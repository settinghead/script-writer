import { z } from 'zod/v4';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { runStreamingAgent } from './StreamingAgentFramework';
import { generateAgentPrompt, generateAgentTools } from './prompt-tools-gen';

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
                    '分析用户请求并选择合适的工具执行'
                );
                thinkingMessageId = thinkingInfo.messageId;
                thinkingStartTime = thinkingInfo.startTime;
            } else if (options.existingThinkingMessageId && options.existingThinkingStartTime) {
                // Use existing thinking message from ChatService
                thinkingMessageId = options.existingThinkingMessageId;
                thinkingStartTime = options.existingThinkingStartTime;
            }

            // 1. Generate prompt and tools using pure functions
            const completePrompt = await generateAgentPrompt(request, projectId, this.artifactRepo);
            const toolDefinitions = generateAgentTools({ transformRepo: this.transformRepo, artifactRepo: this.artifactRepo, projectId, userId });

            // 4. Save user request as raw message
            if (this.chatMessageRepo) {
                await this.chatMessageRepo.createRawMessage(
                    projectId,
                    'user',
                    request.userRequest,
                    { metadata: { source: 'streaming_agent' } }
                );
            }

            // 2. Run the agent with both tools available
            const agentResult = await runStreamingAgent({
                prompt: completePrompt,
                toolDefinitions: toolDefinitions,
                maxSteps: 5, // Allow more steps for complex editing workflows
                projectId: projectId,
                chatMessageRepo: this.chatMessageRepo
            });

            // 3. Log successful completion
            if (this.chatMessageRepo && thinkingMessageId && thinkingStartTime) {
                // Finish thinking
                await this.chatMessageRepo.finishAgentThinking(
                    thinkingMessageId,
                    '分析用户请求并选择合适的工具执行',
                    thinkingStartTime
                );

                // Add success response based on what was done
                let responseMessage = '我已成功处理您的请求！';
                if (agentResult.toolResults.some(r => r.toolName === 'generate_brainstorm_ideas')) {
                    responseMessage = '我已成功为您的项目生成了创意故事想法！您可以在头脑风暴结果中查看它们。';
                } else if (agentResult.toolResults.some(r => r.toolName === 'edit_brainstorm_idea')) {
                    responseMessage = '我已成功根据您的要求改进了故事创意！您可以查看更新后的想法。';
                }

                await this.chatMessageRepo.addAgentResponse(
                    thinkingMessageId,
                    responseMessage
                );
            }

            console.log(`[AgentService] General agent completed for project ${projectId}.`);

        } catch (error) {
            console.error(`[AgentService] General agent failed for project ${projectId}:`, error);

            // Log error to chat
            if (this.chatMessageRepo && thinkingMessageId) {
                await this.chatMessageRepo.addAgentError(
                    thinkingMessageId,
                    '处理您的请求时遇到错误。请重试，如果问题持续存在，请联系支持。'
                );
            }
        }
    }



} 