import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createIntentShortcutService } from '../IntentShortcutService.js';
import { createIntentParameterResolver } from '../IntentParameterResolver.js';
import { CanonicalJsondocService } from '../CanonicalJsondocService.js';
import { createMessageWithDisplay } from '../../conversation/ConversationManager.js';
import { buildAgentConfiguration } from '../AgentRequestBuilder.js';
import { createAgentTool } from '../../transform-jsondoc-framework/StreamingAgentFramework.js';

// Mock dependencies
vi.mock('../CanonicalJsondocService.js');
vi.mock('../IntentParameterResolver.js');
vi.mock('../../conversation/ConversationManager.js');
vi.mock('../AgentRequestBuilder.js');
vi.mock('../../transform-jsondoc-framework/StreamingAgentFramework.js');

const mockCanonicalService = {
    getProjectCanonicalData: vi.fn()
} as any;

const mockJsondocRepo = {
    userHasProjectAccess: vi.fn()
} as any;

const mockTransformRepo = {} as any;

// Mock the createIntentParameterResolver
const mockParameterResolver = {
    resolveParameters: vi.fn()
};

vi.mock('../IntentParameterResolver.js', () => ({
    createIntentParameterResolver: vi.fn(() => mockParameterResolver)
}));

const mockToolDefinition = {
    name: 'generate_灵感创意s',
    description: 'Test tool',
    inputSchema: {},
    outputSchema: {},
    execute: vi.fn()
};

const mockTool = {
    execute: vi.fn()
};

describe('IntentShortcutService', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Mock createIntentParameterResolver
        (createIntentParameterResolver as any).mockReturnValue(mockParameterResolver);

        // Mock buildAgentConfiguration
        (buildAgentConfiguration as any).mockResolvedValue({
            tools: [mockToolDefinition]
        });

        // Mock createAgentTool
        (createAgentTool as any).mockReturnValue(mockTool);

        // Mock createMessageWithDisplay
        (createMessageWithDisplay as any).mockResolvedValue({ rawMessageId: 'msg-1' });
    });

    describe('createIntentShortcutService', () => {
        it('should create service with correct dependencies', () => {
            const service = createIntentShortcutService({
                canonicalService: mockCanonicalService,
                jsondocRepo: mockJsondocRepo,
                transformRepo: mockTransformRepo
            });

            expect(service).toHaveProperty('handleIntent');
            expect(service).toHaveProperty('isIntentSupported');
            expect(service).toHaveProperty('createIntentHandler');
            expect(service).toHaveProperty('executeToolDirectly');
        });

        it('should support valid intent types', () => {
            const service = createIntentShortcutService({
                canonicalService: mockCanonicalService,
                jsondocRepo: mockJsondocRepo,
                transformRepo: mockTransformRepo
            });

            expect(service.isIntentSupported('generate_brainstorm')).toBe(true);
            expect(service.isIntentSupported('generate_episode_script')).toBe(true);
            expect(service.isIntentSupported('invalid_intent')).toBe(false);
        });
    });

    describe('handleIntent', () => {
        it('should handle brainstorm intent successfully', async () => {
            const service = createIntentShortcutService({
                canonicalService: mockCanonicalService,
                jsondocRepo: mockJsondocRepo,
                transformRepo: mockTransformRepo
            });

            const mockParams = {
                jsondocs: ['jsondoc-1'],
                numberOfIdeas: 3,
                userRequirements: 'test requirements'
            };

            const mockToolResult = {
                outputJsondocId: 'result-1',
                message: 'Success'
            };

            mockParameterResolver.resolveParameters.mockResolvedValue(mockParams);
            mockTool.execute.mockResolvedValue(mockToolResult);

            const context = {
                intent: 'generate_brainstorm' as const,
                metadata: { numberOfIdeas: 3 },
                content: '生成创意想法',
                conversationId: 'conv-1',
                projectId: 'proj-1',
                userId: 'user-1'
            };

            await service.handleIntent(context);

            // Verify parameter resolution was called
            expect(mockParameterResolver.resolveParameters).toHaveBeenCalledWith(context);

            // Verify messages were created in correct order
            expect(createMessageWithDisplay).toHaveBeenCalledTimes(4);

            // Thinking message
            expect(createMessageWithDisplay).toHaveBeenNthCalledWith(
                1,
                'conv-1',
                'assistant',
                '🧠 正在为您头脑风暴创意想法...',
                { status: 'streaming' }
            );

            // Tool call message
            expect(createMessageWithDisplay).toHaveBeenNthCalledWith(
                2,
                'conv-1',
                'tool',
                expect.stringContaining('generate_灵感创意s'),
                expect.objectContaining({
                    toolName: 'generate_灵感创意s',
                    toolParameters: mockParams,
                    status: 'streaming'
                })
            );

            // Tool result message
            expect(createMessageWithDisplay).toHaveBeenNthCalledWith(
                3,
                'conv-1',
                'tool',
                expect.stringContaining('result'),
                expect.objectContaining({
                    toolResult: mockToolResult,
                    status: 'completed'
                })
            );

            // Completion message
            expect(createMessageWithDisplay).toHaveBeenNthCalledWith(
                4,
                'conv-1',
                'assistant',
                '✅ 创意想法生成完成！新的故事灵感已经为您准备好了。',
                { status: 'completed' }
            );

            // Verify tool was executed
            expect(mockTool.execute).toHaveBeenCalledWith(
                mockParams,
                expect.objectContaining({
                    toolCallId: expect.stringContaining('intent_shortcut_'),
                    messages: []
                })
            );
        });

        it('should handle episode script intent successfully', async () => {
            const service = createIntentShortcutService({
                canonicalService: mockCanonicalService,
                jsondocRepo: mockJsondocRepo,
                transformRepo: mockTransformRepo
            });

            const mockParams = {
                jsondocs: ['synopsis-1'],
                episodeNumber: 1,
                episodeSynopsisJsondocId: 'synopsis-1',
                userRequirements: ''
            };

            mockParameterResolver.resolveParameters.mockResolvedValue(mockParams);
            mockTool.execute.mockResolvedValue({ outputJsondocId: 'script-1' });

            // Update mock to return episode script tool
            const episodeScriptTool = {
                name: 'generate_单集剧本',
                description: 'Generate episode script',
                inputSchema: {},
                outputSchema: {},
                execute: vi.fn()
            };

            (buildAgentConfiguration as any).mockResolvedValue({
                tools: [episodeScriptTool]
            });

            const context = {
                intent: 'generate_episode_script' as const,
                metadata: { episodeNumber: 1 },
                content: '生成第1集剧本',
                conversationId: 'conv-1',
                projectId: 'proj-1',
                userId: 'user-1'
            };

            await service.handleIntent(context);

            expect(mockParameterResolver.resolveParameters).toHaveBeenCalledWith(context);
            expect(createMessageWithDisplay).toHaveBeenCalledTimes(4);

            // Check thinking message is specific to episode script
            expect(createMessageWithDisplay).toHaveBeenNthCalledWith(
                1,
                'conv-1',
                'assistant',
                '🎭 正在创作分集剧本...',
                { status: 'streaming' }
            );
        });

        it('should handle unsupported intent gracefully', async () => {
            const service = createIntentShortcutService({
                canonicalService: mockCanonicalService,
                jsondocRepo: mockJsondocRepo,
                transformRepo: mockTransformRepo
            });

            const context = {
                intent: 'invalid_intent' as any,
                metadata: {},
                content: 'test',
                conversationId: 'conv-1',
                projectId: 'proj-1',
                userId: 'user-1'
            };

            await expect(service.handleIntent(context)).rejects.toThrow('Invalid enum value');

            // Should create error message
            expect(createMessageWithDisplay).toHaveBeenCalledWith(
                'conv-1',
                'assistant',
                expect.stringContaining('抱歉，处理您的请求时遇到了问题'),
                expect.objectContaining({
                    status: 'failed'
                })
            );
        });

        it('should handle tool execution errors', async () => {
            const service = createIntentShortcutService({
                canonicalService: mockCanonicalService,
                jsondocRepo: mockJsondocRepo,
                transformRepo: mockTransformRepo
            });

            const mockParams = { jsondocs: ['test-1'] };
            mockParameterResolver.resolveParameters.mockResolvedValue(mockParams);
            mockTool.execute.mockRejectedValue(new Error('Tool execution failed'));

            const context = {
                intent: 'generate_brainstorm' as const,
                metadata: {},
                content: 'test',
                conversationId: 'conv-1',
                projectId: 'proj-1',
                userId: 'user-1'
            };

            await expect(service.handleIntent(context)).rejects.toThrow('Tool execution failed');

            // Should create error message
            expect(createMessageWithDisplay).toHaveBeenLastCalledWith(
                'conv-1',
                'assistant',
                expect.stringContaining('Tool execution failed'),
                expect.objectContaining({
                    status: 'failed'
                })
            );
        });
    });

    describe('executeToolDirectly', () => {
        it('should execute tool with correct parameters', async () => {
            const service = createIntentShortcutService({
                canonicalService: mockCanonicalService,
                jsondocRepo: mockJsondocRepo,
                transformRepo: mockTransformRepo
            });

            const toolParams = { jsondocs: ['test-1'] };
            const expectedResult = { outputJsondocId: 'result-1' };

            mockTool.execute.mockResolvedValue(expectedResult);

            const result = await service.executeToolDirectly(
                'generate_灵感创意s',
                toolParams,
                'proj-1',
                'user-1'
            );

            expect(result).toEqual(expectedResult);
            expect(buildAgentConfiguration).toHaveBeenCalledWith(
                expect.objectContaining({ projectId: 'proj-1' }),
                'proj-1',
                mockTransformRepo,
                mockJsondocRepo,
                'user-1'
            );
            expect(createAgentTool).toHaveBeenCalledWith(
                mockToolDefinition,
                { projectId: 'proj-1', userId: 'user-1' }
            );
        });

        it('should throw error when tool not found', async () => {
            const service = createIntentShortcutService({
                canonicalService: mockCanonicalService,
                jsondocRepo: mockJsondocRepo,
                transformRepo: mockTransformRepo
            });

            (buildAgentConfiguration as any).mockResolvedValue({
                tools: [] // No tools available
            });

            await expect(
                service.executeToolDirectly('nonexistent_tool', {}, 'proj-1', 'user-1')
            ).rejects.toThrow('Tool not found: nonexistent_tool');
        });
    });

    describe('createIntentHandler', () => {
        it('should create handler with correct intent type', () => {
            const service = createIntentShortcutService({
                canonicalService: mockCanonicalService,
                jsondocRepo: mockJsondocRepo,
                transformRepo: mockTransformRepo
            });

            const handler = service.createIntentHandler('generate_brainstorm');

            expect(handler.intentType).toBe('generate_brainstorm');
            expect(handler.getToolName()).toBe('generate_灵感创意s');

            const messages = handler.getAssistantMessages();
            expect(messages.thinking).toContain('头脑风暴');
            expect(messages.completion).toContain('创意想法生成完成');
        });

        it('should resolve parameters using correct resolver method', async () => {
            const service = createIntentShortcutService({
                canonicalService: mockCanonicalService,
                jsondocRepo: mockJsondocRepo,
                transformRepo: mockTransformRepo
            });

            const handler = service.createIntentHandler('generate_chronicles');
            const context = {
                intent: 'generate_chronicles' as const,
                metadata: {},
                content: 'test',
                conversationId: 'conv-1',
                projectId: 'proj-1',
                userId: 'user-1'
            };

            await handler.resolveParameters(context);

            expect(mockParameterResolver.resolveParameters).toHaveBeenCalledWith(context);
        });
    });
}); 