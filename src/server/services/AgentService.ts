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
                    'Analyzing brainstorm request and generating creative story ideas'
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
                    'Analyzing brainstorm request and generating creative story ideas',
                    thinkingStartTime
                );

                // Add success response
                await this.chatMessageRepo.addAgentResponse(
                    thinkingMessageId,
                    'I\'ve successfully generated creative story ideas for your project! You can find them in the brainstorm results.'
                );
            }

            console.log(`[AgentService] Brainstorm agent completed for project ${projectId}.`);

        } catch (error) {
            console.error(`[AgentService] Brainstorm agent failed for project ${projectId}:`, error);

            // Log error to chat
            if (this.chatMessageRepo && thinkingMessageId) {
                await this.chatMessageRepo.addAgentError(
                    thinkingMessageId,
                    'I encountered an error while generating story ideas. Please try again or contact support if the issue persists.'
                );
            }

            if (agentTransformId) {
                await this.transformRepo.updateTransform(agentTransformId, { status: 'failed' });
            }
        }
    }
} 