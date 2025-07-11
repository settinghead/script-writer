import { Kysely, sql } from 'kysely';
import { v4 as uuidv4 } from 'uuid';
import { Artifact, validateArtifactData } from '../../common/artifacts';
import type { DB } from '../database/types';
import { buildLineageGraph, findLatestArtifact } from '../../common/transform-artifact-framework/lineageResolution';
import type { ElectricArtifact, ElectricTransform, ElectricHumanTransform, ElectricTransformInput, ElectricTransformOutput, TypedArtifact } from '../../common/types';

export class ArtifactRepository {
    constructor(private db: Kysely<DB>) { }

    // Create a new artifact
    async createArtifact(
        projectId: string,
        schemaType: TypedArtifact['schema_type'],
        data: any,
        schemaVersion: TypedArtifact['schema_version'],
        metadata: any | undefined,
        streamingStatus: string,
        originType: 'ai_generated' | 'user_input',
        initialInput: boolean = false
    ): Promise<Artifact> {
        // Skip validation for initial brainstorm input artifacts
        const shouldSkipValidation = schemaType === 'brainstorm_input_params' && initialInput;

        // Only validate completed artifacts, skip validation during streaming or for initial brainstorm inputs
        if (streamingStatus === 'completed' && !shouldSkipValidation && !validateArtifactData(schemaType, schemaVersion, data)) {
            console.error(`Invalid data for artifact schemaType ${schemaType}:${schemaVersion}`);
            console.error("data:", data);
            throw new Error(`Invalid data for artifact schemaType ${schemaType}:${schemaVersion}`);
        }

        const id = uuidv4();
        const now = new Date();

        const artifactData = {
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
            .insertInto('artifacts')
            .values(artifactData)
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

    // Get artifact by ID
    async getArtifact(artifactId: string, projectId?: string): Promise<Artifact | null> {
        let query = this.db
            .selectFrom('artifacts')
            .selectAll()
            .where('id', '=', artifactId);

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

    // Get artifacts by type for a project
    async getArtifactsByType(
        projectId: string,
        schemaType: TypedArtifact['schema_type'],
        schemaVersion?: TypedArtifact['schema_version']
    ): Promise<Artifact[]> {
        let query = this.db
            .selectFrom('artifacts')
            .selectAll()
            .where('project_id', '=', projectId)
            .where('schema_type', '=', schemaType);

        if (schemaVersion) {
            query = query.where('schema_version', '=', schemaVersion);
        }

        const rows = await query
            .orderBy('created_at', 'desc')
            .execute();

        return rows.map(row => this.rowToArtifact(row));
    }

    // Get all artifacts for a project
    async getProjectArtifacts(projectId: string, limit: number = 50): Promise<Artifact[]> {
        let query = this.db
            .selectFrom('artifacts')
            .selectAll()
            .where('project_id', '=', projectId)
            .orderBy('created_at', 'desc');

        if (limit) {
            query = query.limit(limit);
        }

        const rows = await query.execute();

        return rows.map(row => this.rowToArtifact(row));
    }

    // Get artifacts by IDs for a specific project
    async getArtifactsByIds(artifactIds: string[], projectId?: string): Promise<Artifact[]> {
        let query = this.db
            .selectFrom('artifacts')
            .selectAll()
            .where('id', 'in', artifactIds);

        if (projectId) {
            query = query.where('project_id', '=', projectId);
        }

        const rows = await query.execute();

        return rows.map(row => this.rowToArtifact(row));
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

    // Check if user has access to an artifact (via project membership)
    async userHasArtifactAccess(userId: string, artifactId: string): Promise<boolean> {
        const artifact = await this.db
            .selectFrom('artifacts')
            .select('project_id')
            .where('id', '=', artifactId)
            .executeTakeFirst();

        if (!artifact) {
            return false; // Artifact doesn't exist
        }

        return this.userHasProjectAccess(userId, artifact.project_id);
    }

    // Get artifacts by type for a specific project
    async getProjectArtifactsByType(projectId: string, schemaType: TypedArtifact['schema_type'], limit: number = 20): Promise<Artifact[]> {
        const rows = await this.db
            .selectFrom('artifacts')
            .selectAll()
            .where('project_id', '=', projectId)
            .where('schema_type', '=', schemaType)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .execute();

        return rows.map(row => this.rowToArtifact(row));
    }

    // Get artifacts by type for a specific session
    async getArtifactsByTypeForSession(
        projectId: string,
        schemaType: TypedArtifact['schema_type'],
        sessionId: string,
    ): Promise<Artifact[]> {
        let query = this.db
            .selectFrom('artifacts as a')
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

        return rows.map(row => this.rowToArtifact(row));
    }

    // Get latest user input for a session (ideation or outline)
    async getLatestUserInputForSession(
        projectId: string,
        sessionId: string
    ): Promise<Artifact | null> {
        const row = await this.db
            .selectFrom('artifacts as a')
            .innerJoin('transform_inputs as ti', 'a.id', 'ti.artifact_id')
            .innerJoin('transforms as t', 'ti.transform_id', 't.id')
            .innerJoin('transform_inputs as ti2', 't.id', 'ti2.transform_id')
            .innerJoin('artifacts as session_a', 'ti2.artifact_id', 'session_a.id')
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

        return this.rowToArtifact(row);
    }

    // Delete artifact (should be rare since artifacts are immutable)
    async deleteArtifact(artifactId: string, projectId?: string): Promise<boolean> {
        let query = this.db
            .deleteFrom('artifacts')
            .where('id', '=', artifactId);

        if (projectId) {
            query = query.where('project_id', '=', projectId);
        }

        const result = await query.execute();

        return result.length > 0 && Number(result[0].numDeletedRows) > 0;
    }

    async updateArtifact(artifactId: string, data: any, metadata?: any, streamingStatus?: string): Promise<void> {
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
            .updateTable('artifacts')
            .set(updateData)
            .where('id', '=', artifactId)
            .execute();
    }

    // Get all artifacts for a user (legacy method for backward compatibility)
    async getUserArtifacts(userId: string, limit?: number): Promise<Artifact[]> {
        // In the new project-based system, we need to get artifacts for all user's projects
        // Use the projects_users junction table to find user's projects
        let query = this.db
            .selectFrom('artifacts')
            .innerJoin('projects_users', 'artifacts.project_id', 'projects_users.project_id')
            .select(['artifacts.id', 'artifacts.project_id', 'artifacts.schema_type', 'artifacts.schema_version', 'artifacts.data', 'artifacts.metadata', 'artifacts.created_at'])
            .where('projects_users.user_id', '=', userId)
            .orderBy('artifacts.created_at', 'desc');

        if (limit) {
            query = query.limit(limit);
        }

        const rows = await query.execute();

        return rows.map(row => this.rowToArtifact(row));
    }

    /**
     * Get the latest brainstorm ideas for a project using lineage resolution
     * This ensures we get the most recent versions of each idea, not duplicates from editing
     */
    async getLatestBrainstormIdeas(projectId: string): Promise<Artifact[]> {
        try {
            // Get all project data needed for lineage resolution
            const artifacts = await this.getAllProjectArtifactsForLineage(projectId);
            const transforms = await this.getAllProjectTransformsForLineage(projectId);
            const humanTransforms = await this.getAllProjectHumanTransformsForLineage(projectId);
            const transformInputs = await this.getAllProjectTransformInputsForLineage(projectId);
            const transformOutputs = await this.getAllProjectTransformOutputsForLineage(projectId);

            // Build the lineage graph
            const graph = buildLineageGraph(
                artifacts,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs
            );

            // Get all brainstorm_idea artifacts
            const allBrainstormIdeas = artifacts.filter(a => a.schema_type === 'brainstorm_idea');

            // Resolve each to its latest version
            const latestArtifactIds = new Set<string>();
            const resolvedArtifacts: Artifact[] = [];

            for (const idea of allBrainstormIdeas) {
                const result = findLatestArtifact(idea.id, undefined, graph);

                if (result.artifactId && !latestArtifactIds.has(result.artifactId)) {
                    latestArtifactIds.add(result.artifactId);

                    // Find the actual artifact data
                    const latestArtifact = artifacts.find(a => a.id === result.artifactId);
                    if (latestArtifact && latestArtifact.schema_type === 'brainstorm_idea') {
                        resolvedArtifacts.push(this.rowToArtifact({
                            ...latestArtifact,
                        }));
                    }
                }
            }

            // Sort by creation time (newest first)
            resolvedArtifacts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            return resolvedArtifacts;

        } catch (error) {
            console.error('Error getting latest brainstorm ideas:', error);
            // Fallback to regular method if lineage resolution fails
            return this.getProjectArtifactsByType(projectId, 'brainstorm_idea');
        }
    }

    /**
     * Helper methods to get all project data in Electric format for lineage resolution
     */
    public async getAllProjectArtifactsForLineage(projectId: string): Promise<ElectricArtifact[]> {
        const rows = await this.db
            .selectFrom('artifacts')
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
            source_artifact_id: row.source_artifact_id || undefined,
            derivation_path: row.derivation_path || '',
            derived_artifact_id: row.derived_artifact_id || undefined,
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
            artifact_id: row.artifact_id,
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
            artifact_id: row.artifact_id,
            project_id: row.project_id
        }));
    }


    // Helper to convert database row to Artifact with all required fields
    private rowToArtifact(row: any): Artifact {
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