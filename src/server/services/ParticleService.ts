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
     * Uses hash-based comparison to only update particles that have actually changed
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

        // Extract particles from jsondoc (generates hash-based IDs)
        const newParticles = isActive ? await this.particleExtractor.extractParticles(jsondoc) : [];
        console.log(`[ParticleService] Generated ${newParticles.length} particles from jsondoc ${jsondocId}`);

        // Get existing particles for this jsondoc
        const existingParticles = await this.db
            .selectFrom('particles')
            .select(['id', 'type', 'title'])
            .where('jsondoc_id', '=', jsondocId)
            .execute();

        const existingParticleIds = new Set(existingParticles.map(p => p.id));
        const newParticleIds = new Set(newParticles.map(p => p.id));



        // Determine which particles need to be added, removed, or kept
        const particlesToAdd = newParticles.filter(p => !existingParticleIds.has(p.id));
        const particleIdsToRemove = Array.from(existingParticleIds).filter(id => !newParticleIds.has(id));
        const unchangedCount = newParticles.length - particlesToAdd.length;

        console.log(`[ParticleService] Particle changes for jsondoc ${jsondocId}: ${particlesToAdd.length} to add, ${particleIdsToRemove.length} to remove, ${unchangedCount} unchanged`);

        // Update database only if there are changes
        if (particlesToAdd.length > 0 || particleIdsToRemove.length > 0) {
            await this.db.transaction().execute(async (tx) => {
                // Remove particles that no longer exist
                if (particleIdsToRemove.length > 0) {
                    await tx.deleteFrom('particles')
                        .where('id', 'in', particleIdsToRemove)
                        .execute();
                }

                // Add new particles
                if (particlesToAdd.length > 0) {
                    const particleInserts: ParticleInsert[] = particlesToAdd.map(p => ({
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

                    await tx.insertInto('particles')
                        .values(particleInserts)
                        .execute();
                }
            });
        }

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

            // Perform semantic search using pgvector cosine similarity
            const results = await this.db
                .selectFrom('particles')
                .selectAll()
                .select(sql<number>`(1 - (embedding <=> ${queryVector}))`.as('similarity'))
                .where('project_id', '=', projectId)
                .where('is_active', '=', true)
                .orderBy('similarity', 'desc')
                .limit(limit)
                .execute();

            // Return results with cosine similarity scores
            return results.map(row => ({
                id: row.id,
                jsondoc_id: row.jsondoc_id,
                project_id: row.project_id,
                path: row.path,
                type: row.type,
                title: row.title,
                content: row.content,
                content_text: row.content_text,
                similarity: (row as any).similarity,
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
     * Only processes jsondocs that need updates (new or changed particles based on hash comparison)
     */
    async initializeAllParticles(): Promise<void> {
        console.log('[ParticleService] Initializing particles for all jsondocs...');

        const jsondocs = await this.db
            .selectFrom('jsondocs')
            .select(['id', 'project_id'])
            .execute();

        let processedCount = 0;
        let skippedCount = 0;

        for (const jsondoc of jsondocs) {
            try {
                const needsUpdate = await this.jsondocNeedsParticleUpdate(jsondoc.id);

                if (needsUpdate) {
                    await this.updateParticlesForJsondoc(jsondoc.id, jsondoc.project_id);
                    processedCount++;
                } else {
                    // console.log(`[ParticleService] Skipping jsondoc ${jsondoc.id} - particles are up to date`);
                    skippedCount++;
                }
            } catch (error) {
                console.error(`[ParticleService] Failed to initialize particles for jsondoc ${jsondoc.id}:`, error);
            }
        }

        console.log(`[ParticleService] Finished initializing particles for ${jsondocs.length} jsondocs (processed: ${processedCount}, skipped: ${skippedCount})`);
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
            user_id: '', // Not stored in DB - using project-based access control
            origin_type: result.origin_type,
            streaming_status: result.streaming_status || null,
            created_at: result.created_at.toISOString(),
            updated_at: result.updated_at.toISOString()
        } as TypedJsondoc;
    }

    /**
     * Check if a jsondoc needs particle updates using hash-based comparison
     * Returns true if:
     * - The jsondoc is inactive and has particles (need to remove them)
     * - The jsondoc is active and the generated particle IDs don't match existing ones
     */
    private async jsondocNeedsParticleUpdate(jsondocId: string): Promise<boolean> {
        const jsondoc = await this.getJsondoc(jsondocId);
        if (!jsondoc) {
            return false;
        }

        // Check if jsondoc is active
        const isActive = await this.isJsondocActive(jsondocId);

        // Get existing particles for this jsondoc
        const existingParticles = await this.db
            .selectFrom('particles')
            .select(['id'])
            .where('jsondoc_id', '=', jsondocId)
            .execute();

        const existingParticleIds = new Set(existingParticles.map(p => p.id));

        if (!isActive) {
            // If jsondoc is inactive, we need to remove particles if they exist
            return existingParticleIds.size > 0;
        }

        // If jsondoc is active, generate new particle IDs and compare
        const newParticles = await this.particleExtractor.extractParticles(jsondoc);
        const newParticleIds = new Set(newParticles.map(p => p.id));

        // Check if the sets of particle IDs are different
        if (existingParticleIds.size !== newParticleIds.size) {
            return true;
        }

        // Check if all existing IDs are in the new set
        for (const existingId of existingParticleIds) {
            if (!newParticleIds.has(existingId)) {
                return true;
            }
        }

        return false;
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