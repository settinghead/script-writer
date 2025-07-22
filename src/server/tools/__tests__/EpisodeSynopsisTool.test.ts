import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEpisodeSynopsisToolDefinition } from '../EpisodeSynopsisTool';
import type { TransformRepository } from '../../transform-jsondoc-framework/TransformRepository';
import type { JsondocRepository } from '../../transform-jsondoc-framework/JsondocRepository';
import { EpisodeSynopsisInputSchema } from '../../../common/schemas/outlineSchemas';

// Mock the streaming transform executor
vi.mock('../../transform-jsondoc-framework/StreamingTransformExecutor', () => ({
    executeStreamingTransform: vi.fn()
}));

import { executeStreamingTransform } from '../../transform-jsondoc-framework/StreamingTransformExecutor';

describe('EpisodeSynopsisTool', () => {
    let mockTransformRepo: TransformRepository;
    let mockJsondocRepo: JsondocRepository;
    const projectId = 'test-project-id';
    const userId = 'test-user-id';

    beforeEach(() => {
        vi.clearAllMocks();

        mockTransformRepo = {} as TransformRepository;
        mockJsondocRepo = {
            getJsondoc: vi.fn(),
            userHasProjectAccess: vi.fn()
        } as any;
    });

    describe('createEpisodeSynopsisToolDefinition', () => {
        it('should create a tool definition with correct structure', () => {
            const toolDef = createEpisodeSynopsisToolDefinition(
                mockTransformRepo,
                mockJsondocRepo,
                projectId,
                userId
            );

            expect(toolDef.name).toBe('generate_episode_synopsis');
            expect(toolDef.description).toContain('生成指定剧集组的详细每集大纲');
            expect(toolDef.inputSchema).toBe(EpisodeSynopsisInputSchema);
            expect(typeof toolDef.execute).toBe('function');
        });

        it('should process episode synopsis generation with all context', async () => {
            const mockEpisodePlanningJsondoc = {
                id: 'episode-planning-id',
                schema_type: 'episode_planning',
                project_id: projectId,
                data: {
                    episodeGroups: [
                        {
                            groupTitle: '相遇篇',
                            episodes: '1-3',
                            keyEvents: ['男女主相遇', '初次误会', '化解误会'],
                            hooks: ['开场悬念', '身份误会', '真相揭露'],
                            emotionalBeats: ['好奇', '误解', '理解']
                        }
                    ]
                }
            };

            const mockChroniclesJsondoc = {
                id: 'chronicles-id',
                schema_type: 'chronicles',
                project_id: projectId,
                data: {
                    title: 'Test Chronicles',
                    stages: [
                        { title: '相遇阶段', stageSynopsis: '男女主角的初次相遇' }
                    ]
                }
            };

            const mockBrainstormJsondoc = {
                id: 'brainstorm-id',
                schema_type: '灵感创意',
                project_id: projectId,
                data: {
                    title: '霸总甜宠故事',
                    body: '现代都市背景的霸总与平凡女主的甜宠故事'
                }
            };

            const mockOutlineJsondoc = {
                id: 'outline-id',
                schema_type: '剧本设定',
                project_id: projectId,
                data: {
                    title: '甜宠短剧设定',
                    genre: '现代甜宠',
                    platform: '抖音'
                }
            };

            (mockJsondocRepo.getJsondoc as any)
                .mockResolvedValueOnce(mockEpisodePlanningJsondoc)
                .mockResolvedValueOnce(mockChroniclesJsondoc)
                .mockResolvedValueOnce(mockBrainstormJsondoc)
                .mockResolvedValueOnce(mockOutlineJsondoc);

            (mockJsondocRepo.userHasProjectAccess as any)
                .mockResolvedValue(true);

            (executeStreamingTransform as any).mockResolvedValue({
                outputJsondocId: 'episode-synopsis-output-id',
                finishReason: 'stop'
            });

            const toolDef = createEpisodeSynopsisToolDefinition(
                mockTransformRepo,
                mockJsondocRepo,
                projectId,
                userId
            );

            const input = {
                jsondocs: [
                    { jsondocId: 'episode-planning-id', description: 'Episode planning', schemaType: 'episode_planning' as const },
                    { jsondocId: 'chronicles-id', description: 'Chronicles', schemaType: 'chronicles' as const },
                    { jsondocId: 'brainstorm-id', description: 'Brainstorm idea', schemaType: '灵感创意' as const },
                    { jsondocId: 'outline-id', description: 'Outline settings', schemaType: '剧本设定' as const }
                ],
                groupTitle: '相遇篇',
                episodeRange: '1-3',
                episodes: [1, 2, 3]
            };

            const result = await toolDef.execute(input, { toolCallId: 'test-episode-synopsis' });

            expect(result.outputJsondocId).toBe('episode-synopsis-output-id');
            expect(result.finishReason).toBe('stop');

            // Verify all jsondocs were accessed
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledTimes(4);
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('episode-planning-id');
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('chronicles-id');
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('brainstorm-id');
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('outline-id');

            // Verify access checks
            expect(mockJsondocRepo.userHasProjectAccess).toHaveBeenCalledTimes(4);

            // Verify streaming transform was called with correct metadata
            expect(executeStreamingTransform).toHaveBeenCalledWith({
                config: expect.objectContaining({
                    templateName: 'episode_synopsis_generation',
                    outputSchema: expect.any(Object)
                }),
                input,
                projectId,
                userId,
                transformRepo: mockTransformRepo,
                jsondocRepo: mockJsondocRepo,
                outputJsondocType: 'episode_synopsis',
                transformMetadata: {
                    toolName: 'generate_episode_synopsis',
                    episode_planning: 'episode-planning-id',
                    chronicles: 'chronicles-id',
                    灵感创意: 'brainstorm-id',
                    剧本设定: 'outline-id',
                    target_group_title: '相遇篇',
                    target_episode_range: '1-3',
                    target_episodes: '1,2,3'
                },
                enableCaching: undefined,
                seed: undefined,
                temperature: undefined,
                topP: undefined,
                maxTokens: undefined,
                toolCallId: 'test-episode-synopsis'
            });
        });

        it('should handle minimal context gracefully', async () => {
            const mockEpisodePlanningJsondoc = {
                id: 'episode-planning-id',
                schema_type: 'episode_planning',
                project_id: projectId,
                data: {
                    episodeGroups: [
                        {
                            groupTitle: '开场篇',
                            episodes: '4-6',
                            keyEvents: ['新的开始'],
                            hooks: ['悬念设置'],
                            emotionalBeats: ['期待']
                        }
                    ]
                }
            };

            (mockJsondocRepo.getJsondoc as any)
                .mockResolvedValueOnce(mockEpisodePlanningJsondoc)
                .mockResolvedValueOnce(null) // Missing chronicles
                .mockResolvedValueOnce(null) // Missing brainstorm
                .mockResolvedValueOnce(null); // Missing outline

            (mockJsondocRepo.userHasProjectAccess as any)
                .mockResolvedValue(true);

            (executeStreamingTransform as any).mockResolvedValue({
                outputJsondocId: 'episode-synopsis-output-id',
                finishReason: 'stop'
            });

            const toolDef = createEpisodeSynopsisToolDefinition(
                mockTransformRepo,
                mockJsondocRepo,
                projectId,
                userId
            );

            const input = {
                jsondocs: [
                    { jsondocId: 'episode-planning-id', description: 'Episode planning', schemaType: 'episode_planning' as const },
                    { jsondocId: 'missing-chronicles', description: 'Missing chronicles', schemaType: 'chronicles' as const },
                    { jsondocId: 'missing-brainstorm', description: 'Missing brainstorm', schemaType: '灵感创意' as const },
                    { jsondocId: 'missing-outline', description: 'Missing outline', schemaType: '剧本设定' as const }
                ],
                groupTitle: '开场篇',
                episodeRange: '4-6',
                episodes: [4, 5, 6]
            };

            const result = await toolDef.execute(input, { toolCallId: 'test-minimal-context' });

            expect(result.outputJsondocId).toBe('episode-synopsis-output-id');
            expect(result.finishReason).toBe('stop');

            // Should still call streaming transform with available metadata
            expect(executeStreamingTransform).toHaveBeenCalledWith({
                config: expect.objectContaining({
                    templateName: 'episode_synopsis_generation'
                }),
                input,
                projectId,
                userId,
                transformRepo: mockTransformRepo,
                jsondocRepo: mockJsondocRepo,
                outputJsondocType: 'episode_synopsis',
                transformMetadata: {
                    toolName: 'generate_episode_synopsis',
                    episode_planning: 'episode-planning-id',
                    target_group_title: '开场篇',
                    target_episode_range: '4-6',
                    target_episodes: '4,5,6'
                },
                enableCaching: undefined,
                seed: undefined,
                temperature: undefined,
                topP: undefined,
                maxTokens: undefined,
                toolCallId: 'test-minimal-context'
            });
        });

        it('should handle access denied gracefully', async () => {
            const mockJsondoc = {
                id: 'restricted-id',
                schema_type: 'episode_planning',
                project_id: 'different-project',
                data: { episodeGroups: [] }
            };

            (mockJsondocRepo.getJsondoc as any)
                .mockResolvedValueOnce(mockJsondoc);

            (mockJsondocRepo.userHasProjectAccess as any)
                .mockResolvedValue(false); // Access denied

            (executeStreamingTransform as any).mockResolvedValue({
                outputJsondocId: 'episode-synopsis-output-id',
                finishReason: 'stop'
            });

            const toolDef = createEpisodeSynopsisToolDefinition(
                mockTransformRepo,
                mockJsondocRepo,
                projectId,
                userId
            );

            const input = {
                jsondocs: [
                    { jsondocId: 'restricted-id', description: 'Restricted jsondoc', schemaType: 'episode_planning' as const }
                ],
                groupTitle: '测试篇',
                episodeRange: '1-3',
                episodes: [1, 2, 3]
            };

            const result = await toolDef.execute(input, { toolCallId: 'test-access-denied' });

            expect(result.outputJsondocId).toBe('episode-synopsis-output-id');
            expect(result.finishReason).toBe('stop');

            // Should proceed without restricted jsondoc metadata
            expect(executeStreamingTransform).toHaveBeenCalledWith({
                config: expect.objectContaining({
                    templateName: 'episode_synopsis_generation'
                }),
                input,
                projectId,
                userId,
                transformRepo: mockTransformRepo,
                jsondocRepo: mockJsondocRepo,
                outputJsondocType: 'episode_synopsis',
                transformMetadata: {
                    toolName: 'generate_episode_synopsis',
                    target_group_title: '测试篇',
                    target_episode_range: '1-3',
                    target_episodes: '1,2,3'
                },
                enableCaching: undefined,
                seed: undefined,
                temperature: undefined,
                topP: undefined,
                maxTokens: undefined,
                toolCallId: 'test-access-denied'
            });
        });

        it('should pass caching options to streaming transform', async () => {
            (executeStreamingTransform as any).mockResolvedValue({
                outputJsondocId: 'episode-synopsis-output-id',
                finishReason: 'stop'
            });

            const cachingOptions = {
                enableCaching: true,
                seed: 123,
                temperature: 0.8,
                topP: 0.95,
                maxTokens: 3000
            };

            const toolDef = createEpisodeSynopsisToolDefinition(
                mockTransformRepo,
                mockJsondocRepo,
                projectId,
                userId,
                cachingOptions
            );

            const input = {
                jsondocs: [],
                groupTitle: '缓存测试篇',
                episodeRange: '7-9',
                episodes: [7, 8, 9]
            };

            await toolDef.execute(input, { toolCallId: 'test-caching-options' });

            expect(executeStreamingTransform).toHaveBeenCalledWith({
                config: expect.objectContaining({
                    templateName: 'episode_synopsis_generation'
                }),
                input,
                projectId,
                userId,
                transformRepo: mockTransformRepo,
                jsondocRepo: mockJsondocRepo,
                outputJsondocType: 'episode_synopsis',
                transformMetadata: {
                    toolName: 'generate_episode_synopsis',
                    target_group_title: '缓存测试篇',
                    target_episode_range: '7-9',
                    target_episodes: '7,8,9'
                },
                enableCaching: true,
                seed: 123,
                temperature: 0.8,
                topP: 0.95,
                maxTokens: 3000,
                toolCallId: 'test-caching-options'
            });
        });

        it('should validate input schema correctly', () => {
            const toolDef = createEpisodeSynopsisToolDefinition(
                mockTransformRepo,
                mockJsondocRepo,
                projectId,
                userId
            );

            // Valid input
            const validInput = {
                jsondocs: [
                    { jsondocId: 'test-id', description: 'Test', schemaType: 'episode_planning' as const }
                ],
                groupTitle: '测试篇',
                episodeRange: '1-3',
                episodes: [1, 2, 3]
            };

            expect(() => toolDef.inputSchema.parse(validInput)).not.toThrow();

            // Invalid input - missing required fields
            const invalidInput = {
                jsondocs: [],
                groupTitle: '测试篇'
                // Missing episodeRange and episodes
            };

            expect(() => toolDef.inputSchema.parse(invalidInput)).toThrow();

            // Invalid input - wrong episode array type
            const invalidEpisodesInput = {
                jsondocs: [],
                groupTitle: '测试篇',
                episodeRange: '1-3',
                episodes: ['1', '2', '3'] // Should be numbers
            };

            expect(() => toolDef.inputSchema.parse(invalidEpisodesInput)).toThrow();
        });

        it('should handle different episode ranges correctly', async () => {
            const mockEpisodePlanningJsondoc = {
                id: 'episode-planning-id',
                schema_type: 'episode_planning',
                project_id: projectId,
                data: {
                    episodeGroups: [
                        {
                            groupTitle: '高潮篇',
                            episodes: '10-15',
                            keyEvents: ['大反转', '真相大白', '情感爆发'],
                            hooks: ['身份揭露', '误会解除', '感情升华'],
                            emotionalBeats: ['震惊', '理解', '感动']
                        }
                    ]
                }
            };

            (mockJsondocRepo.getJsondoc as any)
                .mockResolvedValueOnce(mockEpisodePlanningJsondoc);

            (mockJsondocRepo.userHasProjectAccess as any)
                .mockResolvedValue(true);

            (executeStreamingTransform as any).mockResolvedValue({
                outputJsondocId: 'episode-synopsis-output-id',
                finishReason: 'stop'
            });

            const toolDef = createEpisodeSynopsisToolDefinition(
                mockTransformRepo,
                mockJsondocRepo,
                projectId,
                userId
            );

            const input = {
                jsondocs: [
                    { jsondocId: 'episode-planning-id', description: 'Episode planning', schemaType: 'episode_planning' as const }
                ],
                groupTitle: '高潮篇',
                episodeRange: '10-15',
                episodes: [10, 11, 12, 13, 14, 15]
            };

            const result = await toolDef.execute(input, { toolCallId: 'test-large-range' });

            expect(result.outputJsondocId).toBe('episode-synopsis-output-id');
            expect(result.finishReason).toBe('stop');

            expect(executeStreamingTransform).toHaveBeenCalledWith({
                config: expect.objectContaining({
                    templateName: 'episode_synopsis_generation'
                }),
                input,
                projectId,
                userId,
                transformRepo: mockTransformRepo,
                jsondocRepo: mockJsondocRepo,
                outputJsondocType: 'episode_synopsis',
                transformMetadata: {
                    toolName: 'generate_episode_synopsis',
                    episode_planning: 'episode-planning-id',
                    target_group_title: '高潮篇',
                    target_episode_range: '10-15',
                    target_episodes: '10,11,12,13,14,15'
                },
                enableCaching: undefined,
                seed: undefined,
                temperature: undefined,
                topP: undefined,
                maxTokens: undefined,
                toolCallId: 'test-large-range'
            });
        });
    });
}); 