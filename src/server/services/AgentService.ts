import { z } from 'zod';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { runStreamingAgent } from './StreamingAgentFramework';
import { createBrainstormToolDefinition } from '../tools/BrainstormTool';
import { createBrainstormEditToolDefinition } from '../tools/BrainstormEditTool';
import { AgentBrainstormRequest } from '../../common/types';

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
        } = {}
    ) {
        let agentTransformId: string | null = null;
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

            // 1. Create a parent transform for the entire agent execution
            const agentTransform = await this.transformRepo.createTransform(
                projectId,
                'llm', // An agent is an LLM-driven process
                'v1',
                'running',
                {
                    transform_name: 'general_agent_session',
                    request,
                    context_type: request.contextType || 'general'
                }
            );
            agentTransformId = agentTransform.id;

            // 2. Prepare context for agent by gathering brainstorm artifacts
            const contextString = await this.prepareBrainstormContext(projectId);

            // 3. Create tool definitions - include both brainstorm generation and editing tools
            const brainstormToolDef = createBrainstormToolDefinition(
                this.transformRepo,
                this.artifactRepo,
                projectId,
                userId
            );

            const brainstormEditToolDef = createBrainstormEditToolDefinition(
                this.transformRepo,
                this.artifactRepo,
                projectId,
                userId
            );

            // 4. Enhanced user request with context
            const enhancedUserRequest = `${request.userRequest}

**当前项目背景信息：**
${contextString}

**指令：**
- 如果用户想要生成新的故事创意，使用 generate_brainstorm_ideas 工具
- 如果用户想要修改、改进或编辑现有的故事创意，使用 edit_brainstorm_idea 工具
- 仔细分析用户的具体需求，提供详细的编辑指导和要求
- 确保理解用户的意图并选择合适的工具`;

            // 5. Run the agent with both tools available
            const agentResult = await runStreamingAgent({
                userRequest: enhancedUserRequest,
                toolDefinitions: [brainstormToolDef, brainstormEditToolDef],
                maxSteps: 5, // Allow more steps for complex editing workflows
            });

            // 6. Agent execution is complete, update the parent transform
            const finalAgentTransform = await this.transformRepo.getTransform(agentTransformId);
            const outputArtifactIds = agentResult.toolResults.flatMap(r =>
                r.result.outputArtifactIds || [r.result.outputArtifactId]
            ).filter(Boolean);

            const newContext = {
                ...(finalAgentTransform.execution_context || {}),
                finish_reason: agentResult.finishReason,
                outputArtifactIds,
                tools_used: agentResult.toolResults.map(r => r.toolName)
            };

            await this.transformRepo.updateTransform(agentTransformId, {
                status: 'completed',
                execution_context: newContext
            });

            // Link output artifacts to the agent transform
            const outputArtifacts = outputArtifactIds
                .filter(id => id) // Filter out null/undefined
                .map(artifactId => ({
                    artifactId,
                    outputRole: 'agent_output'
                }));

            if (outputArtifacts.length > 0) {
                await this.transformRepo.addTransformOutputs(agentTransformId, outputArtifacts, projectId);
            }

            // Log successful completion
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

            if (agentTransformId) {
                await this.transformRepo.updateTransform(agentTransformId, { status: 'failed' });
            }
        }
    }

    /**
     * Prepare context string with brainstorm artifacts for the agent
     */
    private async prepareBrainstormContext(projectId: string): Promise<string> {
        try {
            // Get all individual brainstorm_idea artifacts for this project
            const brainstormIdeas = await this.artifactRepo.getProjectArtifactsByType(
                projectId,
                'brainstorm_idea'
            );

            if (brainstormIdeas.length === 0) {
                return '当前项目还没有故事创意。';
            }

            let contextString = '**当前项目的故事创意：**\n\n';

            // Sort by creation time to show them in order
            brainstormIdeas.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            brainstormIdeas.forEach((idea, index) => {
                try {
                    if (idea.data && idea.data.title && idea.data.body) {
                        contextString += `${index + 1}. **${idea.data.title}**\n   ${idea.data.body}\n\n`;
                    }
                } catch (error) {
                    console.error('Error parsing brainstorm idea artifact:', error);
                }
            });

            return contextString;

        } catch (error) {
            console.error('Error preparing brainstorm context:', error);
            return '无法获取项目背景信息。';
        }
    }

    public async runBrainstormAgent(
        projectId: string,
        userId: string,
        request: AgentBrainstormRequest
    ) {
        let agentTransformId: string | null = null;
        let thinkingMessageId: string | undefined;
        let thinkingStartTime: string | undefined;

        try {
            // Log user request and start thinking using event-based messaging
            if (this.chatMessageRepo) {
                // Create user message event
                await this.chatMessageRepo.createUserMessage(projectId, request.userRequest);

                // Start agent thinking
                const thinkingInfo = await this.chatMessageRepo.createAgentThinkingMessage(
                    projectId,
                    '分析头脑风暴请求并生成创意故事想法'
                );
                thinkingMessageId = thinkingInfo.messageId;
                thinkingStartTime = thinkingInfo.startTime;
            }

            // 1. Create a parent transform for the entire agent execution
            const agentTransform = await this.transformRepo.createTransform(
                projectId,
                'llm', // An agent is an LLM-driven process
                'v1',
                'running',
                {
                    transform_name: 'agent_brainstorm_session',
                    request
                }
            );
            agentTransformId = agentTransform.id;

            // 2. Create the tool definition. The tool's execute function will now
            // be responsible for creating its own transform and artifacts.
            const brainstormToolDef = createBrainstormToolDefinition(
                this.transformRepo,
                this.artifactRepo,
                projectId,
                userId
            );

            // 3. Run the agent
            const agentResult = await runStreamingAgent({
                userRequest: request.userRequest,
                toolDefinitions: [brainstormToolDef],
                maxSteps: 3,
            });

            // 4. Agent execution is complete, update the parent transform
            const finalAgentTransform = await this.transformRepo.getTransform(agentTransformId);
            const outputArtifactIds = agentResult.toolResults.flatMap(r =>
                r.result.outputArtifactIds || [r.result.outputArtifactId]
            ).filter(Boolean);

            const newContext = {
                ...(finalAgentTransform.execution_context || {}),
                finish_reason: agentResult.finishReason,
                outputArtifactIds,
            };

            await this.transformRepo.updateTransform(agentTransformId, {
                status: 'completed',
                execution_context: newContext
            });

            // Link output artifacts to the agent transform
            const outputArtifacts = outputArtifactIds
                .filter(id => id) // Filter out null/undefined
                .map((artifactId, index) => ({
                    artifactId,
                    outputRole: `brainstorm_idea_${index}`
                }));

            if (outputArtifacts.length > 0) {
                await this.transformRepo.addTransformOutputs(agentTransformId, outputArtifacts, projectId);
            }

            // Log successful completion
            if (this.chatMessageRepo && thinkingMessageId && thinkingStartTime) {
                // Finish thinking
                await this.chatMessageRepo.finishAgentThinking(
                    thinkingMessageId,
                    '分析头脑风暴请求并生成创意故事想法',
                    thinkingStartTime
                );

                // Add success response
                await this.chatMessageRepo.addAgentResponse(
                    thinkingMessageId,
                    '我已成功为您的项目生成了创意故事想法！您可以在头脑风暴结果中查看它们。'
                );
            }

            console.log(`[AgentService] Brainstorm agent completed for project ${projectId}.`);

        } catch (error) {
            console.error(`[AgentService] Brainstorm agent failed for project ${projectId}:`, error);

            // Log error to chat
            if (this.chatMessageRepo && thinkingMessageId) {
                await this.chatMessageRepo.addAgentError(
                    thinkingMessageId,
                    '生成故事想法时遇到错误。请重试，如果问题持续存在，请联系支持。'
                );
            }

            if (agentTransformId) {
                await this.transformRepo.updateTransform(agentTransformId, { status: 'failed' });
            }
        }
    }
} 