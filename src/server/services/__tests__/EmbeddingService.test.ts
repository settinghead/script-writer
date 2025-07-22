import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmbeddingService } from '../EmbeddingService';
import { embedMany, embed } from 'ai';

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
                            executeTakeFirst: vi.fn()
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
        })),
        updateTable: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn(() => ({
                    execute: vi.fn()
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

describe('EmbeddingService Batch Optimization', () => {
    let embeddingService: EmbeddingService;
    const mockEmbedMany = embedMany as any;
    const mockEmbed = embed as any;

    beforeEach(() => {
        vi.clearAllMocks();
        embeddingService = new EmbeddingService();
    });

    it('should generate batch embeddings using embedMany API', async () => {
        const testTexts = [
            'First test text',
            'Second test text',
            'Third test text'
        ];

        const mockEmbeddings = [
            [0.1, 0.2, 0.3],
            [0.4, 0.5, 0.6],
            [0.7, 0.8, 0.9]
        ];

        mockEmbedMany.mockResolvedValueOnce({
            embeddings: mockEmbeddings
        });

        const results = await embeddingService.generateEmbeddingsBatch(testTexts, { cache: false });

        expect(mockEmbedMany).toHaveBeenCalledTimes(1);
        expect(mockEmbedMany).toHaveBeenCalledWith({
            model: expect.any(Object),
            values: testTexts
        });

        expect(results).toHaveLength(3);
        expect(results[0].embedding).toEqual([0.1, 0.2, 0.3]);
        expect(results[1].embedding).toEqual([0.4, 0.5, 0.6]);
        expect(results[2].embedding).toEqual([0.7, 0.8, 0.9]);
    });

    it('should maintain order of embeddings corresponding to input texts', async () => {
        const testTexts = [
            'Text A',
            'Text B',
            'Text C',
            'Text D'
        ];

        const mockEmbeddings = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
            [1, 1, 1]
        ];

        mockEmbedMany.mockResolvedValueOnce({
            embeddings: mockEmbeddings
        });

        const results = await embeddingService.generateEmbeddingsBatch(testTexts, { cache: false });

        expect(results).toHaveLength(4);
        // Verify that embeddings are in the same order as input texts
        expect(results[0].embedding).toEqual([1, 0, 0]); // Text A
        expect(results[1].embedding).toEqual([0, 1, 0]); // Text B
        expect(results[2].embedding).toEqual([0, 0, 1]); // Text C
        expect(results[3].embedding).toEqual([1, 1, 1]); // Text D
    });

    it('should handle empty input array', async () => {
        const results = await embeddingService.generateEmbeddingsBatch([], { cache: false });

        expect(mockEmbedMany).not.toHaveBeenCalled();
        expect(results).toHaveLength(0);
    });

    it('should handle single text input', async () => {
        const testTexts = ['Single text'];
        const mockEmbedding = [0.1, 0.2, 0.3];

        mockEmbed.mockResolvedValueOnce({
            embedding: mockEmbedding
        });

        const results = await embeddingService.generateEmbeddingsBatch(testTexts, { cache: false });

        expect(mockEmbed).toHaveBeenCalledTimes(1);
        expect(mockEmbedMany).not.toHaveBeenCalled();
        expect(results).toHaveLength(1);
        expect(results[0].embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it('should use batch method in generateEmbeddings for backward compatibility', async () => {
        const testTexts = ['Test text 1', 'Test text 2'];
        const mockEmbeddings = [[0.1, 0.2], [0.3, 0.4]];

        mockEmbedMany.mockResolvedValueOnce({
            embeddings: mockEmbeddings
        });

        // Call the existing generateEmbeddings method
        const results = await embeddingService.generateEmbeddings(testTexts, { cache: false });

        // Should use embedMany under the hood
        expect(mockEmbedMany).toHaveBeenCalledTimes(1);
        expect(mockEmbed).not.toHaveBeenCalled();
        expect(results).toHaveLength(2);
    });

    it('should handle errors gracefully', async () => {
        const testTexts = ['Text that will fail'];

        mockEmbed.mockRejectedValueOnce(new Error('API Error'));

        await expect(
            embeddingService.generateEmbeddingsBatch(testTexts, { cache: false })
        ).rejects.toThrow('Batch embedding generation failed: API Error');
    });
}); 