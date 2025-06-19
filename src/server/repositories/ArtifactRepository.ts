import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { Artifact, validateArtifactData } from '../types/artifacts';

export class ArtifactRepository {
    constructor(private db: Knex) { }

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
        const now = new Date().toISOString();

        const artifactData = {
            id,
            project_id: projectId,
            type,
            type_version: typeVersion,
            data: JSON.stringify(data),
            metadata: JSON.stringify(metadata),
            created_at: now
        };

        await this.db('artifacts').insert(artifactData);

        return {
            id,
            project_id: projectId,
            type,
            type_version: typeVersion,
            data,
            metadata,
            created_at: now
        };
    }

    // Get artifact by ID
    async getArtifact(artifactId: string, projectId?: string): Promise<Artifact | null> {
        let query = this.db('artifacts').where('id', artifactId);

        if (projectId) {
            query = query.where('project_id', projectId);
        }

        const row = await query.first();

        if (!row) {
            return null;
        }

        return {
            ...row,
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null
        };
    }

    // Get artifacts by type for a project
    async getArtifactsByType(
        projectId: string,
        type: string,
        typeVersion?: string
    ): Promise<Artifact[]> {
        let query = this.db('artifacts')
            .where('project_id', projectId)
            .where('type', type);

        if (typeVersion) {
            query = query.where('type_version', typeVersion);
        }

        const rows = await query.orderBy('created_at', 'desc');

        const artifacts = rows.map(row => ({
            ...row,
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null
        }));

        return artifacts;
    }

    // Get all artifacts for a project
    async getProjectArtifacts(projectId: string, limit: number = 50): Promise<Artifact[]> {
        let query = this.db('artifacts')
            .where('project_id', projectId)
            .orderBy('created_at', 'desc');

        if (limit) {
            query = query.limit(limit);
        }

        const rows = await query;

        const artifacts = rows.map(row => ({
            ...row,
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null
        }));

        return artifacts;
    }

    // Get artifacts by IDs for a specific project
    async getArtifactsByIds(artifactIds: string[], projectId?: string): Promise<Artifact[]> {
        let query = this.db
            .select('*')
            .from('artifacts')
            .whereIn('id', artifactIds);

        if (projectId) {
            query = query.andWhere('project_id', projectId);
        }

        const artifacts = await query;

        return artifacts.map(row => ({
            id: row.id,
            project_id: row.project_id,
            type: row.type,
            type_version: row.type_version,
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            created_at: row.created_at
        }));
    }

    // Get artifacts by type for a specific project
    async getProjectArtifactsByType(projectId: string, type: string, limit: number = 20): Promise<Artifact[]> {
        const artifacts = await this.db
            .select('*')
            .from('artifacts')
            .where('project_id', projectId)
            .andWhere('type', type)
            .orderBy('created_at', 'desc')
            .limit(limit);

        return artifacts.map(row => ({
            id: row.id,
            project_id: row.project_id,
            type: row.type,
            type_version: row.type_version,
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            created_at: row.created_at
        }));
    }

    // Get artifacts by type for a specific session
    async getArtifactsByTypeForSession(
        projectId: string,
        type: string,
        sessionId: string,
        typeVersion?: string
    ): Promise<Artifact[]> {
        let query = this.db('artifacts as a')
            .where('a.project_id', projectId)
            .where('a.type', type)
            .where(function () {
                this.whereRaw("JSON_EXTRACT(a.data, '$.id') = ?", [sessionId])
                    .orWhereRaw("JSON_EXTRACT(a.data, '$.ideation_session_id') = ?", [sessionId])
                    .orWhereRaw("JSON_EXTRACT(a.data, '$.outline_session_id') = ?", [sessionId]);
            });

        if (typeVersion) {
            query = query.where('a.type_version', typeVersion);
        }

        const rows = await query.orderBy('a.created_at', 'desc');

        const artifacts = rows.map(row => ({
            ...row,
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null
        }));

        return artifacts;
    }

    // Get latest user input for a session (ideation or outline)
    async getLatestUserInputForSession(
        projectId: string,
        sessionId: string
    ): Promise<Artifact | null> {
        const row = await this.db('artifacts as a')
            .join('transform_inputs as ti', 'a.id', 'ti.artifact_id')
            .join('transforms as t', 'ti.transform_id', 't.id')
            .join('transform_inputs as ti2', 't.id', 'ti2.transform_id')
            .join('artifacts as session_a', 'ti2.artifact_id', 'session_a.id')
            .where('a.project_id', projectId)
            .where('a.type', 'user_input')
            .where(function () {
                this.whereRaw("JSON_EXTRACT(session_a.data, '$.id') = ?", [sessionId])
                    .orWhereRaw("JSON_EXTRACT(session_a.data, '$.ideation_session_id') = ?", [sessionId]);
            })
            .select('a.*')
            .distinct()
            .orderBy('a.created_at', 'desc')
            .first();

        if (!row) {
            return null;
        }

        return {
            ...row,
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null
        };
    }

    // Delete artifact (should be rare since artifacts are immutable)
    async deleteArtifact(artifactId: string, projectId: string): Promise<boolean> {
        const deletedCount = await this.db('artifacts')
            .where('id', artifactId)
            .where('project_id', projectId)
            .del();

        return deletedCount > 0;
    }

    // Update artifact data
    async updateArtifact(artifactId: string, data: any, metadata?: any): Promise<void> {
        const updateData: any = {
            data: JSON.stringify(data)
        };

        if (metadata !== undefined) {
            updateData.metadata = metadata ? JSON.stringify(metadata) : null;
        }

        await this.db('artifacts')
            .where('id', artifactId)
            .update(updateData);
    }

    // Get all artifacts for a user (legacy method for backward compatibility)
    async getUserArtifacts(userId: string, limit?: number): Promise<Artifact[]> {
        // In the new project-based system, we need to get artifacts for all user's projects
        // Use the projects_users junction table to find user's projects
        let query = this.db('artifacts')
            .join('projects_users', 'artifacts.project_id', 'projects_users.project_id')
            .where('projects_users.user_id', userId)
            .select('artifacts.*')
            .orderBy('artifacts.created_at', 'desc');

        if (limit) {
            query = query.limit(limit);
        }

        const rows = await query;

        return rows.map(row => ({
            id: row.id,
            project_id: row.project_id,
            type: row.type,
            type_version: row.type_version,
            data: JSON.parse(row.data),
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            created_at: row.created_at
        }));
    }
} 