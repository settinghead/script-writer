import { z } from 'zod';
import { wrapLanguageModel } from 'ai';
import { TransformJsondocRepository } from './TransformJsondocRepository';
import { createAgentTool } from './StreamingAgentFramework';
import { buildAgentConfiguration } from '../services/AgentRequestBuilder';
import { getLLMModel } from './LLMConfig';
import { createUserContextMiddleware } from '../middleware/UserContextMiddleware';
import { getParticleSystem } from './particles/ParticleSystemInitializer';
import {
    createConversation,
    getConversationMessages,
    createMessageWithDisplay
} from '../conversation/ConversationManager.js';
import {
    createConversationContext,
    type ConversationStreamTextResult
} from '../conversation/StreamingWrappers.js';

// Schema for general agent requests
export const GeneralAgentRequestSchema = z.object({
    userRequest: z.string(),
    projectId: z.string(),
    contextType: z.enum(['brainstorm', 'general']).optional(),
    contextData: z.any().optional() // Additional context data
});

export type GeneralAgentRequest = z.infer<typeof GeneralAgentRequestSchema>;

export class AgentService {
    constructor(
        private transformRepo: TransformJsondocRepository,
        private jsondocRepo: TransformJsondocRepository,
    ) { }

    // Helper function to generate computation state indicators
    private generateComputationIndicator(phase: string, content?: string): string {
        const icons = ['🔄', '⚡', '🎯', '✨', '🔍', '💡', '🚀', '⭐'];
        const hash = this.simpleHash(content || phase);
        const icon = icons[hash % icons.length];

        const phases = {
            'thinking': '编剧大脑启动中',
            'analyzing': '剧情分析器运转中',
            'processing': '角色们正在排练',
            'generating': '创意火花四溅中',
            'completing': '最后润色，马上完工',
            'error': '❌ 创作卡壳了'
        };

        return `${icon} ${phases[phase as keyof typeof phases] || '正在进行相关计算'}...`;
    }

    // Simple hash function for consistent but varied indicators
    private simpleHash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    // Helper function to parse JSON with fallback
    private async tryParseAgentJSON(text: string): Promise<{ humanReadableMessage?: string; parsed: boolean }> {
        try {
            // Remove markdown code blocks if present
            let cleanText = text.trim();
            if (cleanText.startsWith('```json')) {
                cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            }

            // Try regular JSON.parse first
            let parsed;
            try {
                parsed = JSON.parse(cleanText);
            } catch (jsonError) {
                // Fallback to jsonrepair
                const { jsonrepair } = await import('jsonrepair');
                const repairedJson = jsonrepair(cleanText);
                parsed = JSON.parse(repairedJson);
            }

            return {
                humanReadableMessage: parsed.humanReadableMessage,
                parsed: true
            };
        } catch (error) {
            return { parsed: false };
        }
    }


    /**
     * Generate user-friendly error messages based on error type and content
     */
    private generateUserFriendlyErrorMessage(error: any): string {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorString = String(error);

        // Content filtering errors
        if (errorMessage.includes('inappropriate content') ||
            errorMessage.includes('data_inspection_failed') ||
            errorString.includes('data_inspection_failed')) {
            return '抱歉，您的内容可能包含了不适宜的信息，无法处理。请尝试修改您的创意内容，避免使用可能被误判的词汇（如"街头霸王"等可能与暴力相关的词汇），然后重新提交。';
        }

        // API rate limiting
        if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
            return '请求过于频繁，请稍后再试。我们正在努力为您处理请求。';
        }

        // Network/connection errors
        if (errorMessage.includes('network') || errorMessage.includes('connection') ||
            errorMessage.includes('timeout') || errorMessage.includes('ECONNRESET')) {
            return '网络连接出现问题，请检查您的网络连接后重试。如果问题持续存在，请稍后再试。';
        }

        // Authentication errors
        if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized') ||
            errorMessage.includes('invalid token')) {
            return '身份验证失败，请刷新页面后重试。如果问题持续存在，请联系支持。';
        }

        // Model/API service errors
        if (errorMessage.includes('model') || errorMessage.includes('service unavailable') ||
            errorMessage.includes('internal server error')) {
            return 'AI服务暂时不可用，请稍后重试。我们正在努力恢复服务。';
        }

        // Quota/billing errors
        if (errorMessage.includes('quota') || errorMessage.includes('billing') ||
            errorMessage.includes('insufficient funds')) {
            return '服务配额已用完，请联系管理员或稍后重试。';
        }

        // Streaming/data processing errors
        if (errorMessage.includes('No data received from streaming') ||
            errorMessage.includes('stream') || errorMessage.includes('ReadableStream')) {
            return '数据流处理出现问题，请重试。如果问题持续存在，可能是服务器正在维护。';
        }

        // Schema validation errors
        if (errorMessage.includes('schema') || errorMessage.includes('validation') ||
            errorMessage.includes('parse')) {
            return '数据格式验证失败，请重试。如果问题持续存在，请联系技术支持。';
        }

        // Default fallback message
        return '抱歉，处理您的请求时遇到了问题。请重试，如果问题持续存在，请联系支持。';
    }

    /**
     * General agent method that can handle various types of requests including brainstorm editing
     */
    public async runGeneralAgent(
        projectId: string,
        userId: string,
        request: GeneralAgentRequest,
        options: {
            createChatMessages?: boolean;
            existingThinkingMessageId?: string;
            existingThinkingStartTime?: string;
            conversationId?: string; // Add conversationId parameter
            // Caching options for reproducible testing
            enableCaching?: boolean;
            seed?: number;
            temperature?: number;
            topP?: number;
            maxTokens?: number;
        } = { createChatMessages: true }
    ) {
        let computationMessageId: string | undefined;
        let responseMessageId: string | undefined;
        let accumulatedResponse = '';

        // Generate unique execution ID to correlate all messages in this agent run
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`[AgentService] Starting agent execution with ID: ${executionId}`);

        try {
            // Note: Message tracking is now handled automatically by the conversation system
            // through StreamingWrappers - no need for manual message creation

            // 1. Check for conversation continuation

            // 2. Check if particle search is available for optimized context approach
            let useParticleSearchApproach = false;
            try {
                const particleSystem = getParticleSystem();
                if (particleSystem && particleSystem.unifiedSearch) {
                    // Check if particle system is healthy
                    const healthCheck = await particleSystem.unifiedSearch.healthCheck();
                    useParticleSearchApproach = healthCheck.particleCount > 0;
                    console.log(`[AgentService] Particle search approach ${useParticleSearchApproach ? 'enabled' : 'disabled'} (particles: ${healthCheck.particleCount})`);
                }
            } catch (error) {
                console.warn('[AgentService] Particle system health check failed:', error);
            }

            let agentConfig;
            let completePrompt;

            if (useParticleSearchApproach) {
                // Use minimal context + particle search approach
                console.log('[AgentService] Using particle-search optimized approach');

                // Build agent configuration with minimal context
                agentConfig = await buildAgentConfiguration(
                    request,
                    projectId,
                    this.transformRepo,
                    this.jsondocRepo,
                    userId,
                    {
                        enableCaching: options.enableCaching,
                        seed: options.seed,
                        temperature: options.temperature,
                        topP: options.topP,
                        maxTokens: options.maxTokens
                    }
                );

                // Set the complete prompt for particle search approach
                completePrompt = agentConfig.prompt;

            } else {
                // Use traditional full context approach
                console.log('[AgentService] Using traditional full-context approach');

                // Build agent configuration using existing abstraction
                agentConfig = await buildAgentConfiguration(
                    request,
                    projectId,
                    this.transformRepo,
                    this.jsondocRepo,
                    userId,
                    {
                        enableCaching: options.enableCaching,
                        seed: options.seed,
                        temperature: options.temperature,
                        topP: options.topP,
                        maxTokens: options.maxTokens
                    }
                );

                // Use conversation history for continuation or regular prompt
                completePrompt = agentConfig.prompt;
            }

            const toolDefinitions = agentConfig.tools;

            // 2. Run the streaming agent directly
            console.log('--- Starting Streaming Agent ---');

            // Create agent tools with context information
            const tools: Record<string, any> = {};
            const contextInfo = { projectId, userId };
            for (const toolDef of toolDefinitions) {
                tools[toolDef.name] = createAgentTool(toolDef, contextInfo);
            }

            // Extract caching options
            const {
                enableCaching = false,
                seed,
                temperature,
                topP,
                maxTokens
            } = options;

            const baseModel = await getLLMModel();

            // Create user context middleware to inject original user request into all LLM calls
            const userContextMiddleware = createUserContextMiddleware({
                originalUserRequest: request.userRequest,
                projectId,
                userId,
                timestamp: new Date().toISOString()
            });

            // Wrap model with middleware to ensure tools have access to original user context
            const enhancedModel = wrapLanguageModel({
                model: baseModel,
                middleware: userContextMiddleware
            });

            console.log('[AgentService] Using enhanced model with user context middleware');
            console.log('[AgentService] Original user request length:', request.userRequest.length);

            // Use provided conversation or create a new one for this agent session
            const conversationId = options.conversationId || await createConversation(projectId, 'agent', {
                userId,
                executionId,
                userRequest: request.userRequest,
                contextType: request.contextType
            });

            // Get existing messages for the conversation context
            const existingMessages = await getConversationMessages(conversationId);

            // Get conversation context with bound streaming functions
            const conversationContext = createConversationContext(conversationId, projectId, existingMessages);

            // Call streamText through the conversation context
            const result = await conversationContext.streamText({
                messages: [
                    { role: 'user', content: completePrompt }
                ],
                tools: tools,
                maxTokens: maxTokens,
                temperature: temperature,
                topP: topP,
                seed: seed,
                model: enhancedModel
            });

            console.log('\n\n--- Agent Stream & Final Output ---');
            let finalResponse = '';
            let currentToolCall: any = null;
            let toolCallCount = 0;
            let toolResultCount = 0;

            // Process the streaming results - message tracking is handled automatically by conversation system
            for await (const delta of result.fullStream) {
                switch (delta.type) {
                    case 'text-delta':
                        process.stdout.write(delta.textDelta);
                        accumulatedResponse += delta.textDelta;
                        finalResponse += delta.textDelta;
                        break;

                    case 'tool-call':
                        console.log(`\n[Agent Action] Starting tool call to '${delta.toolName}' with ID '${delta.toolCallId}'`);
                        currentToolCall = delta;
                        toolCallCount++;

                        // Log tool call as conversation message
                        try {
                            await createMessageWithDisplay(conversationId, 'tool', JSON.stringify({
                                toolCall: delta.toolName,
                                toolCallId: delta.toolCallId,
                                args: delta.args
                            }), {
                                toolName: delta.toolName,
                                toolCallId: delta.toolCallId,
                                toolParameters: delta.args,
                                status: 'streaming'
                            });
                            console.log(`[Agent Action] Logged tool call message for '${delta.toolName}'`);
                        } catch (error) {
                            console.error(`[Agent Action] Failed to log tool call message:`, error);
                        }
                        break;

                    case 'tool-result':
                        console.log(`\n[Agent Action] Received result for tool call '${delta.toolCallId}'`);
                        toolResultCount++;

                        // Update tool call message with result
                        try {
                            await createMessageWithDisplay(conversationId, 'tool', JSON.stringify({
                                toolCallId: delta.toolCallId,
                                result: delta.result
                            }), {
                                toolCallId: delta.toolCallId,
                                toolResult: delta.result,
                                status: 'completed'
                            });
                            console.log(`[Agent Action] Logged tool result message for '${delta.toolCallId}'`);
                        } catch (error) {
                            console.error(`[Agent Action] Failed to log tool result message:`, error);
                        }
                        break;

                    case 'step-finish':
                        console.log(`\n[Agent Step] Step completed with reason: ${delta.finishReason}`);
                        break;

                    case 'step-start':
                        console.log(`\n[Agent Step] Step started`);
                        break;

                    case 'error':
                        console.log(`\n[Agent Error] Error occurred:`, (delta as any).error?.message || 'Unknown error');
                        break;

                    case 'finish':
                        console.log(`\n[Agent Finish] Agent completed with reason: ${delta.finishReason}`);
                        break;

                    default:
                        console.log(`[DEBUG] Unhandled delta type: ${delta.type}`, delta);
                        break;
                }
            }
            console.log('\n-----------------------------------');

            const finishReason = await result.finishReason;

            // Log summary using our tracked counts
            console.log(`\n--- Agent Execution Summary ---`);
            console.log(`Finish Reason: ${finishReason}`);
            console.log(`\nTool Calls Made: ${toolCallCount}`);
            console.log(`\nTool Results Received by Agent: ${toolResultCount}`);

            console.log(`[AgentService] General agent completed for project ${projectId}.`);

        } catch (error) {
            console.error("\n--- Agent Flow Failed ---");
            console.error(`[AgentService] General agent failed for project ${projectId}:`, error);

            // Generate user-friendly error message based on error type
            const userFriendlyMessage = this.generateUserFriendlyErrorMessage(error);
            console.log(`[AgentService] User-friendly error: ${userFriendlyMessage}`);

            throw error;
        }
    }


} 