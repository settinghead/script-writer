import { streamObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { Response } from 'express';
import { getLLMCredentials } from '../LLMConfig';
import {
    TEMPLATE_SCHEMAS,
    OutlineSchema,
    IdeaArraySchema,
    EpisodeArraySchema,
    ScriptSchema
} from '../../../common/schemas/streaming';
import { TemplateService } from '../templates/TemplateService';
import { ArtifactRepository } from '../../repositories/ArtifactRepository';
import { TransformRepository } from '../../repositories/TransformRepository';

export interface StreamingRequest {
    templateId: string;
    artifactIds: string[];
    templateParams?: Record<string, any>;
    modelName?: string;
}

export class StreamObjectService {
    constructor(
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository,
        private templateService: TemplateService
    ) { }

    /**
     * Execute streaming transform using AI SDK streamObject
     */
    async executeStreamingTransform(
        userId: string,
        request: StreamingRequest,
        res: Response
    ): Promise<void> {
        try {
            // 1. Load artifacts (if any)
            const artifacts = await this.loadArtifacts(userId, request.artifactIds);

            // 2. Get and render template
            const template = this.templateService.getTemplate(request.templateId);
            if (!template) {
                throw new Error(`Template not found: ${request.templateId}`);
            }

            const prompt = await this.templateService.renderTemplate(template, {
                artifacts: this.mapArtifactsToContext(artifacts),
                params: request.templateParams || {}
            });

            // 3. Get schema for this template
            const schema = TEMPLATE_SCHEMAS[request.templateId as keyof typeof TEMPLATE_SCHEMAS];
            if (!schema) {
                throw new Error(`No schema defined for template: ${request.templateId}`);
            }

            // 4. Create transform record
            const transform = await this.createTransform(userId, artifacts, template.id);

            // 5. Get model configuration
            const { apiKey, baseUrl, modelName: defaultModelName } = getLLMCredentials();
            const modelName = request.modelName || defaultModelName;

            const llmAI = createOpenAI({
                apiKey,
                baseURL: baseUrl,
            });

            // 6. Store the prompt
            await this.transformRepo.addLLMPrompts(transform.id, [
                { promptText: prompt, promptRole: 'primary' }
            ]);

            // 7. Stream using AI SDK streamObject
            const result = streamObject({
                model: llmAI(modelName),
                schema: schema as any, // Type assertion for now - schemas are dynamically selected
                prompt
            });

            // 8. Set response headers for streaming
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Transfer-Encoding', 'chunked');

            // 9. Pipe the stream to response
            await this.pipeStreamToResponse(result, res, transform, userId);

        } catch (error) {
            console.error('StreamObject service error:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Streaming failed',
                    details: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }

    /**
     * Pipe streamObject result to HTTP response
     */
    private async pipeStreamToResponse(
        result: any,
        res: Response,
        transform: any,
        userId: string
    ): Promise<void> {
        try {
            // Mark transform as running
            await this.transformRepo.updateTransformStatus(transform.id, 'running');

            // Stream partial objects
            for await (const partialObject of result.partialObjectStream) {
                const chunk = `0:${JSON.stringify(JSON.stringify(partialObject))}`;

                // Store chunk in database for resumability
                await this.transformRepo.addTransformChunk(transform.id, chunk);

                // Write to response
                if (!res.destroyed && res.writable) {
                    res.write(`data: ${chunk}\n\n`);
                }
            }

            // Get final result
            const finalObject = await result.object;
            const usage = await result.usage;

            // Create output artifact
            await this.createOutputArtifact(transform, finalObject, userId);

            // Store LLM metadata
            await this.transformRepo.addLLMTransform({
                transform_id: transform.id,
                model_name: 'gpt-4', // TODO: get from actual model
                raw_response: JSON.stringify(finalObject),
                token_usage: usage
            });

            // Mark transform as completed
            await this.transformRepo.updateTransformStatus(transform.id, 'completed');

            // Send completion events
            res.write(`data: e:${JSON.stringify({ finishReason: 'stop', usage })}\n\n`);
            res.write(`data: d:${JSON.stringify({ finishReason: 'stop', usage })}\n\n`);
            res.end();

        } catch (error) {
            await this.transformRepo.updateTransformStatus(transform.id, 'failed');
            console.error('Streaming error:', error);

            if (!res.destroyed && res.writable) {
                res.write(`data: error:${JSON.stringify({ error: error.message })}\n\n`);
                res.end();
            }
            throw error;
        }
    }

    /**
     * Create job-specific streaming methods
     */
    async streamBrainstorming(userId: string, params: any, res: Response): Promise<void> {
        return this.executeStreamingTransform(userId, {
            templateId: 'brainstorming',
            artifactIds: [],
            templateParams: params
        }, res);
    }

    async streamOutline(userId: string, params: any, sourceArtifactIds: string[], res: Response): Promise<void> {
        return this.executeStreamingTransform(userId, {
            templateId: 'outline',
            artifactIds: sourceArtifactIds,
            templateParams: params
        }, res);
    }

    async streamEpisodes(userId: string, params: any, sourceArtifactIds: string[], res: Response): Promise<void> {
        return this.executeStreamingTransform(userId, {
            templateId: 'episode_synopsis_generation',
            artifactIds: sourceArtifactIds,
            templateParams: params
        }, res);
    }

    async streamScript(userId: string, params: any, sourceArtifactIds: string[], res: Response): Promise<void> {
        return this.executeStreamingTransform(userId, {
            templateId: 'script_generation',
            artifactIds: sourceArtifactIds,
            templateParams: params
        }, res);
    }

    // ===============================
    // Helper Methods
    // ===============================

    private async loadArtifacts(userId: string, artifactIds: string[]): Promise<any[]> {
        const artifacts: any[] = [];
        for (const id of artifactIds) {
            const artifact = await this.artifactRepo.getArtifact(id, userId);
            if (artifact) {
                artifacts.push(artifact);
            }
        }
        return artifacts;
    }

    private mapArtifactsToContext(artifacts: any[]): Record<string, any> {
        const context: Record<string, any> = {};

        for (const artifact of artifacts) {
            // Map artifacts by type for template context
            const role = artifact.type || 'unknown';
            context[role] = artifact.data;
        }

        return context;
    }

    private async createTransform(userId: string, artifacts: any[], templateId: string): Promise<any> {
        const executionContext = {
            template_id: templateId,
            input_artifact_count: artifacts.length
        };

        return await this.transformRepo.createTransform(userId, 'llm', 'v1', 'pending', executionContext);
    }

    private async createOutputArtifact(transform: any, data: any, userId: string): Promise<void> {
        let artifactType = 'llm_output';

        // Determine artifact type based on template
        switch (transform.metadata?.template_id) {
            case 'brainstorming':
                artifactType = 'ideation_ideas';
                break;
            case 'outline':
                artifactType = 'outline_session';
                break;
            case 'episode_synopsis_generation':
                artifactType = 'episode_synopsis';
                break;
            case 'script_generation':
                artifactType = 'script_document';
                break;
        }

        const outputArtifact = await this.artifactRepo.createArtifact(
            userId,
            artifactType,
            data
        );

        // Link output to transform
        await this.transformRepo.addTransformOutputs(transform.id, [
            { artifactId: outputArtifact.id, outputRole: 'primary_output' }
        ]);
    }
} 