import { Kysely } from 'kysely';
import { v4 as uuidv4 } from 'uuid';
import type { DB } from '../database/types';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { TemplateService } from './templates/TemplateService';
import { LLMService } from './LLMService';

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
        private transformRepo: TransformRepository,
        private templateService: TemplateService,
        private llmService: LLMService
    ) {}

    // Start brainstorm job - creates transform and begins background processing
    async startBrainstorm(request: BrainstormRequest): Promise<{ transformId: string }> {
        const { projectId, params } = request;

        // Create user input artifact
        const userInputArtifact = await this.artifactRepo.createArtifact(
            projectId,
            'brainstorm_params',
            params,
            'v1'
        );

        // Create transform for the brainstorm job
        const transform = await this.transformRepo.createTransform(
            projectId,
            'llm',
            'v1',
            'pending',
            { brainstorm_params: params }
        );

        // Link input artifact to transform
        await this.transformRepo.addTransformInputs(transform.id, [
            { artifactId: userInputArtifact.id, inputRole: 'brainstorm_params' }
        ]);

        // Start background processing
        this.processBrainstormInBackground(transform.id, projectId, params);

        return { transformId: transform.id };
    }

    // Background processing method
    private async processBrainstormInBackground(
        transformId: string,
        projectId: string,
        params: BrainstormParams
    ): Promise<void> {
        try {
            // Update transform status to running
            await this.transformRepo.updateTransformStreamingStatus(transformId, 'running', 0);

            // Get brainstorm template
            const template = this.templateService.getBrainstormingTemplate();
            const prompt = template.generatePrompt(params);

            // Update progress
            await this.transformRepo.updateTransformStreamingStatus(transformId, 'running', 25);

            // Call LLM
            const response = await this.llmService.generateText(prompt, 'gpt-4o-mini');

            // Update progress  
            await this.transformRepo.updateTransformStreamingStatus(transformId, 'running', 75);

            // Parse response and create result artifact
            const brainstormResult = this.parseBrainstormResponse(response.text);
            
            const resultArtifact = await this.artifactRepo.createArtifact(
                projectId,
                'brainstorm_result',
                brainstormResult,
                'v1'
            );

            // Update artifact with streaming completion
            await this.artifactRepo.updateArtifactStreamingStatus(
                resultArtifact.id,
                'completed',
                100,
                brainstormResult
            );

            // Link output artifact to transform
            await this.transformRepo.addTransformOutputs(transformId, [
                { artifactId: resultArtifact.id, outputRole: 'brainstorm_result' }
            ]);

            // Complete transform
            await this.transformRepo.updateTransformStreamingStatus(transformId, 'completed', 100);
            await this.transformRepo.updateTransformStatus(transformId, 'completed');

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

    // Parse LLM response into structured brainstorm result
    private parseBrainstormResponse(response: string): any {
        try {
            // Try to parse as JSON first
            return JSON.parse(response);
        } catch {
            // If not JSON, create a simple structure
            return {
                ideas: [
                    {
                        title: "Generated Story Idea",
                        description: response,
                        characters: [],
                        plot_points: [],
                        themes: []
                    }
                ],
                generated_at: new Date().toISOString()
            };
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
        const artifacts = await this.artifactRepo.getArtifactsByType(
            projectId,
            'brainstorm_result',
            'v1'
        );

        if (artifacts.length === 0) {
            return null;
        }

        // Return the most recent result
        return artifacts[0];
    }
} 