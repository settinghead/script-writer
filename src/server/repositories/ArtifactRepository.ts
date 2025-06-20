import { Kysely, sql } from 'kysely';
import { v4 as uuidv4 } from 'uuid';
import { Artifact, validateArtifactData } from '../types/artifacts';
import type { DB } from '../database/types';

export class ArtifactRepository {
    constructor(private db: Kysely<DB>) { }

    // Create a new artifact
    async createArtifact(
        projectId: string,
        type: string,
        data: any,
        typeVersion: string = 'v1',
        metadata?: any
    ): Promise<Artifact> {
        // Validate artifact data
        if (!validateArtifactData(type, typeVersion, data)) {
            throw new Error(`Invalid data for artifact type ${type}:${typeVersion}`);
        }

        const id = uuidv4();
        const now = new Date();

        const artifactData = {
            id,
            project_id: projectId,
            type,
            type_version: typeVersion,
            data: JSON.stringify(data),
            metadata: metadata ? JSON.stringify(metadata) : null,
            created_at: now,
            updated_at: now
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

    // Update artifact data
    async updateArtifact(artifactId: string, data: any, metadata?: any): Promise<void> {
        const updateData: any = {
            data: JSON.stringify(data),
            updated_at: new Date()
        };

        if (metadata !== undefined) {
            updateData.metadata = metadata ? JSON.stringify(metadata) : null;
        }

        await this.db
            .updateTable('artifacts')
            .set(updateData)
            .where('id', '=', artifactId)
            .execute();
    }

    // Update artifact streaming status and progress
    async updateArtifactStreamingStatus(
        artifactId: string, 
        status: string, 
        progress?: number, 
        partialData?: any
    ): Promise<void> {
        const updateData: any = {
            streaming_status: status,
            updated_at: new Date()
        };

        if (progress !== undefined) {
            updateData.streaming_progress = progress.toString();
        }

        if (partialData !== undefined) {
            updateData.partial_data = JSON.stringify(partialData);
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
} 