import { Kysely, sql } from 'kysely';
import { DB } from '../../database/types.js';
import { EmbeddingService } from '../EmbeddingService.js';
import { ParticleExtractor } from './ParticleExtractor';
import { TypedJsondoc } from '../../../common/jsondocs.js';
import { TransformJsondocRepository } from '../TransformJsondocRepository.js';
import { CanonicalJsondocService } from '../../services/CanonicalJsondocService.js';


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
    content_hash: string; // New field
    embedding: string; // PostgreSQL vector format
    is_active: boolean;
}

export class ParticleService {
    private canonicalJsondocService: CanonicalJsondocService;

    constructor(
        private db: Kysely<DB>,
        private embeddingService: EmbeddingService,
        private particleExtractor: ParticleExtractor,
        private jsondocRepo: TransformJsondocRepository,
        private transformRepo: TransformJsondocRepository,
    ) {
        this.canonicalJsondocService = new CanonicalJsondocService(
            this.db,
            this.jsondocRepo,
            this.transformRepo
        );
    }

    /**
     * Sync all particles' active status with current canonicality for a project
     * This ensures particles from non-canonical jsondocs are properly deactivated
     */
    async syncParticleActiveStatus(projectId: string): Promise<void> {
        // // console.log(`[ParticleService] Syncing particle active status for project ${projectId}`);

        // Get all canonical jsondoc IDs for this project
        const canonicalIds = await this.canonicalJsondocService.getCanonicalJsondocIds(projectId);
        // // console.log(`[ParticleService] Found ${canonicalIds.size} canonical jsondocs:`, Array.from(canonicalIds));

        await this.db.transaction().execute(async (tx) => {
            // Activate particles from canonical jsondocs
            if (canonicalIds.size > 0) {
                const activatedResult = await tx
                    .updateTable('particles')
                    .set({ is_active: true })
                    .where('project_id', '=', projectId)
                    .where('jsondoc_id', 'in', Array.from(canonicalIds))
                    .where('is_active', '=', false)
                    .execute();

                // console.log(`[ParticleService] Activated ${activatedResult.length} particles from canonical jsondocs`);
            }

            // Deactivate particles from non-canonical jsondocs
            const deactivatedResult = await tx
                .updateTable('particles')
                .set({ is_active: false })
                .where('project_id', '=', projectId)
                .where('jsondoc_id', 'not in', canonicalIds.size > 0 ? Array.from(canonicalIds) : [''])
                .where('is_active', '=', true)
                .execute();

            // console.log(`[ParticleService] Deactivated ${deactivatedResult.length} particles from non-canonical jsondocs`);
        });

        // console.log(`[ParticleService] Completed particle active status sync for project ${projectId}`);
    }

    /**
     * Update particles for a specific jsondoc
     * Uses hash-based comparison to only update particles that have actually changed
     */
    async updateParticlesForJsondoc(jsondocId: string, projectId: string): Promise<void> {
        // console.log(`[ParticleService] Updating particles for jsondoc ${jsondocId}`);

        const jsondoc = await this.getJsondoc(jsondocId);
        if (!jsondoc) {
            // console.log(`[ParticleService] Jsondoc ${jsondocId} not found`);
            return;
        }

        // Skip patch-type jsondocs - they are temporary approval artifacts, not permanent content
        if (jsondoc.schema_type === 'json_patch') {
            // console.log(`[ParticleService] Skipping jsondoc ${jsondocId} - patch-type jsondocs are not processed by particle system`);
            return;
        }

        // Check if jsondoc is active (leaf in lineage)
        const isActive = await this.isJsondocActive(jsondocId);
        // console.log(`[ParticleService] Jsondoc ${jsondocId} is ${isActive ? 'active' : 'inactive'}`);

        // Extract new particles (outside transaction for performance)
        const newParticles = isActive ? await this.particleExtractor.extractParticles(jsondoc) : [];
        // console.log(`[ParticleService] Generated ${newParticles.length} particles from jsondoc ${jsondocId}`);

        // If jsondoc is not active, we need to deactivate all its particles
        if (!isActive) {
            const deactivatedCount = await this.db
                .updateTable('particles')
                .set({ is_active: false })
                .where('jsondoc_id', '=', jsondocId)
                .where('is_active', '=', true)
                .execute();

            // console.log(`[ParticleService] Deactivated ${deactivatedCount.length} particles for inactive jsondoc ${jsondocId}`);
            return; // Exit early since there's nothing more to do
        }

        // Perform all database operations inside a single transaction to prevent race conditions
        await this.db.transaction().execute(async (tx) => {
            // Lock particles for this jsondoc to prevent concurrent updates
            await tx
                .selectFrom('particles')
                .select('id')
                .where('jsondoc_id', '=', jsondocId)
                .forUpdate()
                .execute();

            // Get existing particles INSIDE the transaction (after lock)
            const existingParticles = await tx
                .selectFrom('particles')
                .select(['id', 'type', 'title', 'content_hash'])
                .where('jsondoc_id', '=', jsondocId)
                .execute();

            const existingMap = new Map(existingParticles.map(p => [p.id, p]));
            const newMap = new Map(newParticles.map(p => [p.id, p]));

            // Compute changes INSIDE the transaction (after lock)
            const toAdd = newParticles.filter(p => !existingMap.has(p.id));
            const toRemoveIds = Array.from(existingMap.keys()).filter(id => !newMap.has(id));
            const toUpdate = newParticles.filter(p => {
                const existing = existingMap.get(p.id);
                return existing && existing.content_hash !== p.content_hash;
            });

            const unchangedCount = newParticles.length - toAdd.length - toUpdate.length;
            // console.log(`[ParticleService] Particle changes: ${toAdd.length} add, ${toRemoveIds.length} remove, ${toUpdate.length} update, ${unchangedCount} unchanged`);

            // Only proceed if there are actual changes
            if (toAdd.length === 0 && toRemoveIds.length === 0 && toUpdate.length === 0) {
                return; // No changes, exit transaction early
            }

            // Remove old particles
            if (toRemoveIds.length > 0) {
                await tx.deleteFrom('particles')
                    .where('id', 'in', toRemoveIds)
                    .execute();
            }

            // Add new particles
            if (toAdd.length > 0) {
                const inserts = toAdd.map(p => ({
                    id: p.id,
                    jsondoc_id: jsondocId,
                    project_id: projectId,
                    path: p.path,
                    type: p.type,
                    title: p.title,
                    content: this.ensureJsonbCompatible(p.content),
                    content_text: p.content_text,
                    embedding: this.embeddingService.embeddingToVector(p.embedding),
                    content_hash: p.content_hash,
                    is_active: true
                }));

                await tx.insertInto('particles').values(inserts).execute();
            }

            // Update changed particles
            for (const p of toUpdate) {
                await tx
                    .updateTable('particles')
                    .set({
                        title: p.title,
                        content: this.ensureJsonbCompatible(p.content),
                        content_text: p.content_text,
                        embedding: this.embeddingService.embeddingToVector(p.embedding),
                        content_hash: p.content_hash,
                        updated_at: sql`CURRENT_TIMESTAMP`
                    })
                    .where('id', '=', p.id)
                    .execute();
            }
        });

        // Backfill content_hash for existing particles if needed (one-time)
        // Check if any particles need backfilling by querying directly
        const particlesNeedingBackfill = await this.db
            .selectFrom('particles')
            .select(['id', 'content_hash'])
            .where('jsondoc_id', '=', jsondocId)
            .where('content_hash', 'is', null)
            .execute();

        if (particlesNeedingBackfill.length > 0) {
            // console.log(`[ParticleService] Backfilling content_hash for ${particlesNeedingBackfill.length} particles in jsondoc ${jsondocId}`);
            // Re-extract and update hashes
            const backfillParticles = await this.particleExtractor.extractParticles(jsondoc);
            const backfillMap = new Map(backfillParticles.map(p => [p.id, p]));

            for (const existing of particlesNeedingBackfill) {
                const backfillParticle = backfillMap.get(existing.id);
                if (backfillParticle) {
                    await this.db
                        .updateTable('particles')
                        .set({
                            content_hash: backfillParticle.content_hash
                        })
                        .where('id', '=', existing.id)
                        .execute();
                }
            }
        }

        // console.log(`[ParticleService] Successfully synced particles for jsondoc ${jsondocId}`);
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
        const jsondocRepo = new TransformJsondocRepository(this.db);
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

        // console.log(`[ParticleService] Deleted particles for jsondoc ${jsondocId}`);
    }

    /**
     * Initialize particles for all existing jsondocs
     * Only processes jsondocs that need updates (new or changed particles based on hash comparison)
     */
    async initializeAllParticles(): Promise<void> {
        // console.log('[ParticleService] Initializing particles for all jsondocs...');

        const jsondocs = await this.db
            .selectFrom('jsondocs')
            .select(['id', 'project_id'])
            .where('schema_type', '!=', 'json_patch') // Skip patch-type jsondocs
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
                    // // console.log(`[ParticleService] Skipping jsondoc ${jsondoc.id} - particles are up to date`);
                    skippedCount++;
                }
            } catch (error) {
                console.error(`[ParticleService] Failed to initialize particles for jsondoc ${jsondoc.id}:`, error);
            }
        }

        // console.log(`[ParticleService] Finished initializing particles for ${jsondocs.length} jsondocs (processed: ${processedCount}, skipped: ${skippedCount})`);
    }

    /**
     * Fix particle active status for all projects
     * This is a maintenance operation to ensure particles from non-canonical jsondocs are properly deactivated
     */
    async fixAllParticleActiveStatus(): Promise<void> {
        // console.log('[ParticleService] Starting particle active status fix for all projects...');

        // Get all projects
        const projects = await this.db
            .selectFrom('jsondocs')
            .select('project_id')
            .distinct()
            .execute();

        let processedCount = 0;

        for (const project of projects) {
            try {
                await this.syncParticleActiveStatus(project.project_id);
                processedCount++;
            } catch (error) {
                console.error(`[ParticleService] Failed to fix particle active status for project ${project.project_id}:`, error);
            }
        }

        // console.log(`[ParticleService] Finished fixing particle active status for ${processedCount} projects`);
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
            .select(['id', 'content_hash'])
            .where('jsondoc_id', '=', jsondocId)
            .execute();

        const existingMap = new Map(existingParticles.map(p => [p.id, p]));

        if (!isActive) {
            return existingMap.size > 0;
        }

        const newParticles = await this.particleExtractor.extractParticles(jsondoc);
        const newMap = new Map(newParticles.map(p => [p.id, p]));

        // Check for ID set differences
        if (existingMap.size !== newMap.size) return true;

        for (const [id, existing] of existingMap) {
            const newP = newMap.get(id);
            if (!newP || existing.content_hash !== newP.content_hash) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if jsondoc is active (should have particles)
     * Uses CanonicalJsondocService to determine if jsondoc is displayed in UI components
     */
    private async isJsondocActive(jsondocId: string): Promise<boolean> {
        // Get the jsondoc to find its project ID
        const jsondoc = await this.getJsondoc(jsondocId);
        if (!jsondoc) {
            return false;
        }

        // Use CanonicalJsondocService to check if jsondoc is canonical (displayed in UI)
        const projectId = (jsondoc as any).project_id;
        return await this.canonicalJsondocService.isJsondocCanonical(jsondocId, projectId);
    }

    /**
     * Ensure content is compatible with PostgreSQL JSONB column
     * Kysely doesn't automatically handle primitive values for JSONB
     */
    private ensureJsonbCompatible(content: any): any {
        // For primitive values (strings, arrays), wrap them in an object
        // Objects, numbers, and booleans work fine as-is
        if (typeof content === 'string') {
            return { value: content };
        }
        if (Array.isArray(content)) {
            return { items: content };
        }
        // Objects, numbers, booleans, null work as-is
        return content;
    }
} 