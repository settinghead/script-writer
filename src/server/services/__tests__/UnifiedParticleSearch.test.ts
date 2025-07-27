import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnifiedParticleSearch } from '../../transform-jsondoc-framework/particles/UnifiedParticleSearch';
import type { Kysely } from 'kysely';
import type { DB } from '../../database/types';
import type { EmbeddingService } from '../../transform-jsondoc-framework/EmbeddingService';
import type { ParticleService } from '../../transform-jsondoc-framework/particles/ParticleService';

// Mock the dependencies
const mockDb = {
    selectFrom: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    execute: vi.fn(),
    executeTakeFirst: vi.fn(),
    fn: {
        count: vi.fn().mockReturnValue({ as: vi.fn().mockReturnValue('count') })
    }
} as unknown as Kysely<DB>;

const mockEmbeddingService = {
    generateEmbedding: vi.fn()
} as unknown as EmbeddingService;

const mockParticleService = {
    searchParticles: vi.fn()
} as unknown as ParticleService;

describe('UnifiedParticleSearch', () => {
    let unifiedSearch: UnifiedParticleSearch;

    beforeEach(() => {
        vi.clearAllMocks();
        unifiedSearch = new UnifiedParticleSearch(mockDb, mockEmbeddingService, mockParticleService);
    });

    describe('searchParticlesStringBased', () => {
        it('should perform string-based search using PostgreSQL full-text search', async () => {
            const mockResults = [
                {
                    id: 'particle1',
                    jsondoc_id: 'jsondoc1',
                    project_id: 'project1',
                    path: '$.characters[0]',
                    type: 'character',
                    title: '女主角',
                    content: '{"name": "李小雨"}',
                    content_text: '女主角李小雨，聪明独立的现代女性',
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z',
                    rank: 0.8
                }
            ];

            (mockDb.execute as any).mockResolvedValue(mockResults);

            const results = await unifiedSearch.searchParticlesStringBased('女主角', 'project1', 5);

            expect(results).toHaveLength(1);
            expect(results[0]).toMatchObject({
                id: 'particle1',
                jsondoc_id: 'jsondoc1',
                title: '女主角',
                search_mode: 'string',
                similarity: 0.8
            });
        });

        it('should fallback to LIKE search when full-text search fails', async () => {
            // First call fails (full-text search)
            (mockDb.execute as any).mockRejectedValueOnce(new Error('Full-text search not available'));

            // Second call succeeds (LIKE search)
            const mockFallbackResults = [
                {
                    id: 'particle2',
                    jsondoc_id: 'jsondoc2',
                    project_id: 'project1',
                    path: '$.plot',
                    type: 'plot',
                    title: '剧情梗概',
                    content: '{}',
                    content_text: '女主角遇到男主角的故事',
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z'
                }
            ];

            (mockDb.execute as any).mockResolvedValueOnce(mockFallbackResults);

            const results = await unifiedSearch.searchParticlesStringBased('女主角', 'project1', 5);

            expect(results).toHaveLength(1);
            expect(results[0]).toMatchObject({
                id: 'particle2',
                search_mode: 'string',
                similarity: 0.5 // Default similarity for LIKE search
            });
        });
    });

    describe('searchParticlesEmbeddingBased', () => {
        it('should use ParticleService for embedding-based search', async () => {
            const mockEmbeddingResults = [
                {
                    id: 'particle3',
                    jsondoc_id: 'jsondoc3',
                    project_id: 'project1',
                    path: '$.themes',
                    type: 'theme',
                    title: '核心主题',
                    content: '{}',
                    content_text: '现代都市爱情故事的核心主题',
                    similarity: 0.85,
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z'
                }
            ];

            (mockParticleService.searchParticles as any).mockResolvedValue(mockEmbeddingResults);

            const results = await unifiedSearch.searchParticlesEmbeddingBased('爱情主题', 'project1', 5);

            expect(mockParticleService.searchParticles).toHaveBeenCalledWith('爱情主题', 'project1', 5);
            expect(results).toHaveLength(1);
            expect(results[0]).toMatchObject({
                id: 'particle3',
                search_mode: 'embedding',
                similarity: 0.85
            });
        });

        it('should filter results by similarity threshold', async () => {
            const mockResults = [
                { id: 'particle1', similarity: 0.8 },
                { id: 'particle2', similarity: 0.3 },
                { id: 'particle3', similarity: 0.6 }
            ];

            (mockParticleService.searchParticles as any).mockResolvedValue(mockResults);

            const results = await unifiedSearch.searchParticlesEmbeddingBased('test', 'project1', 5, 0.5);

            expect(results).toHaveLength(2); // Only particles with similarity >= 0.5
            expect(results.map(r => r.id)).toEqual(['particle1', 'particle3']);
        });
    });

    describe('searchParticles', () => {
        it('should route to string-based search when mode is "string"', async () => {
            const spy = vi.spyOn(unifiedSearch, 'searchParticlesStringBased').mockResolvedValue([]);

            await unifiedSearch.searchParticles('test', 'project1', { mode: 'string', limit: 10 });

            expect(spy).toHaveBeenCalledWith('test', 'project1', 10);
        });

        it('should route to embedding-based search when mode is "embedding"', async () => {
            const spy = vi.spyOn(unifiedSearch, 'searchParticlesEmbeddingBased').mockResolvedValue([]);

            await unifiedSearch.searchParticles('test', 'project1', { mode: 'embedding', limit: 5, threshold: 0.3 });

            expect(spy).toHaveBeenCalledWith('test', 'project1', 5, 0.3);
        });
    });

    describe('healthCheck', () => {
        it('should return health status for both search modes', async () => {
            (mockDb.executeTakeFirst as any).mockResolvedValue({ count: '100' });
            (mockDb.execute as any).mockResolvedValue([]);
            (mockEmbeddingService.generateEmbedding as any).mockResolvedValue([0.1, 0.2, 0.3]);

            const health = await unifiedSearch.healthCheck();

            expect(health).toMatchObject({
                stringSearchAvailable: true,
                embeddingSearchAvailable: true,
                particleCount: 100
            });
        });

        it('should handle unavailable search modes gracefully', async () => {
            (mockDb.executeTakeFirst as any).mockResolvedValue({ count: '50' });
            (mockDb.execute as any).mockRejectedValue(new Error('Full-text search not available'));
            (mockEmbeddingService.generateEmbedding as any).mockRejectedValue(new Error('Embedding service down'));

            const health = await unifiedSearch.healthCheck();

            expect(health).toMatchObject({
                stringSearchAvailable: false,
                embeddingSearchAvailable: false,
                particleCount: 50
            });
        });
    });
}); 