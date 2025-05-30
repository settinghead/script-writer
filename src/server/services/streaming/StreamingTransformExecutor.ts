import { createOpenAI } from '@ai-sdk/openai';
import { streamText, createDataStreamResponse } from 'ai';
import { Response } from 'express';
import { ArtifactRepository } from '../../repositories/ArtifactRepository';
import { TransformRepository } from '../../repositories/TransformRepository';
import { TemplateService } from '../templates/TemplateService';
import { Artifact, BrainstormingJobParamsV1, OutlineJobParamsV1, OutlineSessionV1 } from '../../types/artifacts';
import { IdeationService } from '../IdeationService';
import { JobBroadcaster } from './JobBroadcaster';
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

        // Initialize streaming in database
        console.log(`[StreamingTransformExecutor] Starting streaming for transform ${transform.id}`);

        const pump = async () => {
            try {
                let chunkCount = 0;
                let batchedChunks: string[] = [];
                let accumulatedContent = '';
                let previousContent = '';
                const BATCH_SIZE = 10; // Batch chunks together

                // Import spinner and processing utilities
                const { processStreamingContent, ConsoleSpinner } = await import('../../../common/utils/textCleaning');
                const spinner = ConsoleSpinner.getInstance();

                for await (const chunk of result.textStream) {
                    chunkCount++;
                    accumulatedContent += chunk;

                    // Process content for think mode detection
                    const { isThinking, thinkingStarted, thinkingEnded } = processStreamingContent(
                        accumulatedContent, 
                        previousContent
                    );

                    // Handle spinner for think mode
                    if (thinkingStarted) {
                        spinner.start(`Transform ${transform.id.substring(0, 8)} - AI thinking`);
                    } else if (thinkingEnded) {
                        spinner.stop();
                    }

                    // Add chunk to batch
                    batchedChunks.push(chunk);

                    // Send batch when it reaches size or on specific intervals
                    if (batchedChunks.length >= BATCH_SIZE) {
                        // Format batched chunks for streaming
                        const batchedMessage = `0:${JSON.stringify(batchedChunks.join(''))}`;

                        // Add to database
                        await this.transformRepo.addTransformChunk(transform.id, batchedMessage);
                        console.log(`[StreamingTransformExecutor] Added batch ${Math.floor(chunkCount / BATCH_SIZE)} to database for transform ${transform.id}, batch content preview: ${batchedMessage.substring(0, 100)}...`);

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

                    previousContent = accumulatedContent;
                }

                // Ensure spinner is stopped at the end
                spinner.stop();

                // Send any remaining chunks
                if (batchedChunks.length > 0) {
                    const batchedMessage = `0:${JSON.stringify(batchedChunks.join(''))}`;
                    await this.transformRepo.addTransformChunk(transform.id, batchedMessage);
                    console.log(`[StreamingTransformExecutor] Added final batch to database for transform ${transform.id}, content preview: ${batchedMessage.substring(0, 100)}...`);
                    broadcaster.broadcast(transform.id, batchedMessage);

                    if (isDirectConnection && res && !res.destroyed && res.writable) {
                        try {
                            res.write(`data: ${batchedMessage}`);
                        } catch (writeError: any) {
                            // Silent fail
                        }
                    }
                }

                // Final spinner cleanup
                spinner.stop();

                // Handle completion
                const finalResult = await result;
                const text = await finalResult.text;
                const usage = await finalResult.usage;

                try {
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
                        // Use robust JSON parsing that handles code blocks and additional text
                        const { robustJSONParse } = await import('../../../common/utils/textCleaning');
                        parsedData = await robustJSONParse(text);

                        // Validate based on output format
                        if (outputFormat === 'json_array' && !Array.isArray(parsedData)) {
                            throw new Error('Response is not a JSON array');
                        } else if (outputFormat === 'outline_components' && typeof parsedData !== 'object') {
                            throw new Error('Response is not a JSON object');
                        }

                    } catch (parseError) {
                        console.error(`[StreamingTransformExecutor] JSON parsing failed for transform ${transform.id}:`, parseError.message);
                        console.error(`[StreamingTransformExecutor] Raw content length: ${text.length}`);
                        console.error(`[StreamingTransformExecutor] Raw content preview: ${text.substring(0, 200)}...`);
                        throw parseError;
                    }

                    // Create output artifacts based on output format
                    if (parsedData) {
                        if (outputFormat === 'outline_components') {
                            await this.createOutlineArtifacts(userId, transform, parsedData);
                        } else {
                            // Default to array handling (brainstorming)
                            await this.createOutputArtifacts(userId, transform, parsedData, text);
                        }

                        // Results are stored as artifacts, no need to cache them
                    }

                    // CRITICAL: Mark transform as completed ONLY AFTER all data is saved
                    // This ensures that when frontend checks status='completed', all data is guaranteed to be available
                    await this.transformRepo.updateTransformStatus(transform.id, 'completed');
                    console.log(`[StreamingTransformExecutor] Transform ${transform.id} marked as completed - all data is now available`);

                } catch (error) {
                    await this.transformRepo.updateTransformStatus(transform.id, 'failed');
                    throw error;
                }

                // Send completion events to all connected clients
                const completionData = {
                    e: JSON.stringify({ finishReason: finalResult.finishReason, usage }),
                    d: JSON.stringify({ finishReason: finalResult.finishReason, usage })
                };

                broadcaster.broadcast(transform.id, `e:${completionData.e}`);
                broadcaster.broadcast(transform.id, `d:${completionData.d}`);

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
                
                // Schedule cleanup after 5 minutes to allow final clients to receive data
                setTimeout(async () => {
                    await this.transformRepo.cleanupTransformChunks(transform.id);
                    broadcaster.cleanup(transform.id);
                    console.log(`[StreamingTransformExecutor] Cleaned up chunks and broadcaster for transform ${transform.id}`);
                }, 5 * 60 * 1000);

            } catch (error: any) {
                await this.transformRepo.updateTransformStatus(transform.id, 'failed');

                // Broadcast error to all connected clients
                const errorMessage = `error:${JSON.stringify({ error: error.message })}`;
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

    // Generalized job creation method
    private async createStreamingJob<T>(
        userId: string,
        templateId: string,
        jobParams: T,
        additionalInputs: Array<{ artifactId: string; inputRole: string }> = [],
        executionContext: Record<string, any> = {}
    ): Promise<{ transformId: string }> {
        // 1. Create job parameters artifact
        const paramsArtifact = await this.artifactRepo.createArtifact(
            userId,
            `${templateId}_job_params`,
            jobParams,
            'v1'
        );

        // 2. Get default model name
        const { modelName } = getLLMCredentials();

        // 3. Create transform with 'running' status
        const transform = await this.transformRepo.createTransform(
            userId,
            'llm',
            'v1',
            'running',
            {
                started_at: new Date().toISOString(),
                template_id: templateId,
                model_name: modelName,
                max_retries: 2,
                ...executionContext
            }
        );

        // 4. Link transform inputs
        const inputs = [
            { artifactId: paramsArtifact.id, inputRole: 'job_params' },
            ...additionalInputs
        ];
        await this.transformRepo.addTransformInputs(transform.id, inputs);

        // 5. Start the streaming job immediately in the background
        const jobExecutor = templateId === 'brainstorming' 
            ? this.executeStreamingJobWithRetries.bind(this)
            : this.executeOutlineJobWithRetries.bind(this);
            
        jobExecutor(transform.id)
            .catch(error => {
                console.error(`Error starting ${templateId} streaming job for transform ${transform.id}:`, error);
                this.transformRepo.updateTransformStatus(transform.id, 'failed');
            });

        return { transformId: transform.id };
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

        // 2. Use generalized job creation
        const { transformId } = await this.createStreamingJob(
            userId,
            'brainstorming',
            jobParams,
            [], // No additional inputs for brainstorming
            { ideation_run_id: ideationRunId }
        );

        return {
            ideationRunId,
            transformId
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
        const brainstormingPromptBuilder = async (jobParams: BrainstormingJobParamsV1) => {
            // Get and render template
            const template = this.templateService.getTemplate('brainstorming');
            if (!template) {
                throw new Error('Brainstorming template not found');
            }

            // Build requirements section if provided
            const requirementsSection = jobParams.requirements?.trim()
                ? `特殊要求：${jobParams.requirements.trim()}`
                : '';

            return await this.templateService.renderTemplate(template, {
                artifacts: {},
                params: {
                    platform: jobParams.platform,
                    genre: this.buildGenrePromptString(jobParams.genrePaths, jobParams.genreProportions),
                    requirementsSection: requirementsSection
                }
            });
        };

        await this.executeGenericStreamingJob(
            transform,
            'brainstorming',
            brainstormingPromptBuilder,
            'json_array',
            res
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

        // 3. Use generalized job creation
        const { transformId } = await this.createStreamingJob(
            userId,
            'outline',
            jobParams,
            [
                { artifactId: sourceArtifact.id, inputRole: 'source_artifact' },
                { artifactId: outlineSessionArtifact.id, inputRole: 'outline_session' }
            ],
            { outline_session_id: outlineSessionId }
        );

        return {
            outlineSessionId,
            transformId
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
        const outlinePromptBuilder = async (jobParams: OutlineJobParamsV1, sourceArtifact: any) => {
            if (!sourceArtifact) {
                throw new Error('Source artifact is required for outline generation');
            }

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

            return await this.templateService.renderTemplate(template, {
                artifacts: {},
                params: {
                    episodeInfo,
                    userInput
                }
            });
        };

        await this.executeGenericStreamingJob(
            transform,
            'outline',
            outlinePromptBuilder,
            'outline_components',
            res
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

            // 6. Target Audience
            if (outlineData.target_audience) {
                const targetAudienceArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_target_audience',
                    {
                        demographic: outlineData.target_audience.demographic || '',
                        core_themes: outlineData.target_audience.core_themes || []
                    },
                    'v1',
                    { transform_id: transform.id }
                );
                await this.transformRepo.addTransformOutputs(transform.id, [
                    { artifactId: targetAudienceArtifact.id, outputRole: 'target_audience' }
                ]);
            }

            // 7. Satisfaction Points
            if (outlineData.satisfaction_points && Array.isArray(outlineData.satisfaction_points)) {
                const satisfactionPointsArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_satisfaction_points',
                    {
                        satisfaction_points: outlineData.satisfaction_points
                    },
                    'v1',
                    { transform_id: transform.id }
                );
                await this.transformRepo.addTransformOutputs(transform.id, [
                    { artifactId: satisfactionPointsArtifact.id, outputRole: 'satisfaction_points' }
                ]);
            }

            // 8. Characters
            if (outlineData.characters && Array.isArray(outlineData.characters)) {
                const charactersArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_characters',
                    {
                        characters: outlineData.characters.map((char: any) => ({
                            name: char.name || '',
                            type: char.type || 'other',
                            description: char.description || '',
                            age: char.age || undefined,
                            gender: char.gender || undefined,
                            occupation: char.occupation || undefined,
                            personality_traits: char.personality_traits || undefined,
                            character_arc: char.character_arc || undefined,
                            relationships: char.relationships || undefined,
                            key_scenes: char.key_scenes || undefined
                        }))
                    },
                    'v1',
                    { transform_id: transform.id }
                );
                await this.transformRepo.addTransformOutputs(transform.id, [
                    { artifactId: charactersArtifact.id, outputRole: 'characters' }
                ]);
            }

            // 9. Synopsis Stages
            if (outlineData.synopsis_stages && Array.isArray(outlineData.synopsis_stages)) {
                const synopsisStagesArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'outline_synopsis_stages',
                    {
                        synopsis_stages: outlineData.synopsis_stages
                    },
                    'v1',
                    { transform_id: transform.id }
                );
                await this.transformRepo.addTransformOutputs(transform.id, [
                    { artifactId: synopsisStagesArtifact.id, outputRole: 'synopsis_stages' }
                ]);
            }

            // Note: Outline session status is tracked via transform status, no need to create duplicate artifact

        } catch (error) {
            throw error;
        }
    }

    // Generalized job execution method
    private async executeGenericStreamingJob(
        transform: any,
        templateId: string,
        promptBuilder: (jobParams: any, sourceArtifact?: any) => Promise<string>,
        outputFormat: string,
        res?: Response
    ): Promise<void> {
        // Get job parameters from transform inputs
        const inputs = await this.transformRepo.getTransformInputs(transform.id);
        const paramsInput = inputs.find(input => input.input_role === 'job_params');
        const sourceInput = inputs.find(input => input.input_role === 'source_artifact');

        if (!paramsInput) {
            throw new Error('Job parameters not found for transform');
        }

        const paramsArtifact = await this.artifactRepo.getArtifact(paramsInput.artifact_id, transform.user_id);
        if (!paramsArtifact) {
            throw new Error('Job parameters artifact not found');
        }

        const jobParams = paramsArtifact.data;

        // Get source artifact if needed
        let sourceArtifact = null;
        if (sourceInput) {
            sourceArtifact = await this.artifactRepo.getArtifact(sourceInput.artifact_id, transform.user_id);
            if (!sourceArtifact) {
                throw new Error('Source artifact not found');
            }
        }

        // Build prompt using the provided builder function
        const prompt = await promptBuilder(jobParams, sourceArtifact);

        // Get model name from credentials
        const { modelName } = getLLMCredentials();

        // Stream LLM response
        await this.streamLLMResponse(
            prompt,
            modelName,
            outputFormat,
            transform,
            res,
            transform.user_id
        );
    }
} 