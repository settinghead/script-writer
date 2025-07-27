import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddingService } from '../../transform-jsondoc-framework/EmbeddingService';

// Mock the AI SDK functions
vi.mock('ai', () => ({
    embed: vi.fn(),
    embedMany: vi.fn()
}));

// Mock the database connection
vi.mock('../../database/connection', () => ({
    db: {
        selectFrom: vi.fn(() => ({
            select: vi.fn(() => ({
                where: vi.fn(() => ({
                    where: vi.fn(() => ({
                        where: vi.fn(() => ({
                            executeTakeFirst: vi.fn().mockResolvedValue(null)
                        }))
                    }))
                }))
            }))
        })),
        insertInto: vi.fn(() => ({
            values: vi.fn(() => ({
                onConflict: vi.fn(() => ({
                    column: vi.fn(() => ({
                        doUpdateSet: vi.fn(() => ({
                            execute: vi.fn()
                        }))
                    }))
                }))
            }))
        }))
    }
}));

// Mock the LLM config
vi.mock('../../transform-jsondoc-framework/LLMConfig', () => ({
    getEmbeddingCredentials: () => ({
        apiKey: 'test-key',
        baseUrl: 'https://api.test.com',
        modelName: 'text-embedding-3-small',
        provider: 'openai',
        dimensions: 1536
    }),
    getEmbeddingModel: () => Promise.resolve({
        modelId: 'text-embedding-3-small'
    })
}));

import { embedMany, embed } from 'ai';

describe('Batch Embedding Integration Test', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should demonstrate cost savings with batch embedding', async () => {
        const embeddingService = new EmbeddingService();

        const testTexts = [
            'brainstorm_collection\n\nIdea 1: A modern romance story',
            'brainstorm_collection\n\nIdea 2: A historical drama',
            'brainstorm_collection\n\nIdea 3: A sci-fi adventure',
            'brainstorm_collection\n\nIdea 4: A comedy series',
            'brainstorm_collection\n\nIdea 5: A mystery thriller'
        ];

        // Mock embedMany to return batch results
        const mockBatchEmbeddings = [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
            [0.7, 0.8, 0.9],
            [0.11, 0.22, 0.33],
            [0.44, 0.55, 0.66]
        ];

        (embedMany as any).mockResolvedValueOnce({
            embeddings: mockBatchEmbeddings
        });

        // Generate embeddings using the batch method
        const results = await embeddingService.generateEmbeddingsBatch(testTexts, { cache: false });

        // Verify that embedMany was called once with all texts
        expect(embedMany).toHaveBeenCalledTimes(1);
        expect(embedMany).toHaveBeenCalledWith({
            model: expect.any(Object),
            values: testTexts
        });

        // Verify that individual embed was not called
        expect(embed).not.toHaveBeenCalled();

        // Verify results are correct and in order
        expect(results).toHaveLength(5);
        expect(results[0].embedding).toEqual([0.1, 0.2, 0.3]);
        expect(results[1].embedding).toEqual([0.4, 0.5, 0.6]);
        expect(results[2].embedding).toEqual([0.7, 0.8, 0.9]);
        expect(results[3].embedding).toEqual([0.11, 0.22, 0.33]);
        expect(results[4].embedding).toEqual([0.44, 0.55, 0.66]);
    });

    it('should demonstrate backward compatibility', async () => {
        const embeddingService = new EmbeddingService();

        const testTexts = [
            'Test text 1',
            'Test text 2'
        ];

        const mockBatchEmbeddings = [
            [0.1, 0.2],
            [0.3, 0.4]
        ];

        (embedMany as any).mockResolvedValueOnce({
            embeddings: mockBatchEmbeddings
        });

        // Call the old generateEmbeddings method - should use batch internally
        const results = await embeddingService.generateEmbeddings(testTexts, { cache: false });

        // Should use embedMany under the hood, not individual embed calls
        expect(embedMany).toHaveBeenCalledTimes(1);
        expect(embed).not.toHaveBeenCalled();

        expect(results).toHaveLength(2);
        expect(results[0].embedding).toEqual([0.1, 0.2]);
        expect(results[1].embedding).toEqual([0.3, 0.4]);
    });

    it('should handle single text input efficiently', async () => {
        const embeddingService = new EmbeddingService();

        const testTexts = ['Single text input'];
        const mockEmbedding = [0.5, 0.6, 0.7];

        (embed as any).mockResolvedValueOnce({
            embedding: mockEmbedding
        });

        const results = await embeddingService.generateEmbeddingsBatch(testTexts, { cache: false });

        // Single text uses individual embed call for efficiency
        expect(embed).toHaveBeenCalledTimes(1);
        expect(embedMany).not.toHaveBeenCalled();

        expect(results).toHaveLength(1);
        expect(results[0].embedding).toEqual([0.5, 0.6, 0.7]);
    });
}); 