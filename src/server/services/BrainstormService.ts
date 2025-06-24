import { Kysely } from 'kysely';
import { v4 as uuidv4 } from 'uuid';
import type { DB } from '../database/types';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { runStreamingAgent } from './StreamingAgentFramework';
import { createBrainstormToolDefinition } from '../tools/BrainstormTool';

export interface BrainstormParams {
    genre: string;
    theme: string;
    character_setting: string;
    plot_device: string;
    ending_type: string;
    length: string;
    platform: string;
    additional_requirements?: string;
}

export interface BrainstormRequest {
    projectId: string;
    params: BrainstormParams;
}

export class BrainstormService {
    constructor(
        private db: Kysely<DB>,
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository
    ) { }

    // Method to inject AgentService after initialization to avoid circular dependency
    private agentService?: any;
    public setAgentService(agentService: any) {
        this.agentService = agentService;
    }

    // Start brainstorm job - creates transform and begins background processing
    async startBrainstorm(request: BrainstormRequest): Promise<{ transformId: string }> {
        const { projectId, params } = request;

        // Transform frontend params to BrainstormParamsV1 schema
        const brainstormParamsV1 = {
            platform: params.platform,
            genre_paths: [params.genre.split(',').map(g => g.trim())], // Convert comma-separated to array of arrays
            requirements: [
                params.theme,
                params.character_setting,
                params.plot_device,
                params.ending_type,
                params.length,
                params.additional_requirements
            ].filter(Boolean).join('; ') // Combine all requirements into a single string
        };



        // Create user input artifact with the properly formatted schema
        const userInputArtifact = await this.artifactRepo.createArtifact(
            projectId,
            'brainstorm_params',
            brainstormParamsV1,
            'v1'
        );

        // Create transform for the brainstorm job
        const transform = await this.transformRepo.createTransform(
            projectId,
            'llm',
            'v1',
            'pending',
            { brainstorm_params: brainstormParamsV1 }
        );

        // Link input artifact to transform
        await this.transformRepo.addTransformInputs(transform.id, [
            { artifactId: userInputArtifact.id, inputRole: 'brainstorm_params' }
        ], projectId);

        // Start background processing using AgentService
        this.processBrainstormWithAgent(transform.id, projectId, params);

        return { transformId: transform.id };
    }

    // Background processing method using AgentService
    private async processBrainstormWithAgent(
        transformId: string,
        projectId: string,
        params: BrainstormParams
    ): Promise<void> {
        try {
            // Update transform status to running
            await this.transformRepo.updateTransformStreamingStatus(transformId, 'running', 0);

            // Get user ID from the transform context (assuming it's stored there)
            // For now, we'll use a placeholder - this should be passed from the request
            const userId = 'test-user-1'; // TODO: Get from authenticated user context

            // Prepare agent request based on the parameters
            const userRequest = `为${params.platform}平台生成创意故事想法。
类型：${params.genre}
主题：${params.theme}
角色设定：${params.character_setting}
情节设定：${params.plot_device}
结局类型：${params.ending_type}
长度：${params.length}
其他要求：${params.additional_requirements || '无'}`;

            // Update progress
            await this.transformRepo.updateTransformStreamingStatus(transformId, 'running', 50);

            // Use AgentService instead of direct streaming framework
            if (this.agentService) {
                await this.agentService.runBrainstormAgent(projectId, userId, {
                    userRequest,
                    platform: params.platform,
                    genre: params.genre,
                    other_requirements: params.additional_requirements
                });
            }

            // Update progress
            await this.transformRepo.updateTransformStreamingStatus(transformId, 'completed', 100);
            await this.transformRepo.updateTransformStatus(transformId, 'completed');

            console.log(`Brainstorm completed for project ${projectId} via AgentService`);

        } catch (error) {
            console.error('Brainstorm processing error:', error);

            // Update transform with error
            await this.transformRepo.updateTransform(transformId, {
                status: 'failed',
                streaming_status: 'failed',
                error_message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Get brainstorm status by transform ID
    async getBrainstormStatus(transformId: string): Promise<any> {
        const transform = await this.transformRepo.getTransform(transformId);
        if (!transform) {
            throw new Error('Transform not found');
        }

        return {
            transformId: transform.id,
            status: transform.status,
            streamingStatus: transform.streaming_status,
            progress: transform.progress_percentage,
            errorMessage: transform.error_message,
            createdAt: transform.created_at,
            updatedAt: transform.updated_at
        };
    }

    // Get brainstorm result by project ID
    async getBrainstormResult(projectId: string): Promise<any> {
        // Look for individual brainstorm_idea artifacts (created by the tool)
        const artifacts = await this.artifactRepo.getProjectArtifactsByType(
            projectId,
            'brainstorm_idea'
        );

        if (artifacts.length === 0) {
            return null;
        }

        // Sort by creation time and return all ideas
        artifacts.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        return {
            ideas: artifacts.map(artifact => ({
                id: artifact.id,
                title: artifact.data.title,
                body: artifact.data.body,
                createdAt: artifact.created_at,
                metadata: artifact.metadata
            })),
            totalCount: artifacts.length
        };
    }
} 