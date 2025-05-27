import * as sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { Artifact, validateArtifactData } from '../types/artifacts';

export class ArtifactRepository {
    constructor(private db: sqlite3.Database) { }

    // Create a new artifact
    async createArtifact(
        userId: string,
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

        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
        INSERT INTO artifacts (id, user_id, type, type_version, data, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

            stmt.run(
                [id, userId, type, typeVersion, JSON.stringify(data), JSON.stringify(metadata), now],
                function (err) {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve({
                        id,
                        user_id: userId,
                        type,
                        type_version: typeVersion,
                        data,
                        metadata,
                        created_at: now
                    });
                }
            );

            stmt.finalize();
        });
    }

    // Get artifact by ID
    async getArtifact(artifactId: string, userId?: string): Promise<Artifact | null> {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM artifacts WHERE id = ?';
            let params = [artifactId];

            if (userId) {
                query += ' AND user_id = ?';
                params.push(userId);
            }

            this.db.get(query, params, (err, row: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!row) {
                    resolve(null);
                    return;
                }

                resolve({
                    ...row,
                    data: JSON.parse(row.data),
                    metadata: row.metadata ? JSON.parse(row.metadata) : null
                });
            });
        });
    }

    // Get artifacts by type for a user
    async getArtifactsByType(
        userId: string,
        type: string,
        typeVersion?: string
    ): Promise<Artifact[]> {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM artifacts WHERE user_id = ? AND type = ?';
            let params = [userId, type];

            if (typeVersion) {
                query += ' AND type_version = ?';
                params.push(typeVersion);
            }

            query += ' ORDER BY created_at DESC';

            this.db.all(query, params, (err, rows: any[]) => {
                if (err) {
                    reject(err);
                    return;
                }

                const artifacts = rows.map(row => ({
                    ...row,
                    data: JSON.parse(row.data),
                    metadata: row.metadata ? JSON.parse(row.metadata) : null
                }));

                resolve(artifacts);
            });
        });
    }

    // Get all artifacts for a user
    async getUserArtifacts(userId: string, limit?: number): Promise<Artifact[]> {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM artifacts WHERE user_id = ? ORDER BY created_at DESC';
            let params = [userId];

            if (limit) {
                query += ' LIMIT ?';
                params.push(limit.toString());
            }

            this.db.all(query, params, (err, rows: any[]) => {
                if (err) {
                    reject(err);
                    return;
                }

                const artifacts = rows.map(row => ({
                    ...row,
                    data: JSON.parse(row.data),
                    metadata: row.metadata ? JSON.parse(row.metadata) : null
                }));

                resolve(artifacts);
            });
        });
    }

    // Get artifacts by IDs
    async getArtifactsByIds(artifactIds: string[], userId?: string): Promise<Artifact[]> {
        if (artifactIds.length === 0) return [];

        return new Promise((resolve, reject) => {
            const placeholders = artifactIds.map(() => '?').join(',');
            let query = `SELECT * FROM artifacts WHERE id IN (${placeholders})`;
            let params = [...artifactIds];

            if (userId) {
                query += ' AND user_id = ?';
                params.push(userId);
            }

            query += ' ORDER BY created_at ASC';

            this.db.all(query, params, (err, rows: any[]) => {
                if (err) {
                    reject(err);
                    return;
                }

                const artifacts = rows.map(row => ({
                    ...row,
                    data: JSON.parse(row.data),
                    metadata: row.metadata ? JSON.parse(row.metadata) : null
                }));

                resolve(artifacts);
            });
        });
    }

    // Get artifacts by type for a specific session
    async getArtifactsByTypeForSession(
        userId: string,
        type: string,
        sessionId: string,
        typeVersion?: string
    ): Promise<Artifact[]> {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT a.* FROM artifacts a
                WHERE a.user_id = ? AND a.type = ?
                AND (
                    JSON_EXTRACT(a.data, '$.id') = ? OR
                    JSON_EXTRACT(a.data, '$.ideation_session_id') = ? OR
                    JSON_EXTRACT(a.data, '$.outline_session_id') = ?
                )
            `;
            let params = [userId, type, sessionId, sessionId, sessionId];

            if (typeVersion) {
                query += ' AND a.type_version = ?';
                params.push(typeVersion);
            }

            query += ' ORDER BY a.created_at DESC';

            this.db.all(query, params, (err, rows: any[]) => {
                if (err) {
                    reject(err);
                    return;
                }

                const artifacts = rows.map(row => ({
                    ...row,
                    data: JSON.parse(row.data),
                    metadata: row.metadata ? JSON.parse(row.metadata) : null
                }));

                resolve(artifacts);
            });
        });
    }

    // Get latest user input for a session (ideation or outline)
    async getLatestUserInputForSession(
        userId: string,
        sessionId: string
    ): Promise<Artifact | null> {
        return new Promise((resolve, reject) => {
            // First get all transforms related to this session
            const query = `
                SELECT DISTINCT a.*
                FROM artifacts a
                JOIN transform_inputs ti ON a.id = ti.artifact_id
                JOIN transforms t ON ti.transform_id = t.id
                JOIN transform_inputs ti2 ON t.id = ti2.transform_id
                JOIN artifacts session_a ON ti2.artifact_id = session_a.id
                WHERE a.user_id = ? 
                AND a.type = 'user_input'
                AND (
                    JSON_EXTRACT(session_a.data, '$.id') = ? OR
                    JSON_EXTRACT(session_a.data, '$.ideation_session_id') = ?
                )
                ORDER BY a.created_at DESC
                LIMIT 1
            `;

            this.db.get(query, [userId, sessionId, sessionId], (err, row: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!row) {
                    resolve(null);
                    return;
                }

                resolve({
                    ...row,
                    data: JSON.parse(row.data),
                    metadata: row.metadata ? JSON.parse(row.metadata) : null
                });
            });
        });
    }

    // Delete artifact (should be rare since artifacts are immutable)
    async deleteArtifact(artifactId: string, userId: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM artifacts WHERE id = ? AND user_id = ?',
                [artifactId, userId],
                function (err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(this.changes > 0);
                }
            );
        });
    }
} 