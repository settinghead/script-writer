import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEpisodePlanningToolDefinition } from '../EpisodePlanningTool';
import type { TransformJsondocRepository } from '../../transform-jsondoc-framework/TransformJsondocRepository';
import { EpisodePlanningInputSchema } from '../../../common/schemas/outlineSchemas';

// Mock the streaming transform executor
vi.mock('../../transform-jsondoc-framework/StreamingTransformExecutor', () => ({
    executeStreamingTransform: vi.fn()
}));

import { executeStreamingTransform } from '../../transform-jsondoc-framework/StreamingTransformExecutor';

describe('EpisodePlanningTool', () => {
    let mockTransformRepo: TransformJsondocRepository
    let mockJsondocRepo: TransformJsondocRepository;
    const projectId = 'test-project-id';
    const userId = 'test-user-id';

    beforeEach(() => {
        vi.clearAllMocks();

        mockTransformRepo = {} as TransformJsondocRepository
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

            expect(toolDef.name).toBe('generate_分集结构');
            expect(toolDef.description).toContain('生成分集结构');
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
                schema_type: '灵感创意',
                project_id: projectId,
                data: {
                    title: 'Test Brainstorm',
                    body: 'Test brainstorm content'
                }
            };

            const mockOutlineJsondoc = {
                id: 'outline-id',
                schema_type: '剧本设定',
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
                    { jsondocId: 'brainstorm-id', description: 'Brainstorm idea', schemaType: '灵感创意' as const },
                    { jsondocId: 'outline-id', description: 'Outline settings', schemaType: '剧本设定' as const }
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
            const calls = vi.mocked(executeStreamingTransform).mock.calls;
            expect(calls).toHaveLength(1);
            expect(calls[0][0]).toMatchObject({
                input,
                projectId,
                userId,
                transformRepo: mockTransformRepo,
                jsondocRepo: mockJsondocRepo,
                outputJsondocType: '分集结构',
                transformMetadata: {
                    toolName: 'generate_分集结构',
                    chronicles: 'chronicles-id',
                    灵感创意: 'brainstorm-id',
                    剧本设定: 'outline-id',
                    numberOfEpisodes: 30,
                    requirements: 'Test requirements'
                },
            });
            expect(calls[0][0].config.templateName).toBe('分集结构');
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
            const calls = vi.mocked(executeStreamingTransform).mock.calls;
            expect(calls).toHaveLength(1);
            expect(calls[0][0]).toMatchObject({
                input,
                projectId,
                userId,
                transformRepo: mockTransformRepo,
                jsondocRepo: mockJsondocRepo,
                outputJsondocType: '分集结构',
                transformMetadata: {
                    toolName: 'generate_分集结构',
                    numberOfEpisodes: 20,
                    requirements: 'Test requirements'
                },
            });
            expect(calls[0][0].config.templateName).toBe('分集结构');
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
            const calls = vi.mocked(executeStreamingTransform).mock.calls;
            expect(calls).toHaveLength(1);
            expect(calls[0][0]).toMatchObject({
                input,
                projectId,
                userId,
                transformRepo: mockTransformRepo,
                jsondocRepo: mockJsondocRepo,
                outputJsondocType: '分集结构',
                transformMetadata: {
                    toolName: 'generate_分集结构',
                    numberOfEpisodes: 20,
                    requirements: 'Test requirements'
                },
            });
            expect(calls[0][0].config.templateName).toBe('分集结构');
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

            const calls = vi.mocked(executeStreamingTransform).mock.calls;
            expect(calls).toHaveLength(1);
            expect(calls[0][0]).toMatchObject({
                input,
                projectId,
                userId,
                transformRepo: mockTransformRepo,
                jsondocRepo: mockJsondocRepo,
                outputJsondocType: '分集结构',
                transformMetadata: {
                    toolName: 'generate_分集结构',
                    numberOfEpisodes: 20,
                    requirements: 'Test requirements'
                },
                enableCaching: true,
                seed: 42,
                temperature: 0.7,
                topP: 0.9,
                maxTokens: 2000
            });
            expect(calls[0][0].config.templateName).toBe('分集结构');
        });
    });
}); 