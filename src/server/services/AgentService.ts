import { z } from 'zod';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { runStreamingAgent } from './StreamingAgentFramework';
import { createBrainstormToolDefinition } from '../tools/BrainstormTool';
import { AgentBrainstormRequest } from '../../common/types';

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
            const outputArtifactIds = agentResult.toolResults.map(r => r.result.outputArtifactId);

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
                .map(artifactId => ({
                    artifactId,
                    outputRole: 'brainstorm_idea_collection'
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