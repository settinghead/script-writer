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
                        console.error(`[StreamingTransformExecutor] JSON parsing failed for transform ${transform.id}:`, parseError instanceof Error ? parseError.message : String(parseError));
                        console.error(`[StreamingTransformExecutor] Raw content length: ${text.length}`);
                        console.error(`[StreamingTransformExecutor] Raw content preview: ${text.substring(0, 200)}...`);
                        throw parseError;
                    }

                    // Create output artifacts based on output format
                    if (parsedData) {
                        if (outputFormat === 'outline_components') {
                            await this.createOutlineArtifacts(userId, transform, parsedData);
                        } else if (outputFormat === 'json_array') {
                            // Check template type to determine artifact creation method
                            const templateId = transform.execution_context?.template_id;
                            if (templateId === 'episode_synopsis_generation') {
                                await this.createEpisodeArtifacts(userId, transform, parsedData);
                            } else {
                                // Default to brainstorming handling
                                await this.createOutputArtifacts(userId, transform, parsedData, text);
                            }
                        } else if (outputFormat === 'json') {
                            // Handle single JSON object output formats
                            const templateId = transform.execution_context?.template_id;
                            if (templateId === 'script_generation') {
                                await this.createScriptArtifacts(userId, transform, parsedData);
                            } else {
                                // Default handling
                                await this.createOutputArtifacts(userId, transform, [parsedData], text);
                            }
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
            : this.executeStreamingJobWithRetries.bind(this);

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
                case 'episode_synopsis_generation':
                    await this.executeStreamingEpisodeGeneration(transform, res);
                    break;
                case 'script_generation':
                    await this.executeStreamingScriptGeneration(transform, res);
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
        console.error(`🚨 [StreamingTransformExecutor] Job failure for transform ${transformId}:`, error);
        console.error(`🚨 [StreamingTransformExecutor] Error stack:`, error.stack);
        
        const transform = await this.transformRepo.getTransform(transformId);
        if (!transform) {
            throw new Error(`Transform ${transformId} not found`);
        }

        if (transform.retry_count < transform.max_retries) {
            console.log(`🔄 [StreamingTransformExecutor] Retrying transform ${transformId} (attempt ${transform.retry_count + 1}/${transform.max_retries})`);
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
            console.error(`❌ [StreamingTransformExecutor] Transform ${transformId} failed permanently after ${transform.max_retries} retries`);
            // Mark as failed
            await this.updateTransformStatus(transformId, 'failed');
        }
    }

    private async retryStreamingJob(transformId: string): Promise<void> {
        try {
            // Important: Don't pass response object to retries since the original connection may be closed
            await this.executeStreamingJobWithRetries(transformId, undefined);
        } catch (error) {
            console.error(`🚨 [StreamingTransformExecutor] Retry failed for transform ${transformId}:`, error);
            await this.handleJobFailure(transformId, error as Error);
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

    async startScriptGenerationJob(
        userId: string,
        jobParams: any
    ): Promise<{ scriptSessionId: string; transformId: string }> {
        // 1. Generate session ID for script generation
        const scriptSessionId = `script-${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

        // 2. Use generalized job creation
        const { transformId } = await this.createStreamingJob(
            userId,
            'script_generation',
            jobParams,
            [], // No additional inputs for script generation (will load source artifacts from job params)
            { scriptSessionId }
        );

        return {
            scriptSessionId,
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

            // Get cascaded parameters from job params or provide defaults
            const cascadedParams = jobParams.cascadedParams || {};
            
            return await this.templateService.renderTemplate(template, {
                artifacts: {},
                params: {
                    episodeInfo,
                    userInput,
                    totalEpisodes: jobParams.totalEpisodes || 12,
                    platform: (cascadedParams as any).platform || '短视频平台',
                    genre: (cascadedParams as any).genre_paths 
                        ? (cascadedParams as any).genre_paths.map((path: string[]) => path.join(' > ')).join(', ')
                        : '未指定',
                    requirements: (cascadedParams as any).requirements || ''
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

    private async executeStreamingEpisodeGeneration(transform: any, res?: Response): Promise<void> {
        const episodePromptBuilder = async (jobParams: any, stageArtifact: any, paramsArtifact?: any) => {
            if (!stageArtifact) {
                throw new Error('Stage artifact is required for episode generation');
            }

            const stageData = stageArtifact.data;

            // Use custom parameters if provided, otherwise use stage defaults
            const numberOfEpisodes = paramsArtifact?.data?.numberOfEpisodes || stageData.numberOfEpisodes;
            const customRequirements = paramsArtifact?.data?.customRequirements;



            // Get and render template
            const template = this.templateService.getTemplate('episode_synopsis_generation');
            if (!template) {
                throw new Error('Episode synopsis generation template not found');
            }

            // Build requirements section if provided
            const requirementsSection = customRequirements?.trim()
                ? `\n特殊要求：${customRequirements.trim()}`
                : '';

            // Extract ALL required parameters without fallbacks
            // These parameters MUST be available - no fallbacks allowed
            if (!paramsArtifact?.data?.cascadedParams) {
                throw new Error('Cascaded parameters not found in episode params artifact');
            }

            const cascaded = paramsArtifact.data.cascadedParams;
            
            // Validate and extract required parameters - throw if missing
            if (!cascaded.platform) {
                throw new Error('Platform parameter is required but not found in cascaded params');
            }
            if (!cascaded.genre_paths || !Array.isArray(cascaded.genre_paths)) {
                throw new Error('Genre paths parameter is required but not found in cascaded params');
            }
            if (!cascaded.totalEpisodes) {
                throw new Error('Total episodes parameter is required but not found in cascaded params');
            }
            if (!cascaded.episodeDuration) {
                throw new Error('Episode duration parameter is required but not found in cascaded params');
            }

            const platform = cascaded.platform;
            const genre = cascaded.genre_paths.map((path: string[]) => path.join(' > ')).join(', ');
            const requirements = cascaded.requirements || '';
            const totalEpisodes = cascaded.totalEpisodes.toString();
            const episodeDuration = cascaded.episodeDuration.toString();

            // Determine stage number from stage data
            if (!stageData.stageNumber) {
                throw new Error('Stage number is required but not found in stage data');
            }
            const stageNumber = stageData.stageNumber.toString();

            // 🔥 NEW: Format enhanced keyPoints structure for the LLM
            const formatKeyPoints = (keyPoints: any[]): string => {
                if (!keyPoints || !Array.isArray(keyPoints)) {
                    return '';
                }

                return keyPoints.map((point, index) => {
                    let formatted = `${index + 1}. ${point.event}`;

                    if (point.timeSpan) {
                        formatted += ` (${point.timeSpan})`;
                    }

                    // Add emotion arcs
                    if (point.emotionArcs && Array.isArray(point.emotionArcs) && point.emotionArcs.length > 0) {
                        formatted += '\n   情感发展：';
                        point.emotionArcs.forEach((arc: any) => {
                            formatted += `\n   - ${arc.characters.join('、')}: ${arc.content}`;
                        });
                    }

                    // Add relationship developments
                    if (point.relationshipDevelopments && Array.isArray(point.relationshipDevelopments) && point.relationshipDevelopments.length > 0) {
                        formatted += '\n   关系发展：';
                        point.relationshipDevelopments.forEach((rel: any) => {
                            formatted += `\n   - ${rel.characters.join('、')}: ${rel.content}`;
                        });
                    }

                    return formatted;
                }).join('\n\n');
            };

            // 🔥 NEW: Extract relationship and emotional summary from keyPoints
            const extractRelationshipSummary = (keyPoints: any[]): string => {
                if (!keyPoints || !Array.isArray(keyPoints)) {
                    return '';
                }

                const relationshipChanges = keyPoints.flatMap(point =>
                    (point.relationshipDevelopments || []).map((rel: any) =>
                        `${rel.characters.join('、')}: ${rel.content}`
                    )
                );

                return relationshipChanges.length > 0
                    ? relationshipChanges.join('\n')
                    : '';
            };

            const extractEmotionalSummary = (keyPoints: any[]): string => {
                if (!keyPoints || !Array.isArray(keyPoints)) {
                    return '';
                }

                const emotionChanges = keyPoints.flatMap(point =>
                    (point.emotionArcs || []).map((arc: any) =>
                        `${arc.characters.join('、')}: ${arc.content}`
                    )
                );

                return emotionChanges.length > 0
                    ? emotionChanges.join('\n')
                    : '';
            };

            // 🔥 NEW: Calculate episode range and generate dynamic instructions
            // We need to determine the starting episode number for this stage
            let startingEpisodeNumber = 1;
            
            // Calculate starting episode number based on previous stages
            // (This logic will be similar to what's in createEpisodeArtifacts)
            const stageArtifactId = transform.execution_context?.stage_artifact_id;
            if (stageArtifactId) {
                try {
                    const currentStageArtifact = await this.artifactRepo.getArtifact(stageArtifactId, transform.user_id);
                    if (currentStageArtifact && currentStageArtifact.data) {
                        const currentStageData = currentStageArtifact.data as any;
                        const outlineSessionId = currentStageData.outlineSessionId;
                        const currentStageNumber = currentStageData.stageNumber;
                        
                        if (outlineSessionId && currentStageNumber) {
                            const allStageArtifacts = await this.artifactRepo.getArtifactsByType(
                                transform.user_id,
                                'outline_synopsis_stage'
                            );
                            
                            const relevantStages = allStageArtifacts
                                .filter(artifact => (artifact.data as any).outlineSessionId === outlineSessionId)
                                .sort((a, b) => (a.data as any).stageNumber - (b.data as any).stageNumber);
                            
                            // Calculate starting episode number
                            for (const stageArtifact of relevantStages) {
                                const stageData = stageArtifact.data as any;
                                if (stageData.stageNumber < currentStageNumber) {
                                    startingEpisodeNumber += stageData.numberOfEpisodes || 0;
                                } else {
                                    break;
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.warn('Failed to calculate starting episode number for prompt, defaulting to 1:', error);
                }
            }

            const endingEpisodeNumber = startingEpisodeNumber + numberOfEpisodes - 1;
            
            // Generate episode-specific instructions dynamically
            const episodeSpecificInstructions = this.templateService.generateEpisodeSpecificInstructions(
                startingEpisodeNumber, 
                endingEpisodeNumber
            );



            // 🔥 FIXED: Pass ALL required parameters - no missing values allowed
            const templateParams = {
                    numberOfEpisodes,
                    stageSynopsis: stageData.stageSynopsis,
                    customRequirements: requirementsSection,
                // Enhanced stage parameters - all required
                    timeframe: stageData.timeframe || '',
                    startingCondition: stageData.startingCondition || '',
                    endingCondition: stageData.endingCondition || '',
                    stageStartEvent: stageData.stageStartEvent || '',
                    stageEndEvent: stageData.stageEndEvent || '',
                // 🔥 NEW: Pass formatted enhanced keyPoints structure
                keyPoints: formatKeyPoints(stageData.keyPoints || []),
                // 🔥 NEW: Pass extracted relationship and emotional summaries
                relationshipLevel: extractRelationshipSummary(stageData.keyPoints || []),
                emotionalArc: extractEmotionalSummary(stageData.keyPoints || []),
                externalPressure: stageData.externalPressure || '',
                // 🔥 FIXED: All cascaded parameters - no fallbacks
                platform,
                genre,
                requirements,
                totalEpisodes,
                episodeDuration,
                stageNumber,
                // 🔥 NEW: Dynamic episode range and instructions
                startingEpisode: startingEpisodeNumber,
                endingEpisode: endingEpisodeNumber,
                episodeSpecificInstructions
            };



            return await this.templateService.renderTemplate(template, {
                artifacts: {},
                params: templateParams
            });
        };

        await this.executeGenericStreamingJob(
            transform,
            'episode_synopsis_generation',
            episodePromptBuilder,
            'json_array',
            res
        );
    }

    private async executeStreamingScriptGeneration(transform: any, res?: Response): Promise<void> {
        const scriptPromptBuilder = async (jobParams: any) => {
            // Get and render template
            const template = this.templateService.getTemplate('script_generation');
            if (!template) {
                throw new Error('Script generation template not found');
            }

            return await this.templateService.renderTemplate(template, {
                artifacts: {},
                params: jobParams
            });
        };

        await this.executeGenericStreamingJob(
            transform,
            'script_generation',
            scriptPromptBuilder,
            'json',
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

            // 9. Synopsis Stages - Create individual stage artifacts from enhanced structure
            // 🔥 FIX: Use the new enhanced stages structure instead of old synopsis_stages
            const stagesToProcess = outlineData.stages || outlineData.synopsis_stages;
            
            if (stagesToProcess && Array.isArray(stagesToProcess)) {
                // Get outline session ID from transform context
                const outlineSessionId = transform.execution_context?.outline_session_id;

                if (!outlineSessionId) {
                    console.warn('No outline session ID found in transform context, skipping stage artifacts creation');
                } else {
                    console.log(`Creating ${stagesToProcess.length} stage artifacts from enhanced structure`);
                    
                    // Create individual stage artifacts
                    for (let i = 0; i < stagesToProcess.length; i++) {
                        const stage = stagesToProcess[i];

                        // Handle both enhanced format (stages) and legacy format (synopsis_stages)
                        const isEnhancedFormat = stage.hasOwnProperty('keyPoints') || stage.hasOwnProperty('timeframe');
                        
                        console.log(`Creating stage ${i + 1} - Enhanced format: ${isEnhancedFormat}`);

                        const stageArtifact = await this.artifactRepo.createArtifact(
                            userId,
                            'outline_synopsis_stage',
                            {
                                stageNumber: i + 1,
                                stageSynopsis: stage.stageSynopsis || stage.title || `Stage ${i + 1}`,
                                numberOfEpisodes: stage.numberOfEpisodes || 1,
                                outlineSessionId: outlineSessionId,
                                // 🔥 ENHANCED: Store the full enhanced structure
                                timeframe: stage.timeframe || '',
                                startingCondition: stage.startingCondition || '',
                                endingCondition: stage.endingCondition || '',
                                stageStartEvent: stage.stageStartEvent || '',
                                stageEndEvent: stage.stageEndEvent || '',
                                // 🔥 KEY FIX: Store the enhanced keyPoints structure
                                keyPoints: stage.keyPoints || [],
                                externalPressure: stage.externalPressure || ''
                            },
                            'v1',
                            {
                                transform_id: transform.id,
                                stage_number: i + 1
                            }
                        );

                        await this.transformRepo.addTransformOutputs(transform.id, [
                            { artifactId: stageArtifact.id, outputRole: 'synopsis_stage' }
                        ]);

                        console.log(`✅ Created enhanced stage artifact ${stageArtifact.id} for stage ${i + 1} with ${stage.keyPoints?.length || 0} keyPoints`);
                    }
                }
            }

            // Note: Outline session status is tracked via transform status, no need to create duplicate artifact

        } catch (error) {
            throw error;
        }
    }

    private async createEpisodeArtifacts(
        userId: string,
        transform: any,
        episodeData: any[]
    ): Promise<void> {
        try {
            // Get episode generation session ID from transform context
            const sessionId = transform.execution_context?.episode_generation_session_id;
            const stageArtifactId = transform.execution_context?.stage_artifact_id;

            console.log(`🔍 [DEBUG] Transform execution context:`, {
                transformId: transform.id,
                sessionId,
                stageArtifactId,
                fullContext: transform.execution_context
            });

            if (!sessionId) {
                console.warn('🔍 [DEBUG] No episode generation session ID found in transform context, using fallback');
            }

            // 🔥 FIXED: Calculate the starting episode number by summing up episodes from all previous stages
            let startingEpisodeNumber = 1;
            
            console.log(`🔍 [DEBUG] Starting episode numbering calculation for transform ${transform.id}`);
            console.log(`🔍 [DEBUG] Stage artifact ID: ${stageArtifactId}`);
            
            if (stageArtifactId) {
                try {
                    // Get current stage artifact to find its stage number and outlineSessionId
                    const currentStageArtifact = await this.artifactRepo.getArtifact(stageArtifactId, userId);
                    console.log(`🔍 [DEBUG] Current stage artifact:`, currentStageArtifact ? 'found' : 'not found');
                    
                    if (currentStageArtifact && currentStageArtifact.data) {
                        const currentStageData = currentStageArtifact.data as any;
                        const outlineSessionId = currentStageData.outlineSessionId;
                        const currentStageNumber = currentStageData.stageNumber;
                        
                        console.log(`🔍 [DEBUG] Current stage data:`, {
                            outlineSessionId,
                            currentStageNumber,
                            numberOfEpisodes: currentStageData.numberOfEpisodes,
                            title: currentStageData.title
                        });
                        
                        if (outlineSessionId && currentStageNumber) {
                            // Get all stage artifacts for this outline session
                            const allStageArtifacts = await this.artifactRepo.getArtifactsByType(
                                userId,
                                'outline_synopsis_stage'
                            );
                            
                            console.log(`🔍 [DEBUG] Total stage artifacts found: ${allStageArtifacts.length}`);
                            
                            // Filter stages for this outline session and sum episodes from previous stages
                            const relevantStages = allStageArtifacts
                                .filter(artifact => (artifact.data as any).outlineSessionId === outlineSessionId)
                                .sort((a, b) => (a.data as any).stageNumber - (b.data as any).stageNumber);
                            
                            console.log(`🔍 [DEBUG] Relevant stages for outline session ${outlineSessionId}:`, 
                                relevantStages.map(s => ({
                                    id: s.id,
                                    stageNumber: (s.data as any).stageNumber,
                                    numberOfEpisodes: (s.data as any).numberOfEpisodes,
                                    title: (s.data as any).title
                                }))
                            );
                            
                            // Calculate starting episode number by summing episodes from previous stages
                            let episodeSumDebug = [];
                            for (const stageArtifact of relevantStages) {
                                const stageData = stageArtifact.data as any;
                                if (stageData.stageNumber < currentStageNumber) {
                                    const episodeCount = stageData.numberOfEpisodes || 0;
                                    episodeSumDebug.push(`Stage ${stageData.stageNumber}: +${episodeCount} episodes`);
                                    startingEpisodeNumber += episodeCount;
                                } else {
                                    break; // We've reached the current stage
                                }
                            }
                            
                            console.log(`🔍 [DEBUG] Episode calculation breakdown:`);
                            console.log(`🔍 [DEBUG] Base starting number: 1`);
                            episodeSumDebug.forEach(debug => console.log(`🔍 [DEBUG] ${debug}`));
                            console.log(`🔍 [DEBUG] Final starting episode number for stage ${currentStageNumber}: ${startingEpisodeNumber}`);
                        } else {
                            console.log(`🔍 [DEBUG] Missing required data - outlineSessionId: ${outlineSessionId}, currentStageNumber: ${currentStageNumber}`);
                        }
                    } else {
                        console.log(`🔍 [DEBUG] Current stage artifact or data is null`);
                    }
                } catch (error) {
                    console.warn('🔍 [DEBUG] Failed to calculate starting episode number, defaulting to 1:', error);
                    startingEpisodeNumber = 1;
                }
            } else {
                console.log(`🔍 [DEBUG] No stage artifact ID provided in transform context`);
            }

            // Create individual episode synopsis artifacts with correct numbering
            console.log(`🔍 [DEBUG] Creating ${episodeData.length} episodes starting from episode ${startingEpisodeNumber}`);
            
            for (let i = 0; i < episodeData.length; i++) {
                const episode = episodeData[i];
                const correctEpisodeNumber = startingEpisodeNumber + i;

                console.log(`🔍 [DEBUG] Creating episode ${i + 1}/${episodeData.length}: stage-local=${i + 1}, global-episode=${correctEpisodeNumber}`);
                console.log(`🔍 [DEBUG] Episode data:`, {
                    title: episode.title,
                    synopsis: episode.synopsis?.substring(0, 100) + '...',
                    keyEventsCount: episode.keyEvents?.length || 0,
                    emotionDevelopmentsCount: episode.emotionDevelopments?.length || 0,
                    relationshipDevelopmentsCount: episode.relationshipDevelopments?.length || 0
                });

                const episodeArtifact = await this.artifactRepo.createArtifact(
                    userId,
                    'episode_synopsis',
                    {
                        episodeNumber: correctEpisodeNumber,
                        title: episode.title || `第${correctEpisodeNumber}集`,
                        briefSummary: episode.synopsis || episode.briefSummary || '',
                        keyEvents: episode.keyEvents || [],
                        hooks: episode.endHook || episode.hooks || '',
                        stageArtifactId: stageArtifactId || '',
                        episodeGenerationSessionId: sessionId,
                        // 🔥 NEW: Include emotion and relationship developments
                        emotionDevelopments: episode.emotionDevelopments || [],
                        relationshipDevelopments: episode.relationshipDevelopments || []
                    },
                    'v1',
                    {
                        transform_id: transform.id,
                        episode_number: correctEpisodeNumber
                    }
                );

                // Link artifact as transform output
                await this.transformRepo.addTransformOutputs(transform.id, [
                    { artifactId: episodeArtifact.id, outputRole: `episode_${correctEpisodeNumber}` }
                ]);

                console.log(`🔍 [DEBUG] ✅ Created episode artifact ${episodeArtifact.id} for episode ${correctEpisodeNumber} (stage-local index ${i + 1})`);
            }
            
            console.log(`🔍 [DEBUG] ✅ Completed creating all episodes. Range: ${startingEpisodeNumber} to ${startingEpisodeNumber + episodeData.length - 1}`);
        

            // Update episode generation session status to completed
            if (sessionId) {
                try {
                    // Find and update the session artifact
                    const sessionArtifacts = await this.artifactRepo.getArtifactsByType(
                        userId,
                        'episode_generation_session'
                    );

                    const sessionArtifact = sessionArtifacts.find(
                        artifact => (artifact.data as any).id === sessionId
                    );

                    if (sessionArtifact) {
                        // Update session status
                        const updatedSessionData = {
                            ...sessionArtifact.data,
                            status: 'completed'
                        };

                        await this.artifactRepo.createArtifact(
                            userId,
                            'episode_generation_session',
                            updatedSessionData,
                            'v1',
                            {
                                transform_id: transform.id,
                                replaces_artifact_id: sessionArtifact.id
                            }
                        );

                        console.log(`Updated episode generation session ${sessionId} status to completed`);
                    }
                } catch (sessionUpdateError) {
                    console.error('Failed to update episode generation session status:', sessionUpdateError);
                    // Don't throw - episode creation succeeded, session update is not critical
                }
            }

        } catch (error) {
            throw error;
        }
    }

    private async createScriptArtifacts(
        userId: string,
        transform: any,
        scriptData: any
    ): Promise<void> {
        try {
            // Validate required fields
            if (!scriptData.episodeNumber) {
                throw new Error(`Missing episodeNumber in scriptData: ${JSON.stringify(scriptData, null, 2)}`);
            }

            // Create episode script artifact from the generated script data
            const scriptArtifact = await this.artifactRepo.createArtifact(
                userId,
                'episode_script',
                {
                    episodeNumber: scriptData.episodeNumber,
                    scriptContent: scriptData.scriptContent || '', // 🔥 FIX: Include the actual script content!
                    scenes: scriptData.scenes || [],
                    wordCount: scriptData.wordCount || 0,
                    estimatedDuration: scriptData.estimatedDuration || 0,
                    generatedAt: new Date().toISOString(),
                    // Legacy fields for compatibility
                    title: scriptData.title || '未命名剧本',
                    characterList: scriptData.characterList || [],
                    summary: scriptData.summary || '',
                    totalDialogueLines: scriptData.totalDialogueLines || 0
                },
                'v1',
                { transform_id: transform.id }
            );

            // Link artifact as transform output
            await this.transformRepo.addTransformOutputs(transform.id, [
                { artifactId: scriptArtifact.id, outputRole: 'episode_script' }
            ]);

            console.log(`✅ Created script artifact ${scriptArtifact.id} for episode ${scriptData.episodeNumber} with script content length: ${scriptData.scriptContent?.length || 0}`);

        } catch (error) {
            throw error;
        }
    }

    // Generalized job execution method
    private async executeGenericStreamingJob(
        transform: any,
        templateId: string,
        promptBuilder: (jobParams: any, sourceArtifact?: any, paramsArtifact?: any) => Promise<string>,
        outputFormat: string,
        res?: Response
    ): Promise<void> {
        // Get job parameters from transform inputs
        const inputs = await this.transformRepo.getTransformInputs(transform.id);

        // For episode generation, we need to handle multiple input roles
        if (templateId === 'episode_synopsis_generation') {
            const stageInput = inputs.find(input => input.input_role === 'stage_data');
            const paramsInput = inputs.find(input => input.input_role === 'episode_params');

            if (!stageInput) {
                throw new Error('Stage data not found for episode generation');
            }

            const stageArtifact = await this.artifactRepo.getArtifact(stageInput.artifact_id, transform.user_id);
            if (!stageArtifact) {
                throw new Error('Stage artifact not found');
            }

            let paramsArtifact: any = null;
            if (paramsInput) {
                paramsArtifact = await this.artifactRepo.getArtifact(paramsInput.artifact_id, transform.user_id);
            }

            // Build prompt using the provided builder function with stage and params artifacts
            const prompt = await promptBuilder(null, stageArtifact, paramsArtifact);

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
        } else {
            // Original logic for other templates
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
            let sourceArtifact: Artifact | null = null;
            if (sourceInput) {
                sourceArtifact = await this.artifactRepo.getArtifact(sourceInput.artifact_id, transform.user_id);
                if (!sourceArtifact) {
                    throw new Error('Source artifact not found');
                }
            }

            // Build prompt using the provided builder function
            console.log(`🔧 [StreamingTransformExecutor] Building prompt for template ${templateId} with job params:`, JSON.stringify(jobParams, null, 2));
            let prompt: string;
            try {
                prompt = await promptBuilder(jobParams, sourceArtifact);
                console.log(`✅ [StreamingTransformExecutor] Successfully built prompt for ${templateId}, length: ${prompt.length}`);
            } catch (promptError) {
                console.error(`🚨 [StreamingTransformExecutor] Failed to build prompt for template ${templateId}:`, promptError);
                throw promptError;
            }

            // Get model name from credentials
            const { modelName } = getLLMCredentials();

            // Stream LLM response
            try {
                await this.streamLLMResponse(
                    prompt,
                    modelName,
                    outputFormat,
                    transform,
                    res,
                    transform.user_id
                );
                console.log(`✅ [StreamingTransformExecutor] Successfully completed streaming for ${templateId}`);
            } catch (streamError) {
                console.error(`🚨 [StreamingTransformExecutor] Failed to stream LLM response for template ${templateId}:`, streamError);
                throw streamError;
            }
        }
    }
} 