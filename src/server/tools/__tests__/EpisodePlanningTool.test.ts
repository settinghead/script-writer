import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEpisodePlanningToolDefinition } from '../EpisodePlanningTool';
import type { TransformRepository } from '../../transform-jsondoc-framework/TransformRepository';
import type { JsondocRepository } from '../../transform-jsondoc-framework/JsondocRepository';
import { EpisodePlanningInputSchema } from '../../../common/schemas/outlineSchemas';

// Mock the streaming transform executor
vi.mock('../../transform-jsondoc-framework/StreamingTransformExecutor', () => ({
    executeStreamingTransform: vi.fn()
}));

import { executeStreamingTransform } from '../../transform-jsondoc-framework/StreamingTransformExecutor';

describe('EpisodePlanningTool', () => {
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

    describe('createEpisodePlanningToolDefinition', () => {
        it('should create a tool definition with correct structure', () => {
            const toolDef = createEpisodePlanningToolDefinition(
                mockTransformRepo,
                mockJsondocRepo,
                projectId,
                userId
            );

            expect(toolDef.name).toBe('generate_episode_planning');
            expect(toolDef.description).toContain('生成剧集框架');
            expect(toolDef.inputSchema).toBe(EpisodePlanningInputSchema);
            expect(typeof toolDef.execute).toBe('function');
        });

        it('should process all provided jsondocs', async () => {
            const mockChroniclesJsondoc = {
                id: 'chronicles-id',
                schema_type: 'chronicles',
                project_id: projectId,
                data: {
                    title: 'Test Chronicles',
                    stages: [
                        { title: 'Stage 1', events: ['Event 1'] },
                        { title: 'Stage 2', events: ['Event 2'] }
                    ]
                }
            };

            const mockBrainstormJsondoc = {
                id: 'brainstorm-id',
                schema_type: 'brainstorm_idea',
                project_id: projectId,
                data: {
                    title: 'Test Brainstorm',
                    body: 'Test brainstorm content'
                }
            };

            const mockOutlineJsondoc = {
                id: 'outline-id',
                schema_type: 'outline_settings',
                project_id: projectId,
                data: {
                    title: 'Test Outline',
                    genre: 'romance'
                }
            };

            (mockJsondocRepo.getJsondoc as any)
                .mockResolvedValueOnce(mockChroniclesJsondoc)
                .mockResolvedValueOnce(mockBrainstormJsondoc)
                .mockResolvedValueOnce(mockOutlineJsondoc);

            (mockJsondocRepo.userHasProjectAccess as any)
                .mockResolvedValue(true);

            (executeStreamingTransform as any).mockResolvedValue({
                outputJsondocId: 'output-id',
                finishReason: 'completed'
            });

            const toolDef = createEpisodePlanningToolDefinition(
                mockTransformRepo,
                mockJsondocRepo,
                projectId,
                userId
            );

            const input = {
                jsondocs: [
                    { jsondocId: 'chronicles-id', description: 'Chronicles data', schemaType: 'chronicles' as const },
                    { jsondocId: 'brainstorm-id', description: 'Brainstorm idea', schemaType: 'brainstorm_idea' as const },
                    { jsondocId: 'outline-id', description: 'Outline settings', schemaType: 'outline_settings' as const }
                ],
                numberOfEpisodes: 30,
                requirements: 'Test requirements'
            };

            const result = await toolDef.execute(input, { toolCallId: 'test-tool-call' });

            expect(result.outputJsondocId).toBe('output-id');
            expect(result.finishReason).toBe('completed');

            // Verify all jsondocs were accessed
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledTimes(3);
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('chronicles-id');
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('brainstorm-id');
            expect(mockJsondocRepo.getJsondoc).toHaveBeenCalledWith('outline-id');

            // Verify access checks
            expect(mockJsondocRepo.userHasProjectAccess).toHaveBeenCalledTimes(3);

            // Verify streaming transform was called with correct metadata
            expect(executeStreamingTransform).toHaveBeenCalledWith({
                config: expect.objectContaining({
                    templateName: 'episode_planning'
                }),
                input,
                projectId,
                userId,
                transformRepo: mockTransformRepo,
                jsondocRepo: mockJsondocRepo,
                outputJsondocType: 'episode_planning',
                transformMetadata: {
                    toolName: 'generate_episode_planning',
                    chronicles: 'chronicles-id',
                    brainstorm_idea: 'brainstorm-id',
                    outline_settings: 'outline-id',
                    numberOfEpisodes: 30,
                    requirements: 'Test requirements'
                },
                enableCaching: undefined,
                seed: undefined,
                temperature: undefined,
                topP: undefined,
                maxTokens: undefined
            });
        });

        it('should handle missing jsondocs gracefully', async () => {
            (mockJsondocRepo.getJsondoc as any)
                .mockResolvedValueOnce(null); // First jsondoc not found

            (executeStreamingTransform as any).mockResolvedValue({
                outputJsondocId: 'output-id',
                finishReason: 'completed'
            });

            const toolDef = createEpisodePlanningToolDefinition(
                mockTransformRepo,
                mockJsondocRepo,
                projectId,
                userId
            );

            const input = {
                jsondocs: [
                    { jsondocId: 'missing-id', description: 'Missing jsondoc', schemaType: 'chronicles' as const }
                ],
                numberOfEpisodes: 20,
                requirements: 'Test requirements'
            };

            const result = await toolDef.execute(input, { toolCallId: 'test-tool-call' });

            expect(result.outputJsondocId).toBe('output-id');
            expect(result.finishReason).toBe('completed');

            // Should still call streaming transform with empty metadata
            expect(executeStreamingTransform).toHaveBeenCalledWith({
                config: expect.objectContaining({
                    templateName: 'episode_planning'
                }),
                input,
                projectId,
                userId,
                transformRepo: mockTransformRepo,
                jsondocRepo: mockJsondocRepo,
                outputJsondocType: 'episode_planning',
                transformMetadata: {
                    toolName: 'generate_episode_planning',
                    numberOfEpisodes: 20,
                    requirements: 'Test requirements'
                },
                enableCaching: undefined,
                seed: undefined,
                temperature: undefined,
                topP: undefined,
                maxTokens: undefined
            });
        });

        it('should handle access denied gracefully', async () => {
            const mockJsondoc = {
                id: 'test-id',
                schema_type: 'chronicles',
                project_id: projectId,
                data: { title: 'Test' }
            };

            (mockJsondocRepo.getJsondoc as any)
                .mockResolvedValueOnce(mockJsondoc);

            (mockJsondocRepo.userHasProjectAccess as any)
                .mockResolvedValue(false); // Access denied

            (executeStreamingTransform as any).mockResolvedValue({
                outputJsondocId: 'output-id',
                finishReason: 'completed'
            });

            const toolDef = createEpisodePlanningToolDefinition(
                mockTransformRepo,
                mockJsondocRepo,
                projectId,
                userId
            );

            const input = {
                jsondocs: [
                    { jsondocId: 'test-id', description: 'Test jsondoc', schemaType: 'chronicles' as const }
                ],
                numberOfEpisodes: 20,
                requirements: 'Test requirements'
            };

            const result = await toolDef.execute(input, { toolCallId: 'test-tool-call' });

            expect(result.outputJsondocId).toBe('output-id');
            expect(result.finishReason).toBe('completed');

            // Should still proceed with empty metadata
            expect(executeStreamingTransform).toHaveBeenCalledWith({
                config: expect.objectContaining({
                    templateName: 'episode_planning'
                }),
                input,
                projectId,
                userId,
                transformRepo: mockTransformRepo,
                jsondocRepo: mockJsondocRepo,
                outputJsondocType: 'episode_planning',
                transformMetadata: {
                    toolName: 'generate_episode_planning',
                    numberOfEpisodes: 20,
                    requirements: 'Test requirements'
                },
                enableCaching: undefined,
                seed: undefined,
                temperature: undefined,
                topP: undefined,
                maxTokens: undefined
            });
        });

        it('should pass caching options to streaming transform', async () => {
            (executeStreamingTransform as any).mockResolvedValue({
                outputJsondocId: 'output-id',
                finishReason: 'completed'
            });

            const cachingOptions = {
                enableCaching: true,
                seed: 42,
                temperature: 0.7,
                topP: 0.9,
                maxTokens: 2000
            };

            const toolDef = createEpisodePlanningToolDefinition(
                mockTransformRepo,
                mockJsondocRepo,
                projectId,
                userId,
                cachingOptions
            );

            const input = {
                jsondocs: [],
                numberOfEpisodes: 20,
                requirements: 'Test requirements'
            };

            await toolDef.execute(input, { toolCallId: 'test-tool-call' });

            expect(executeStreamingTransform).toHaveBeenCalledWith({
                config: expect.objectContaining({
                    templateName: 'episode_planning'
                }),
                input,
                projectId,
                userId,
                transformRepo: mockTransformRepo,
                jsondocRepo: mockJsondocRepo,
                outputJsondocType: 'episode_planning',
                transformMetadata: {
                    toolName: 'generate_episode_planning',
                    numberOfEpisodes: 20,
                    requirements: 'Test requirements'
                },
                enableCaching: true,
                seed: 42,
                temperature: 0.7,
                topP: 0.9,
                maxTokens: 2000
            });
        });
    });
}); 