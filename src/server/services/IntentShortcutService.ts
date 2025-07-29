import {
    IntentContext,
    IntentContextSchema,
    IntentType,
    IntentHandlerResponse,
    IntentHandlerResponseSchema,
    getToolNameForIntent,
    supportsIntent
} from '../../common/schemas/intentSchemas.js';
import { createIntentParameterResolver } from './IntentParameterResolver.js';
import { CanonicalJsondocService } from './CanonicalJsondocService.js';
import { createMessageWithDisplay } from '../conversation/ConversationManager.js';
import type { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository.js';
import { createAgentTool } from '../transform-jsondoc-framework/StreamingAgentFramework.js';
import { buildAgentConfiguration } from './AgentRequestBuilder.js';

// Dependencies for intent shortcut service
type IntentShortcutServiceDependencies = {
    canonicalService: CanonicalJsondocService;
    jsondocRepo: TransformJsondocRepository;
    transformRepo: TransformJsondocRepository;
};

// Create intent shortcut service with dependencies captured in closure
export function createIntentShortcutService(dependencies: IntentShortcutServiceDependencies) {
    const { canonicalService, jsondocRepo, transformRepo } = dependencies;

    // Create parameter resolver with same dependencies
    const parameterResolver = createIntentParameterResolver({
        canonicalService,
        jsondocRepo
    });

    // Generate assistant messages for each intent type
    const generateAssistantMessages = (intent: IntentType) => {
        const messageMap = {
            'generate_brainstorm': {
                thinking: '🧠 正在为您头脑风暴创意想法...',
                completion: '✅ 创意想法生成完成！新的故事灵感已经为您准备好了。'
            },
            'generate_outline_settings': {
                thinking: '📋 正在生成大纲设定...',
                completion: '✅ 大纲设定已完成！故事框架和角色设定已经构建完毕。'
            },
            'generate_chronicles': {
                thinking: '👥 正在创作人物小传...',
                completion: '✅ 人物小传创作完成！角色背景和性格特点已经丰富完善。'
            },
            'generate_episode_planning': {
                thinking: '🎬 正在规划分集结构...',
                completion: '✅ 分集结构规划完成！故事节奏和情节分布已经优化安排。'
            },
            'generate_episode_synopsis': {
                thinking: '📝 正在生成分集大纲...',
                completion: '✅ 分集大纲生成完成！本集的详细剧情脉络已经梳理清楚。'
            },
            'generate_episode_script': {
                thinking: '🎭 正在创作分集剧本...',
                completion: '✅ 分集剧本创作完成！完整的对话和场景描述已经编写完毕。'
            }
        };

        return messageMap[intent];
    };

    // Create intent handler for a specific intent type
    const createIntentHandler = (intentType: IntentType) => {
        const resolveParameters = async (context: IntentContext) => {
            // Use the unified parameter resolver
            return await parameterResolver.resolveParameters(context);
        };

        const getToolName = () => getToolNameForIntent(intentType);
        const getAssistantMessages = () => generateAssistantMessages(intentType);

        return {
            intentType,
            resolveParameters,
            getToolName,
            getAssistantMessages
        };
    };

    // Helper to resolve parameters for tool execution
    const resolveToolParameters = async (context: IntentContext): Promise<any> => {
        console.log(`[IntentShortcutService] Resolving parameters for intent: ${context.intent}`);

        // Use the unified parameter resolver
        const resolvedParams = await parameterResolver.resolveParameters(context);

        console.log('[IntentShortcutService] Resolved parameters:', resolvedParams);
        return resolvedParams;
    };

    // Execute tool directly (bypassing LLM)
    const executeToolDirectly = async (
        toolName: string,
        toolParams: any,
        projectId: string,
        userId: string
    ) => {
        console.log(`[IntentShortcutService] Executing tool directly: ${toolName}`);

        try {
            // Get available tools using the same logic as AgentService
            const agentConfig = await buildAgentConfiguration(
                { userRequest: '', projectId, contextType: 'general' },
                projectId,
                transformRepo,
                jsondocRepo,
                userId
            );

            // Find the specific tool
            const toolDefinition = agentConfig.tools.find(tool => tool.name === toolName);
            if (!toolDefinition) {
                throw new Error(`Tool not found: ${toolName}`);
            }

            // Create and execute the tool
            const contextInfo = { projectId, userId };
            const tool = createAgentTool(toolDefinition, contextInfo);

            const result = await tool.execute(toolParams, {
                toolCallId: `intent_shortcut_${Date.now()}`,
                messages: [] // Empty messages for direct execution
            });

            console.log(`[IntentShortcutService] Tool execution completed: ${toolName}`);
            return result;

        } catch (error) {
            console.error(`[IntentShortcutService] Tool execution failed: ${toolName}`, error);
            throw error;
        }
    };

    // Main intent handling function
    const handleIntent = async (context: IntentContext): Promise<void> => {
        console.log(`[IntentShortcutService] Handling intent: ${context.intent}`);

        try {
            // Validate context
            const validatedContext = IntentContextSchema.parse(context);

            // Check if intent is supported
            if (!supportsIntent(validatedContext.intent)) {
                throw new Error(`Unsupported intent: ${validatedContext.intent}`);
            }

            // Create handler for this intent
            const handler = createIntentHandler(validatedContext.intent);

            // 1. Create thinking message
            const assistantMessages = handler.getAssistantMessages();
            await createMessageWithDisplay(
                validatedContext.conversationId,
                'assistant',
                assistantMessages.thinking,
                { status: 'streaming' }
            );

            // 2. Resolve parameters
            const resolvedParams = await handler.resolveParameters(validatedContext);
            console.log(`[IntentShortcutService] Resolved parameters:`, resolvedParams);

            // 3. Create tool call message
            const toolName = handler.getToolName();
            const toolCallId = `intent_${validatedContext.intent}_${Date.now()}`;

            await createMessageWithDisplay(
                validatedContext.conversationId,
                'tool',
                JSON.stringify({
                    toolCall: toolName,
                    toolCallId: toolCallId,
                    args: resolvedParams
                }),
                {
                    toolName: toolName,
                    toolCallId: toolCallId,
                    toolParameters: resolvedParams,
                    status: 'streaming'
                }
            );

            // 4. Execute tool directly
            const toolResult = await executeToolDirectly(
                toolName,
                resolvedParams,
                validatedContext.projectId,
                validatedContext.userId
            );

            // 5. Create tool result message
            await createMessageWithDisplay(
                validatedContext.conversationId,
                'tool',
                JSON.stringify({
                    toolCallId: toolCallId,
                    result: toolResult
                }),
                {
                    toolCallId: toolCallId,
                    toolResult: toolResult,
                    status: 'completed'
                }
            );

            // 6. Create completion message
            await createMessageWithDisplay(
                validatedContext.conversationId,
                'assistant',
                assistantMessages.completion,
                { status: 'completed' }
            );

            console.log(`[IntentShortcutService] Intent handling completed: ${validatedContext.intent}`);

        } catch (error) {
            console.error(`[IntentShortcutService] Intent handling failed:`, error);

            // Create error message
            await createMessageWithDisplay(
                context.conversationId,
                'assistant',
                `抱歉，处理您的请求时遇到了问题：${error instanceof Error ? error.message : '未知错误'}`,
                {
                    status: 'failed',
                    errorMessage: error instanceof Error ? error.message : 'Unknown error'
                }
            );

            throw error;
        }
    };

    // Check if service supports an intent
    const isIntentSupported = (intent: string): intent is IntentType => {
        return supportsIntent(intent);
    };

    // Return service interface with dependencies captured in closure
    return {
        handleIntent,
        isIntentSupported,
        createIntentHandler,
        executeToolDirectly
    };
} 