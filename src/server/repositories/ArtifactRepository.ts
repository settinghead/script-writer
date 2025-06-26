import { Kysely, sql } from 'kysely';
import { v4 as uuidv4 } from 'uuid';
import { Artifact, validateArtifactData } from '../types/artifacts';
import type { DB } from '../database/types';
import { buildLineageGraph, findLatestArtifact } from '../../common/utils/lineageResolution';
import type { ElectricArtifact, ElectricTransform, ElectricHumanTransform, ElectricTransformInput, ElectricTransformOutput } from '../../common/types';

export class ArtifactRepository {
    constructor(private db: Kysely<DB>) { }

    // Create a new artifact
    async createArtifact(
        projectId: string,
        type: string,
        data: any,
        typeVersion: string,
        metadata: any | undefined,
        streamingStatus: string,
        originType: 'ai_generated' | 'user_input'
    ): Promise<Artifact> {
        // Validate artifact data
        if (!validateArtifactData(type, typeVersion, data)) {
            throw new Error(`Invalid data for artifact type ${type}:${typeVersion}`);
        }

        const id = uuidv4();
        const now = new Date();

        // Map old type names to new schema types for backward compatibility
        const schemaType = this.mapTypeToSchemaType(type);

        const artifactData = {
            id,
            project_id: projectId,

            // NEW: Schema and origin types
            schema_type: schemaType,
            schema_version: typeVersion,
            origin_type: originType,

            // LEGACY: Keep old fields for backward compatibility
            type,
            type_version: typeVersion,

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
            type,
            type_version: typeVersion,
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
            type: row.type,
            type_version: row.type_version,
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString()
        };
    }

    // Get artifacts by type for a project
    async getArtifactsByType(
        projectId: string,
        type: string,
        typeVersion?: string
    ): Promise<Artifact[]> {
        let query = this.db
            .selectFrom('artifacts')
            .selectAll()
            .where('project_id', '=', projectId)
            .where('type', '=', type);

        if (typeVersion) {
            query = query.where('type_version', '=', typeVersion);
        }

        const rows = await query
            .orderBy('created_at', 'desc')
            .execute();

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            type: row.type,
            type_version: row.type_version,
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString()
        }));
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

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            type: row.type,
            type_version: row.type_version,
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString()
        }));
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

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            type: row.type,
            type_version: row.type_version,
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString()
        }));
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

    // Get artifacts by type for a specific project
    async getProjectArtifactsByType(projectId: string, type: string, limit: number = 20): Promise<Artifact[]> {
        const rows = await this.db
            .selectFrom('artifacts')
            .selectAll()
            .where('project_id', '=', projectId)
            .where('type', '=', type)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .execute();

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            type: row.type,
            type_version: row.type_version,
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString()
        }));
    }

    // Get artifacts by type for a specific session
    async getArtifactsByTypeForSession(
        projectId: string,
        type: string,
        sessionId: string,
        typeVersion?: string
    ): Promise<Artifact[]> {
        let query = this.db
            .selectFrom('artifacts as a')
            .selectAll()
            .where('a.project_id', '=', projectId)
            .where('a.type', '=', type)
            .where((eb) =>
                eb.or([
                    eb(sql`a.data->>'id'`, '=', sessionId),
                    eb(sql`a.data->>'ideation_session_id'`, '=', sessionId),
                    eb(sql`a.data->>'outline_session_id'`, '=', sessionId)
                ])
            );

        if (typeVersion) {
            query = query.where('a.type_version', '=', typeVersion);
        }

        const rows = await query
            .orderBy('a.created_at', 'desc')
            .execute();

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            type: row.type,
            type_version: row.type_version,
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString()
        }));
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
            .select(['a.id', 'a.project_id', 'a.type', 'a.type_version', 'a.data', 'a.metadata', 'a.created_at'])
            .where('a.project_id', '=', projectId)
            .where('a.type', '=', 'user_input')
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

        return {
            id: row.id,
            project_id: row.project_id,
            type: row.type,
            type_version: row.type_version,
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString()
        };
    }

    // Delete artifact (should be rare since artifacts are immutable)
    async deleteArtifact(artifactId: string, projectId: string): Promise<boolean> {
        const result = await this.db
            .deleteFrom('artifacts')
            .where('id', '=', artifactId)
            .where('project_id', '=', projectId)
            .execute();

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
            .select(['artifacts.id', 'artifacts.project_id', 'artifacts.type', 'artifacts.type_version', 'artifacts.data', 'artifacts.metadata', 'artifacts.created_at'])
            .where('projects_users.user_id', '=', userId)
            .orderBy('artifacts.created_at', 'desc');

        if (limit) {
            query = query.limit(limit);
        }

        const rows = await query.execute();

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            type: row.type,
            type_version: row.type_version,
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            created_at: row.created_at?.toISOString() || new Date().toISOString()
        }));
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
            const allBrainstormIdeas = artifacts.filter(a => a.type === 'brainstorm_idea');

            // Resolve each to its latest version
            const latestArtifactIds = new Set<string>();
            const resolvedArtifacts: Artifact[] = [];

            for (const idea of allBrainstormIdeas) {
                const result = findLatestArtifact(idea.id, undefined, graph);

                if (result.artifactId && !latestArtifactIds.has(result.artifactId)) {
                    latestArtifactIds.add(result.artifactId);

                    // Find the actual artifact data
                    const latestArtifact = artifacts.find(a => a.id === result.artifactId);
                    if (latestArtifact && latestArtifact.type === 'brainstorm_idea') {
                        resolvedArtifacts.push({
                            id: latestArtifact.id,
                            project_id: latestArtifact.project_id,
                            type: latestArtifact.type,
                            type_version: latestArtifact.type_version as string,
                            data: JSON.parse(latestArtifact.data as string), // Parse the data for return
                            metadata: latestArtifact.metadata ? JSON.parse(latestArtifact.metadata as string) : null,
                            created_at: latestArtifact.created_at
                        });
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
    private async getAllProjectArtifactsForLineage(projectId: string): Promise<ElectricArtifact[]> {
        const rows = await this.db
            .selectFrom('artifacts')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            type: row.type,
            type_version: row.type_version,
            data: row.data, // Keep as string for Electric format
            metadata: row.metadata || undefined,
            created_at: row.created_at?.toISOString() || new Date().toISOString(),
            streaming_status: row.streaming_status as 'streaming' | 'completed' | 'failed' | 'cancelled' | undefined,
            // NEW: Include schema and origin type fields
            schema_type: row.schema_type || this.mapTypeToSchemaType(row.type),
            schema_version: row.schema_version || row.type_version,
            origin_type: (row.origin_type as 'ai_generated' | 'user_input') || 'ai_generated'
        }));
    }

    private async getAllProjectTransformsForLineage(projectId: string): Promise<ElectricTransform[]> {
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

    private async getAllProjectHumanTransformsForLineage(projectId: string): Promise<ElectricHumanTransform[]> {
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

    private async getAllProjectTransformInputsForLineage(projectId: string): Promise<ElectricTransformInput[]> {
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

    private async getAllProjectTransformOutputsForLineage(projectId: string): Promise<ElectricTransformOutput[]> {
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

    // Map legacy type names to new schema types for backward compatibility
    private mapTypeToSchemaType(type: string): string {
        const typeMapping: Record<string, string> = {
            'brainstorm_idea': 'brainstorm_idea_schema',
            'brainstorm_idea_collection': 'brainstorm_collection_schema',
            'user_input': 'user_input_schema',
            'outline_title': 'outline_title_schema',
            'outline_genre': 'outline_genre_schema',
            'outline_selling_points': 'outline_selling_points_schema',
            'outline_setting': 'outline_setting_schema',
            'outline_synopsis': 'outline_synopsis_schema',
            'outline_characters': 'outline_characters_schema',
            'brainstorm_params': 'brainstorm_params_schema',
            'plot_outline': 'plot_outline_schema'
        };

        return typeMapping[type] || `${type}_schema`;
    }
} 