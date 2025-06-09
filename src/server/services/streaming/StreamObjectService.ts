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
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                res.write(`data: error:${JSON.stringify({ error: errorMessage })}\n\n`);
                res.end();
            }
            throw error;
        }
    }

    /**
     * Create job-specific streaming methods
     */
      async streamBrainstorming(userId: string, params: any, res: Response): Promise<void> {
    // Build genre string from genrePaths and genreProportions
    const buildGenrePromptString = (genrePaths: string[][], genreProportions: number[]): string => {
      if (!genrePaths || genrePaths.length === 0) return '未指定';
      return genrePaths.map((path: string[], index: number) => {
        const proportion = genreProportions && genreProportions[index] !== undefined
          ? genreProportions[index]
          : (100 / genrePaths.length);
        const pathString = path.join(' > ');
        return genrePaths.length > 1
          ? `${pathString} (${proportion.toFixed(0)}%)`
          : pathString;
      }).join(', ');
    };

    // Build requirements section if provided
    const requirementsSection = params.requirements?.trim()
      ? `特殊要求：${params.requirements.trim()}`
      : '';

    const templateParams = {
      genre: buildGenrePromptString(params.genrePaths || [], params.genreProportions || []),
      platform: params.platform || '通用短视频平台',
      requirementsSection: requirementsSection
    };

    return this.executeStreamingTransform(userId, {
      templateId: 'brainstorming',
      artifactIds: [],
      templateParams
    }, res);
  }

      async streamOutline(userId: string, params: any, sourceArtifactIds: string[], res: Response): Promise<void> {
    // Load source artifacts to extract content and cascade parameters
    const artifacts = await this.loadArtifacts(userId, sourceArtifactIds);
    if (artifacts.length === 0) {
      throw new Error('No source artifacts found');
    }

    // Get the primary source artifact (usually first one)
    const sourceArtifact = artifacts[0];
    
    // Extract user input from the source artifact
    let userInput = '';
    if (sourceArtifact.type === 'brainstorm_idea') {
      userInput = `${sourceArtifact.data.idea_title || ''}: ${sourceArtifact.data.idea_text}`;
    } else if (sourceArtifact.type === 'user_input') {
      userInput = sourceArtifact.data.text || '';
    }

    // Use cascaded parameters if available, otherwise defaults
    const cascadedParams = params.cascadedParams || {};
    
    // Build genre string from cascaded genre paths
    const buildGenrePromptString = (genrePaths: string[][], genreProportions: number[]): string => {
      if (!genrePaths || genrePaths.length === 0) return '未指定';
      return genrePaths.map((path: string[], index: number) => {
        const proportion = genreProportions && genreProportions[index] !== undefined
          ? genreProportions[index]
          : (100 / genrePaths.length);
        const pathString = path.join(' > ');
        return genrePaths.length > 1
          ? `${pathString} (${proportion.toFixed(0)}%)`
          : pathString;
      }).join(', ');
    };

    const templateParams = {
      userInput: userInput,
      platform: cascadedParams.platform || '通用短视频平台',
      genre: buildGenrePromptString(cascadedParams.genre_paths || [], cascadedParams.genre_proportions || []),
      requirements: cascadedParams.requirements || '',
      totalEpisodes: params.totalEpisodes || 30,
      episodeInfo: params.totalEpisodes 
        ? `总共需要分为 ${params.totalEpisodes} 集，单集时长约 ${params.episodeDuration || 2} 分钟。`
        : '总共需要分为 30 集，单集时长约 2 分钟。'
    };

    return this.executeStreamingTransform(userId, {
      templateId: 'outline',
      artifactIds: sourceArtifactIds,
      templateParams
    }, res);
  }

      async streamEpisodes(userId: string, params: any, sourceArtifactIds: string[], res: Response): Promise<void> {
    // Load source artifacts to get outline data and stage information
    const artifacts = await this.loadArtifacts(userId, sourceArtifactIds);
    if (artifacts.length === 0) {
      throw new Error('No source artifacts found');
    }

    // Find the outline session artifact (outline data)
    const outlineArtifact = artifacts.find(a => a.type === 'outline_session');
    if (!outlineArtifact) {
      throw new Error('Outline session artifact not found');
    }

    // Get stage artifact if provided (contains stage-specific data)
    const stageArtifact = artifacts.find(a => a.type === 'synopsis_stage');
    if (!stageArtifact) {
      throw new Error('Synopsis stage artifact not found');
    }

    const outlineData = outlineArtifact.data;
    const stageData = stageArtifact.data;

    // Build template parameters from the stage and outline data
    const templateParams = {
      // Platform and genre info from cascade or outline
      platform: params.platform || outlineData.components?.platform || '通用短视频平台',
      genre: params.genre || outlineData.components?.genre || '未指定',
      requirements: params.requirements || outlineData.components?.requirements || '',
      
      // Episode configuration
      totalEpisodes: params.totalEpisodes || outlineData.totalEpisodes || 30,
      episodeDuration: params.episodeDuration || outlineData.episodeDuration || 2,
      
      // Stage-specific data
      stageNumber: stageData.stageNumber || 1,
      numberOfEpisodes: stageData.numberOfEpisodes || 1,
      startingEpisode: stageData.startingEpisode || 1,
      endingEpisode: stageData.endingEpisode || 1,
      
      // Stage content
      stageSynopsis: stageData.stageSynopsis || '',
      timeframe: stageData.timeframe || '',
      startingCondition: stageData.startingCondition || '',
      endingCondition: stageData.endingCondition || '',
      stageStartEvent: stageData.stageStartEvent || '',
      stageEndEvent: stageData.stageEndEvent || '',
      relationshipLevel: stageData.relationshipLevel || '',
      emotionalArc: stageData.emotionalArc || '',
      externalPressure: stageData.externalPressure || '',
      
      // Key points as formatted string 
      keyPoints: stageData.keyMilestones ? 
        stageData.keyMilestones.map((m: any) => `${m.event} (${m.timeSpan})`).join('; ') : '',
      
      // Custom requirements if any
      customRequirements: params.customRequirements || '',
      episodeSpecificInstructions: params.episodeSpecificInstructions || ''
    };

    return this.executeStreamingTransform(userId, {
      templateId: 'episode_synopsis_generation',
      artifactIds: sourceArtifactIds,
      templateParams
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