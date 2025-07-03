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
        let thinkingMessageId: string | undefined;
        let thinkingStartTime: string | undefined;

        try {
            // Handle chat messages based on options
            if (options.createChatMessages && this.chatMessageRepo) {
                // Create user message event (only if not called from ChatService)
                await this.chatMessageRepo.createUserMessage(projectId, request.userRequest);

                // Start agent thinking
                const thinkingInfo = await this.chatMessageRepo.createAgentThinkingMessage(
                    projectId,
                    '分析您的请求并开始创作'
                );
                thinkingMessageId = thinkingInfo.messageId;
                thinkingStartTime = thinkingInfo.startTime;
            } else if (options.existingThinkingMessageId && options.existingThinkingStartTime) {
                // Use existing thinking message from ChatService
                thinkingMessageId = options.existingThinkingMessageId;
                thinkingStartTime = options.existingThinkingStartTime;
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
                switch (delta.type) {
                    case 'text-delta':
                        process.stdout.write(delta.textDelta);
                        finalResponse += delta.textDelta;
                        break;
                    case 'tool-call':
                        console.log(`\n[Agent Action] Starting tool call to '${delta.toolName}' with ID '${delta.toolCallId}'`);
                        currentToolCall = delta;

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
                }
            }
            console.log('\n-----------------------------------');

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

            const agentResult = {
                finishReason,
                toolCalls,
                toolResults
            };

            // 3. Log successful completion
            if (this.chatMessageRepo && thinkingMessageId && thinkingStartTime) {
                // Finish thinking
                await this.chatMessageRepo.finishAgentThinking(
                    thinkingMessageId,
                    '分析您的请求并开始创作',
                    thinkingStartTime
                );

                // Add success response based on what was done
                let responseMessage = '我已成功处理您的请求！';
                if (agentResult.toolResults.some((r: any) => r.toolName === 'generate_brainstorm_ideas')) {
                    responseMessage = '我已成功为您的项目生成了创意故事想法！您可以在头脑风暴结果中查看它们。';
                } else if (agentResult.toolResults.some((r: any) => r.toolName === 'edit_brainstorm_idea')) {
                    responseMessage = '我已成功根据您的要求改进了故事创意！您可以查看更新后的想法。';
                } else if (agentResult.toolResults.some((r: any) => r.toolName === 'generate_outline_settings')) {
                    responseMessage = '我已成功为您的项目生成了剧本框架！您可以在剧本框架部分查看详细的角色、背景和商业定位信息。';
                } else if (agentResult.toolResults.some((r: any) => r.toolName === 'generate_chronicles')) {
                    responseMessage = '我已成功为您的项目生成了时间顺序大纲！您可以在时间顺序大纲部分查看按时间顺序的故事发展阶段。';
                } else if (agentResult.toolResults.some((r: any) => r.toolName === 'generate_outline')) {
                    responseMessage = '我已成功为您的项目生成了完整大纲！您可以在大纲部分查看详细的故事结构和发展脉络。';
                }

                await this.chatMessageRepo.addAgentResponse(
                    thinkingMessageId,
                    responseMessage
                );
            }

            console.log(`[AgentService] General agent completed for project ${projectId}.`);

        } catch (error) {
            console.error("\n--- Agent Flow Failed ---");
            console.error(`[AgentService] General agent failed for project ${projectId}:`, error);

            // Save error as raw message
            if (this.chatMessageRepo && projectId) {
                await this.chatMessageRepo.createRawMessage(
                    projectId,
                    'assistant',
                    `Error: ${error instanceof Error ? error.message : String(error)}`,
                    { metadata: { source: 'streaming_agent', error: true } }
                );
            }

            // Log error to chat
            if (this.chatMessageRepo && thinkingMessageId) {
                await this.chatMessageRepo.addAgentError(
                    thinkingMessageId,
                    '处理您的请求时遇到错误。请重试，如果问题持续存在，请联系支持。'
                );
            }

            throw error;
        }
    }



} 