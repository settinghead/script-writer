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
            expect(toolDef.description).toContain('为指定范围的剧集生成详细的单集大纲');
            expect(toolDef.inputSchema).toBe(EpisodeSynopsisInputSchema);
            expect(typeof toolDef.execute).toBe('function');
        });

        it('should process episode synopsis generation for multiple episodes', async () => {
            const mockEpisodePlanningJsondoc = {
                id: 'episode-planning-id',
                schema_type: 'episode_planning',
                project_id: projectId,
                data: {
                    totalEpisodes: 30,
                    episodeGroups: [
                        {
                            groupTitle: '相遇篇',
                            episodes: '1-6',
                            plotDescription: '男女主角在特殊情况下初次相遇，产生误会和化学反应',
                            keyEvents: ['初次相遇', '误会产生'],
                            hooks: ['身份悬念', '情感冲突'],
                            emotionalBeats: ['好奇', '紧张', '心动']
                        }
                    ]
                }
            };

            const mockChroniclesJsondoc = {
                id: 'chronicles-id',
                schema_type: 'chronicles',
                project_id: projectId,
                data: {
                    stages: [
                        {
                            title: '初遇阶段',
                            episodes: [1, 2, 3],
                            keyEvents: ['相遇', '误会', '解释']
                        }
                    ]
                }
            };

            // Mock generated episode synopsis jsondocs
            const mockEpisode1Synopsis = {
                id: 'episode-1-synopsis-id',
                schema_type: 'episode_synopsis',
                project_id: projectId,
                data: {
                    episodeNumber: 1,
                    title: '初次相遇',
                    openingHook: '神秘男子突然出现',
                    mainPlot: '女主在咖啡厅遇到神秘男子',
                    emotionalClimax: '两人眼神交汇的瞬间',
                    cliffhanger: '男子留下神秘名片离开',
                    suspenseElements: ['身份悬念', '名片秘密'],
                    estimatedDuration: 120
                }
            };

            const mockEpisode2Synopsis = {
                id: 'episode-2-synopsis-id',
                schema_type: 'episode_synopsis',
                project_id: projectId,
                data: {
                    episodeNumber: 2,
                    title: '误会产生',
                    openingHook: '女主调查神秘名片',
                    mainPlot: '发现男子是竞争对手公司的人',
                    emotionalClimax: '女主感到被欺骗的愤怒',
                    cliffhanger: '男子出现解释真相',
                    suspenseElements: ['真实身份', '真正目的'],
                    estimatedDuration: 120
                }
            };

            (mockJsondocRepo.getJsondoc as any)
                .mockResolvedValueOnce(mockEpisodePlanningJsondoc)
                .mockResolvedValueOnce(mockChroniclesJsondoc)
                .mockResolvedValueOnce(mockEpisode1Synopsis) // First episode generation result
                .mockResolvedValueOnce(mockEpisode2Synopsis); // Second episode generation result

            (mockJsondocRepo.userHasProjectAccess as any)
                .mockResolvedValue(true);

            // Mock executeStreamingTransform to return different results for each episode
            (executeStreamingTransform as any)
                .mockResolvedValueOnce({
                    outputJsondocId: 'episode-1-synopsis-id',
                    finishReason: 'stop'
                })
                .mockResolvedValueOnce({
                    outputJsondocId: 'episode-2-synopsis-id',
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
                    { jsondocId: 'chronicles-id', description: 'Chronicles', schemaType: 'chronicles' as const }
                ],
                episodeStart: 1,
                episodeEnd: 2,
                groupTitle: '相遇篇'
            };

            const result = await toolDef.execute(input, { toolCallId: 'test-episode-synopsis' });

            // Should return array of jsondoc IDs
            expect(result.outputJsondocIds).toEqual(['episode-1-synopsis-id', 'episode-2-synopsis-id']);
            expect(result.finishReason).toBe('stop');

            // Should call executeStreamingTransform twice (once per episode)
            expect(executeStreamingTransform).toHaveBeenCalledTimes(2);

            // Should call getJsondoc for initial context + generated episodes
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledTimes(4);
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('episode-planning-id');
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('chronicles-id');
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('episode-1-synopsis-id');
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('episode-2-synopsis-id');

            // Verify first episode call (no previous episodes)
            const firstCall = (executeStreamingTransform as any).mock.calls[0][0];
            expect(firstCall.input.episodeNumber).toBe(1);
            expect(firstCall.input.jsondocs).toHaveLength(2); // Only initial context

            // Verify second episode call (includes first episode as context)
            const secondCall = (executeStreamingTransform as any).mock.calls[1][0];
            expect(secondCall.input.episodeNumber).toBe(2);
            expect(secondCall.input.jsondocs).toHaveLength(3); // Initial context + episode 1
            expect(secondCall.input.jsondocs[2].jsondocId).toBe('episode-1-synopsis-id');
        });

        it('should handle single episode generation', async () => {
            const mockEpisodePlanningJsondoc = {
                id: 'episode-planning-id',
                schema_type: 'episode_planning',
                project_id: projectId,
                data: { totalEpisodes: 30 }
            };

            const mockEpisodeSynopsis = {
                id: 'episode-5-synopsis-id',
                schema_type: 'episode_synopsis',
                project_id: projectId,
                data: {
                    episodeNumber: 5,
                    title: '转折点',
                    openingHook: '真相大白',
                    mainPlot: '所有秘密被揭露',
                    emotionalClimax: '主角做出重要决定',
                    cliffhanger: '新的危机出现',
                    suspenseElements: ['后续发展'],
                    estimatedDuration: 120
                }
            };

            (mockJsondocRepo.getJsondoc as any)
                .mockResolvedValueOnce(mockEpisodePlanningJsondoc)
                .mockResolvedValueOnce(mockEpisodeSynopsis);

            (mockJsondocRepo.userHasProjectAccess as any)
                .mockResolvedValue(true);

            (executeStreamingTransform as any).mockResolvedValue({
                outputJsondocId: 'episode-5-synopsis-id',
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
                episodeStart: 5,
                episodeEnd: 5,
                groupTitle: '转折篇'
            };

            const result = await toolDef.execute(input, { toolCallId: 'test-single-episode' });

            expect(result.outputJsondocIds).toEqual(['episode-5-synopsis-id']);
            expect(result.finishReason).toBe('stop');
            expect(executeStreamingTransform).toHaveBeenCalledTimes(1);
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
                episodeStart: 1,
                episodeEnd: 3,
                groupTitle: '测试篇'
            };

            expect(() => toolDef.inputSchema.parse(validInput)).not.toThrow();

            // Invalid input - missing required fields
            const invalidInput = {
                jsondocs: [],
                groupTitle: '测试篇'
                // Missing episodeStart and episodeEnd
            };

            expect(() => toolDef.inputSchema.parse(invalidInput)).toThrow();

            // Invalid input - wrong episode range (but valid schema)
            const invalidRangeInput = {
                jsondocs: [
                    { jsondocId: 'test-id', description: 'Test', schemaType: 'episode_planning' as const }
                ],
                episodeStart: 5,
                episodeEnd: 3, // End before start
                groupTitle: '测试篇'
            };

            expect(() => toolDef.inputSchema.parse(invalidRangeInput)).not.toThrow(); // Schema doesn't validate range logic, just structure
        });

        it('should handle cumulative context correctly for multiple episodes', async () => {
            // Mock 4 episodes to test the "previous 2 episodes" context logic
            const mockJsondocs = Array.from({ length: 4 }, (_, i) => ({
                id: `episode-${i + 1}-synopsis-id`,
                schema_type: 'episode_synopsis',
                project_id: projectId,
                data: {
                    episodeNumber: i + 1,
                    title: `Episode ${i + 1}`,
                    openingHook: `Hook ${i + 1}`,
                    mainPlot: `Plot ${i + 1}`,
                    emotionalClimax: `Climax ${i + 1}`,
                    cliffhanger: `Cliffhanger ${i + 1}`,
                    suspenseElements: [`Element ${i + 1}`],
                    estimatedDuration: 120
                }
            }));

            const mockEpisodePlanningJsondoc = {
                id: 'episode-planning-id',
                schema_type: 'episode_planning',
                project_id: projectId,
                data: { totalEpisodes: 30 }
            };

            // Setup getJsondoc mock to return planning + generated episodes
            (mockJsondocRepo.getJsondoc as any)
                .mockResolvedValueOnce(mockEpisodePlanningJsondoc) // Initial context
                .mockResolvedValueOnce(mockJsondocs[0]) // Episode 1 result
                .mockResolvedValueOnce(mockJsondocs[1]) // Episode 2 result  
                .mockResolvedValueOnce(mockJsondocs[2]) // Episode 3 result
                .mockResolvedValueOnce(mockJsondocs[3]); // Episode 4 result

            (mockJsondocRepo.userHasProjectAccess as any)
                .mockResolvedValue(true);

            // Mock streaming transform results
            (executeStreamingTransform as any)
                .mockResolvedValueOnce({ outputJsondocId: 'episode-1-synopsis-id', finishReason: 'stop' })
                .mockResolvedValueOnce({ outputJsondocId: 'episode-2-synopsis-id', finishReason: 'stop' })
                .mockResolvedValueOnce({ outputJsondocId: 'episode-3-synopsis-id', finishReason: 'stop' })
                .mockResolvedValueOnce({ outputJsondocId: 'episode-4-synopsis-id', finishReason: 'stop' });

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
                episodeStart: 1,
                episodeEnd: 4,
                groupTitle: '测试篇'
            };

            const result = await toolDef.execute(input, { toolCallId: 'test-cumulative-context' });

            expect(result.outputJsondocIds).toHaveLength(4);
            expect(executeStreamingTransform).toHaveBeenCalledTimes(4);

            // Check context for each episode call
            const calls = (executeStreamingTransform as any).mock.calls;

            // Episode 1: Only initial context
            expect(calls[0][0].input.jsondocs).toHaveLength(1);

            // Episode 2: Initial context + episode 1
            expect(calls[1][0].input.jsondocs).toHaveLength(2);
            expect(calls[1][0].input.jsondocs[1].jsondocId).toBe('episode-1-synopsis-id');

            // Episode 3: Initial context + episodes 1 and 2
            expect(calls[2][0].input.jsondocs).toHaveLength(3);
            expect(calls[2][0].input.jsondocs[1].jsondocId).toBe('episode-1-synopsis-id');
            expect(calls[2][0].input.jsondocs[2].jsondocId).toBe('episode-2-synopsis-id');

            // Episode 4: Initial context + episodes 2 and 3 (only last 2)
            expect(calls[3][0].input.jsondocs).toHaveLength(3);
            expect(calls[3][0].input.jsondocs[1].jsondocId).toBe('episode-2-synopsis-id');
            expect(calls[3][0].input.jsondocs[2].jsondocId).toBe('episode-3-synopsis-id');
        });
    });
}); 