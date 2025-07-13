import { Kysely, sql } from 'kysely';
import { v4 as uuidv4 } from 'uuid';
import { JsonDoc, validateJsonDocData } from '../../common/jsonDocs';
import type { DB } from '../database/types';
import { buildLineageGraph, findLatestJsonDoc } from '../../common/transform-jsonDoc-framework/lineageResolution';
import type { ElectricJsonDoc, ElectricTransform, ElectricHumanTransform, ElectricTransformInput, ElectricTransformOutput, TypedJsonDoc } from '../../common/types';

export class JsonDocRepository {
    constructor(private db: Kysely<DB>) { }

    // Create a new jsonDoc
    async createJsonDoc(
        projectId: string,
        schemaType: TypedJsonDoc['schema_type'],
        data: any,
        schemaVersion: TypedJsonDoc['schema_version'],
        metadata: any | undefined,
        streamingStatus: string,
        originType: 'ai_generated' | 'user_input',
        initialInput: boolean = false
    ): Promise<JsonDoc> {
        // Skip validation for initial brainstorm input jsonDocs
        const shouldSkipValidation = schemaType === 'brainstorm_input_params' && initialInput;

        // Only validate completed jsonDocs, skip validation during streaming or for initial brainstorm inputs
        if (streamingStatus === 'completed' && !shouldSkipValidation && !validateJsonDocData(schemaType, schemaVersion, data)) {
            console.error(`Invalid data for jsonDoc schemaType ${schemaType}:${schemaVersion}`);
            console.error("data:", data);
            throw new Error(`Invalid data for jsonDoc schemaType ${schemaType}:${schemaVersion}`);
        }

        const id = uuidv4();
        const now = new Date();

        const jsonDocData = {
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
            .insertInto('jsonDocs')
            .values(jsonDocData)
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

    // Get jsonDoc by ID
    async getJsonDoc(jsonDocId: string, projectId?: string): Promise<JsonDoc | null> {
        let query = this.db
            .selectFrom('jsonDocs')
            .selectAll()
            .where('id', '=', jsonDocId);

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

    // Get jsonDocs by type for a project
    async getJsonDocsByType(
        projectId: string,
        schemaType: TypedJsonDoc['schema_type'],
        schemaVersion?: TypedJsonDoc['schema_version']
    ): Promise<JsonDoc[]> {
        let query = this.db
            .selectFrom('jsonDocs')
            .selectAll()
            .where('project_id', '=', projectId)
            .where('schema_type', '=', schemaType);

        if (schemaVersion) {
            query = query.where('schema_version', '=', schemaVersion);
        }

        const rows = await query
            .orderBy('created_at', 'desc')
            .execute();

        return rows.map(row => this.rowToJsonDoc(row));
    }

    // Get all jsonDocs for a project
    async getProjectJsonDocs(projectId: string, limit: number = 50): Promise<JsonDoc[]> {
        let query = this.db
            .selectFrom('jsonDocs')
            .selectAll()
            .where('project_id', '=', projectId)
            .orderBy('created_at', 'desc');

        if (limit) {
            query = query.limit(limit);
        }

        const rows = await query.execute();

        return rows.map(row => this.rowToJsonDoc(row));
    }

    // Get jsonDocs by IDs for a specific project
    async getJsonDocsByIds(jsonDocIds: string[], projectId?: string): Promise<JsonDoc[]> {
        let query = this.db
            .selectFrom('jsonDocs')
            .selectAll()
            .where('id', 'in', jsonDocIds);

        if (projectId) {
            query = query.where('project_id', '=', projectId);
        }

        const rows = await query.execute();

        return rows.map(row => this.rowToJsonDoc(row));
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

    // Check if user has access to an jsonDoc (via project membership)
    async userHasJsonDocAccess(userId: string, jsonDocId: string): Promise<boolean> {
        const jsonDoc = await this.db
            .selectFrom('jsonDocs')
            .select('project_id')
            .where('id', '=', jsonDocId)
            .executeTakeFirst();

        if (!jsonDoc) {
            return false; // JsonDoc doesn't exist
        }

        return this.userHasProjectAccess(userId, jsonDoc.project_id);
    }

    // Get jsonDocs by type for a specific project
    async getProjectJsonDocsByType(projectId: string, schemaType: TypedJsonDoc['schema_type'], limit: number = 20): Promise<JsonDoc[]> {
        const rows = await this.db
            .selectFrom('jsonDocs')
            .selectAll()
            .where('project_id', '=', projectId)
            .where('schema_type', '=', schemaType)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .execute();

        return rows.map(row => this.rowToJsonDoc(row));
    }

    // Get jsonDocs by type for a specific session
    async getJsonDocsByTypeForSession(
        projectId: string,
        schemaType: TypedJsonDoc['schema_type'],
        sessionId: string,
    ): Promise<JsonDoc[]> {
        let query = this.db
            .selectFrom('jsonDocs as a')
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

        return rows.map(row => this.rowToJsonDoc(row));
    }

    // Get latest user input for a session (ideation or outline)
    async getLatestUserInputForSession(
        projectId: string,
        sessionId: string
    ): Promise<JsonDoc | null> {
        const row = await this.db
            .selectFrom('jsonDocs as a')
            .innerJoin('transform_inputs as ti', 'a.id', 'ti.jsonDoc_id')
            .innerJoin('transforms as t', 'ti.transform_id', 't.id')
            .innerJoin('transform_inputs as ti2', 't.id', 'ti2.transform_id')
            .innerJoin('jsonDocs as session_a', 'ti2.jsonDoc_id', 'session_a.id')
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

        return this.rowToJsonDoc(row);
    }

    // Delete jsonDoc (should be rare since jsonDocs are immutable)
    async deleteJsonDoc(jsonDocId: string, projectId?: string): Promise<boolean> {
        let query = this.db
            .deleteFrom('jsonDocs')
            .where('id', '=', jsonDocId);

        if (projectId) {
            query = query.where('project_id', '=', projectId);
        }

        const result = await query.execute();

        return result.length > 0 && Number(result[0].numDeletedRows) > 0;
    }

    async updateJsonDoc(jsonDocId: string, data: any, metadata?: any, streamingStatus?: string): Promise<void> {
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
            .updateTable('jsonDocs')
            .set(updateData)
            .where('id', '=', jsonDocId)
            .execute();
    }

    // Get all jsonDocs for a user (legacy method for backward compatibility)
    async getUserJsonDocs(userId: string, limit?: number): Promise<JsonDoc[]> {
        // In the new project-based system, we need to get jsonDocs for all user's projects
        // Use the projects_users junction table to find user's projects
        let query = this.db
            .selectFrom('jsonDocs')
            .innerJoin('projects_users', 'jsonDocs.project_id', 'projects_users.project_id')
            .select(['jsonDocs.id', 'jsonDocs.project_id', 'jsonDocs.schema_type', 'jsonDocs.schema_version', 'jsonDocs.data', 'jsonDocs.metadata', 'jsonDocs.created_at'])
            .where('projects_users.user_id', '=', userId)
            .orderBy('jsonDocs.created_at', 'desc');

        if (limit) {
            query = query.limit(limit);
        }

        const rows = await query.execute();

        return rows.map(row => this.rowToJsonDoc(row));
    }

    /**
     * Get the latest brainstorm ideas for a project using lineage resolution
     * This ensures we get the most recent versions of each idea, not duplicates from editing
     */
    async getLatestBrainstormIdeas(projectId: string): Promise<JsonDoc[]> {
        try {
            // Get all project data needed for lineage resolution
            const jsonDocs = await this.getAllProjectJsonDocsForLineage(projectId);
            const transforms = await this.getAllProjectTransformsForLineage(projectId);
            const humanTransforms = await this.getAllProjectHumanTransformsForLineage(projectId);
            const transformInputs = await this.getAllProjectTransformInputsForLineage(projectId);
            const transformOutputs = await this.getAllProjectTransformOutputsForLineage(projectId);

            // Build the lineage graph
            const graph = buildLineageGraph(
                jsonDocs,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs
            );

            // Get all brainstorm_idea jsonDocs
            const allBrainstormIdeas = jsonDocs.filter(a => a.schema_type === 'brainstorm_idea');

            // Resolve each to its latest version
            const latestJsonDocIds = new Set<string>();
            const resolvedJsonDocs: JsonDoc[] = [];

            for (const idea of allBrainstormIdeas) {
                const result = findLatestJsonDoc(idea.id, undefined, graph);

                if (result.jsonDocId && !latestJsonDocIds.has(result.jsonDocId)) {
                    latestJsonDocIds.add(result.jsonDocId);

                    // Find the actual jsonDoc data
                    const latestJsonDoc = jsonDocs.find(a => a.id === result.jsonDocId);
                    if (latestJsonDoc && latestJsonDoc.schema_type === 'brainstorm_idea') {
                        resolvedJsonDocs.push(this.rowToJsonDoc({
                            ...latestJsonDoc,
                        }));
                    }
                }
            }

            // Sort by creation time (newest first)
            resolvedJsonDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            return resolvedJsonDocs;

        } catch (error) {
            console.error('Error getting latest brainstorm ideas:', error);
            // Fallback to regular method if lineage resolution fails
            return this.getProjectJsonDocsByType(projectId, 'brainstorm_idea');
        }
    }

    /**
     * Helper methods to get all project data in Electric format for lineage resolution
     */
    public async getAllProjectJsonDocsForLineage(projectId: string): Promise<ElectricJsonDoc[]> {
        const rows = await this.db
            .selectFrom('jsonDocs')
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
            source_jsonDoc_id: row.source_jsonDoc_id || undefined,
            derivation_path: row.derivation_path || '',
            derived_jsonDoc_id: row.derived_jsonDoc_id || undefined,
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
            jsonDoc_id: row.jsonDoc_id,
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
            jsonDoc_id: row.jsonDoc_id,
            project_id: row.project_id
        }));
    }


    // Helper to convert database row to JsonDoc with all required fields
    private rowToJsonDoc(row: any): JsonDoc {
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