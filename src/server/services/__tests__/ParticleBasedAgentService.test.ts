import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runParticleBasedGeneralAgent, checkParticleBasedAgentHealth } from '../ParticleBasedAgentService';
import type { GeneralAgentRequest } from '../../transform-jsondoc-framework/AgentService';
import type { TransformRepository } from '../../transform-jsondoc-framework/TransformRepository';
import type { JsondocRepository } from '../../transform-jsondoc-framework/JsondocRepository';

// Mock dependencies
vi.mock('../ParticleSystemInitializer', () => ({
    getParticleSystem: vi.fn()
}));

vi.mock('../../transform-jsondoc-framework/LLMConfig', () => ({
    getLLMModel: vi.fn()
}));

vi.mock('../../middleware/UserContextMiddleware.js', () => ({
    createUserContextMiddleware: vi.fn()
}));

vi.mock('ai', () => ({
    streamText: vi.fn(),
    wrapLanguageModel: vi.fn(),
    tool: vi.fn()
}));

describe('ParticleBasedAgentService', () => {
    const mockRequest: GeneralAgentRequest = {
        userRequest: '生成一些故事创意',
        projectId: 'test-project',
        contextType: 'general'
    };

    const mockTransformRepo = {} as TransformRepository;
    const mockJsondocRepo = {
        getProjectJsondocs: vi.fn()
    } as unknown as JsondocRepository;

    const mockUnifiedSearch = {
        healthCheck: vi.fn()
    };

    const mockParticleSystem = {
        unifiedSearch: mockUnifiedSearch
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('runParticleBasedGeneralAgent', () => {
        it('should handle particle system not available', async () => {
            const { getParticleSystem } = await import('../ParticleSystemInitializer.js');
            (getParticleSystem as any).mockReturnValue(null);

            await expect(
                runParticleBasedGeneralAgent(
                    mockRequest,
                    'test-project',
                    mockTransformRepo,
                    mockJsondocRepo,
                    'test-user'
                )
            ).rejects.toThrow('Particle system not available');
        });

        it('should build minimal context successfully', async () => {
            const { getParticleSystem } = await import('../ParticleSystemInitializer.js');
            (getParticleSystem as any).mockReturnValue(mockParticleSystem);

            (mockJsondocRepo.getProjectJsondocs as any).mockResolvedValue([
                { schema_type: 'user_input' },
                { schema_type: '灵感创意' },
                { schema_type: '剧本设定' }
            ]);

            const { getLLMModel } = await import('../../transform-jsondoc-framework/LLMConfig.js');
            (getLLMModel as any).mockResolvedValue({ model: 'test-model' });

            // Mock the UserContextMiddleware - skip import since it has complex dependencies
            const createUserContextMiddleware = vi.fn().mockReturnValue({ middleware: 'test' });

            const { streamText, wrapLanguageModel } = await import('ai');
            (wrapLanguageModel as any).mockReturnValue({ enhanced: 'model' });

            const mockStreamResult = {
                fullStream: (async function* () {
                    yield { type: 'text-delta', textDelta: 'Test response' };
                    yield { type: 'finish' };
                })(),
                finishReason: Promise.resolve('stop')
            };
            (streamText as any).mockResolvedValue(mockStreamResult);

            const result = await runParticleBasedGeneralAgent(
                mockRequest,
                'test-project',
                mockTransformRepo,
                mockJsondocRepo,
                'test-user'
            );

            expect(result.finalResponse).toBe('Test response');
            expect(result.contextSize).toBeGreaterThan(0);
            expect(result.contextSize).toBeLessThan(1000); // Much smaller than traditional approach
        });

        it('should handle project with no jsondocs', async () => {
            const { getParticleSystem } = await import('../ParticleSystemInitializer.js');
            (getParticleSystem as any).mockReturnValue(mockParticleSystem);

            (mockJsondocRepo.getProjectJsondocs as any).mockResolvedValue([]);

            const { getLLMModel } = await import('../../transform-jsondoc-framework/LLMConfig.js');
            (getLLMModel as any).mockResolvedValue({ model: 'test-model' });

            // Mock the UserContextMiddleware - skip import since it has complex dependencies
            const createUserContextMiddleware = vi.fn().mockReturnValue({ middleware: 'test' });

            const { streamText, wrapLanguageModel } = await import('ai');
            (wrapLanguageModel as any).mockReturnValue({ enhanced: 'model' });

            const mockStreamResult = {
                fullStream: (async function* () {
                    yield { type: 'text-delta', textDelta: 'Starting new project' };
                    yield { type: 'finish' };
                })(),
                finishReason: Promise.resolve('stop')
            };
            (streamText as any).mockResolvedValue(mockStreamResult);

            const result = await runParticleBasedGeneralAgent(
                mockRequest,
                'test-project',
                mockTransformRepo,
                mockJsondocRepo,
                'test-user'
            );

            expect(result.finalResponse).toBe('Starting new project');
            expect(result.contextSize).toBeGreaterThan(0);
        });

        it('should handle database errors gracefully', async () => {
            const { getParticleSystem } = await import('../ParticleSystemInitializer.js');
            (getParticleSystem as any).mockReturnValue(mockParticleSystem);

            (mockJsondocRepo.getProjectJsondocs as any).mockRejectedValue(new Error('Database error'));

            const { getLLMModel } = await import('../../transform-jsondoc-framework/LLMConfig.js');
            (getLLMModel as any).mockResolvedValue({ model: 'test-model' });

            const { createUserContextMiddleware } = await import('../../middleware/UserContextMiddleware.js');
            (createUserContextMiddleware as any).mockReturnValue({ middleware: 'test' });

            const { streamText, wrapLanguageModel } = await import('ai');
            (wrapLanguageModel as any).mockReturnValue({ enhanced: 'model' });

            const mockStreamResult = {
                fullStream: (async function* () {
                    yield { type: 'text-delta', textDelta: 'Fallback response' };
                    yield { type: 'finish' };
                })(),
                finishReason: Promise.resolve('stop')
            };
            (streamText as any).mockResolvedValue(mockStreamResult);

            const result = await runParticleBasedGeneralAgent(
                mockRequest,
                'test-project',
                mockTransformRepo,
                mockJsondocRepo,
                'test-user'
            );

            expect(result.finalResponse).toBe('Fallback response');
            // Should still work with fallback context
        });
    });

    describe('checkParticleBasedAgentHealth', () => {
        it('should return healthy status when particle system is available', async () => {
            const { getParticleSystem } = await import('../ParticleSystemInitializer.js');
            (getParticleSystem as any).mockReturnValue(mockParticleSystem);

            (mockUnifiedSearch.healthCheck as any).mockResolvedValue({
                stringSearchAvailable: true,
                embeddingSearchAvailable: true,
                particleCount: 100
            });

            const health = await checkParticleBasedAgentHealth();

            expect(health).toEqual({
                particleSystemAvailable: true,
                unifiedSearchAvailable: true,
                searchModes: {
                    stringSearchAvailable: true,
                    embeddingSearchAvailable: true
                },
                particleCount: 100
            });
        });

        it('should return unhealthy status when particle system is not available', async () => {
            const { getParticleSystem } = await import('../ParticleSystemInitializer.js');
            (getParticleSystem as any).mockReturnValue(null);

            const health = await checkParticleBasedAgentHealth();

            expect(health).toEqual({
                particleSystemAvailable: false,
                unifiedSearchAvailable: false,
                searchModes: {
                    stringSearchAvailable: false,
                    embeddingSearchAvailable: false
                },
                particleCount: 0
            });
        });

        it('should handle health check errors gracefully', async () => {
            const { getParticleSystem } = await import('../ParticleSystemInitializer.js');
            (getParticleSystem as any).mockReturnValue(mockParticleSystem);

            (mockUnifiedSearch.healthCheck as any).mockRejectedValue(new Error('Health check failed'));

            const health = await checkParticleBasedAgentHealth();

            expect(health).toEqual({
                particleSystemAvailable: false,
                unifiedSearchAvailable: false,
                searchModes: {
                    stringSearchAvailable: false,
                    embeddingSearchAvailable: false
                },
                particleCount: 0
            });
        });
    });
}); 