import { z } from 'zod';
import { streamText } from 'ai';
import { TransformRepository } from './TransformRepository';
import { ArtifactRepository } from './ArtifactRepository';
import { createAgentTool } from './StreamingAgentFramework';
import { buildAgentConfiguration } from '../services/AgentRequestBuilder';
import { getLLMModel } from './LLMConfig';

// Schema for general agent requests
export const GeneralAgentRequestSchema = z.object({
    userRequest: z.string(),
    projectId: z.string(),
    contextType: z.enum(['brainstorm', 'general']).optional(),
    contextData: z.any().optional() // Additional context data
});

export type GeneralAgentRequest = z.infer<typeof GeneralAgentRequestSchema>;

export class AgentService {
    private chatMessageRepo?: any; // Injected later to avoid circular dependency

    constructor(
        private transformRepo: TransformRepository,
        private artifactRepo: ArtifactRepository,
    ) { }

    // Method to inject chat repository after initialization
    public setChatMessageRepository(chatMessageRepo: any) {
        this.chatMessageRepo = chatMessageRepo;
    }

    // Helper function to generate computation state indicators
    private generateComputationIndicator(phase: string, content?: string): string {
        const icons = ['🔄', '⚡', '🎯', '✨', '🔍', '💡', '🚀', '⭐'];
        const hash = this.simpleHash(content || phase);
        const icon = icons[hash % icons.length];

        const phases = {
            'thinking': '正在思考您的请求',
            'analyzing': '正在分析项目状态',
            'processing': '正在处理相关内容',
            'generating': '正在生成创作内容',
            'completing': '正在完成最后步骤',
            'error': '❌ 处理过程中遇到问题'
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
            console.log(`[DEBUG] Trying to parse JSON from text (${text.length} chars): "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
            // Remove markdown code blocks if present
            let cleanText = text.trim();
            if (cleanText.startsWith('```json')) {
                cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                console.log(`[DEBUG] Cleaned markdown`);
            }

            // Try regular JSON.parse first
            let parsed;
            try {
                parsed = JSON.parse(cleanText);
                console.log(`[DEBUG] JSON.parse successful`);
            } catch (jsonError) {
                console.log(`[DEBUG] JSON.parse failed, trying jsonrepair`);
                // Fallback to jsonrepair
                const { jsonrepair } = await import('jsonrepair');
                const repairedJson = jsonrepair(cleanText);
                console.log(`[DEBUG] Repaired JSON (${repairedJson.length} chars)`);
                parsed = JSON.parse(repairedJson);
                console.log(`[DEBUG] Repaired JSON parsed successfully`);
            }

            const result = {
                humanReadableMessage: parsed.humanReadableMessage,
                parsed: true
            };
            console.log(`[DEBUG] Final parsing result - humanReadableMessage: "${result.humanReadableMessage}"`);
            return result;
        } catch (error) {
            console.log(`[DEBUG] All JSON parsing failed:`, error instanceof Error ? error.message : String(error));
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

        try {
            // Handle chat messages based on options
            if (options.createChatMessages && this.chatMessageRepo) {
                // Create user message event (only if not called from ChatService)
                await this.chatMessageRepo.createUserMessage(projectId, request.userRequest);

                // Create computation message for internal processing
                const computationMessage = await this.chatMessageRepo.createComputationMessage(
                    projectId,
                    this.generateComputationIndicator('thinking')
                );
                computationMessageId = computationMessage.id;

                // Create response message for agent's actual response
                const responseMessage = await this.chatMessageRepo.createResponseMessage(projectId, '');
                responseMessageId = responseMessage.id;
            }

            // 1. Build agent configuration using new abstraction
            const agentConfig = await buildAgentConfiguration(
                request,
                projectId,
                this.transformRepo,
                this.artifactRepo,
                userId,
                {
                    enableCaching: options.enableCaching,
                    seed: options.seed,
                    temperature: options.temperature,
                    topP: options.topP,
                    maxTokens: options.maxTokens
                }
            );

            console.log(`[AgentService] Request type detected: ${agentConfig.requestType}`);

            const completePrompt = agentConfig.prompt;
            const toolDefinitions = agentConfig.tools;

            // Update computation message to show analysis phase
            if (computationMessageId && this.chatMessageRepo) {
                await this.chatMessageRepo.updateComputationMessage(
                    computationMessageId,
                    this.generateComputationIndicator('analyzing', request.userRequest)
                );
            }

            // 4. Save user request as raw message
            if (this.chatMessageRepo) {
                await this.chatMessageRepo.createRawMessage(
                    projectId,
                    'user',
                    request.userRequest,
                    { metadata: { source: 'streaming_agent' } }
                );
            }

            // 2. Run the streaming agent directly
            console.log('--- Starting Streaming Agent ---');

            // Create agent tools
            const tools: Record<string, any> = {};
            for (const toolDef of toolDefinitions) {
                tools[toolDef.name] = createAgentTool(toolDef);
            }

            // Extract caching options
            const {
                enableCaching = false,
                seed,
                temperature,
                topP,
                maxTokens
            } = options;

            const model = await getLLMModel();
            const result = await streamText({
                model: model,
                tools: tools,
                maxSteps: 5, // Allow more steps for complex editing workflows
                prompt: completePrompt,
                // Pass AI SDK options directly
                ...(seed && { seed }),
                ...(temperature && { temperature }),
                ...(topP && { topP }),
                ...(maxTokens && { maxTokens })
            });

            console.log('\n\n--- Agent Stream & Final Output ---');
            let finalResponse = '';
            let currentToolCall: any = null;

            for await (const delta of result.fullStream) {
                console.log(`[DEBUG] Delta type: ${delta.type}`);
                switch (delta.type) {
                    case 'text-delta':
                        console.log(`[DEBUG] Text delta: "${delta.textDelta}"`);
                        process.stdout.write(delta.textDelta);
                        accumulatedResponse += delta.textDelta;
                        finalResponse += delta.textDelta;
                        console.log(`[DEBUG] Accumulated so far (${accumulatedResponse.length} chars): "${accumulatedResponse}"`);

                        // Try to parse JSON and update response message in real-time
                        if (responseMessageId && this.chatMessageRepo) {
                            const parseResult = await this.tryParseAgentJSON(accumulatedResponse);
                            if (parseResult.parsed && parseResult.humanReadableMessage) {
                                console.log(`[DEBUG] Streaming JSON parsed successfully: "${parseResult.humanReadableMessage}"`);
                                // Successfully parsed JSON, update with human readable message
                                await this.chatMessageRepo.updateResponseMessage(
                                    responseMessageId,
                                    parseResult.humanReadableMessage,
                                    'streaming'
                                );
                            } else {
                                // JSON not complete yet, show accumulated text
                                await this.chatMessageRepo.updateResponseMessage(
                                    responseMessageId,
                                    accumulatedResponse,
                                    'streaming'
                                );
                            }
                        }
                        break;

                    case 'tool-call':
                        console.log(`\n[Agent Action] Starting tool call to '${delta.toolName}' with ID '${delta.toolCallId}'`);
                        currentToolCall = delta;

                        // Update computation message to show processing phase
                        if (computationMessageId && this.chatMessageRepo) {
                            await this.chatMessageRepo.updateComputationMessage(
                                computationMessageId,
                                this.generateComputationIndicator('processing', delta.toolName)
                            );
                        }

                        // Save tool call as raw message
                        if (this.chatMessageRepo && projectId) {
                            await this.chatMessageRepo.createRawMessage(
                                projectId,
                                'tool',
                                `Tool call: ${delta.toolName}`,
                                {
                                    toolName: delta.toolName,
                                    toolParameters: delta.args,
                                    metadata: {
                                        toolCallId: delta.toolCallId,
                                        source: 'streaming_agent'
                                    }
                                }
                            );
                        }
                        break;

                    case 'tool-result':
                        console.log(`\n[Agent Action] Received result for tool call '${delta.toolCallId}'`);

                        // Update computation message to show generation phase
                        if (computationMessageId && this.chatMessageRepo) {
                            await this.chatMessageRepo.updateComputationMessage(
                                computationMessageId,
                                this.generateComputationIndicator('generating', currentToolCall?.toolName)
                            );
                        }

                        // Save tool result as raw message
                        if (this.chatMessageRepo && projectId && currentToolCall) {
                            await this.chatMessageRepo.createRawMessage(
                                projectId,
                                'tool',
                                `Tool result: ${currentToolCall.toolName}`,
                                {
                                    toolName: currentToolCall.toolName,
                                    toolParameters: currentToolCall.args,
                                    toolResult: delta.result,
                                    metadata: {
                                        toolCallId: delta.toolCallId,
                                        source: 'streaming_agent'
                                    }
                                }
                            );
                        }
                        break;

                    default:
                        console.log(`[DEBUG] Unhandled delta type: ${delta.type}`, delta);
                        break;
                }
            }
            console.log('\n-----------------------------------');

            // Final processing of the response
            if (responseMessageId && this.chatMessageRepo) {
                console.log(`[DEBUG] Final processing - accumulatedResponse: "${accumulatedResponse}"`);
                console.log(`[DEBUG] Final processing - finalResponse: "${finalResponse}"`);

                // Try both accumulatedResponse and finalResponse
                let finalParseResult = await this.tryParseAgentJSON(accumulatedResponse);
                if (!finalParseResult.parsed && finalResponse !== accumulatedResponse) {
                    console.log(`[DEBUG] Trying finalResponse instead...`);
                    finalParseResult = await this.tryParseAgentJSON(finalResponse);
                }
                console.log(`[DEBUG] Final parse result:`, finalParseResult);

                if (finalParseResult.parsed && finalParseResult.humanReadableMessage) {
                    console.log(`[DEBUG] Using human readable message: "${finalParseResult.humanReadableMessage}"`);
                    // Successfully parsed JSON, use human readable message
                    await this.chatMessageRepo.updateResponseMessage(
                        responseMessageId,
                        finalParseResult.humanReadableMessage,
                        'completed'
                    );

                    // Add a small delay and force another update to ensure it's persisted
                    await new Promise(resolve => setTimeout(resolve, 100));
                    await this.chatMessageRepo.updateResponseMessage(
                        responseMessageId,
                        finalParseResult.humanReadableMessage,
                        'completed'
                    );
                    console.log(`[DEBUG] Final message update completed`);
                } else {
                    console.log(`[DEBUG] JSON parsing failed, using fallback: "${accumulatedResponse || finalResponse}"`);
                    // JSON parsing failed, use accumulated text as fallback
                    await this.chatMessageRepo.updateResponseMessage(
                        responseMessageId,
                        accumulatedResponse || finalResponse || '我已完成您的请求。',
                        'completed'
                    );
                }
            }

            // Complete computation message
            if (computationMessageId && this.chatMessageRepo) {
                await this.chatMessageRepo.updateComputationMessage(
                    computationMessageId,
                    this.generateComputationIndicator('completing'),
                    'completed'
                );
            }

            // Save final assistant response as raw message
            if (this.chatMessageRepo && projectId && finalResponse.trim()) {
                await this.chatMessageRepo.createRawMessage(
                    projectId,
                    'assistant',
                    finalResponse.trim(),
                    { metadata: { source: 'streaming_agent' } }
                );
            }

            const finishReason = await result.finishReason;
            const toolCalls = await result.toolCalls;
            const toolCallsMade = toolCalls.length;
            const toolResults = await result.toolResults;
            const toolResultsReceived = toolResults.length;

            // Log summary
            console.log(`\n--- Agent Execution Summary ---`);
            console.log(`Finish Reason: ${finishReason}`);
            console.log(`\nTool Calls Made: ${toolCallsMade}`);
            console.log(`\nTool Results Received by Agent: ${toolResultsReceived}`);
            console.log(JSON.stringify(toolResults, null, 2));

            console.log(`[AgentService] General agent completed for project ${projectId}.`);

        } catch (error) {
            console.error("\n--- Agent Flow Failed ---");
            console.error(`[AgentService] General agent failed for project ${projectId}:`, error);

            // Generate user-friendly error message based on error type
            const userFriendlyMessage = this.generateUserFriendlyErrorMessage(error);

            // Update messages with error state
            if (computationMessageId && this.chatMessageRepo) {
                await this.chatMessageRepo.updateComputationMessage(
                    computationMessageId,
                    this.generateComputationIndicator('error'),
                    'failed'
                );
            }

            if (responseMessageId && this.chatMessageRepo) {
                await this.chatMessageRepo.updateResponseMessage(
                    responseMessageId,
                    userFriendlyMessage,
                    'failed'
                );
            }

            // Save error as raw message
            if (this.chatMessageRepo && projectId) {
                await this.chatMessageRepo.createRawMessage(
                    projectId,
                    'assistant',
                    `Error: ${error instanceof Error ? error.message : String(error)}`,
                    { metadata: { source: 'streaming_agent', error: true } }
                );
            }

            throw error;
        }
    }
} 