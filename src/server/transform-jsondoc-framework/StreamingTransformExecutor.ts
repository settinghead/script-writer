import { z } from 'zod';
import { TemplateService } from '../services/templates/TemplateService';
import { LLMService } from './LLMService';
import { CachedLLMService, getCachedLLMService } from './CachedLLMService';
import { TransformRepository } from './TransformRepository';
import { JsondocRepository } from './JsondocRepository';
import { ChatMessageRepository } from './ChatMessageRepository';
import { ParticleTemplateProcessor } from '../services/ParticleTemplateProcessor';
import { applyPatch, deepClone, Operation } from 'fast-json-patch';
import { TypedJsondoc } from '../../common/jsondocs.js';
import { dump } from 'js-yaml';
import * as Diff from 'diff';
import { jsonrepair } from 'jsonrepair';
import * as rfc6902 from 'rfc6902';
import {
    parseContextDiff,
    applyContextDiffToJSON,
    type ParsedDiff
} from '../../common/contextDiff';

/**
 * Configuration for a streaming transform - minimal interface that tools provide
 */
export interface StreamingTransformConfig<TInput, TOutput> {
    templateName: string;  // 'brainstorming', 'brainstorm_edit_patch', 'outline'
    inputSchema: z.ZodSchema<TInput>;
    outputSchema: z.ZodSchema<TOutput>;
    // OPTIONAL: Custom template variables function. If not provided, uses default schema-driven extraction
    prepareTemplateVariables?: (input: TInput, context?: any) => { params?: any; jsondocs?: any } | Promise<{ params?: any; jsondocs?: any }>;
    transformLLMOutput?: (llmOutput: TOutput, input: TInput) => any;  // Optional: transform LLM output before saving
}

/**
 * Default template variable extraction - automatically extracts all fields from input schema and jsondocs
 */
export async function defaultPrepareTemplateVariables<TInput>(
    input: TInput,
    jsondocRepo: JsondocRepository
): Promise<{ params: any; jsondocs: any }> {
    // Extract all input parameters (excluding jsondocs array)
    const params = { ...input };
    delete (params as any).jsondocs;

    // Extract jsondoc data
    const jsondocs: Record<string, any> = {};

    if ((input as any).jsondocs && Array.isArray((input as any).jsondocs)) {
        for (const jsondocRef of (input as any).jsondocs) {
            const jsondoc = await jsondocRepo.getJsondoc(jsondocRef.jsondocId);
            if (jsondoc) {
                // Use description as key, fallback to schema type or jsondoc ID
                const key = jsondocRef.description || jsondocRef.schemaType || jsondocRef.jsondocId;
                // For JSON patch templates, flatten the structure and stringify the data
                // This allows the LLM to see the data structure clearly while generating correct paths
                jsondocs[key] = {
                    id: jsondoc.id,
                    description: jsondocRef.description,
                    schemaType: jsondocRef.schemaType,
                    schema_type: jsondoc.schema_type,
                    data: JSON.stringify(jsondoc.data, null, 2)
                };
            }
        }
    }

    return { params, jsondocs };
}

/**
 * Execution mode for streaming transforms
 */
export type StreamingExecutionMode =
    | { mode: 'full-object' }
    | { mode: 'patch', originalJsondoc: any }
    | { mode: 'patch-approval', originalJsondoc: any };

/**
 * Parameters for executing a streaming transform
 */
export interface StreamingTransformParams<TInput, TOutput> {
    config: StreamingTransformConfig<TInput, TOutput>;
    input: TInput;
    projectId: string;
    userId: string;
    transformRepo: TransformRepository;
    jsondocRepo: JsondocRepository;
    outputJsondocType: TypedJsondoc['schema_type'];  // e.g., 'brainstorm_collection', 'outline'
    transformMetadata?: Record<string, any>;  // tool-specific metadata
    updateIntervalChunks?: number;  // How often to update jsondoc (default: 3)
    // Caching options
    enableCaching?: boolean;  // Enable LLM response caching (default: false)
    seed?: number;  // Seed for deterministic outputs
    temperature?: number;  // LLM temperature
    topP?: number;  // LLM top-p sampling
    maxTokens?: number;  // LLM max tokens
    // NEW: Execution mode for patch vs full-object generation
    executionMode?: StreamingExecutionMode;
    // NEW: Dry run mode - no database operations
    dryRun?: boolean;  // Skip all database operations (default: false)
    // NEW: Streaming callback for real-time updates
    onStreamChunk?: (chunk: TOutput, chunkCount: number) => void | Promise<void>;  // Called for each streaming chunk
    // NEW: Tool call ID for conversation history tracking
    toolCallId?: string;
}

/**
 * Result of a streaming transform execution
 */
export interface StreamingTransformResult {
    outputJsondocId: string;
    finishReason: string;
    transformId: string;
}

/**
 * Core streaming transform executor - handles all the boilerplate for streaming tools
 */
export class StreamingTransformExecutor {
    private templateService: TemplateService;
    private llmService: LLMService;
    private cachedLLMService: CachedLLMService;

    constructor(particleProcessor?: ParticleTemplateProcessor) {
        this.templateService = new TemplateService(particleProcessor);
        this.llmService = new LLMService();
        this.cachedLLMService = getCachedLLMService();
    }

    /**
     * Execute a streaming transform with full lifecycle management
     */
    async executeStreamingTransform<TInput, TOutput>(
        params: StreamingTransformParams<TInput, TOutput>
    ): Promise<StreamingTransformResult> {
        const {
            config,
            input,
            projectId,
            userId,
            transformRepo,
            jsondocRepo,
            outputJsondocType,
            transformMetadata = {},
            updateIntervalChunks = 3,
            enableCaching = false,
            seed,
            temperature,
            topP,
            maxTokens,
            executionMode,
            dryRun = false,
            onStreamChunk,
            toolCallId
        } = params;

        let transformId: string | null = null;
        let outputJsondocId: string | null = null;
        let outputLinked = false; // Track if we've linked the output jsondoc to transform
        let retryCount = 0;
        const maxRetries = 3;


        while (retryCount <= maxRetries) {
            try {
                // 1. Input validation against schema
                const validatedInput = config.inputSchema.parse(input);

                // 2. Create transform for this execution (or update existing one on retry)
                if (!dryRun && !transformId) {
                    // Use ai_patch type for patch-approval mode, llm for others
                    const transformType = executionMode?.mode === 'patch-approval' ? 'ai_patch' : 'llm';
                    const transform = await transformRepo.createTransform(
                        projectId,
                        transformType,
                        'v1',
                        'running',
                        {
                            template_name: config.templateName,
                            retry_count: retryCount,
                            max_retries: maxRetries,
                            ...transformMetadata
                        },
                        toolCallId
                    );
                    transformId = transform.id;
                    console.log(`[StreamingTransformExecutor] Created transform ${transformId} with session ID: ${toolCallId || 'no-session'}`);
                } else if (!dryRun && transformId) {
                    // Update retry count on existing transform
                    console.log(`[StreamingTransformExecutor] Updating transform ${transformId} with session ID: ${toolCallId || 'no-session'} (retry ${retryCount})`);
                    await transformRepo.updateTransform(transformId, {
                        status: 'running',
                        retry_count: retryCount,
                        execution_context: {
                            template_name: config.templateName,
                            retry_count: retryCount,
                            max_retries: maxRetries,
                            ...transformMetadata
                        }
                    });
                } else if (dryRun) {
                    // console.log(`[StreamingTransformExecutor] Dry run: Skipping transform creation/update for ${config.templateName}`);
                }

                // 3. Handle input jsondocs: both source jsondocs and tool input (only on first attempt)
                if (!dryRun && retryCount === 0) {
                    const transformInputs: Array<{ jsondocId: string; inputRole: string }> = [];

                    // 3a. Extract source jsondocs from input.jsondocs array
                    if ((validatedInput as any).jsondocs && Array.isArray((validatedInput as any).jsondocs)) {
                        for (const [index, jsondocRef] of (validatedInput as any).jsondocs.entries()) {
                            // Use consistent semantic roles for database lineage
                            const inputRole = index === 0 ? 'source' : 'context';
                            transformInputs.push({
                                jsondocId: jsondocRef.jsondocId,
                                inputRole: inputRole
                            });
                        }
                    }


                    // 3c. Add all transform inputs at once
                    if (!dryRun && transformId) {
                        await transformRepo.addTransformInputs(transformId, transformInputs, projectId);
                    } else if (dryRun) {
                        // console.log(`[StreamingTransformExecutor] Dry run: Skipping transform inputs for ${config.templateName}`);
                    }
                }

                // 4. Create initial output jsondoc in streaming state (only on first attempt)
                // Skip for patch-approval mode - patches will be the outputs
                if (!dryRun && !outputJsondocId && executionMode?.mode !== 'patch-approval') {
                    let initialData: any;
                    if (executionMode?.mode === 'patch') {
                        // In patch mode, start with the original jsondoc data
                        initialData = deepClone(executionMode.originalJsondoc);
                    } else {
                        // In full-object mode, use empty structure
                        initialData = this.createInitialJsondocData(outputJsondocType, transformMetadata);
                    }

                    const outputJsondoc = await jsondocRepo.createJsondoc(
                        projectId,
                        outputJsondocType,
                        initialData,
                        'v1',
                        {
                            started_at: new Date().toISOString(),
                            template_name: config.templateName,
                            retry_count: retryCount,
                            execution_mode: executionMode?.mode || 'full-object',
                            ...transformMetadata
                        },
                        'streaming',
                        'ai_generated'
                    );
                    outputJsondocId = outputJsondoc.id;
                } else if (dryRun) {
                    // console.log(`[StreamingTransformExecutor] Dry run: Skipping initial output jsondoc creation for ${config.templateName}`);
                }

                // 5. Template rendering
                const template = this.templateService.getTemplate(config.templateName);
                if (!template) {
                    throw new Error(`Template '${config.templateName}' not found`);
                }

                // NEW: Get template context directly from prepareTemplateVariables
                const templateContext = config.prepareTemplateVariables
                    ? await config.prepareTemplateVariables(validatedInput, { jsondocRepo })
                    : await defaultPrepareTemplateVariables(validatedInput, jsondocRepo);

                const finalPrompt = await this.templateService.renderTemplate(
                    template,
                    templateContext,
                    { projectId, userId } // Particle context
                );

                // 6. Store the prompt (only on first attempt)
                if (!dryRun && retryCount === 0 && transformId) {
                    await transformRepo.addLLMPrompts(transformId, [
                        { promptText: finalPrompt, promptRole: 'primary' }
                    ], projectId);

                    // Store the initial user prompt as a real-time message
                    const { db } = await import('../database/connection.js');
                    const chatMessageRepo = new ChatMessageRepository(db);
                    await this.storeMessageRealTime(
                        transformId,
                        projectId,
                        'user',
                        finalPrompt,
                        { content_type: 'initial_prompt', template_name: config.templateName },
                        chatMessageRepo
                    );
                } else if (dryRun) {
                    // console.log(`[StreamingTransformExecutor] Dry run: Skipping adding LLM prompt storage for ${config.templateName}`);
                }

                // 7. Execute streaming with internal retry (this handles LLM-level retries)
                const stream = await this.executeStreamingWithRetry({
                    prompt: finalPrompt,
                    schema: config.outputSchema,
                    templateName: config.templateName,
                    enableCaching,
                    seed,
                    temperature,
                    topP,
                    maxTokens,
                    executionMode // Pass execution mode for better streaming strategy detection
                });

                // 8. Process stream and update jsondoc periodically
                let chunkCount = 0;
                let updateCount = 0;
                let lastData: TOutput | null = null;
                let chatMessageRepo: ChatMessageRepository | null = null;

                // Initialize chat message repo for real-time saving (only once)
                if (!dryRun && transformId) {
                    const { db } = await import('../database/connection.js');
                    chatMessageRepo = new ChatMessageRepository(db);
                }

                for await (const partialData of stream) {
                    chunkCount++;

                    // Handle different stream data formats
                    let actualData: TOutput;
                    let streamingInfo: any = null;

                    if (partialData && typeof partialData === 'object' && 'type' in partialData) {
                        // New format with rawText and patches
                        streamingInfo = partialData;

                        if (partialData.type === 'finalPatches' || partialData.type === 'patches') {
                            actualData = partialData.patches as TOutput;
                        } else {
                            // For rawText chunks, keep the last actual data
                            actualData = (lastData || []) as TOutput;
                        }
                    } else {
                        // Standard format
                        actualData = partialData as TOutput;
                    }

                    lastData = actualData;

                    // Store real-time LLM output chunk (every 5 chunks to avoid spam)
                    if (!dryRun && transformId && chatMessageRepo && chunkCount % 5 === 1) {
                        try {
                            const chunkContent = streamingInfo
                                ? JSON.stringify(streamingInfo, null, 2)
                                : (typeof actualData === 'string' ? actualData : JSON.stringify(actualData, null, 2));

                            await this.storeMessageRealTime(
                                transformId,
                                projectId,
                                'assistant',
                                chunkContent,
                                {
                                    content_type: 'streaming_chunk',
                                    chunk_number: chunkCount,
                                    template_name: config.templateName,
                                    stream_type: streamingInfo?.type || 'standard'
                                },
                                chatMessageRepo
                            );
                        } catch (chunkSaveError) {
                            console.warn(`[StreamingTransformExecutor] Failed to save real-time chunk ${chunkCount}:`, chunkSaveError);
                        }
                    }

                    // Call streaming callback if provided
                    if (onStreamChunk) {
                        try {
                            // Pass both the processed data and raw streaming info for debugging
                            const callbackData = streamingInfo || actualData;
                            await onStreamChunk(callbackData, chunkCount);
                        } catch (callbackError) {
                            console.warn(`[StreamingTransformExecutor] Streaming callback error at chunk ${chunkCount}:`, callbackError);
                        }
                    }

                    // Update jsondoc every N chunks or if this is the final chunk
                    if (chunkCount % updateIntervalChunks === 0) {
                        try {
                            let jsondocData: any;
                            if (executionMode?.mode === 'patch') {
                                // In patch mode, try to apply partial patches (may fail, that's ok)
                                try {
                                    jsondocData = await this.applyPatchesToOriginalWithPersistence(
                                        partialData as TOutput,
                                        executionMode.originalJsondoc,
                                        config.templateName,
                                        retryCount,
                                        projectId,
                                        userId,
                                        jsondocRepo,
                                        transformId,
                                        transformRepo,
                                        dryRun
                                    );
                                } catch (patchError) {
                                    // If partial patch fails, keep original data and continue
                                    console.warn(`[StreamingTransformExecutor] Partial patch failed at chunk ${chunkCount}, continuing...`);
                                    console.warn(`[StreamingTransformExecutor] Patch content: ${JSON.stringify(partialData)}`);
                                    jsondocData = executionMode.originalJsondoc;
                                }
                            } else if (executionMode?.mode === 'patch-approval') {
                                // In patch-approval mode, create/update patch jsondocs progressively
                                try {
                                    await this.createStreamingPatchApprovalJsondocs(
                                        partialData as TOutput,
                                        executionMode.originalJsondoc,
                                        config.templateName,
                                        retryCount,
                                        projectId,
                                        userId,
                                        jsondocRepo,
                                        transformId,
                                        transformRepo,
                                        dryRun,
                                        chunkCount
                                    );
                                    console.log(`[StreamingTransformExecutor] Updated streaming patches at chunk ${chunkCount}`);
                                } catch (patchError) {
                                    console.warn(`[StreamingTransformExecutor] Streaming patch update failed at chunk ${chunkCount}, continuing...`);
                                    console.warn(`[StreamingTransformExecutor] Patch content: ${JSON.stringify(partialData)}`);
                                }
                                jsondocData = null; // Skip regular jsondoc updates in patch-approval mode
                            } else {
                                // Transform LLM output to final jsondoc format if needed
                                jsondocData = config.transformLLMOutput
                                    ? config.transformLLMOutput(partialData as TOutput, validatedInput)
                                    : partialData;
                            }

                            if (!dryRun && outputJsondocId && jsondocData !== null) {
                                await jsondocRepo.updateJsondoc(
                                    outputJsondocId,
                                    jsondocData,
                                    {
                                        chunk_count: chunkCount,
                                        last_updated: new Date().toISOString(),
                                        update_count: ++updateCount,
                                        retry_count: retryCount,
                                        execution_mode: executionMode?.mode || 'full-object'
                                    }
                                );

                                // Link output jsondoc to transform eagerly on first update
                                if (!outputLinked && transformId) {
                                    try {
                                        await transformRepo.addTransformOutputs(transformId, [
                                            { jsondocId: outputJsondocId, outputRole: 'generated_output' }
                                        ], projectId);
                                        outputLinked = true;
                                    } catch (linkError) {
                                        console.warn(`[StreamingTransformExecutor] Failed to link output jsondoc during streaming:`, linkError);
                                        // Don't throw - we'll retry at completion
                                    }
                                }
                            } else if (dryRun) {
                                // console.log(`[StreamingTransformExecutor] Dry run: Skipping jsondoc update for ${config.templateName} at chunk ${chunkCount}`);
                            } else if (executionMode?.mode === 'patch-approval') {
                                // In patch-approval mode, we don't update during streaming, only at completion
                                console.log(`[StreamingTransformExecutor] Patch-approval mode: Skipping streaming update at chunk ${chunkCount}`);
                            }
                        } catch (updateError) {
                            console.warn(`[StreamingTransformExecutor] Failed to update jsondoc at chunk ${chunkCount}:`, updateError);
                        }
                    }
                }

                // 9. Final validation and jsondoc update
                if (!lastData) {
                    throw new Error('No data received from streaming');
                }

                // **CRITICAL: Strict schema validation here**
                let finalValidatedData: TOutput;
                try {
                    finalValidatedData = config.outputSchema.parse(lastData);
                } catch (validationError) {
                    console.error(`[StreamingTransformExecutor] Schema validation FAILED for ${config.templateName}:`, validationError);
                    throw new Error(`Schema validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`);
                }

                // Handle patch mode vs full-object mode
                let finalJsondocData: any;
                if (executionMode?.mode === 'patch') {
                    // Apply patches to original jsondoc
                    finalJsondocData = await this.applyPatchesToOriginalWithPersistence(
                        finalValidatedData,
                        executionMode.originalJsondoc,
                        config.templateName,
                        retryCount,
                        projectId,
                        userId,
                        jsondocRepo,
                        transformId,
                        transformRepo,
                        dryRun
                    );
                } else if (executionMode?.mode === 'patch-approval') {
                    // Finalize streaming patch jsondocs - mark them as completed
                    await this.finalizeStreamingPatchApprovalJsondocs(
                        finalValidatedData,
                        executionMode.originalJsondoc,
                        config.templateName,
                        retryCount,
                        projectId,
                        userId,
                        jsondocRepo,
                        transformId,
                        transformRepo,
                        dryRun,
                        chunkCount
                    );
                    finalJsondocData = null; // No single jsondoc output in patch-approval mode
                } else {
                    // Transform LLM output to final jsondoc format if needed (full-object mode)
                    finalJsondocData = config.transformLLMOutput
                        ? config.transformLLMOutput(finalValidatedData, validatedInput)
                        : finalValidatedData;
                }

                // Handle different execution modes for completion
                if (!dryRun) {
                    if (executionMode?.mode === 'patch-approval') {
                        // In patch-approval mode, we don't have a single output jsondoc
                        // Instead, patch jsondocs were created by createPatchApprovalJsondocs
                        // We still need to store LLM metadata and mark transform as completed

                        // 11. Store LLM metadata (simplified - we don't have detailed usage from streaming)
                        if (transformId) {
                            await transformRepo.addLLMTransform({
                                transform_id: transformId,
                                model_name: 'streaming_model',
                                raw_response: JSON.stringify(finalValidatedData), // Store LLM output, not transformed
                                token_usage: null,
                                project_id: projectId
                            });
                        }

                        // 12. Mark ai_patch transform as completed (CRITICAL FIX)
                        if (transformId) {
                            const finalPatches = await this.convertUnifiedDiffToJsonPatches(
                                finalValidatedData,
                                executionMode.originalJsondoc,
                                config.templateName,
                                retryCount,
                                this.llmService,
                                [] // Empty messages for completion context
                            );
                            await transformRepo.updateTransform(transformId, {
                                status: 'completed',
                                execution_context: {
                                    template_name: config.templateName,
                                    completed_at: new Date().toISOString(),
                                    execution_mode: 'patch-approval',
                                    patch_count: finalPatches?.length || 0,
                                    total_chunks: chunkCount,
                                    total_updates: updateCount + 1,
                                    retry_count: retryCount,
                                    max_retries: maxRetries,
                                    streaming_patches: true
                                }
                            });
                        }
                    } else if (outputJsondocId) {
                        // Normal mode with output jsondoc
                        await jsondocRepo.updateJsondoc(
                            outputJsondocId,
                            finalJsondocData,
                            {
                                chunk_count: chunkCount,
                                completed_at: new Date().toISOString(),
                                total_updates: updateCount + 1,
                                retry_count: retryCount
                            },
                            'completed'  // Mark as completed to trigger validation
                        );

                        // 10. Link output jsondoc to transform (if not already linked during streaming)
                        if (!outputLinked && transformId) {
                            await transformRepo.addTransformOutputs(transformId, [
                                { jsondocId: outputJsondocId, outputRole: 'generated_output' }
                            ], projectId);
                        }

                        // 11. Store LLM metadata (simplified - we don't have detailed usage from streaming)
                        if (transformId) {
                            await transformRepo.addLLMTransform({
                                transform_id: transformId,
                                model_name: 'streaming_model',
                                raw_response: JSON.stringify(finalValidatedData), // Store LLM output, not transformed
                                token_usage: null,
                                project_id: projectId
                            });
                        }

                        // 12. Mark transform as completed
                        if (transformId) {
                            await transformRepo.updateTransform(transformId, {
                                status: 'completed',
                                execution_context: {
                                    template_name: config.templateName,
                                    completed_at: new Date().toISOString(),
                                    output_jsondoc_id: outputJsondocId,
                                    total_chunks: chunkCount,
                                    total_updates: updateCount + 1,
                                    retry_count: retryCount,
                                    max_retries: maxRetries
                                }
                            });
                        }
                    }
                } else if (dryRun) {
                    // console.log(`[StreamingTransformExecutor] Dry run: Skipping all database operations for ${config.templateName}`);
                }

                return {
                    outputJsondocId: outputJsondocId || (executionMode?.mode === 'patch-approval' ? 'patch-approval-pending' : 'dry-run-no-output'),
                    finishReason: 'stop',
                    transformId: transformId || 'dry-run-no-transform'
                };

            } catch (error) {
                console.error(`[StreamingTransformExecutor] Error executing ${config.templateName} (attempt ${retryCount + 1}):`, error);

                retryCount++;

                // If we've exhausted all retries, mark as permanently failed
                if (retryCount > maxRetries) {
                    console.error(`[StreamingTransformExecutor] All ${maxRetries + 1} attempts failed for ${config.templateName}`);

                    // Update transform status to failed
                    if (!dryRun && transformId) {
                        try {
                            await transformRepo.updateTransform(transformId, {
                                status: 'failed',
                                retry_count: retryCount - 1, // Actual retry count
                                error_message: error instanceof Error ? error.message : String(error),
                                execution_context: {
                                    template_name: config.templateName,
                                    error_message: error instanceof Error ? error.message : String(error),
                                    failed_at: new Date().toISOString(),
                                    retry_count: retryCount - 1,
                                    max_retries: maxRetries
                                }
                            });
                        } catch (statusUpdateError) {
                            console.error(`[StreamingTransformExecutor] Failed to update transform status:`, statusUpdateError);
                        }
                    }

                    // Mark output jsondoc as failed if it exists
                    if (outputJsondocId) {
                        try {
                            await jsondocRepo.updateJsondoc(
                                outputJsondocId,
                                {},
                                {
                                    error_message: error instanceof Error ? error.message : String(error),
                                    failed_at: new Date().toISOString(),
                                    retry_count: retryCount - 1
                                },
                                'failed'
                            );
                        } catch (jsondocUpdateError) {
                            console.error(`[StreamingTransformExecutor] Failed to update jsondoc status:`, jsondocUpdateError);
                        }
                    }

                    throw error;
                } else {
                    // Wait before retry with exponential backoff
                    const waitTime = Math.min(1000 * Math.pow(2, retryCount - 1), 10000); // Max 10 seconds
                    console.log(`[StreamingTransformExecutor] Retrying ${config.templateName} in ${waitTime}ms (attempt ${retryCount + 1}/${maxRetries + 1})`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }

        // This should never be reached due to the throw in the retry exhaustion case
        throw new Error('Unexpected end of retry loop');
    }

    /**
     * Convert context-based diff to JSON patches with validation and retry
     */
    private async convertUnifiedDiffToJsonPatches(
        llmOutput: any,
        originalJsondoc: any,
        templateName: string,
        retryCount: number,
        llmService: any,
        originalMessages: any[]
    ): Promise<Operation[]> {
        const maxValidationRetries = 3;
        let currentMessages = [...originalMessages];

        // Extract context-based diff from LLM output
        const diffString = this.extractUnifiedDiff(llmOutput);
        if (!diffString) {
            throw new Error('No context-based diff found in LLM output');
        }

        for (let attempt = 0; attempt <= maxValidationRetries; attempt++) {
            try {
                // 1. Apply context-based diff to the original JSON
                const originalData = originalJsondoc.data || originalJsondoc;
                const originalText = JSON.stringify(originalData, null, 2);
                const modifiedText = applyContextDiffToJSON(originalText, diffString);

                if (!modifiedText) {
                    throw new Error('Failed to apply context-based diff to JSON');
                }

                // 2. Parse the modified JSON
                let modifiedData;
                try {
                    modifiedData = JSON.parse(modifiedText);
                } catch (parseError) {
                    throw new Error(`Failed to parse modified JSON: ${parseError}`);
                }

                if (!modifiedData) {
                    const errorMsg = 'Failed to apply context-based diff modifications';
                    if (attempt < maxValidationRetries) {
                        console.log(`[StreamingTransformExecutor] Context diff application failed (attempt ${attempt + 1}), retrying...`);
                        const correctedDiff = await this.retryDiffGeneration(
                            currentMessages,
                            llmService,
                            errorMsg,
                            JSON.stringify(originalData, null, 2),
                            diffString
                        );
                        return await this.convertUnifiedDiffToJsonPatches(
                            correctedDiff,
                            originalJsondoc,
                            templateName,
                            retryCount,
                            llmService,
                            originalMessages
                        );
                    } else {
                        throw new Error(errorMsg);
                    }
                }

                // 3. Generate JSON patches from original and modified objects
                try {
                    const originalData = originalJsondoc.data || originalJsondoc;
                    const jsonPatches = rfc6902.createPatch(originalData, modifiedData);
                    console.log(`[StreamingTransformExecutor] Successfully converted context-based diff to ${jsonPatches.length} JSON patches for ${templateName}`);
                    return jsonPatches;
                } catch (patchError: any) {
                    const errorMsg = `JSON patch generation failed: ${patchError.message}`;
                    if (attempt < maxValidationRetries) {
                        console.log(`[StreamingTransformExecutor] JSON patch generation failed (attempt ${attempt + 1}), retrying...`);
                        const correctedDiff = await this.retryDiffGeneration(
                            currentMessages,
                            llmService,
                            errorMsg,
                            JSON.stringify(originalData, null, 2),
                            diffString,
                            undefined,
                            modifiedData
                        );
                        return await this.convertUnifiedDiffToJsonPatches(
                            correctedDiff,
                            originalJsondoc,
                            templateName,
                            retryCount,
                            llmService,
                            originalMessages
                        );
                    } else {
                        throw new Error(errorMsg);
                    }
                }

            } catch (error: any) {
                if (attempt < maxValidationRetries) {
                    console.log(`[StreamingTransformExecutor] Diff application failed (attempt ${attempt + 1}), retrying...`);
                    const correctedDiff = await this.retryDiffGeneration(
                        currentMessages,
                        llmService,
                        error.message,
                        JSON.stringify(originalJsondoc.data || originalJsondoc, null, 2),
                        diffString
                    );
                    return await this.convertUnifiedDiffToJsonPatches(
                        correctedDiff,
                        originalJsondoc,
                        templateName,
                        retryCount,
                        llmService,
                        originalMessages
                    );
                } else {
                    console.error(`[StreamingTransformExecutor] All ${maxValidationRetries + 1} diff validation attempts failed:`, error);
                    throw error;
                }
            }
        }

        throw new Error('Unexpected end of validation retry loop');
    }

    /**
     * Helper method to retry diff generation with error feedback
     */
    private async retryDiffGeneration(
        messages: any[],
        llmService: any,
        errorMessage: string,
        originalText: string,
        failedDiff: string,
        patchedText?: string,
        parsedResult?: any
    ): Promise<string> {
        // Construct detailed error feedback for the LLM
        let feedbackMessage = `你刚才生成的基于上下文的差异补丁存在问题：

**错误信息**: ${errorMessage}

**原始JSON文本**:
\`\`\`json
${originalText}
\`\`\`

**你生成的差异补丁**:
\`\`\`diff
${failedDiff}
\`\`\``;

        if (patchedText) {
            feedbackMessage += `

**应用补丁后的文本**:
\`\`\`
${patchedText}
\`\`\``;
        }

        if (parsedResult) {
            feedbackMessage += `

**解析后的对象**:
\`\`\`json
${JSON.stringify(parsedResult, null, 2)}
\`\`\``;
        }

        feedbackMessage += `

请重新生成一个正确的基于上下文的差异补丁，确保：
1. 使用 CONTEXT: 标识提供足够的上下文定位
2. 使用 - 标识要删除的内容，+ 标识要添加的内容
3. 上下文必须与原始JSON完全匹配
4. 修改的内容格式正确且有效
5. 结果符合预期的数据结构schema

请直接输出修正后的基于上下文的差异补丁：`;

        // Add error feedback to conversation
        const updatedMessages = [
            ...messages,
            { role: 'user', content: feedbackMessage }
        ];

        // Call LLM again with error feedback using streamText (since diffs are text-based)
        try {
            console.log(`[StreamingTransformExecutor] Calling LLM for diff retry with ${updatedMessages.length} messages using streamText`);

            // Import streamText from AI SDK
            const { streamText } = await import('ai');
            const { getLLMModel } = await import('./LLMConfig.js');
            const model = await getLLMModel();

            const retryResponse = await streamText({
                model: model,
                messages: updatedMessages,
                system: "You are an expert at generating unified diff patches for JSON data. Generate ONLY the unified diff patch, with no additional explanation or formatting."
            });

            console.log(`[StreamingTransformExecutor] LLM retry text response received, collecting text...`);

            // Collect all text chunks into final diff string
            let correctedDiff = '';
            for await (const textDelta of retryResponse.textStream) {
                correctedDiff += textDelta;
            }

            console.log(`[StreamingTransformExecutor] LLM retry text collected:`, {
                type: typeof correctedDiff,
                isString: typeof correctedDiff === 'string',
                isNull: correctedDiff === null,
                isUndefined: correctedDiff === undefined,
                length: correctedDiff?.length,
                preview: typeof correctedDiff === 'string' ? correctedDiff.substring(0, 100) : String(correctedDiff)
            });

            if (!correctedDiff || typeof correctedDiff !== 'string') {
                const errorDetails = {
                    type: typeof correctedDiff,
                    value: correctedDiff,
                    isNull: correctedDiff === null,
                    isUndefined: correctedDiff === undefined,
                    stringified: String(correctedDiff)
                };

                console.error(`[StreamingTransformExecutor] Invalid LLM diff response details:`, errorDetails);
                throw new Error(`LLM returned invalid diff response: type=${typeof correctedDiff}, value=${String(correctedDiff)}, details=${JSON.stringify(errorDetails)}`);
            }

            if (correctedDiff.length === 0) {
                console.warn(`[StreamingTransformExecutor] LLM returned empty diff string`);
                throw new Error(`LLM returned empty diff response`);
            }

            console.log(`[StreamingTransformExecutor] LLM provided valid corrected diff (${correctedDiff.length} chars):`, correctedDiff.substring(0, 200) + '...');

            return correctedDiff;
        } catch (retryError: any) {
            console.error(`[StreamingTransformExecutor] Failed to get corrected diff from LLM:`, {
                error: retryError,
                message: retryError?.message,
                stack: retryError?.stack,
                name: retryError?.name
            });
            throw new Error(`LLM retry failed: ${retryError.message || 'Unknown error'}`);
        }
    }

    /**
     * Store a single message in real-time during streaming
     */
    private async storeMessageRealTime(
        transformId: string,
        projectId: string,
        role: 'user' | 'assistant' | 'tool' | 'system',
        content: string,
        metadata: any = {},
        chatMessageRepo: ChatMessageRepository
    ): Promise<void> {
        try {
            await chatMessageRepo.createRawMessage(
                projectId,
                role,
                content,
                {
                    metadata: {
                        transform_id: transformId,
                        streaming: true,
                        timestamp: new Date().toISOString(),
                        ...metadata
                    }
                }
            );
            console.log(`[StreamingTransformExecutor] Stored real-time ${role} message for transform ${transformId}`);
        } catch (error) {
            console.error(`[StreamingTransformExecutor] Failed to store real-time message:`, error);
        }
    }

    /**
     * Store raw conversation history for LLM patch transforms
     */
    private async storeTransformConversationHistory(
        transformId: string,
        projectId: string,
        originalMessages: any[],
        diffString: string,
        finalPatches: any[],
        chatMessageRepo: ChatMessageRepository
    ): Promise<void> {
        try {
            // Store the complete conversation including the unified diff
            const conversationMessages = [
                ...originalMessages,
                {
                    role: 'assistant',
                    content: diffString,
                    metadata: {
                        transform_id: transformId,
                        content_type: 'unified_diff',
                        final_patches_count: finalPatches.length
                    }
                }
            ];

            // Store each message in raw_messages table with transform association
            for (const message of conversationMessages) {
                await chatMessageRepo.createRawMessage(
                    projectId,
                    message.role,
                    message.content,
                    {
                        metadata: {
                            transform_id: transformId,
                            ...message.metadata
                        }
                    }
                );
            }

            console.log(`[StreamingTransformExecutor] Stored conversation history for transform ${transformId}`);
        } catch (error) {
            console.error(`[StreamingTransformExecutor] Failed to store conversation history:`, error);
        }
    }

    /**
     * Apply unified diff to original jsondoc with retry fallback mechanisms
     */
    private async applyPatchesToOriginal<TOutput>(
        llmOutput: TOutput,
        originalJsondoc: any,
        templateName: string,
        retryCount: number
    ): Promise<any> {
        try {
            // Use unified diff approach
            const jsonPatches = await this.convertUnifiedDiffToJsonPatches(
                llmOutput,
                originalJsondoc,
                templateName,
                retryCount,
                this.llmService,
                [] // Empty messages for basic retry
            );

            if (jsonPatches && jsonPatches.length > 0) {
                console.log(`[StreamingTransformExecutor] Applying ${jsonPatches.length} JSON patches converted from unified diff for ${templateName}`);

                const originalCopy = deepClone(originalJsondoc);
                const patchResults = applyPatch(originalCopy, jsonPatches);

                // Check if all patches applied successfully
                const failedPatches = patchResults.filter(r => r.test === false);
                if (failedPatches.length === 0) {
                    console.log(`[StreamingTransformExecutor] Successfully applied all converted JSON patches`);
                    return originalCopy;
                } else {
                    console.log(`[StreamingTransformExecutor] Failed patches:`, failedPatches);
                    throw new Error(`Failed to apply ${failedPatches.length} converted JSON patches`);
                }
            }

            throw new Error('No valid unified diff found in LLM output');

        } catch (error) {
            console.error(`[StreamingTransformExecutor] Unified diff application failed for ${templateName} (attempt ${retryCount + 1}):`, error);
            throw error;
        }
    }

    /**
     * Create a patch jsondoc to persist intermediate patches in the lineage graph
     */
    private async createPatchJsondoc(
        patches: any[],
        targetJsondocId: string,
        targetSchemaType: string,
        patchIndex: number,
        applied: boolean,
        errorMessage?: string,
        projectId?: string,
        userId?: string,
        jsondocRepo?: JsondocRepository,
        transformId?: string,
        transformRepo?: TransformRepository,
        dryRun?: boolean
    ): Promise<string | null> {
        if (dryRun || !projectId || !userId || !jsondocRepo || !transformRepo) {
            // console.log(`[StreamingTransformExecutor] Dry run or missing dependencies: Skipping patch jsondoc creation`);
            return null;
        }

        try {
            const patchData = {
                patches,
                targetJsondocId,
                targetSchemaType,
                patchIndex,
                applied,
                errorMessage
            };

            const patchJsondoc = await jsondocRepo.createJsondoc(
                projectId,
                'json_patch',
                patchData,
                'v1',
                {
                    created_at: new Date().toISOString(),
                    template_name: 'patch_generation',
                    patch_index: patchIndex,
                    applied: applied,
                    target_jsondoc_id: targetJsondocId,
                    target_schema_type: targetSchemaType
                },
                'completed',
                'ai_generated'
            );

            // Link patch jsondoc as input to the transform
            if (transformId) {
                await transformRepo.addTransformInputs(transformId, [
                    { jsondocId: patchJsondoc.id, inputRole: 'intermediate_patch' }
                ], projectId);
            }

            console.log(`[StreamingTransformExecutor] Created patch jsondoc ${patchJsondoc.id} for transform ${transformId}`);
            return patchJsondoc.id;

        } catch (error) {
            console.error(`[StreamingTransformExecutor] Failed to create patch jsondoc:`, error);
            return null;
        }
    }

    /**
     * Apply unified diff to original jsondoc with patch jsondoc persistence
     */
    private async applyPatchesToOriginalWithPersistence<TOutput>(
        llmOutput: TOutput,
        originalJsondoc: any,
        templateName: string,
        retryCount: number,
        projectId?: string,
        userId?: string,
        jsondocRepo?: JsondocRepository,
        transformId?: string | null,
        transformRepo?: TransformRepository,
        dryRun?: boolean
    ): Promise<any> {
        try {
            // Use unified diff approach with conversation history
            const jsonPatches = await this.convertUnifiedDiffToJsonPatches(
                llmOutput,
                originalJsondoc,
                templateName,
                retryCount,
                this.llmService,
                [] // Empty messages for basic retry - could be enhanced with conversation context
            );

            if (jsonPatches && jsonPatches.length > 0) {
                console.log(`[StreamingTransformExecutor] Applying ${jsonPatches.length} JSON patches converted from unified diff for ${templateName}`);

                // Create patch jsondoc before applying patches (store final JSON patches for compatibility)
                const patchJsondocId = await this.createPatchJsondoc(
                    jsonPatches,
                    originalJsondoc.id || 'target_jsondoc_id',
                    originalJsondoc.schema_type || 'target_schema_type',
                    retryCount,
                    false, // Will be updated after application
                    undefined,
                    projectId,
                    userId,
                    jsondocRepo,
                    transformId || undefined,
                    transformRepo,
                    dryRun
                );

                const originalCopy = deepClone(originalJsondoc);
                const patchResults = applyPatch(originalCopy, jsonPatches);

                // Check if all patches applied successfully
                const failedPatches = patchResults.filter(r => r.test === false);
                if (failedPatches.length === 0) {
                    console.log(`[StreamingTransformExecutor] Successfully applied all converted JSON patches`);

                    // Update patch jsondoc to mark as successfully applied
                    if (patchJsondocId && jsondocRepo) {
                        try {
                            const patchJsondoc = await jsondocRepo.getJsondoc(patchJsondocId);
                            if (patchJsondoc) {
                                const updatedPatchData = {
                                    ...patchJsondoc.data,
                                    applied: true
                                };
                                await jsondocRepo.updateJsondoc(
                                    patchJsondocId,
                                    updatedPatchData,
                                    {
                                        applied_at: new Date().toISOString(),
                                        success: true
                                    }
                                );
                            }
                        } catch (updateError) {
                            console.warn(`[StreamingTransformExecutor] Failed to update patch jsondoc status:`, updateError);
                        }
                    }

                    // Store conversation history for debugging
                    if (!dryRun && transformId && projectId) {
                        const { ChatMessageRepository } = await import('./ChatMessageRepository.js');
                        const { db } = await import('../database/connection.js');
                        const chatMessageRepo = new ChatMessageRepository(db);

                        const diffString = this.extractUnifiedDiff(llmOutput);
                        if (diffString) {
                            await this.storeTransformConversationHistory(
                                transformId,
                                projectId,
                                [], // Original messages - could be enhanced
                                diffString,
                                jsonPatches,
                                chatMessageRepo
                            );
                        }
                    }

                    return originalCopy;
                } else {
                    console.log(`[StreamingTransformExecutor] Failed patches:`, failedPatches);

                    // Update patch jsondoc to mark as failed
                    if (patchJsondocId && jsondocRepo) {
                        try {
                            const patchJsondoc = await jsondocRepo.getJsondoc(patchJsondocId);
                            if (patchJsondoc) {
                                const updatedPatchData = {
                                    ...patchJsondoc.data,
                                    applied: false,
                                    errorMessage: `Failed to apply ${failedPatches.length} converted JSON patches`
                                };
                                await jsondocRepo.updateJsondoc(
                                    patchJsondocId,
                                    updatedPatchData,
                                    {
                                        failed_at: new Date().toISOString(),
                                        success: false,
                                        error_message: `Failed to apply ${failedPatches.length} converted JSON patches`
                                    }
                                );
                            }
                        } catch (updateError) {
                            console.warn(`[StreamingTransformExecutor] Failed to update patch jsondoc error status:`, updateError);
                        }
                    }

                    throw new Error(`Failed to apply ${failedPatches.length} converted JSON patches`);
                }
            }

            throw new Error('No valid unified diff found in LLM output');

        } catch (error) {
            console.error(`[StreamingTransformExecutor] Unified diff application failed for ${templateName} (attempt ${retryCount + 1}):`, error);
            throw error;
        }
    }



    /**
     * Extract unified diff from LLM output
     */
    private extractUnifiedDiff(llmOutput: any): string | null {
        try {
            if (typeof llmOutput === 'string') {
                return llmOutput;
            }

            // Handle cases where LLM wraps diff in object
            if (llmOutput && typeof llmOutput.diff === 'string') {
                return llmOutput.diff;
            }

            if (llmOutput && typeof llmOutput.patch === 'string') {
                return llmOutput.patch;
            }

            return null;
        } catch (error) {
            console.warn(`[StreamingTransformExecutor] Failed to extract unified diff:`, error);
            return null;
        }
    }



    /**
     * Execute streaming with single retry on failure
     * Automatically detects JSON patch operations and uses streamText for diff generation
     */
    private async executeStreamingWithRetry<TOutput>(options: {
        prompt: string;
        schema: z.ZodSchema<TOutput>;
        templateName: string;
        enableCaching?: boolean;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
        executionMode?: StreamingExecutionMode;
    }) {
        const {
            prompt,
            schema,
            templateName,
            enableCaching = false,
            seed,
            temperature,
            topP,
            maxTokens,
            executionMode
        } = options;

        // Check if this should use streamText for diff generation
        // 1. JSON patch operations schema detection
        const isJsonPatchOperations = this.isJsonPatchOperationsSchema(schema);

        // 2. Execution mode-based detection (patch modes should use streamText for diffs)
        const isPatchMode = executionMode?.mode === 'patch' ||
            executionMode?.mode === 'patch-approval';

        // 3. Template name pattern detection (templates ending with _diff should use streamText)
        const isDiffTemplate = templateName.endsWith('_diff') ||
            templateName.includes('_edit_diff');

        const shouldUseStreamText = isJsonPatchOperations || isPatchMode || isDiffTemplate;

        if (shouldUseStreamText) {
            console.log(`[StreamingTransformExecutor] Using streamText for ${templateName} - Schema: ${isJsonPatchOperations}, Mode: ${isPatchMode}, Template: ${isDiffTemplate}`);
            return this.executeStreamTextForPatches({
                prompt,
                templateName,
                seed,
                temperature,
                topP,
                maxTokens
            });
        }

        // Standard object streaming for non-patch operations
        console.log(`[StreamingTransformExecutor] Using streamObject for ${templateName} - Schema: ${isJsonPatchOperations}, Mode: ${isPatchMode}, Template: ${isDiffTemplate}`);

        const { getLLMModel } = await import('./LLMConfig.js');
        const model = await getLLMModel();

        // Choose service based on caching preference
        const service = enableCaching
            ? CachedLLMService.withCaching()
            : CachedLLMService.withoutCaching();

        const streamOptions = {
            model: model,
            prompt,
            schema: schema as any,
            seed,
            temperature,
            topP,
            maxTokens
        };

        try {
            const stream = await service.streamObject(streamOptions);
            return stream;
        } catch (error) {
            console.warn(`[StreamingTransformExecutor] First attempt failed for ${templateName}, retrying...`, error);

            // Single retry with the same service
            try {
                const retryStream = await service.streamObject(streamOptions);
                return retryStream;
            } catch (retryError) {
                console.error(`[StreamingTransformExecutor] Retry failed for ${templateName}:`, retryError);
                throw retryError;
            }
        }
    }

    /**
     * Check if schema is JsonPatchOperationsSchema (array of patch operations)
     */
    private isJsonPatchOperationsSchema(schema: z.ZodSchema<any>): boolean {
        try {
            // Check if it's a ZodArray
            if (!(schema instanceof z.ZodArray)) {
                return false;
            }

            // Check if the array element is a ZodObject with patch operation structure
            const elementSchema = schema.element;
            if (!(elementSchema instanceof z.ZodObject)) {
                return false;
            }

            const shape = elementSchema.shape;
            // Check for typical JSON patch operation fields
            return 'op' in shape && 'path' in shape &&
                (shape.op instanceof z.ZodEnum || shape.op instanceof z.ZodLiteral) &&
                shape.path instanceof z.ZodString;
        } catch (error) {
            console.warn('[StreamingTransformExecutor] Error checking JSON patch schema:', error);
            return false;
        }
    }

    /**
     * Execute streamText for patch generation and convert to JSON patch operations
     */
    private async executeStreamTextForPatches(options: {
        prompt: string;
        templateName: string;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }): Promise<AsyncIterable<any>> {
        const { prompt, templateName, seed, temperature, topP, maxTokens } = options;

        console.log(`[StreamingTransformExecutor] Using streamText for ${templateName} diff generation`);

        // Get model instance
        const { getLLMModel } = await import('./LLMConfig.js');
        const model = await getLLMModel();

        // Import streamText from AI SDK
        const { streamText } = await import('ai');

        try {
            const response = await streamText({
                model: model,
                messages: [{
                    role: 'user',
                    content: prompt
                }],
                system: "You are an expert at generating unified diff patches for JSON data. Generate ONLY the unified diff patch, with no additional explanation or formatting.",
                seed,
                temperature,
                topP,
                maxTokens
            });

            // Convert text stream to JSON patch operations stream
            return this.convertTextStreamToJsonPatches(response.textStream, templateName);

        } catch (error) {
            console.warn(`[StreamingTransformExecutor] First streamText attempt failed for ${templateName}, retrying...`, error);

            // Single retry
            try {
                const retryResponse = await streamText({
                    model: model,
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    system: "You are an expert at generating unified diff patches for JSON data. Generate ONLY the unified diff patch, with no additional explanation or formatting.",
                    seed,
                    temperature,
                    topP,
                    maxTokens
                });

                return this.convertTextStreamToJsonPatches(retryResponse.textStream, templateName);
            } catch (retryError) {
                console.error(`[StreamingTransformExecutor] StreamText retry failed for ${templateName}:`, retryError);
                throw retryError;
            }
        }
    }

    /**
     * Convert text stream (unified diffs) to JSON patch operations stream
     * Now yields objects with both rawText and patches for debugging
     */
    private async *convertTextStreamToJsonPatches(
        textStream: AsyncIterable<string>,
        templateName: string
    ): AsyncGenerator<any, void, unknown> {
        let accumulatedText = '';
        let lastValidPatches: any[] = [];

        console.log(`[StreamingTransformExecutor] Starting text stream to JSON patches conversion for ${templateName}`);

        try {
            for await (const textDelta of textStream) {
                accumulatedText += textDelta;

                // Always yield the raw text chunk for debugging
                yield {
                    type: 'rawText',
                    textDelta,
                    accumulatedText,
                    templateName
                };

                // Try to convert accumulated text to JSON patches periodically
                try {
                    // For streaming, we need to get patches from the current accumulated diff
                    // This is a simplified approach - in practice, you might want to wait for complete hunks
                    if (accumulatedText.includes('@@') && accumulatedText.includes('\n')) {
                        // Try to parse as a complete diff
                        const patches = await this.convertUnifiedDiffTextToJsonPatches(accumulatedText, templateName);
                        if (patches && patches.length > 0) {
                            lastValidPatches = patches;
                            yield {
                                type: 'patches',
                                patches,
                                templateName,
                                source: 'streaming'
                            };
                        }
                    }
                } catch (conversionError) {
                    // Continue streaming, we'll try again with more text
                    console.debug(`[StreamingTransformExecutor] Partial conversion failed for ${templateName}, continuing...`);
                }
            }

            // Final conversion with complete text
            try {
                const finalPatches = await this.convertUnifiedDiffTextToJsonPatches(accumulatedText, templateName);
                if (finalPatches && finalPatches.length > 0) {
                    console.log(`[StreamingTransformExecutor] Final conversion successful for ${templateName}: ${finalPatches.length} patches`);
                    yield {
                        type: 'finalPatches',
                        patches: finalPatches,
                        templateName,
                        source: 'final',
                        rawText: accumulatedText
                    };
                } else if (lastValidPatches.length > 0) {
                    console.log(`[StreamingTransformExecutor] Using last valid patches for ${templateName}: ${lastValidPatches.length} patches`);
                    yield {
                        type: 'finalPatches',
                        patches: lastValidPatches,
                        templateName,
                        source: 'lastValid',
                        rawText: accumulatedText
                    };
                } else {
                    console.warn(`[StreamingTransformExecutor] No valid patches generated for ${templateName}`);
                    yield {
                        type: 'finalPatches',
                        patches: [],
                        templateName,
                        source: 'empty',
                        rawText: accumulatedText
                    };
                }
            } catch (finalError) {
                console.error(`[StreamingTransformExecutor] Final conversion failed for ${templateName}:`, finalError);
                yield {
                    type: 'finalPatches',
                    patches: lastValidPatches.length > 0 ? lastValidPatches : [],
                    templateName,
                    source: 'error',
                    rawText: accumulatedText,
                    error: finalError instanceof Error ? finalError.message : String(finalError)
                };
            }
        } catch (streamError) {
            console.error(`[StreamingTransformExecutor] Text stream error for ${templateName}:`, streamError);
            yield {
                type: 'error',
                patches: lastValidPatches.length > 0 ? lastValidPatches : [],
                templateName,
                rawText: accumulatedText,
                error: streamError instanceof Error ? streamError.message : String(streamError)
            };
        }
    }

    /**
 * Convert unified diff text to JSON patch operations  
 */
    private async convertUnifiedDiffTextToJsonPatches(diffText: string, templateName: string): Promise<any[]> {
        try {
            console.log(`[StreamingTransformExecutor] Converting unified diff to JSON patches for ${templateName}`);
            console.log(`[StreamingTransformExecutor] Diff text (${diffText.length} chars):`, diffText.substring(0, 200) + '...');

            // This method needs access to the original JSON to generate proper patches
            // For now, we'll need to store the original data context or restructure this approach

            // As a temporary solution, parse the diff and create simple patch operations
            // This is a simplified implementation that extracts basic patch information
            const patches: any[] = [];

            // Try to extract patch information from the unified diff
            const lines = diffText.split('\n');
            let currentPath: string | null = null;

            for (const line of lines) {
                // Extract file paths (simplified)
                if (line.startsWith('---') || line.startsWith('+++')) {
                    // Skip file headers for now
                    continue;
                }

                // Extract hunk headers
                if (line.startsWith('@@')) {
                    // Parse hunk header to understand what's being changed
                    // Format: @@ -oldStart,oldCount +newStart,newCount @@
                    continue;
                }

                // Process actual changes
                if (line.startsWith('+') && !line.startsWith('+++')) {
                    // Addition - try to extract the JSON path and value
                    const content = line.substring(1).trim();
                    if (content.includes(':')) {
                        // This looks like a JSON property
                        const [key, ...valueParts] = content.split(':');
                        const value = valueParts.join(':').trim().replace(/,$/, '').replace(/"/g, '');

                        patches.push({
                            op: 'add',
                            path: `/${key.trim().replace(/"/g, '')}`,
                            value: this.parseJsonValue(value)
                        });
                    }
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                    // Deletion - try to extract the JSON path
                    const content = line.substring(1).trim();
                    if (content.includes(':')) {
                        const [key] = content.split(':');
                        patches.push({
                            op: 'remove',
                            path: `/${key.trim().replace(/"/g, '')}`
                        });
                    }
                }
            }

            console.log(`[StreamingTransformExecutor] Generated ${patches.length} basic patch operations for ${templateName}`);

            return patches;
        } catch (error) {
            console.error(`[StreamingTransformExecutor] Failed to convert unified diff to JSON patches for ${templateName}:`, error);
            return [];
        }
    }

    /**
     * Parse a string value to appropriate JSON type
     */
    private parseJsonValue(value: string): any {
        if (!value || value === 'null') return null;
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (/^\d+$/.test(value)) return parseInt(value, 10);
        if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
        if (value.startsWith('[') && value.endsWith(']')) {
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }
        if (value.startsWith('{') && value.endsWith('}')) {
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }
        return value;
    }


    /**
     * Create initial data structure for different jsondoc types (universal JSON handling)
     * Can be customized by passing initialData in transformMetadata
     * Since validation is skipped during streaming, we can use simple empty structures
     */
    private createInitialJsondocData(jsondocType: string, transformMetadata?: Record<string, any>): any {
        // If custom initial data is provided, use it
        if (transformMetadata?.initialData) {
            return transformMetadata.initialData;
        }

        // Universal approach - simple empty structures since validation is skipped during streaming
        if (jsondocType.includes('collection') || jsondocType.includes('array')) {
            return [];  // Array-based jsondocs
        } else {
            return {};  // Object-based jsondocs
        }
    }

    /**
     * Create or update individual patch jsondocs progressively during streaming
     */
    private async createStreamingPatchApprovalJsondocs<TOutput>(
        llmOutput: TOutput,
        originalJsondoc: any,
        templateName: string,
        retryCount: number,
        projectId?: string,
        userId?: string,
        jsondocRepo?: JsondocRepository,
        transformId?: string | null,
        transformRepo?: TransformRepository,
        dryRun?: boolean,
        chunkCount?: number
    ): Promise<void> {
        if (dryRun || !jsondocRepo || !projectId || !transformId || !transformRepo) {
            // console.log(`[StreamingTransformExecutor] Dry run or missing dependencies: Skipping streaming patch jsondoc creation`);
            return;
        }

        try {
            // Convert unified diff to JSON patches
            const patches = await this.convertUnifiedDiffToJsonPatches(
                llmOutput,
                originalJsondoc,
                templateName,
                retryCount,
                this.llmService,
                [] // Empty messages for streaming context
            );

            if (!patches || patches.length === 0) {
                console.log(`[StreamingTransformExecutor] No patches found in streaming LLM output at chunk ${chunkCount}`);
                return;
            }

            console.log(`[StreamingTransformExecutor] Processing ${patches.length} patches during streaming at chunk ${chunkCount}`);

            // Get existing patch jsondocs created by this transform
            const existingOutputs = await transformRepo.getTransformOutputs(transformId);
            const existingPatchJsondocs = await Promise.all(
                existingOutputs.map(async output => {
                    const jsondoc = await jsondocRepo.getJsondoc(output.jsondoc_id);
                    return jsondoc && jsondoc.schema_type === 'json_patch'
                        ? { jsondoc, outputId: output.jsondoc_id }
                        : null;
                })
            );
            const validPatchJsondocs = existingPatchJsondocs.filter(item => item !== null);

            // Process each patch - create new ones or update existing ones
            for (let i = 0; i < patches.length; i++) {
                const patch = patches[i];
                const patchData = {
                    patches: [patch], // Single patch per jsondoc
                    targetJsondocId: originalJsondoc.id || (() => {
                        throw new Error(`Missing originalJsondoc.id for streaming patch creation in template ${templateName}. originalJsondoc: ${JSON.stringify(originalJsondoc, null, 2)}`);
                    })(),
                    targetSchemaType: originalJsondoc.schema_type || (() => {
                        throw new Error(`Missing originalJsondoc.schema_type for streaming patch creation in template ${templateName}. originalJsondoc: ${JSON.stringify(originalJsondoc, null, 2)}`);
                    })(),
                    patchIndex: i,
                    applied: false,
                    chunkCount: chunkCount || 0,
                    streamingUpdate: true
                };

                if (i < validPatchJsondocs.length) {
                    // Update existing patch jsondoc
                    const existingPatch = validPatchJsondocs[i];
                    await jsondocRepo.updateJsondoc(
                        existingPatch.outputId,
                        patchData,
                        {
                            last_updated: new Date().toISOString(),
                            chunk_count: chunkCount || 0,
                            patch_index: i,
                            streaming_update: true,
                            template_name: templateName
                        }
                    );
                    console.log(`[StreamingTransformExecutor] Updated existing patch jsondoc ${existingPatch.outputId} (index ${i}) at chunk ${chunkCount}`);
                } else {
                    // Create new patch jsondoc
                    const patchJsondoc = await jsondocRepo.createJsondoc(
                        projectId,
                        'json_patch',
                        patchData,
                        'v1',
                        {
                            created_at: new Date().toISOString(),
                            template_name: templateName,
                            patch_index: i,
                            applied: false,
                            target_jsondoc_id: originalJsondoc.id || (() => {
                                throw new Error(`Missing originalJsondoc.id for streaming patch metadata in template ${templateName}. originalJsondoc: ${JSON.stringify(originalJsondoc, null, 2)}`);
                            })(),
                            target_schema_type: originalJsondoc.schema_type || (() => {
                                throw new Error(`Missing originalJsondoc.schema_type for streaming patch metadata in template ${templateName}. originalJsondoc: ${JSON.stringify(originalJsondoc, null, 2)}`);
                            })(),
                            chunk_count: chunkCount || 0,
                            streaming_creation: true
                        },
                        'streaming', // Mark as streaming initially
                        'ai_generated'
                    );

                    // Link patch jsondoc as output to the transform
                    await transformRepo.addTransformOutputs(transformId, [
                        { jsondocId: patchJsondoc.id }
                    ], projectId);

                    console.log(`[StreamingTransformExecutor] Created new patch jsondoc ${patchJsondoc.id} (index ${i}) at chunk ${chunkCount}`);
                }
            }

            // Mark any extra existing patch jsondocs as deleted if we have fewer patches now
            if (validPatchJsondocs.length > patches.length) {
                for (let i = patches.length; i < validPatchJsondocs.length; i++) {
                    const extraPatch = validPatchJsondocs[i];
                    await jsondocRepo.updateJsondoc(
                        extraPatch.outputId,
                        { deleted: true },
                        {
                            deleted_at: new Date().toISOString(),
                            chunk_count: chunkCount || 0,
                            reason: 'patch_count_reduced_during_streaming'
                        }
                    );
                    console.log(`[StreamingTransformExecutor] Marked extra patch jsondoc ${extraPatch.outputId} as deleted at chunk ${chunkCount}`);
                }
            }

        } catch (error) {
            console.error(`[StreamingTransformExecutor] Failed to create/update streaming patch jsondocs at chunk ${chunkCount}:`, error);
            // Don't throw - allow streaming to continue
        }
    }

    /**
     * Finalize streaming patch jsondocs - mark them as completed and clean up
     */
    private async finalizeStreamingPatchApprovalJsondocs<TOutput>(
        llmOutput: TOutput,
        originalJsondoc: any,
        templateName: string,
        retryCount: number,
        projectId?: string,
        userId?: string,
        jsondocRepo?: JsondocRepository,
        transformId?: string | null,
        transformRepo?: TransformRepository,
        dryRun?: boolean,
        chunkCount?: number
    ): Promise<void> {
        if (dryRun || !jsondocRepo || !projectId || !transformId || !transformRepo) {
            // console.log(`[StreamingTransformExecutor] Dry run or missing dependencies: Skipping patch jsondoc finalization`);
            return;
        }

        try {
            // Convert unified diff to final JSON patches
            const finalPatches = await this.convertUnifiedDiffToJsonPatches(
                llmOutput,
                originalJsondoc,
                templateName,
                retryCount,
                this.llmService,
                [] // Empty messages for finalization context
            );

            if (!finalPatches || finalPatches.length === 0) {
                console.log(`[StreamingTransformExecutor] No final patches found for finalization`);
                return;
            }

            console.log(`[StreamingTransformExecutor] Finalizing ${finalPatches.length} patch jsondocs`);

            // Get all patch jsondocs created by this transform
            const existingOutputs = await transformRepo.getTransformOutputs(transformId);
            const patchOutputs = [];

            for (const output of existingOutputs) {
                const jsondoc = await jsondocRepo.getJsondoc(output.jsondoc_id);
                if (jsondoc && jsondoc.schema_type === 'json_patch') {
                    patchOutputs.push(output);
                }
            }

            // Update each patch jsondoc to completed status
            for (let i = 0; i < finalPatches.length && i < patchOutputs.length; i++) {
                const patch = finalPatches[i];
                const outputId = patchOutputs[i].jsondoc_id;

                const finalPatchData = {
                    patches: [patch], // Single patch per jsondoc
                    targetJsondocId: originalJsondoc.id || (() => {
                        throw new Error(`Missing originalJsondoc.id for patch finalization in template ${templateName}. originalJsondoc: ${JSON.stringify(originalJsondoc, null, 2)}`);
                    })(),
                    targetSchemaType: originalJsondoc.schema_type || (() => {
                        throw new Error(`Missing originalJsondoc.schema_type for patch finalization in template ${templateName}. originalJsondoc: ${JSON.stringify(originalJsondoc, null, 2)}`);
                    })(),
                    patchIndex: i,
                    applied: false,
                    chunkCount: chunkCount || 0,
                    streamingUpdate: false,
                    finalized: true
                };

                await jsondocRepo.updateJsondoc(
                    outputId,
                    finalPatchData,
                    {
                        completed_at: new Date().toISOString(),
                        chunk_count: chunkCount || 0,
                        patch_index: i,
                        template_name: templateName,
                        finalized: true
                    },
                    'completed' // Mark as completed
                );

                console.log(`[StreamingTransformExecutor] Finalized patch jsondoc ${outputId} (index ${i})`);
            }

            // Mark any remaining patch jsondocs as completed even if they don't have final data
            for (let i = finalPatches.length; i < patchOutputs.length; i++) {
                const outputId = patchOutputs[i].jsondoc_id;
                await jsondocRepo.updateJsondoc(
                    outputId,
                    { deleted: true, finalized: true },
                    {
                        completed_at: new Date().toISOString(),
                        deleted_at: new Date().toISOString(),
                        reason: 'no_final_patch_data'
                    },
                    'completed'
                );
                console.log(`[StreamingTransformExecutor] Marked extra patch jsondoc ${outputId} as deleted during finalization`);
            }

        } catch (error) {
            console.error(`[StreamingTransformExecutor] Failed to finalize streaming patch jsondocs:`, error);
            // Don't throw - the transform should still complete
        }
    }



}

/**
 * Convenience function for tool implementations
 */
export async function executeStreamingTransform<TInput, TOutput>(
    params: StreamingTransformParams<TInput, TOutput>
): Promise<StreamingTransformResult> {
    // Try to get global particle processor if available
    const { getParticleTemplateProcessor } = await import('../services/ParticleSystemInitializer.js');
    const particleProcessor = getParticleTemplateProcessor() || undefined;

    const executor = new StreamingTransformExecutor(particleProcessor);
    return executor.executeStreamingTransform(params);
} 
