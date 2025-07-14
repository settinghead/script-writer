import { Kysely, sql } from 'kysely';
import { DB } from '../database/types';
import { EmbeddingService } from './EmbeddingService';
import { ParticleExtractor, ParticleData } from './ParticleExtractor';
import { TypedJsondoc } from '../../common/jsondocs.js';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';

export interface ParticleSearchResult {
    id: string;
    jsondoc_id: string;
    project_id: string;
    path: string;
    type: string;
    title: string;
    content: any;
    content_text: string;
    similarity?: number;
    created_at: Date;
    updated_at: Date;
}

export interface ParticleInsert {
    id: string;
    jsondoc_id: string;
    project_id: string;
    path: string;
    type: string;
    title: string;
    content: any;
    content_text: string;
    embedding: string; // PostgreSQL vector format
    is_active: boolean;
}

export class ParticleService {
    constructor(
        private db: Kysely<DB>,
        private embeddingService: EmbeddingService,
        private particleExtractor: ParticleExtractor
    ) { }

    /**
     * Update particles for a specific jsondoc
     */
    async updateParticlesForJsondoc(jsondocId: string, projectId: string): Promise<void> {
        console.log(`[ParticleService] Updating particles for jsondoc ${jsondocId}`);

        const jsondoc = await this.getJsondoc(jsondocId);
        if (!jsondoc) {
            console.log(`[ParticleService] Jsondoc ${jsondocId} not found`);
            return;
        }

        // Check if jsondoc is active (leaf in lineage)
        const isActive = await this.isJsondocActive(jsondocId);
        console.log(`[ParticleService] Jsondoc ${jsondocId} is ${isActive ? 'active' : 'inactive'}`);

        // Extract particles from jsondoc
        const particles = isActive ? await this.particleExtractor.extractParticles(jsondoc) : [];
        console.log(`[ParticleService] Extracted ${particles.length} particles from jsondoc ${jsondocId}`);

        // Update database in transaction
        await this.db.transaction().execute(async (tx) => {
            // Delete existing particles
            await tx.deleteFrom('particles')
                .where('jsondoc_id', '=', jsondocId)
                .execute();

            if (particles.length > 0) {
                // Convert particles to database format
                const particleInserts: ParticleInsert[] = particles.map(p => ({
                    id: p.id,
                    jsondoc_id: jsondocId,
                    project_id: projectId,
                    path: p.path,
                    type: p.type,
                    title: p.title,
                    content: p.content,
                    content_text: p.content_text,
                    embedding: this.embeddingService.embeddingToVector(p.embedding),
                    is_active: true
                }));

                // Insert new particles
                await tx.insertInto('particles')
                    .values(particleInserts)
                    .execute();
            }
        });

        console.log(`[ParticleService] Successfully updated particles for jsondoc ${jsondocId}`);
    }

    /**
     * Search particles using semantic similarity
     */
    async searchParticles(
        query: string,
        projectId: string,
        limit: number = 10
    ): Promise<ParticleSearchResult[]> {
        try {
            // Generate embedding for query
            const queryEmbedding = await this.embeddingService.generateEmbedding(query);
            const queryVector = this.embeddingService.embeddingToVector(queryEmbedding);

            // Perform semantic search using pgvector
            const results = await this.db
                .selectFrom('particles')
                .selectAll()
                .select(sql<number>`(embedding <-> ${queryVector})`.as('distance'))
                .where('project_id', '=', projectId)
                .where('is_active', '=', true)
                .orderBy('distance', 'asc')
                .limit(limit)
                .execute();

            // Convert distance to similarity score (1 - distance)
            return results.map(row => ({
                id: row.id,
                jsondoc_id: row.jsondoc_id,
                project_id: row.project_id,
                path: row.path,
                type: row.type,
                title: row.title,
                content: row.content,
                content_text: row.content_text,
                similarity: 1 - (row as any).distance,
                created_at: row.created_at,
                updated_at: row.updated_at
            }));
        } catch (error) {
            console.error('[ParticleService] Search failed:', error);
            throw new Error(`Particle search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get a single particle by ID
     */
    async getParticle(particleId: string, projectId: string, userId: string): Promise<ParticleSearchResult | null> {
        // Verify user has access to the project
        const jsondocRepo = new JsondocRepository(this.db);
        const hasAccess = await jsondocRepo.userHasProjectAccess(userId, projectId);
        if (!hasAccess) {
            throw new Error('Access denied to project');
        }

        const result = await this.db
            .selectFrom('particles')
            .selectAll()
            .where('id', '=', particleId)
            .where('project_id', '=', projectId)
            .where('is_active', '=', true)
            .executeTakeFirst();

        if (!result) {
            return null;
        }

        return {
            id: result.id,
            jsondoc_id: result.jsondoc_id,
            project_id: result.project_id,
            path: result.path,
            type: result.type,
            title: result.title,
            content: result.content,
            content_text: result.content_text,
            created_at: result.created_at,
            updated_at: result.updated_at
        };
    }

    /**
     * Delete particles for a specific jsondoc
     */
    async deleteParticlesByJsondoc(jsondocId: string): Promise<void> {
        await this.db
            .deleteFrom('particles')
            .where('jsondoc_id', '=', jsondocId)
            .execute();

        console.log(`[ParticleService] Deleted particles for jsondoc ${jsondocId}`);
    }

    /**
     * Initialize particles for all existing jsondocs
     */
    async initializeAllParticles(): Promise<void> {
        console.log('[ParticleService] Initializing particles for all jsondocs...');

        const jsondocs = await this.db
            .selectFrom('jsondocs')
            .select(['id', 'project_id'])
            .execute();

        for (const jsondoc of jsondocs) {
            try {
                await this.updateParticlesForJsondoc(jsondoc.id, jsondoc.project_id);
            } catch (error) {
                console.error(`[ParticleService] Failed to initialize particles for jsondoc ${jsondoc.id}:`, error);
            }
        }

        console.log(`[ParticleService] Finished initializing particles for ${jsondocs.length} jsondocs`);
    }

    /**
     * Get particles for a specific project
     */
    async getProjectParticles(projectId: string, limit?: number): Promise<ParticleSearchResult[]> {
        let query = this.db
            .selectFrom('particles')
            .selectAll()
            .where('project_id', '=', projectId)
            .where('is_active', '=', true)
            .orderBy('created_at', 'desc');

        if (limit) {
            query = query.limit(limit);
        }

        const results = await query.execute();

        return results.map(row => ({
            id: row.id,
            jsondoc_id: row.jsondoc_id,
            project_id: row.project_id,
            path: row.path,
            type: row.type,
            title: row.title,
            content: row.content,
            content_text: row.content_text,
            created_at: row.created_at,
            updated_at: row.updated_at
        }));
    }

    /**
     * Helper method to get jsondoc
     */
    private async getJsondoc(jsondocId: string): Promise<TypedJsondoc | null> {
        const result = await this.db
            .selectFrom('jsondocs')
            .selectAll()
            .where('id', '=', jsondocId)
            .executeTakeFirst();

        if (!result) {
            return null;
        }

        return {
            id: result.id,
            schema_type: result.schema_type,
            schema_version: result.schema_version,
            data: JSON.parse(result.data),
            metadata: result.metadata ? JSON.parse(result.metadata) : null,
            project_id: result.project_id,
            origin_type: result.origin_type,
            streaming_status: result.streaming_status || null,
            created_at: result.created_at.toISOString(),
            updated_at: result.updated_at.toISOString()
        } as TypedJsondoc;
    }

    /**
     * Check if jsondoc is active (leaf in lineage - no dependents)
     */
    private async isJsondocActive(jsondocId: string): Promise<boolean> {
        const dependents = await this.db
            .selectFrom('transform_inputs')
            .select('id')
            .where('jsondoc_id', '=', jsondocId)
            .limit(1)
            .execute();

        return dependents.length === 0;
    }
} 