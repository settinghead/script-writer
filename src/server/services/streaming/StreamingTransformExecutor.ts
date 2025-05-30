import { createOpenAI } from '@ai-sdk/openai';
import { streamText, createDataStreamResponse } from 'ai';
import { Response } from 'express';
import { jsonrepair } from 'jsonrepair';
import { ArtifactRepository } from '../../repositories/ArtifactRepository';
import { TransformRepository } from '../../repositories/TransformRepository';
import { TemplateService } from '../templates/TemplateService';
import { Artifact, BrainstormingJobParamsV1, OutlineJobParamsV1, OutlineSessionV1 } from '../../types/artifacts';
import { IdeationService } from '../IdeationService';
import { JobBroadcaster } from './JobBroadcaster';
import { StreamingCache } from './StreamingCache';
import { v4 as uuidv4 } from 'uuid';
import { getLLMCredentials } from '../LLMConfig';

// Define StreamingRequest interface locally to avoid path issues
interface StreamingRequest {
    templateId: string;
    artifactIds: string[];
    templateParams?: Record<string, any>;
}

export class StreamingTransformExecutor {
    constructor(
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository,
        private templateService: TemplateService,
        private ideationService?: IdeationService
    ) { }

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

            // 3. Create transform record
            const transform = await this.createTransform(userId, artifacts, template.id);

            // 4. Get model name from request or use default
            const { modelName: defaultModelName } = getLLMCredentials();
            const modelName = defaultModelName;

            // 5. Stream LLM response
            await this.streamLLMResponse(
                prompt,
                modelName,
                template.outputFormat,
                transform,
                res,
                userId
            );

        } catch (error) {
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Streaming failed',
                    details: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }

    private async loadArtifacts(userId: string, artifactIds: string[]): Promise<Artifact[]> {
        const artifacts: Artifact[] = [];
        for (const id of artifactIds) {
            const artifact = await this.artifactRepo.getArtifact(id, userId);
            if (!artifact) {
                throw new Error(`Artifact ${id} not found`);
            }
            artifacts.push(artifact);
        }
        return artifacts;
    }

    private mapArtifactsToContext(artifacts: Artifact[]): Record<string, any> {
        const context: Record<string, any> = {};
        for (const artifact of artifacts) {
            context[artifact.type] = artifact.data;
        }
        return context;
    }

    private async createTransform(userId: string, artifacts: Artifact[], templateId: string) {
        const { modelName: defaultModelName } = getLLMCredentials();

        const transform = await this.transformRepo.createTransform(
            userId,
            'llm',
            'v1',
            'running',
            {
                started_at: new Date().toISOString(),
                template_id: templateId,
                model_name: defaultModelName
            }
        );

        // Link input artifacts
        if (artifacts.length > 0) {
            await this.transformRepo.addTransformInputs(
                transform.id,
                artifacts.map(artifact => ({ artifactId: artifact.id }))
            );
        }

        return transform;
    }

    private async streamLLMResponse(
        prompt: string,
        modelName: string,
        outputFormat: string,
        transform: any,
        res: Response | undefined,
        userId: string
    ): Promise<void> {
        const { apiKey, baseUrl } = getLLMCredentials();

        const llmAI = createOpenAI({
            apiKey,
            baseURL: baseUrl,
        });

        // Store the prompt
        await this.transformRepo.addLLMPrompts(transform.id, [
            { promptText: prompt, promptRole: 'primary' }
        ]);

        const result = await streamText({
            model: llmAI(modelName),
            messages: [{ role: 'user', content: prompt }]
        });

        // Get the job broadcaster instance
        const broadcaster = JobBroadcaster.getInstance();

        // If a response is provided, it's a direct connection (not background job)
        // We still need to set headers for direct connections
        let isDirectConnection = false;
        if (res && !res.headersSent && !res.destroyed && res.writable) {
            try {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.setHeader('Transfer-Encoding', 'chunked');
                isDirectConnection = true;
            } catch (error: any) {
                isDirectConnection = false;
            }
        }

        const pump = async () => {
            try {
                // Initialize cache for this transform
                const cache = StreamingCache.getInstance();
                cache.initializeTransform(transform.id);

                let chunkCount = 0;
                let batchedChunks: string[] = [];
                const BATCH_SIZE = 10; // Batch chunks together

                for await (const chunk of result.textStream) {
                    chunkCount++;

                    // Add chunk to batch
                    batchedChunks.push(chunk);

                    // Send batch when it reaches size or on specific intervals
                    if (batchedChunks.length >= BATCH_SIZE) {
                        // Format batched chunks for streaming
                        const batchedMessage = `0:${JSON.stringify(batchedChunks.join(''))}\n`;

                        // Add to cache
                        cache.addChunk(transform.id, batchedMessage);

                        // Broadcast to all connected clients
                        broadcaster.broadcast(transform.id, batchedMessage);

                        // Also write to direct connection if available
                        if (isDirectConnection && res && !res.destroyed && res.writable) {
                            try {
                                res.write(`data: ${batchedMessage}`);
                            } catch (writeError: any) {
                                isDirectConnection = false;
                            }
                        }

                        // Clear batch
                        batchedChunks = [];
                    }
                }

                // Send any remaining chunks
                if (batchedChunks.length > 0) {
                    const batchedMessage = `0:${JSON.stringify(batchedChunks.join(''))}\n`;
                    cache.addChunk(transform.id, batchedMessage);
                    broadcaster.broadcast(transform.id, batchedMessage);

                    if (isDirectConnection && res && !res.destroyed && res.writable) {
                        try {
                            res.write(`data: ${batchedMessage}`);
                        } catch (writeError: any) {
                            // Silent fail
                        }
                    }
                }

                // Handle completion
                const finalResult = await result;
                const text = await finalResult.text;
                const usage = await finalResult.usage;

                try {
                    // Mark transform as completed
                    await this.transformRepo.updateTransformStatus(transform.id, 'completed');

                    // Check if LLM transform data already exists to prevent duplicate insertion
                    const existingLLMData = await this.transformRepo.getLLMTransformData(transform.id);
                    if (!existingLLMData) {
                        // Update LLM transform data only if it doesn't exist
                        await this.transformRepo.addLLMTransform({
                            transform_id: transform.id,
                            model_name: modelName,
                            raw_response: text,
                            token_usage: usage
                        });
                    }

                    // Parse and create output artifacts based on outputFormat
                    let parsedData: any = null;

                    try {
                        // Clean the text content
                        let cleanContent = text.trim();
                        if (cleanContent.startsWith('```json')) {
                            cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                        } else if (cleanContent.startsWith('```')) {
                            cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
                        }

                        // Use jsonrepair for more robust parsing
                        const { jsonrepair } = await import('jsonrepair');
                        const repairedJson = jsonrepair(cleanContent);
                        parsedData = JSON.parse(repairedJson);

                        // Validate based on output format
                        if (outputFormat === 'json_array' && !Array.isArray(parsedData)) {
                            throw new Error('Response is not a JSON array');
                        } else if (outputFormat === 'outline_components' && typeof parsedData !== 'object') {
                            throw new Error('Response is not a JSON object');
                        }

                    } catch (parseError) {
                        // Try a more aggressive cleaning approach for arrays
                        if (outputFormat === 'json_array') {
                            try {
                                let fallbackContent = text.trim();
                                // Remove any trailing incomplete JSON
                                const lastBracket = fallbackContent.lastIndexOf('}');
                                if (lastBracket > 0) {
                                    fallbackContent = fallbackContent.substring(0, lastBracket + 1) + ']';
                                }

                                const { jsonrepair } = await import('jsonrepair');
                                const repairedFallback = jsonrepair(fallbackContent);
                                parsedData = JSON.parse(repairedFallback);

                                if (!Array.isArray(parsedData)) {
                                    throw new Error('Fallback parsing failed - not an array');
                                }
                            } catch (fallbackError) {
                                throw parseError; // Throw original error
                            }
                        } else {
                            throw parseError;
                        }
                    }

                    // Create output artifacts based on output format
                    if (parsedData) {
                        if (outputFormat === 'outline_components') {
                            await this.createOutlineArtifacts(userId, transform, parsedData);
                        } else {
                            // Default to array handling (brainstorming)
                            await this.createOutputArtifacts(userId, transform, parsedData, text);
                        }

                        // Store parsed results in cache
                        cache.setResults(transform.id, parsedData);
                    }

                    // Mark cache as complete
                    cache.markComplete(transform.id);

                } catch (error) {
                    await this.transformRepo.updateTransformStatus(transform.id, 'failed');
                    throw error;
                }

                // Send completion events to all connected clients
                const completionData = {
                    e: JSON.stringify({ finishReason: finalResult.finishReason, usage }),
                    d: JSON.stringify({ finishReason: finalResult.finishReason, usage })
                };

                broadcaster.broadcast(transform.id, `e:${completionData.e}\n`);
                broadcaster.broadcast(transform.id, `d:${completionData.d}\n`);

                // Also send to direct connection if available
                if (isDirectConnection && res && !res.destroyed && res.writable) {
                    try {
                        res.write(`data: e:${completionData.e}\n\n`);
                        res.write(`data: d:${completionData.d}\n\n`);
                        res.end();
                    } catch (endError: any) {
                        // Silent fail
                    }
                }

            } catch (error: any) {
                await this.transformRepo.updateTransformStatus(transform.id, 'failed');

                // Broadcast error to all connected clients
                const errorMessage = `error:${JSON.stringify({ error: error.message })}\n`;
                broadcaster.broadcast(transform.id, errorMessage);

                // Also send to direct connection if available
                if (isDirectConnection && res && !res.destroyed && res.writable) {
                    try {
                        res.write(`data: ${errorMessage}\n`);
                        res.end();
                    } catch (errorWriteError: any) {
                        // Silent fail
                    }
                }
                throw error; // Re-throw for background job retry handling
            }
        };
        await pump();
    }

    private async createOutputArtifacts(
        userId: string,
        transform: any,
        jsonData: any[],
        rawContent: string
    ): Promise<void> {
        try {
            // Create individual brainstorm idea artifacts
            for (let i = 0; i < jsonData.length; i++) {
                const item = jsonData[i];

                // Transform the LLM response format to match BrainstormIdeaV1
                const brainstormIdeaData = {
                    idea_text: item.body || item.text || String(item),
                    idea_title: item.title,
                    order_index: i,
                    confidence_score: item.confidence_score || undefined
                };

                const artifact = await this.artifactRepo.createArtifact(
                    userId,
                    'brainstorm_idea',
                    brainstormIdeaData,
                    'v1',
                    { transform_id: transform.id }
                );

                // Link artifact as transform output
                await this.transformRepo.addTransformOutputs(transform.id, [
                    { artifactId: artifact.id, outputRole: `idea_${i}` }
                ]);
            }

        } catch (error) {
            throw error;
        }
    }

    // Job-based brainstorming methods
    async startBrainstormingJob(
        userId: string,
        jobParams: BrainstormingJobParamsV1
    ): Promise<{ ideationRunId: string; transformId: string }> {
        if (!this.ideationService) {
            throw new Error('IdeationService not available for job creation');
        }

        // 1. Create ideation run using existing service
        const { runId: ideationRunId } = await this.ideationService.createRunWithIdeas(
            userId,
            jobParams.platform,
            jobParams.genrePaths,
            jobParams.genreProportions,
            [], // No initial ideas for brainstorming job
            [], // No initial idea titles
            jobParams.requirements
        );

        // 2. Create job parameters artifact
        const paramsArtifact = await this.artifactRepo.createArtifact(
            userId,
            'brainstorming_job_params',
            jobParams,
            'v1'
        );

        // 3. Get default model name
        const { modelName } = getLLMCredentials();

        // 4. Create transform with 'running' status
        const transform = await this.transformRepo.createTransform(
            userId,
            'llm',
            'v1',
            'running',
            {
                started_at: new Date().toISOString(),
                template_id: 'brainstorming',
                model_name: modelName,
                ideation_run_id: ideationRunId,
                max_retries: 2
            }
        );

        // 5. Link transform inputs
        await this.transformRepo.addTransformInputs(
            transform.id,
            [{ artifactId: paramsArtifact.id, inputRole: 'job_params' }]
        );

        return {
            ideationRunId,
            transformId: transform.id
        };
    }

    async executeStreamingJobWithRetries(
        transformId: string,
        res?: Response
    ): Promise<void> {
        const transform = await this.transformRepo.getTransform(transformId);
        if (!transform) {
            throw new Error(`Transform ${transformId} not found`);
        }

        // Simple check: if completed, don't restart
        if (transform.status === 'completed') {
            return;
        }

        // Check if we already have LLM data (job finished but status not updated)
        const llmData = await this.transformRepo.getLLMTransformData(transformId);
        if (llmData) {
            await this.updateTransformStatus(transformId, 'completed');
            return;
        }

        // Determine job type based on template_id
        const templateId = transform.execution_context?.template_id;

        try {
            switch (templateId) {
                case 'brainstorming':
                    await this.executeStreamingLLM(transform, res);
                    break;
                case 'outline':
                    await this.executeStreamingOutline(transform, res);
                    break;
                default:
                    throw new Error(`Unknown template_id: ${templateId}`);
            }
            await this.updateTransformStatus(transformId, 'completed');
        } catch (error) {
            await this.handleJobFailure(transformId, error as Error);
        }
    }

    private async handleJobFailure(
        transformId: string,
        error: Error
    ): Promise<void> {
        const transform = await this.transformRepo.getTransform(transformId);
        if (!transform) {
            throw new Error(`Transform ${transformId} not found`);
        }

        if (transform.retry_count < transform.max_retries) {
            // Increment retry count and retry
            await this.transformRepo.updateTransform(transformId, {
                retry_count: transform.retry_count + 1,
                status: 'running'
            });

            // Schedule retry with exponential backoff
            const delay = 1000 * Math.pow(2, transform.retry_count);

            setTimeout(() => {
                this.retryStreamingJob(transformId);
            }, delay);
        } else {
            // Mark as failed
            await this.updateTransformStatus(transformId, 'failed');
        }
    }

    private async retryStreamingJob(transformId: string): Promise<void> {
        try {
            // Important: Don't pass response object to retries since the original connection may be closed
            await this.executeStreamingJobWithRetries(transformId, undefined);
        } catch (error) {
            // Silent fail for retries
        }
    }

    private async updateTransformStatus(transformId: string, status: string): Promise<void> {
        await this.transformRepo.updateTransform(transformId, {
            status,
            updated_at: new Date().toISOString()
        });
    }

    private async executeStreamingLLM(transform: any, res?: Response): Promise<void> {
        // Get job parameters from transform inputs
        const inputs = await this.transformRepo.getTransformInputs(transform.id);
        const paramsInput = inputs.find(input => input.input_role === 'job_params');

        if (!paramsInput) {
            throw new Error('Job parameters not found for transform');
        }

        const paramsArtifact = await this.artifactRepo.getArtifact(paramsInput.artifact_id, transform.user_id);
        if (!paramsArtifact) {
            throw new Error('Job parameters artifact not found');
        }

        const jobParams = paramsArtifact.data as BrainstormingJobParamsV1;

        // Get and render template
        const template = this.templateService.getTemplate('brainstorming');
        if (!template) {
            throw new Error('Brainstorming template not found');
        }

        const prompt = await this.templateService.renderTemplate(template, {
            artifacts: {},
            params: {
                platform: jobParams.platform,
                genre: this.buildGenrePromptString(jobParams.genrePaths, jobParams.genreProportions),
                requirements: jobParams.requirements
            }
        });

        // Get model name from credentials
        const { modelName } = getLLMCredentials();

        // Stream LLM response
        await this.streamLLMResponse(
            prompt,
            modelName,
            template.outputFormat,
            transform,
            res,
            transform.user_id
        );
    }

    private buildGenrePromptString(genrePaths: string[][], genreProportions: number[]): string {
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
    }

    // Job-based outline generation methods
    async startOutlineJob(
        userId: string,
        jobParams: OutlineJobParamsV1
    ): Promise<{ outlineSessionId: string; transformId: string }> {
        // 1. Get and validate source artifact
        const sourceArtifact = await this.artifactRepo.getArtifact(jobParams.sourceArtifactId, userId);
        if (!sourceArtifact) {
            throw new Error('Source artifact not found or access denied');
        }

        // Validate artifact type
        if (!['brainstorm_idea', 'user_input'].includes(sourceArtifact.type)) {
            throw new Error('Invalid source artifact type. Must be brainstorm_idea or user_input');
        }

        // 2. Create outline session
        const outlineSessionId = uuidv4();
        const outlineSessionArtifact = await this.artifactRepo.createArtifact(
            userId,
            'outline_session',
            {
                id: outlineSessionId,
                ideation_session_id: 'job-based',
                status: 'active',
                created_at: new Date().toISOString()
            } as OutlineSessionV1
        );

        // 3. Create job parameters artifact
        const paramsArtifact = await this.artifactRepo.createArtifact(
            userId,
            'outline_job_params',
            jobParams,
            'v1'
        );

        // 4. Get default model name
        const { modelName } = getLLMCredentials();

        // 5. Create transform with 'running' status
        const transform = await this.transformRepo.createTransform(
            userId,
            'llm',
            'v1',
            'running',
            {
                started_at: new Date().toISOString(),
                template_id: 'outline',
                model_name: modelName,
                outline_session_id: outlineSessionId,
                max_retries: 2
            }
        );

        // 6. Link transform inputs
        await this.transformRepo.addTransformInputs(
            transform.id,
            [
                { artifactId: paramsArtifact.id, inputRole: 'job_params' },
                { artifactId: sourceArtifact.id, inputRole: 'source_artifact' },
                { artifactId: outlineSessionArtifact.id, inputRole: 'outline_session' }
            ]
        );

        return {
            outlineSessionId,
            transformId: transform.id
        };
    }

    async executeOutlineJobWithRetries(
        transformId: string,
        res?: Response
    ): Promise<void> {
        const transform = await this.transformRepo.getTransform(transformId);
        if (!transform) {
            throw new Error(`Transform ${transformId} not found`);
        }

        // Simple check: if completed, don't restart
        if (transform.status === 'completed') {
            return;
        }

        // Check if we already have LLM data (job finished but status not updated)
        const llmData = await this.transformRepo.getLLMTransformData(transformId);
        if (llmData) {
            await this.updateTransformStatus(transformId, 'completed');
            return;
        }

        // Just start the job - no complex checks
        try {
            await this.executeStreamingOutline(transform, res);
            await this.updateTransformStatus(transformId, 'completed');
        } catch (error) {
            await this.handleJobFailure(transformId, error as Error);
        }
    }

    private async executeStreamingOutline(transform: any, res?: Response): Promise<void> {
        // Get job parameters and source artifact
        const inputs = await this.transformRepo.getTransformInputs(transform.id);
        const paramsInput = inputs.find(input => input.input_role === 'job_params');
        const sourceInput = inputs.find(input => input.input_role === 'source_artifact');

        if (!paramsInput || !sourceInput) {
            throw new Error('Job parameters or source artifact not found for transform');
        }

        const paramsArtifact = await this.artifactRepo.getArtifact(paramsInput.artifact_id, transform.user_id);
        const sourceArtifact = await this.artifactRepo.getArtifact(sourceInput.artifact_id, transform.user_id);

        if (!paramsArtifact || !sourceArtifact) {
            throw new Error('Job parameters or source artifact not found');
        }

        const jobParams = paramsArtifact.data as OutlineJobParamsV1;

        // Extract user input text from source artifact
        const userInput = sourceArtifact.data.text || sourceArtifact.data.idea_text;
        if (!userInput || !userInput.trim()) {
            throw new Error('Source artifact contains no text content');
        }

        // Get and render template
        const template = this.templateService.getTemplate('outline');
        if (!template) {
            throw new Error('Outline template not found');
        }

        // Build episode info string if provided
        const episodeInfo = (jobParams.totalEpisodes && jobParams.episodeDuration)
            ? `\n\n剧集信息：\n- 总集数：${jobParams.totalEpisodes}集\n- 每集时长：约${jobParams.episodeDuration}分钟`
            : '';

        const prompt = await this.templateService.renderTemplate(template, {
            artifacts: {},
            params: {
                episodeInfo,
                userInput
            }
        });

        // Get model name from credentials
        const { modelName } = getLLMCredentials();

        // Stream LLM response with outline_components output format
        await this.streamLLMResponse(
            prompt,
            modelName,
            'outline_components',
            transform,
            res,
            transform.user_id
        );
    }

    private async createOutlineArtifacts(
        userId: string,
        transform: any,
        outlineData: any
    ): Promise<void> {
        try {
            // Create individual outline component artifacts based on the JSON structure

            // 1. Title
            if (outlineData.title) {
                const titleArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_title',
                    { title: outlineData.title },
                    'v1',
                    { transform_id: transform.id }
                );
                await this.transformRepo.addTransformOutputs(transform.id, [
                    { artifactId: titleArtifact.id, outputRole: 'title' }
                ]);
            }

            // 2. Genre
            if (outlineData.genre) {
                const genreArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_genre',
                    { genre: outlineData.genre },
                    'v1',
                    { transform_id: transform.id }
                );
                await this.transformRepo.addTransformOutputs(transform.id, [
                    { artifactId: genreArtifact.id, outputRole: 'genre' }
                ]);
            }

            // 3. Selling Points
            if (outlineData.selling_points && Array.isArray(outlineData.selling_points)) {
                const sellingPointsArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_selling_points',
                    { selling_points: outlineData.selling_points.join('\n') },
                    'v1',
                    { transform_id: transform.id }
                );
                await this.transformRepo.addTransformOutputs(transform.id, [
                    { artifactId: sellingPointsArtifact.id, outputRole: 'selling_points' }
                ]);
            }

            // 4. Setting
            if (outlineData.setting) {
                const settingData = typeof outlineData.setting === 'object'
                    ? `${outlineData.setting.core_setting_summary || ''}\n\n关键场景：\n${(outlineData.setting.key_scenes || []).map((scene: string) => `- ${scene}`).join('\n')}`
                    : String(outlineData.setting);

                const settingArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_setting',
                    { setting: settingData },
                    'v1',
                    { transform_id: transform.id }
                );
                await this.transformRepo.addTransformOutputs(transform.id, [
                    { artifactId: settingArtifact.id, outputRole: 'setting' }
                ]);
            }

            // 5. Synopsis
            if (outlineData.synopsis) {
                const synopsisArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_synopsis',
                    { synopsis: outlineData.synopsis },
                    'v1',
                    { transform_id: transform.id }
                );
                await this.transformRepo.addTransformOutputs(transform.id, [
                    { artifactId: synopsisArtifact.id, outputRole: 'synopsis' }
                ]);
            }

            // 6. Characters
            if (outlineData.main_characters && Array.isArray(outlineData.main_characters)) {
                const charactersArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_characters',
                    {
                        characters: outlineData.main_characters.map((char: any) => ({
                            name: char.name || '',
                            description: char.description || ''
                        }))
                    },
                    'v1',
                    { transform_id: transform.id }
                );
                await this.transformRepo.addTransformOutputs(transform.id, [
                    { artifactId: charactersArtifact.id, outputRole: 'characters' }
                ]);
            }

            // Update outline session status to completed
            if (transform.execution_context?.outline_session_id) {
                await this.artifactRepo.createArtifact(
                    userId,
                    'outline_session',
                    {
                        id: transform.execution_context.outline_session_id,
                        ideation_session_id: 'job-based',
                        status: 'completed',
                        created_at: new Date().toISOString()
                    } as OutlineSessionV1
                );
            }

        } catch (error) {
            throw error;
        }
    }
} 