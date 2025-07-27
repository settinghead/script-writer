import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParticleExtractor } from '../../transform-jsondoc-framework/particles/ParticleExtractor';
import { EmbeddingService } from '../../transform-jsondoc-framework/EmbeddingService';

// Mock the embedding service
vi.mock('../EmbeddingService');

// Mock the particle registry
vi.mock('../particleRegistry', () => ({
    getParticlePathsForSchemaType: vi.fn()
}));

// Mock JSONPath
vi.mock('jsonpath-plus', () => ({
    JSONPath: vi.fn()
}));

import { getParticlePathsForSchemaType } from '../particleRegistry';
import { JSONPath } from 'jsonpath-plus';

describe('ParticleExtractor Batch Optimization', () => {
    let particleExtractor: ParticleExtractor;
    let mockEmbeddingService: Partial<EmbeddingService>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create mock embedding service
        mockEmbeddingService = {
            generateEmbeddingsBatch: vi.fn(),
            generateEmbedding: vi.fn(),
        };

        particleExtractor = new ParticleExtractor(mockEmbeddingService as EmbeddingService);
    });

    it('should use batch embedding for multiple particles', async () => {
        const mockJsondoc = {
            id: 'test-jsondoc',
            schema_type: 'brainstorm_collection',
            data: {
                platform: '抖音',
                genre: '现代甜宠',
                total_ideas: 3,
                ideas: [
                    { title: 'Idea 1', body: 'First idea content' },
                    { title: 'Idea 2', body: 'Second idea content' },
                    { title: 'Idea 3', body: 'Third idea content' }
                ]
            },
            created_at: '2024-01-01T00:00:00Z'
        } as any;

        // Mock particle path definitions
        (getParticlePathsForSchemaType as any).mockReturnValue([
            {
                path: '$.ideas[*]',
                type: 'idea',
                titlePath: '$.title',
                titleDefault: 'Idea'
            }
        ]);

        // Mock JSONPath results
        (JSONPath as any).mockReturnValue([
            { value: { title: 'Idea 1', body: 'First idea content' }, path: ['$', 'ideas', 0] },
            { value: { title: 'Idea 2', body: 'Second idea content' }, path: ['$', 'ideas', 1] },
            { value: { title: 'Idea 3', body: 'Third idea content' }, path: ['$', 'ideas', 2] }
        ]);

        // Mock batch embedding results
        const mockEmbeddings = [
            { embedding: [0.1, 0.2, 0.3], usage: { tokens: 20 } },
            { embedding: [0.4, 0.5, 0.6], usage: { tokens: 22 } },
            { embedding: [0.7, 0.8, 0.9], usage: { tokens: 21 } }
        ];
        (mockEmbeddingService.generateEmbeddingsBatch as any).mockResolvedValue(mockEmbeddings);

        const particles = await particleExtractor.extractParticles(mockJsondoc);

        // Verify batch embedding was called once with all content texts
        expect(mockEmbeddingService.generateEmbeddingsBatch).toHaveBeenCalledTimes(1);
        expect(mockEmbeddingService.generateEmbeddingsBatch).toHaveBeenCalledWith([
            expect.stringContaining('Idea 1'),
            expect.stringContaining('Idea 2'),
            expect.stringContaining('Idea 3')
        ]);

        // Verify individual generateEmbedding was not called
        expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();

        // Verify particles were created correctly
        expect(particles).toHaveLength(3);
        expect(particles[0].title).toBe('Idea 1');
        expect(particles[0].embedding).toEqual([0.1, 0.2, 0.3]);
        expect(particles[1].title).toBe('Idea 2');
        expect(particles[1].embedding).toEqual([0.4, 0.5, 0.6]);
        expect(particles[2].title).toBe('Idea 3');
        expect(particles[2].embedding).toEqual([0.7, 0.8, 0.9]);
    });

    it('should handle empty particles correctly', async () => {
        const mockJsondoc = {
            id: 'test-jsondoc',
            schema_type: 'brainstorm_collection',
            data: {
                platform: '抖音',
                genre: '现代甜宠',
                total_ideas: 0,
                ideas: []
            },
            created_at: '2024-01-01T00:00:00Z'
        } as any;

        (getParticlePathsForSchemaType as any).mockReturnValue([
            {
                path: '$.ideas[*]',
                type: 'idea',
                titlePath: '$.title',
                titleDefault: 'Idea'
            }
        ]);

        (JSONPath as any).mockReturnValue([]);

        const particles = await particleExtractor.extractParticles(mockJsondoc);

        expect(mockEmbeddingService.generateEmbeddingsBatch).not.toHaveBeenCalled();
        expect(particles).toHaveLength(0);
    });

    it('should maintain particle order matching input order', async () => {
        const mockJsondoc = {
            id: 'test-jsondoc',
            schema_type: 'brainstorm_collection',
            data: {
                platform: '抖音',
                genre: '现代甜宠',
                total_ideas: 4,
                ideas: [
                    { title: 'First', body: 'A' },
                    { title: 'Second', body: 'B' },
                    { title: 'Third', body: 'C' },
                    { title: 'Fourth', body: 'D' }
                ]
            },
            created_at: '2024-01-01T00:00:00Z'
        } as any;

        (getParticlePathsForSchemaType as any).mockReturnValue([
            {
                path: '$.ideas[*]',
                type: 'idea',
                titlePath: '$.title',
                titleDefault: 'Idea'
            }
        ]);

        // Mock JSONPath to handle both main path and title path extraction
        (JSONPath as any).mockImplementation((options: any) => {
            if (options.path === '$.ideas[*]') {
                // Main path extraction
                return [
                    { value: { title: 'First', body: 'A' }, path: ['$', 'ideas', 0] },
                    { value: { title: 'Second', body: 'B' }, path: ['$', 'ideas', 1] },
                    { value: { title: 'Third', body: 'C' }, path: ['$', 'ideas', 2] },
                    { value: { title: 'Fourth', body: 'D' }, path: ['$', 'ideas', 3] }
                ];
            } else if (options.path === '$.title') {
                // Title extraction - return the title from the content
                const content = options.json;
                if (content && content.title) {
                    return content.title;
                }
                return null;
            }
            return [];
        });

        const mockEmbeddings = [
            { embedding: [1, 0, 0, 0], usage: { tokens: 10 } },
            { embedding: [0, 1, 0, 0], usage: { tokens: 10 } },
            { embedding: [0, 0, 1, 0], usage: { tokens: 10 } },
            { embedding: [0, 0, 0, 1], usage: { tokens: 10 } }
        ];
        (mockEmbeddingService.generateEmbeddingsBatch as any).mockResolvedValue(mockEmbeddings);

        const particles = await particleExtractor.extractParticles(mockJsondoc);

        expect(particles).toHaveLength(4);
        expect(particles[0].title).toBe('First');
        expect(particles[0].embedding).toEqual([1, 0, 0, 0]);
        expect(particles[1].title).toBe('Second');
        expect(particles[1].embedding).toEqual([0, 1, 0, 0]);
        expect(particles[2].title).toBe('Third');
        expect(particles[2].embedding).toEqual([0, 0, 1, 0]);
        expect(particles[3].title).toBe('Fourth');
        expect(particles[3].embedding).toEqual([0, 0, 0, 1]);
    });
}); 