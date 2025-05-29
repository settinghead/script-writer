import { createOpenAI } from '@ai-sdk/openai';
import { streamText, createDataStreamResponse } from 'ai';
import { Response } from 'express';
import { jsonrepair } from 'jsonrepair';
import { ArtifactRepository } from '../../repositories/ArtifactRepository';
import { TransformRepository } from '../../repositories/TransformRepository';
import { TemplateService } from '../templates/TemplateService';
import { Artifact, BrainstormingJobParamsV1 } from '../../types/artifacts';
import { IdeationService } from '../IdeationService';
import { JobBroadcaster } from './JobBroadcaster';
import { StreamingCache } from './StreamingCache';

// Define StreamingRequest interface locally to avoid path issues
interface StreamingRequest {
    templateId: string;
    artifactIds: string[];
    templateParams?: Record<string, any>;
    modelName?: string;
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

            // 4. Stream LLM response
            await this.streamLLMResponse(
                prompt,
                request.modelName || 'deepseek-chat',
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
        if (artifactIds.length === 0) return [];

        const artifacts: Artifact[] = [];
        for (const id of artifactIds) {
            const artifact = await this.artifactRepo.getArtifact(userId, id);
            if (artifact) {
                artifacts.push(artifact);
            }
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
        const transform = await this.transformRepo.createTransform(
            userId,
            'llm',
            'v1',
            'running',
            {
                started_at: new Date().toISOString(),
                template_id: templateId,
                model_name: 'deepseek-chat'
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
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            throw new Error('DEEPSEEK_API_KEY not configured');
        }

        const deepseekAI = createOpenAI({
            apiKey,
            baseURL: 'https://api.deepseek.com',
        });

        // Store the prompt
        await this.transformRepo.addLLMPrompts(transform.id, [
            { promptText: prompt, promptRole: 'primary' }
        ]);

        const result = await streamText({
            model: deepseekAI(modelName),
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

                    // Parse and create output artifacts
                    let jsonData: any[] = [];

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
                        jsonData = JSON.parse(repairedJson);

                        if (!Array.isArray(jsonData)) {
                            throw new Error('Response is not a JSON array');
                        }

                    } catch (parseError) {
                        // Try a more aggressive cleaning approach
                        try {
                            let fallbackContent = text.trim();
                            // Remove any trailing incomplete JSON
                            const lastBracket = fallbackContent.lastIndexOf('}');
                            if (lastBracket > 0) {
                                fallbackContent = fallbackContent.substring(0, lastBracket + 1) + ']';
                            }

                            const { jsonrepair } = await import('jsonrepair');
                            const repairedFallback = jsonrepair(fallbackContent);
                            jsonData = JSON.parse(repairedFallback);

                            if (!Array.isArray(jsonData)) {
                                throw new Error('Fallback parsing failed - not an array');
                            }
                        } catch (fallbackError) {
                            throw parseError; // Throw original error
                        }
                    }

                    // Create output artifacts
                    if (jsonData.length > 0) {
                        await this.createOutputArtifacts(userId, transform, jsonData, text);

                        // Store parsed results in cache
                        cache.setResults(transform.id, jsonData);
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

        // 3. Create transform with 'running' status
        const transform = await this.transformRepo.createTransform(
            userId,
            'llm',
            'v1',
            'running',
            {
                started_at: new Date().toISOString(),
                template_id: 'brainstorming',
                model_name: 'deepseek-chat',
                ideation_run_id: ideationRunId,
                max_retries: 2
            }
        );

        // 4. Link transform inputs
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

        // Just start the job - no complex checks
        try {
            await this.executeStreamingLLM(transform, res);
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
        // Get job parameters
        const inputs = await this.transformRepo.getTransformInputs(transform.id);
        const paramsInput = inputs.find(input => input.input_role === 'job_params');

        if (!paramsInput) {
            throw new Error('Job parameters not found for transform');
        }

        const paramsArtifact = await this.artifactRepo.getArtifact(paramsInput.artifact_id);
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

        // Stream LLM response
        await this.streamLLMResponse(
            prompt,
            'deepseek-chat',
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
} 