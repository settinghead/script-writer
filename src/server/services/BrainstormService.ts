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
    ) {}

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
        ]);

        // Start background processing using StreamingAgentFramework
        this.processBrainstormWithAgent(transform.id, projectId, params);

        return { transformId: transform.id };
    }

    // Background processing method using StreamingAgentFramework
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

            // Create brainstorm tool definition
            const brainstormTool = createBrainstormToolDefinition(
                this.transformRepo,
                this.artifactRepo,
                projectId,
                userId
            );

            // Prepare agent request based on the parameters
            const userRequest = `Generate creative story ideas for ${params.platform} platform. 
Genre: ${params.genre}
Theme: ${params.theme}
Character setting: ${params.character_setting}
Plot device: ${params.plot_device}
Ending type: ${params.ending_type}
Length: ${params.length}
Additional requirements: ${params.additional_requirements || 'None'}`;

            // Update progress
            await this.transformRepo.updateTransformStreamingStatus(transformId, 'running', 25);

            // Run the streaming agent
            const result = await runStreamingAgent({
                userRequest,
                toolDefinitions: [brainstormTool],
                maxSteps: 3
            });

            // Update progress
            await this.transformRepo.updateTransformStreamingStatus(transformId, 'running', 75);

            // The tool execution creates its own artifacts and transforms
            // We just need to mark our main transform as completed
            await this.transformRepo.updateTransformStreamingStatus(transformId, 'completed', 100);
            await this.transformRepo.updateTransformStatus(transformId, 'completed');

            console.log(`Brainstorm completed for project ${projectId}:`, result);

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
        // Look for brainstorm_idea_collection artifacts (created by the tool)
        const artifacts = await this.artifactRepo.getArtifactsByType(
            projectId,
            'brainstorm_idea_collection',
            'v1'
        );

        if (artifacts.length === 0) {
            return null;
        }

        // Return the most recent result
        return artifacts[0];
    }
} 