import { Kysely, sql } from 'kysely';
import { v4 as uuidv4 } from 'uuid';
import { Jsondoc, validateJsondocData } from '../../common/jsondocs';
import type { DB } from '../database/types';
import { buildLineageGraph, findLatestJsondoc } from '../../common/transform-jsondoc-framework/lineageResolution';
import type { ElectricJsondoc, ElectricTransform, ElectricHumanTransform, ElectricTransformInput, ElectricTransformOutput, TypedJsondoc } from '../../common/types';

export class JsondocRepository {
    constructor(private db: Kysely<DB>) { }

    // Create a new jsondoc
    async createJsondoc(
        projectId: string,
        schemaType: TypedJsondoc['schema_type'],
        data: any,
        schemaVersion: TypedJsondoc['schema_version'],
        metadata: any | undefined,
        streamingStatus: string,
        originType: 'ai_generated' | 'user_input',
        initialInput: boolean = false
    ): Promise<Jsondoc> {
        // Skip validation for initial brainstorm input jsondocs
        const shouldSkipValidation = schemaType === 'brainstorm_input_params' && initialInput;

        // Only validate completed jsondocs, skip validation during streaming or for initial brainstorm inputs
        if (streamingStatus === 'completed' && !shouldSkipValidation && !validateJsondocData(schemaType, schemaVersion, data)) {
            console.error(`Invalid data for jsondoc schemaType ${schemaType}:${schemaVersion}`);
            console.error("data:", data);
            throw new Error(`Invalid data for jsondoc schemaType ${schemaType}:${schemaVersion}`);
        }

        const id = uuidv4();
        const now = new Date();

        const jsondocData = {
            id,
            project_id: projectId,

            // NEW: Schema and origin types
            schema_type: schemaType,
            schema_version: schemaVersion,
            origin_type: originType,


            data: JSON.stringify(data),
            metadata: metadata ? JSON.stringify(metadata) : null,
            streaming_status: streamingStatus,
            created_at: now
        };

        await this.db
            .insertInto('jsondocs')
            .values(jsondocData)
            .execute();

        return {
            id,
            project_id: projectId,
            schema_type: schemaType,
            schema_version: schemaVersion,
            origin_type: originType,
            data,
            metadata,
            created_at: now.toISOString()
        };
    }

    // Get jsondoc by ID
    async getJsondoc(jsondocId: string, projectId?: string): Promise<Jsondoc | null> {
        let query = this.db
            .selectFrom('jsondocs')
            .selectAll()
            .where('id', '=', jsondocId);

        if (projectId) {
            query = query.where('project_id', '=', projectId);
        }

        const row = await query.executeTakeFirst();

        if (!row) {
            return null;
        }

        return {
            id: row.id,
            project_id: row.project_id,
            schema_type: row.schema_type,
            schema_version: row.schema_version,
            origin_type: row.origin_type as 'ai_generated' | 'user_input',
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString()
        };
    }

    // Get jsondocs by type for a project
    async getJsondocsByType(
        projectId: string,
        schemaType: TypedJsondoc['schema_type'],
        schemaVersion?: TypedJsondoc['schema_version']
    ): Promise<Jsondoc[]> {
        let query = this.db
            .selectFrom('jsondocs')
            .selectAll()
            .where('project_id', '=', projectId)
            .where('schema_type', '=', schemaType);

        if (schemaVersion) {
            query = query.where('schema_version', '=', schemaVersion);
        }

        const rows = await query
            .orderBy('created_at', 'desc')
            .execute();

        return rows.map(row => this.rowToJsondoc(row));
    }

    // Get all jsondocs for a project
    async getProjectJsondocs(projectId: string, limit: number = 50): Promise<Jsondoc[]> {
        let query = this.db
            .selectFrom('jsondocs')
            .selectAll()
            .where('project_id', '=', projectId)
            .orderBy('created_at', 'desc');

        if (limit) {
            query = query.limit(limit);
        }

        const rows = await query.execute();

        return rows.map(row => this.rowToJsondoc(row));
    }

    // Get jsondocs by IDs for a specific project
    async getJsondocsByIds(jsondocIds: string[], projectId?: string): Promise<Jsondoc[]> {
        let query = this.db
            .selectFrom('jsondocs')
            .selectAll()
            .where('id', 'in', jsondocIds);

        if (projectId) {
            query = query.where('project_id', '=', projectId);
        }

        const rows = await query.execute();

        return rows.map(row => this.rowToJsondoc(row));
    }

    // Check if user has access to a project
    async userHasProjectAccess(userId: string, projectId: string): Promise<boolean> {
        const result = await this.db
            .selectFrom('projects_users')
            .select('id')
            .where('user_id', '=', userId)
            .where('project_id', '=', projectId)
            .executeTakeFirst();

        return !!result;
    }

    // Check if user has access to an jsondoc (via project membership)
    async userHasJsondocAccess(userId: string, jsondocId: string): Promise<boolean> {
        const jsondoc = await this.db
            .selectFrom('jsondocs')
            .select('project_id')
            .where('id', '=', jsondocId)
            .executeTakeFirst();

        if (!jsondoc) {
            return false; // Jsondoc doesn't exist
        }

        return this.userHasProjectAccess(userId, jsondoc.project_id);
    }

    // Get jsondocs by type for a specific project
    async getProjectJsondocsByType(projectId: string, schemaType: TypedJsondoc['schema_type'], limit: number = 20): Promise<Jsondoc[]> {
        const rows = await this.db
            .selectFrom('jsondocs')
            .selectAll()
            .where('project_id', '=', projectId)
            .where('schema_type', '=', schemaType)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .execute();

        return rows.map(row => this.rowToJsondoc(row));
    }

    // Get jsondocs by type for a specific session
    async getJsondocsByTypeForSession(
        projectId: string,
        schemaType: TypedJsondoc['schema_type'],
        sessionId: string,
    ): Promise<Jsondoc[]> {
        let query = this.db
            .selectFrom('jsondocs as a')
            .selectAll()
            .where('a.project_id', '=', projectId)
            .where('a.schema_type', '=', schemaType)
            .where((eb) =>
                eb.or([
                    eb(sql`a.data->>'id'`, '=', sessionId),
                    eb(sql`a.data->>'ideation_session_id'`, '=', sessionId),
                    eb(sql`a.data->>'outline_session_id'`, '=', sessionId)
                ])
            );

        const rows = await query
            .orderBy('a.created_at', 'desc')
            .execute();

        return rows.map(row => this.rowToJsondoc(row));
    }

    // Get latest user input for a session (ideation or outline)
    async getLatestUserInputForSession(
        projectId: string,
        sessionId: string
    ): Promise<Jsondoc | null> {
        const row = await this.db
            .selectFrom('jsondocs as a')
            .innerJoin('transform_inputs as ti', 'a.id', 'ti.jsondoc_id')
            .innerJoin('transforms as t', 'ti.transform_id', 't.id')
            .innerJoin('transform_inputs as ti2', 't.id', 'ti2.transform_id')
            .innerJoin('jsondocs as session_a', 'ti2.jsondoc_id', 'session_a.id')
            .select(['a.id', 'a.project_id', 'a.schema_type', 'a.schema_version', 'a.data', 'a.metadata', 'a.created_at'])
            .where('a.project_id', '=', projectId)
            .where('a.origin_type', '=', 'user_input')
            .where((eb) =>
                eb.or([
                    eb(sql`session_a.data->>'id'`, '=', sessionId),
                    eb(sql`session_a.data->>'ideation_session_id'`, '=', sessionId)
                ])
            )
            .orderBy('a.created_at', 'desc')
            .executeTakeFirst();

        if (!row) {
            return null;
        }

        return this.rowToJsondoc(row);
    }

    // Delete jsondoc (should be rare since jsondocs are immutable)
    async deleteJsondoc(jsondocId: string, projectId?: string): Promise<boolean> {
        let query = this.db
            .deleteFrom('jsondocs')
            .where('id', '=', jsondocId);

        if (projectId) {
            query = query.where('project_id', '=', projectId);
        }

        const result = await query.execute();

        return result.length > 0 && Number(result[0].numDeletedRows) > 0;
    }

    async updateJsondoc(jsondocId: string, data: any, metadata?: any, streamingStatus?: string): Promise<void> {
        const updateData: any = {
            data: JSON.stringify(data)
        };

        if (metadata !== undefined) {
            updateData.metadata = metadata ? JSON.stringify(metadata) : null;
        }

        if (streamingStatus !== undefined) {
            updateData.streaming_status = streamingStatus;
        }

        await this.db
            .updateTable('jsondocs')
            .set(updateData)
            .where('id', '=', jsondocId)
            .execute();
    }

    // Get all jsondocs for a user (legacy method for backward compatibility)
    async getUserJsondocs(userId: string, limit?: number): Promise<Jsondoc[]> {
        // In the new project-based system, we need to get jsondocs for all user's projects
        // Use the projects_users junction table to find user's projects
        let query = this.db
            .selectFrom('jsondocs')
            .innerJoin('projects_users', 'jsondocs.project_id', 'projects_users.project_id')
            .select(['jsondocs.id', 'jsondocs.project_id', 'jsondocs.schema_type', 'jsondocs.schema_version', 'jsondocs.data', 'jsondocs.metadata', 'jsondocs.created_at'])
            .where('projects_users.user_id', '=', userId)
            .orderBy('jsondocs.created_at', 'desc');

        if (limit) {
            query = query.limit(limit);
        }

        const rows = await query.execute();

        return rows.map(row => this.rowToJsondoc(row));
    }

    /**
     * Get the latest brainstorm ideas for a project using lineage resolution
     * This ensures we get the most recent versions of each idea, not duplicates from editing
     */
    async getLatestBrainstormIdeas(projectId: string): Promise<Jsondoc[]> {
        try {
            // Get all project data needed for lineage resolution
            const jsondocs = await this.getAllProjectJsondocsForLineage(projectId);
            const transforms = await this.getAllProjectTransformsForLineage(projectId);
            const humanTransforms = await this.getAllProjectHumanTransformsForLineage(projectId);
            const transformInputs = await this.getAllProjectTransformInputsForLineage(projectId);
            const transformOutputs = await this.getAllProjectTransformOutputsForLineage(projectId);

            // Build the lineage graph
            const graph = buildLineageGraph(
                jsondocs,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs
            );

            // Get all brainstorm_idea jsondocs
            const allBrainstormIdeas = jsondocs.filter(a => a.schema_type === 'brainstorm_idea');

            // Resolve each to its latest version
            const latestJsondocIds = new Set<string>();
            const resolvedJsondocs: Jsondoc[] = [];

            for (const idea of allBrainstormIdeas) {
                const result = findLatestJsondoc(idea.id, undefined, graph);

                if (result.jsondocId && !latestJsondocIds.has(result.jsondocId)) {
                    latestJsondocIds.add(result.jsondocId);

                    // Find the actual jsondoc data
                    const latestJsondoc = jsondocs.find(a => a.id === result.jsondocId);
                    if (latestJsondoc && latestJsondoc.schema_type === 'brainstorm_idea') {
                        resolvedJsondocs.push(this.rowToJsondoc({
                            ...latestJsondoc,
                        }));
                    }
                }
            }

            // Sort by creation time (newest first)
            resolvedJsondocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            return resolvedJsondocs;

        } catch (error) {
            console.error('Error getting latest brainstorm ideas:', error);
            // Fallback to regular method if lineage resolution fails
            return this.getProjectJsondocsByType(projectId, 'brainstorm_idea');
        }
    }

    /**
     * Helper methods to get all project data in Electric format for lineage resolution
     */
    public async getAllProjectJsondocsForLineage(projectId: string): Promise<ElectricJsondoc[]> {
        const rows = await this.db
            .selectFrom('jsondocs')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            schema_type: row.schema_type,
            schema_version: row.schema_version,
            data: row.data, // Keep as string for Electric format
            metadata: row.metadata || undefined,
            created_at: row.created_at?.toISOString() || new Date().toISOString(),
            streaming_status: row.streaming_status as 'streaming' | 'completed' | 'failed' | 'cancelled' | undefined,
            // NEW: Include schema and origin type fields
            origin_type: (row.origin_type as 'ai_generated' | 'user_input') || 'ai_generated'
        }));
    }

    public async getAllProjectTransformsForLineage(projectId: string): Promise<ElectricTransform[]> {
        const rows = await this.db
            .selectFrom('transforms')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            type: row.type as 'llm' | 'human',
            type_version: row.type_version,
            status: row.status || 'completed',
            retry_count: row.retry_count || 0,
            max_retries: row.max_retries || 3,
            execution_context: row.execution_context || undefined,
            created_at: row.created_at?.toISOString() || new Date().toISOString(),
            updated_at: row.updated_at?.toISOString() || new Date().toISOString(),
            streaming_status: row.streaming_status || undefined,
            progress_percentage: row.progress_percentage ? Number(row.progress_percentage) : undefined,
            error_message: row.error_message || undefined
        }));
    }

    public async getAllProjectHumanTransformsForLineage(projectId: string): Promise<ElectricHumanTransform[]> {
        const rows = await this.db
            .selectFrom('human_transforms')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        return rows.map(row => ({
            transform_id: row.transform_id,
            project_id: row.project_id,
            action_type: row.action_type,
            interface_context: row.interface_context || undefined,
            change_description: row.change_description || undefined,
            source_jsondoc_id: row.source_jsondoc_id || undefined,
            derivation_path: row.derivation_path || '',
            derived_jsondoc_id: row.derived_jsondoc_id || undefined,
            transform_name: row.transform_name || undefined
        }));
    }

    public async getAllProjectTransformInputsForLineage(projectId: string): Promise<ElectricTransformInput[]> {
        const rows = await this.db
            .selectFrom('transform_inputs')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        return rows.map(row => ({
            id: row.id,
            transform_id: row.transform_id,
            jsondoc_id: row.jsondoc_id,
            project_id: row.project_id
        }));
    }

    public async getAllProjectTransformOutputsForLineage(projectId: string): Promise<ElectricTransformOutput[]> {
        const rows = await this.db
            .selectFrom('transform_outputs')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        return rows.map(row => ({
            id: row.id,
            transform_id: row.transform_id,
            jsondoc_id: row.jsondoc_id,
            project_id: row.project_id
        }));
    }


    // Helper to convert database row to Jsondoc with all required fields
    private rowToJsondoc(row: any): Jsondoc {
        return {
            id: row.id,
            project_id: row.project_id,
            schema_type: row.schema_type,
            schema_version: row.schema_version,
            origin_type: (row.origin_type as 'ai_generated' | 'user_input') || 'ai_generated',
            data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
            metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString()
        };
    }
} 