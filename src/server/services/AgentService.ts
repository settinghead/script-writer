import { z } from 'zod';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { runStreamingAgent } from './StreamingAgentFramework';
import { createBrainstormToolDefinition } from '../tools/BrainstormTool';
import { AgentBrainstormRequest } from '../../common/types';
export class AgentService {
    constructor(
        private transformRepo: TransformRepository,
        private artifactRepo: ArtifactRepository,
    ) { }

    public async runBrainstormAgent(
        projectId: string,
        userId: string,
        request: AgentBrainstormRequest
    ) {
        let agentTransformId: string | null = null;
        try {
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

            console.log(`[AgentService] Brainstorm agent completed for project ${projectId}.`);

        } catch (error) {
            console.error(`[AgentService] Brainstorm agent failed for project ${projectId}:`, error);
            if (agentTransformId) {
                await this.transformRepo.updateTransform(agentTransformId, { status: 'failed' });
            }
        }
    }
} 