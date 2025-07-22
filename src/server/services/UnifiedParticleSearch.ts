import { Kysely, sql } from 'kysely';
import { DB } from '../database/types';
import { EmbeddingService } from './EmbeddingService';
import { ParticleService, ParticleSearchResult } from './ParticleService';

export interface UnifiedSearchOptions {
    mode: 'string' | 'embedding';
    limit?: number;
    threshold?: number; // For embedding similarity filtering
}

export interface UnifiedSearchResult extends ParticleSearchResult {
    search_mode: 'string' | 'embedding';
}

/**
 * Unified particle search service that provides both string-based and embedding-based search
 */
export class UnifiedParticleSearch {
    constructor(
        private db: Kysely<DB>,
        private embeddingService: EmbeddingService,
        private particleService: ParticleService
    ) { }

    /**
     * Fast string-based search for @mention system
     * Uses PostgreSQL full-text search for fast results without embeddings
     */
    async searchParticlesStringBased(
        query: string,
        projectId: string,
        limit: number = 10
    ): Promise<UnifiedSearchResult[]> {
        try {
            // Use PostgreSQL full-text search with ranking
            const results = await this.db
                .selectFrom('particles')
                .selectAll()
                .select(
                    sql<number>`
                        ts_rank(
                            to_tsvector('english', title || ' ' || content_text),
                            plainto_tsquery('english', ${query})
                        )
                    `.as('rank')
                )
                .where('project_id', '=', projectId)
                .where('is_active', '=', true)
                .where(eb => eb(
                    sql`to_tsvector('english', title || ' ' || content_text)`,
                    '@@',
                    sql`plainto_tsquery('english', ${query})`
                ))
                .orderBy('rank', 'desc')
                .orderBy('created_at', 'desc')
                .limit(limit)
                .execute();

            return results.map(row => ({
                id: row.id,
                jsondoc_id: row.jsondoc_id,
                project_id: row.project_id,
                path: row.path,
                type: row.type,
                title: row.title,
                content: row.content,
                content_text: row.content_text,
                similarity: (row as any).rank, // Use text rank as similarity score
                created_at: row.created_at,
                updated_at: row.updated_at,
                search_mode: 'string' as const
            }));
        } catch (error) {
            console.error('[UnifiedParticleSearch] String search failed:', error);
            // Fallback to simple LIKE search if full-text search fails
            return this.fallbackStringSearch(query, projectId, limit);
        }
    }

    /**
     * Semantic search using embeddings for agent queries
     * Uses the existing ParticleService embedding-based search
     */
    async searchParticlesEmbeddingBased(
        query: string,
        projectId: string,
        limit: number = 5,
        threshold: number = 0.0
    ): Promise<UnifiedSearchResult[]> {
        try {
            const results = await this.particleService.searchParticles(query, projectId, limit);

            // Filter by similarity threshold and add search mode
            return results
                .filter(result => (result.similarity || 0) >= threshold)
                .map(result => ({
                    ...result,
                    search_mode: 'embedding' as const
                }));
        } catch (error) {
            console.error('[UnifiedParticleSearch] Embedding search failed:', error);
            throw error;
        }
    }

    /**
     * Unified search interface that chooses the appropriate method
     */
    async searchParticles(
        query: string,
        projectId: string,
        options: UnifiedSearchOptions
    ): Promise<UnifiedSearchResult[]> {
        const { mode, limit = 10, threshold = 0.0 } = options;

        if (mode === 'string') {
            return this.searchParticlesStringBased(query, projectId, limit);
        } else {
            return this.searchParticlesEmbeddingBased(query, projectId, limit, threshold);
        }
    }

    /**
     * Fallback string search using LIKE when full-text search fails
     */
    private async fallbackStringSearch(
        query: string,
        projectId: string,
        limit: number
    ): Promise<UnifiedSearchResult[]> {
        const searchTerm = `%${query.toLowerCase()}%`;

        const results = await this.db
            .selectFrom('particles')
            .selectAll()
            .where('project_id', '=', projectId)
            .where('is_active', '=', true)
            .where(eb => eb.or([
                eb(sql`LOWER(title)`, 'like', searchTerm),
                eb(sql`LOWER(content_text)`, 'like', searchTerm),
                eb(sql`LOWER(type)`, 'like', searchTerm)
            ]))
            .orderBy('created_at', 'desc')
            .limit(limit)
            .execute();

        return results.map(row => ({
            id: row.id,
            jsondoc_id: row.jsondoc_id,
            project_id: row.project_id,
            path: row.path,
            type: row.type,
            title: row.title,
            content: row.content,
            content_text: row.content_text,
            similarity: 0.5, // Default similarity for LIKE search
            created_at: row.created_at,
            updated_at: row.updated_at,
            search_mode: 'string' as const
        }));
    }

    /**
     * Health check for the unified search system
     */
    async healthCheck(): Promise<{
        stringSearchAvailable: boolean;
        embeddingSearchAvailable: boolean;
        particleCount: number;
    }> {
        try {
            // Check if we can do basic queries
            const particleCount = await this.db
                .selectFrom('particles')
                .select(this.db.fn.count('id').as('count'))
                .where('is_active', '=', true)
                .executeTakeFirst();

            // Test string search
            let stringSearchAvailable = false;
            try {
                await this.db
                    .selectFrom('particles')
                    .select('id')
                    .where(eb => eb(
                        sql`to_tsvector('english', 'test')`,
                        '@@',
                        sql`plainto_tsquery('english', 'test')`
                    ))
                    .limit(1)
                    .execute();
                stringSearchAvailable = true;
            } catch (error) {
                console.warn('[UnifiedParticleSearch] Full-text search not available:', error);
            }

            // Test embedding search (via ParticleService)
            let embeddingSearchAvailable = false;
            try {
                // This will fail gracefully if embedding service is not available
                await this.embeddingService.generateEmbedding('test');
                embeddingSearchAvailable = true;
            } catch (error) {
                console.warn('[UnifiedParticleSearch] Embedding search not available:', error);
            }

            return {
                stringSearchAvailable,
                embeddingSearchAvailable,
                particleCount: Number(particleCount?.count || 0)
            };
        } catch (error) {
            console.error('[UnifiedParticleSearch] Health check failed:', error);
            return {
                stringSearchAvailable: false,
                embeddingSearchAvailable: false,
                particleCount: 0
            };
        }
    }
}

// Export convenience functions for backward compatibility
export async function searchParticlesStringBased(
    db: Kysely<DB>,
    embeddingService: EmbeddingService,
    particleService: ParticleService,
    query: string,
    projectId: string,
    limit: number = 10
): Promise<UnifiedSearchResult[]> {
    const unifiedSearch = new UnifiedParticleSearch(db, embeddingService, particleService);
    return unifiedSearch.searchParticlesStringBased(query, projectId, limit);
}

export async function searchParticlesEmbeddingBased(
    db: Kysely<DB>,
    embeddingService: EmbeddingService,
    particleService: ParticleService,
    query: string,
    projectId: string,
    limit: number = 5
): Promise<UnifiedSearchResult[]> {
    const unifiedSearch = new UnifiedParticleSearch(db, embeddingService, particleService);
    return unifiedSearch.searchParticlesEmbeddingBased(query, projectId, limit);
} 