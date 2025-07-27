import { z } from 'zod';
import { TemplateService } from '../services/templates/TemplateService';
import { LLMService } from './LLMService';
import { CachedLLMService, getCachedLLMService } from './CachedLLMService';
import { TransformJsondocRepository } from './TransformJsondocRepository';
import { ChatMessageRepository } from './ChatMessageRepository';
import { ParticleTemplateProcessor } from '../services/ParticleTemplateProcessor';
import { applyPatch, deepClone, Operation } from 'fast-json-patch';
import { TypedJsondoc } from '../../common/jsondocs.js';
import {
    applyContextDiffToJSON,
} from '../../common/contextDiff';
import { JsonPatchArray } from '@/common/schemas/transforms.js';

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
    jsondocRepo: TransformJsondocRepository
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
                // Don't stringify the data here - let TemplateService handle formatting based on template type
                jsondocs[key] = {
                    id: jsondoc.id,
                    description: jsondocRef.description,
                    schemaType: jsondocRef.schemaType,
                    schema_type: jsondoc.schema_type,
                    data: jsondoc.data
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
    | { mode: 'patch-approval', originalJsondoc: any };

/**
 * Parameters for executing a streaming transform
 */
export interface StreamingTransformParams<TInput, TOutput> {
    config: StreamingTransformConfig<TInput, TOutput>;
    input: TInput;
    projectId: string;
    userId: string;
    transformRepo: TransformJsondocRepository;
    jsondocRepo: TransformJsondocRepository;
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
    executionMode: StreamingExecutionMode;
    // NEW: Dry run mode - no database operations
    dryRun?: boolean;  // Skip all database operations (default: false)
    // NEW: Streaming callback for real-time updates
    onStreamChunk?: (chunk: TOutput, chunkCount: number) => void | Promise<void>;  // Called for each streaming chunk
    // NEW: End callback for final processing notification
    onStreamEnd?: (finalResult: any) => void | Promise<void>;  // Called when streaming completes
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
    // Context for final conversion to use the working algorithm
    private originalJsondocForFinalConversion: any = null;
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
            onStreamEnd,
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



                if (executionMode.mode === 'patch-approval' && executionMode.originalJsondoc) {
                    this.originalJsondocForFinalConversion = executionMode.originalJsondoc;
                    // originalMessages will be set when they're built below
                } else {
                    const hasOriginal = executionMode && executionMode.mode !== 'full-object' && 'originalJsondoc' in executionMode && !!executionMode.originalJsondoc;
                    console.warn(`[StreamingTransformExecutor] Not setting originalJsondocForFinalConversion - mode: ${executionMode.mode}, hasOriginal: ${hasOriginal}`);
                }

                // 2. Create transform for this execution (or update existing one on retry)
                if (!dryRun && !transformId) {
                    // Use ai_patch type for patch-approval mode, llm for others
                    const transformType = executionMode.mode === 'patch-approval' ? 'ai_patch' : 'llm';
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
                } else if (!dryRun && transformId) {
                    // Update retry count on existing transform
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
                if (!dryRun && !outputJsondocId && executionMode.mode !== 'patch-approval') {
                    let initialData: any;
                    initialData = this.createInitialJsondocData(outputJsondocType, transformMetadata);


                    const outputJsondoc = await jsondocRepo.createJsondoc(
                        projectId,
                        outputJsondocType,
                        initialData,
                        'v1',
                        {
                            started_at: new Date().toISOString(),
                            template_name: config.templateName,
                            retry_count: retryCount,
                            execution_mode: executionMode.mode || 'full-object',
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

                // Optionally save debug prompt for diff templates
                if (config.templateName.includes('edit_diff')) {
                    try {
                        const { writeFileSync } = await import('fs');
                        const { join } = await import('path');
                        const debugPromptPath = join(process.cwd(), 'debug-llm-prompt.txt');
                        writeFileSync(debugPromptPath, finalPrompt, 'utf8');
                    } catch (debugError) {
                        // Ignore debug save errors
                    }
                }

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
                    let isEagerPatch = false;
                    let isFinalPatch = false;

                    if (partialData && typeof partialData === 'object' && 'type' in partialData) {
                        // New format with rawText and patches
                        streamingInfo = partialData;

                        if (partialData.type === 'finalPatches') {
                            actualData = partialData.patches as TOutput;
                            isFinalPatch = true;
                        } else if (partialData.type === 'patches') {
                            actualData = partialData.patches as TOutput;
                        } else if (partialData.type === 'eagerPatches') {
                            // EAGER PATCHES: Process immediately!
                            actualData = partialData.patches as TOutput;
                            isEagerPatch = true;
                        } else {
                            // For rawText chunks, keep the last actual data
                            actualData = (lastData || []) as TOutput;
                        }
                    } else {
                        // Standard format
                        actualData = partialData as TOutput;
                    }

                    lastData = actualData;

                    // Store real-time LLM output chunk (every 5 chunks to avoid spam, but always for eager patches)
                    if (!dryRun && transformId && chatMessageRepo && (chunkCount % 5 === 1 || isEagerPatch)) {
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
                                    content_type: isEagerPatch ? 'eager_patch_chunk' : 'streaming_chunk',
                                    chunk_number: chunkCount,
                                    template_name: config.templateName,
                                    stream_type: streamingInfo?.type || 'standard',
                                    eager_patch: isEagerPatch,
                                    patch_count: isEagerPatch ? partialData.patches?.length : undefined
                                },
                                chatMessageRepo
                            );
                        } catch (chunkSaveError) {
                            console.warn(`[StreamingTransformExecutor] Failed to save real-time chunk ${chunkCount}:`, chunkSaveError);
                        }
                    }

                    // Call streaming callback if provided (always for eager patches, final patches, or periodic for others)
                    if (isEagerPatch || isFinalPatch || chunkCount % updateIntervalChunks === 0) {
                        // console.log(`[StreamingTransformExecutor] Processing chunk ${chunkCount}, isEagerPatch: ${isEagerPatch}, isFinalPatch: ${isFinalPatch}`);

                        // INTERNALIZED LOGIC: Process the debug-context-diff.ts pipeline eagerly during streaming
                        let enhancedCallbackData = streamingInfo || actualData;

                        try {
                            // For patch-approval mode, eagerly process the working pipeline
                            if (executionMode.mode === 'patch-approval' && this.originalJsondocForFinalConversion) {
                                let pipelineResults: Awaited<ReturnType<typeof this.processDebugPipeline>>;
                                try {
                                    pipelineResults = await this.processDebugPipeline(
                                        streamingInfo || actualData,
                                        chunkCount,
                                    );

                                    // console.log(`[StreamingTransformExecutor] Pipeline patches:`, pipelineResults.patches.length);
                                    // console.log(`[StreamingTransformExecutor] dryRun:`, dryRun, `transformId:`, transformId, `projectId:`, projectId);

                                    if (executionMode.mode === 'patch-approval' && !dryRun && transformId && projectId) {
                                        const patchesToUpsert = pipelineResults.patches;

                                        if (patchesToUpsert.length > 0) {
                                            // console.log(`[StreamingTransformExecutor] First patch sample:`, JSON.stringify(patchesToUpsert[0]));
                                            try {
                                                await this.upsertPatchJsondocs(
                                                    patchesToUpsert,
                                                    executionMode.originalJsondoc,
                                                    config.templateName,
                                                    projectId,
                                                    transformId,
                                                    jsondocRepo,
                                                    transformRepo,
                                                    chunkCount
                                                );
                                            } catch (upsertError) {
                                                console.warn(`[StreamingTransformExecutor] Failed to upsert patch jsondocs at chunk ${chunkCount}:`, upsertError);
                                            }
                                        }
                                    }

                                    enhancedCallbackData = {
                                        ...enhancedCallbackData,
                                        pipelineResults: pipelineResults
                                    }
                                } catch (pipelineError) {
                                    // On pipeline error, fall back to original data
                                    console.warn(`[StreamingTransformExecutor] Pipeline processing failed at chunk ${chunkCount}, using fallback:`, pipelineError);
                                    enhancedCallbackData = streamingInfo || actualData;
                                }
                            }
                            if (onStreamChunk) {
                                await onStreamChunk(enhancedCallbackData, chunkCount);
                            }
                        } catch (callbackError) {
                            console.warn(`[StreamingTransformExecutor] Streaming callback error at chunk ${chunkCount}:`, callbackError);
                        }

                    }

                    // EAGER PATCH PROCESSING: Apply immediately if we have eager patches
                    if (isEagerPatch && actualData && Array.isArray(actualData) && actualData.length > 0) {
                        try {

                            if (executionMode.mode === 'patch-approval' && !dryRun && transformId && projectId) {
                                // Upsert patch jsondocs immediately for eager patches
                                await this.upsertPatchJsondocs(
                                    actualData as any[],
                                    executionMode.originalJsondoc,
                                    config.templateName,
                                    projectId,
                                    transformId,
                                    jsondocRepo,
                                    transformRepo,
                                    chunkCount
                                );
                            }
                        } catch (eagerError) {
                            console.warn(`[StreamingTransformExecutor] EAGER FAILURE: Failed to upsert eager patches at chunk ${chunkCount}:`, eagerError);
                            // Continue streaming - eager failures shouldn't stop the process
                        }
                    }

                    // Update jsondoc every N chunks or if this is the final chunk
                    if (chunkCount % updateIntervalChunks === 0) {
                        try {
                            let jsondocData: any;
                            if (executionMode.mode === 'patch-approval') {
                                // In patch-approval mode, patch jsondocs are already created during eager processing
                                // Skip redundant streaming updates to prevent re-parsing failures
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
                                        execution_mode: executionMode.mode || 'full-object'
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
                            } else if (executionMode.mode === 'patch-approval') {
                                // In patch-approval mode, we don't update during streaming, only at completion
                                // console.log(`[StreamingTransformExecutor] Patch-approval mode: Skipping streaming update at chunk ${chunkCount}`);
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
                if (executionMode.mode === 'patch-approval') {
                    // Finalize patch jsondocs - mark them as completed
                    // console.log(`[StreamingTransformExecutor] Finalizing patch jsondocs for transform ${transformId}`);

                    if (!dryRun && transformId && projectId) {
                        try {
                            // Fetch all patch jsondocs for this transform
                            const outputs = await transformRepo.getTransformOutputs(transformId);
                            const patchJsondocIds = outputs
                                .filter(o => o.output_role === 'patch_output')
                                .map(o => o.jsondoc_id);

                            // console.log(`[StreamingTransformExecutor] Found ${patchJsondocIds.length} patch jsondocs to finalize`);

                            // Mark all patch jsondocs as completed
                            for (const patchId of patchJsondocIds) {
                                // console.log(`[StreamingTransformExecutor] Marking patch ${patchId} as completed`);

                                // First get existing metadata
                                const existingJsondoc = await jsondocRepo.getJsondoc(patchId);
                                if (existingJsondoc) {
                                    const existingMetadata = existingJsondoc.metadata || {};
                                    const updatedMetadata = {
                                        ...existingMetadata,
                                        completed_at: new Date().toISOString(),
                                        finalized: true
                                    };

                                    // Update only metadata and status without touching data
                                    const { db } = await import('../database/connection.js');
                                    await db
                                        .updateTable('jsondocs')
                                        .set({
                                            metadata: JSON.stringify(updatedMetadata),
                                            streaming_status: 'completed'
                                        })
                                        .where('id', '=', patchId)
                                        .execute();
                                }
                            }
                        } catch (finalizationError) {
                            console.warn(`[StreamingTransformExecutor] Failed to finalize patch jsondocs:`, finalizationError);
                        }
                    }
                    finalJsondocData = null; // No single jsondoc output in patch-approval mode
                } else {
                    // Transform LLM output to final jsondoc format if needed (full-object mode)
                    finalJsondocData = config.transformLLMOutput
                        ? config.transformLLMOutput(finalValidatedData, validatedInput)
                        : finalValidatedData;
                }

                // Handle different execution modes for completion
                if (!dryRun) {
                    if (executionMode.mode === 'patch-approval') {
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
                            // finalValidatedData is already the processed JSON patches array
                            const finalPatches = finalValidatedData as Operation[];
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

                // Call onStreamEnd callback if provided
                if (onStreamEnd) {
                    try {
                        const finalResult = {
                            outputJsondocId: outputJsondocId || (executionMode.mode === 'patch-approval' ? 'patch-approval-pending' : 'dry-run-no-output'),
                            finishReason: 'stop',
                            transformId: transformId || 'dry-run-no-transform',
                            finalValidatedData,
                            totalChunks: chunkCount,
                            executionMode: executionMode.mode
                        };
                        await onStreamEnd(finalResult);
                    } catch (endCallbackError) {
                        console.warn(`[StreamingTransformExecutor] End callback error:`, endCallbackError);
                    }
                }

                return {
                    outputJsondocId: outputJsondocId || (executionMode.mode === 'patch-approval' ? 'patch-approval-pending' : 'dry-run-no-output'),
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
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }

        // This should never be reached due to the throw in the retry exhaustion case
        throw new Error('Unexpected end of retry loop');
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

        } catch (error) {
            console.error(`[StreamingTransformExecutor] Failed to store conversation history:`, error);
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
        jsondocRepo?: TransformJsondocRepository,
        transformId?: string,
        transformRepo?: TransformJsondocRepository,
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

            return patchJsondoc.id;

        } catch (error) {
            console.error(`[StreamingTransformExecutor] Failed to create patch jsondoc:`, error);
            return null;
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
        executionMode: StreamingExecutionMode;
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
        const isPatchMode = executionMode.mode === 'patch-approval';

        // 3. Template name pattern detection (templates ending with _diff should use streamText)
        const isDiffTemplate = templateName.endsWith('_diff') ||
            templateName.includes('_edit_diff');

        const shouldUseStreamText = isJsonPatchOperations || isPatchMode || isDiffTemplate;

        if (shouldUseStreamText) {
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


        // Get model instance
        const { getLLMModel } = await import('./LLMConfig.js');
        const model = await getLLMModel();

        // Import streamText from AI SDK
        const { streamText } = await import('ai');

        try {
            const messages = [{
                role: 'user' as const,
                content: prompt
            }];


            const response = await streamText({
                model: model,

                messages,
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
     * SIMPLIFIED: Uses the exact same approach as debug-context-diff.ts
     * 1. Apply text diff to stringified JSON data
     * 2. Use jsonrepair to parse resulting JSON
     * 3. Use rfc6902 to calculate patches
     * 4. Emit patches (partial or final)
     */
    private async *convertTextStreamToJsonPatches(
        textStream: AsyncIterable<string>,
        templateName: string
    ): AsyncGenerator<any, void, unknown> {
        let accumulatedText = '';
        let lastValidPatches: any[] = [];
        let eagerParseAttempts = 0;

        // Get original JSON data for patch calculation
        let originalJsondoc = this.originalJsondocForFinalConversion;

        // If not set, we can't do patch-based processing, so fall back to basic text streaming
        if (!originalJsondoc) {
            console.warn(`[StreamingTransformExecutor] No original jsondoc context for patch calculation - falling back to text-only streaming`);

            // Fall back to basic text streaming without patch generation
            let accumulatedText = '';
            try {
                for await (const textDelta of textStream) {
                    accumulatedText += textDelta;

                    // Yield raw text chunks for debugging
                    yield {
                        type: 'rawText',
                        textDelta,
                        accumulatedText,
                        templateName
                    };
                }

                // Return the accumulated text as final result (not patches)
                yield {
                    type: 'finalPatches',
                    patches: [], // Empty patches since we can't calculate them
                    templateName,
                    source: 'no_original_context',
                    rawText: accumulatedText
                };
            } catch (error) {
                console.error(`[StreamingTransformExecutor] Text streaming error:`, error);
                yield {
                    type: 'error',
                    patches: [],
                    templateName,
                    rawText: accumulatedText,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
            return;
        }

        let originalData = originalJsondoc.data || originalJsondoc;

        // Handle case where jsondoc data is stored as a string in the database
        if (typeof originalData === 'string') {
            try {
                originalData = JSON.parse(originalData);
                console.log(`[StreamingTransformExecutor] Parsed string data from jsondoc for ${templateName}`);
            } catch (parseError) {
                console.error(`[StreamingTransformExecutor] Failed to parse string data from jsondoc:`, parseError);
                // Fall back to treating it as-is
            }
        }

        // Use consistent JSON formatting across the entire pipeline
        const { formatJsonConsistently } = await import('../../common/jsonFormatting.js');
        const originalJsonString = formatJsonConsistently(originalData);

        try {
            for await (const textDelta of textStream) {
                accumulatedText += textDelta;
                eagerParseAttempts++;

                // Always yield raw text chunk for debugging
                yield {
                    type: 'rawText',
                    textDelta,
                    accumulatedText,
                    templateName,
                    eagerParseAttempt: eagerParseAttempts
                };



                // EAGER PARSING: Try more frequently for patch-approval mode
                if (eagerParseAttempts % 3 === 0 || accumulatedText.length > 50) {
                    try {
                        // STEP 1: Apply text diff to stringified JSON data
                        const { applyContextDiffToJSON } = await import('../../common/contextDiff.js');
                        const modifiedJsonString = applyContextDiffToJSON(originalJsonString, accumulatedText);

                        if (modifiedJsonString && modifiedJsonString !== originalJsonString) {
                            // STEP 2: Use jsonrepair to parse resulting JSON (handled in applyContextDiffToJSON)
                            const modifiedData = JSON.parse(modifiedJsonString);

                            // STEP 3: Use rfc6902 to calculate patches
                            const { createPatch } = await import('rfc6902');
                            const eagerPatches = createPatch(originalData, modifiedData);

                            // DEBUG: Always log what's happening with patch generation
                            if (eagerPatches.length === 0) {
                                // Check if data actually changed
                                const originalHash = JSON.stringify(originalData).length;
                                const modifiedHash = JSON.stringify(modifiedData).length;
                            }

                            if (eagerPatches.length > 0 && JSON.stringify(eagerPatches) !== JSON.stringify(lastValidPatches)) {
                                // console.log(`[convertTextStreamToJsonPatches] Yielding ${eagerPatches.length} eager patches at attempt ${eagerParseAttempts}`);
                                lastValidPatches = eagerPatches;

                                // STEP 4: Emit patches
                                yield {
                                    type: 'eagerPatches',
                                    patches: eagerPatches,
                                    templateName,
                                    source: 'eager_parsing',
                                    attempt: eagerParseAttempts,
                                    textLength: accumulatedText.length
                                };
                            }
                        }
                    } catch (eagerError) {
                        // Expected for partial diffs - continue silently
                    }
                }
            }

            // FINAL CONVERSION: Use the exact same approach
            try {
                // STEP 1: Extract only the unified diff portion from accumulated text
                const { extractUnifiedDiffOnly } = await import('../../common/contextDiff.js');
                const cleanedDiff = extractUnifiedDiffOnly(accumulatedText);

                // STEP 2: Apply unified diff using the proven applyContextDiffToJSON method
                const { applyContextDiffToJSON } = await import('../../common/contextDiff.js');
                const finalModifiedJsonString = applyContextDiffToJSON(originalJsonString, cleanedDiff);

                if (finalModifiedJsonString) {
                    // STEP 2: Parse resulting JSON (already handled by applyContextDiffToJSON with jsonrepair)
                    const finalModifiedData = JSON.parse(finalModifiedJsonString);

                    // STEP 3: Use rfc6902 to calculate final patches
                    const { createPatch } = await import('rfc6902');
                    const finalPatches = createPatch(originalData, finalModifiedData);

                    // DEBUG: Essential info only
                    const dataChanged = JSON.stringify(originalData) !== JSON.stringify(finalModifiedData);

                    if (finalPatches.length === 0 && !dataChanged) {
                        // Write debug files for inspection if needed
                        const fs = await import('fs');
                        await fs.writeFileSync('./debug-streaming-accumulated-text.txt', accumulatedText);
                        await fs.writeFileSync('./debug-streaming-cleaned-diff.txt', cleanedDiff);
                        await fs.writeFileSync('./debug-streaming-original-string.txt', originalJsonString);
                        await fs.writeFileSync('./debug-streaming-modified-string.txt', finalModifiedJsonString);
                    }


                    // STEP 4: Emit final patches (always emit patches, even if empty - let the calling code decide)
                    // console.log(`[convertTextStreamToJsonPatches] Yielding final patches: ${finalPatches.length} patches`);
                    yield {
                        type: 'finalPatches',
                        patches: finalPatches,
                        templateName,
                        source: finalPatches.length > 0 ? 'final' : 'no_content_changes',
                        rawText: accumulatedText,
                        totalEagerAttempts: eagerParseAttempts
                    };
                } else {
                    // Failed to apply diff - fallback to last valid patches
                    yield {
                        type: 'finalPatches',
                        patches: lastValidPatches,
                        templateName,
                        source: 'diff_application_failed',
                        rawText: accumulatedText,
                        totalEagerAttempts: eagerParseAttempts
                    };
                }
            } catch (finalError) {
                console.error(`[StreamingTransformExecutor] Final conversion failed for ${templateName}:`, finalError);
                yield {
                    type: 'finalPatches',
                    patches: lastValidPatches,
                    templateName,
                    source: 'error',
                    rawText: accumulatedText,
                    error: finalError instanceof Error ? finalError.message : String(finalError),
                    totalEagerAttempts: eagerParseAttempts
                };
            }
        } catch (streamError) {
            console.error(`[StreamingTransformExecutor] Text stream error for ${templateName}:`, streamError);
            yield {
                type: 'error',
                patches: lastValidPatches,
                templateName,
                rawText: accumulatedText,
                error: streamError instanceof Error ? streamError.message : String(streamError),
                totalEagerAttempts: eagerParseAttempts
            };
        }
    }



    /**
     * Apply eager patches to original jsondoc with optimized streaming performance
     * Uses the same algorithm as regular patch application but with reduced overhead
     */
    private async applyEagerPatchesToOriginal<TOutput>(
        eagerPatches: any[],
        originalJsondoc: any,
        templateName: string,
        retryCount: number,
        projectId?: string,
        userId?: string,
        jsondocRepo?: TransformJsondocRepository,
        transformId?: string | null,
        transformRepo?: TransformJsondocRepository,
        dryRun?: boolean,
        chunkCount?: number
    ): Promise<any> {
        try {

            if (!eagerPatches || eagerPatches.length === 0) {
                return originalJsondoc;
            }

            // Use the same patch application logic as regular patches
            const originalCopy = deepClone(originalJsondoc);
            const patchResults = applyPatch(originalCopy, eagerPatches);

            // Check if all patches applied successfully
            const failedPatches = patchResults.filter(r => r.test === false);
            if (failedPatches.length === 0) {

                // Optionally create a lightweight patch jsondoc for eager patches (without full persistence overhead)
                if (!dryRun && projectId && transformId && jsondocRepo) {
                    try {
                        // Create a simplified patch record for lineage tracking
                        const eagerPatchData = {
                            patches: eagerPatches,
                            targetJsondocId: originalJsondoc.id || 'eager_target',
                            targetSchemaType: originalJsondoc.schema_type || 'eager_schema',
                            patchIndex: chunkCount || 0,
                            applied: true,
                            eager: true,
                            chunkCount: chunkCount || 0
                        };

                        // Create patch jsondoc with minimal metadata for performance
                        const eagerPatchJsondoc = await jsondocRepo.createJsondoc(
                            projectId,
                            'json_patch',
                            eagerPatchData,
                            'v1',
                            {
                                created_at: new Date().toISOString(),
                                template_name: templateName,
                                patch_index: chunkCount || 0,
                                applied: true,
                                eager_patch: true,
                                chunk_count: chunkCount || 0,
                                target_jsondoc_id: originalJsondoc.id || 'eager_target'
                            },
                            'completed', // Mark as completed immediately
                            'ai_generated'
                        );

                    } catch (eagerPatchError) {
                        console.warn(`[StreamingTransformExecutor] Failed to create eager patch jsondoc (non-critical):`, eagerPatchError);
                        // Don't fail the eager application for this
                    }
                }

                return originalCopy;
            } else {
                console.warn(`[StreamingTransformExecutor] EAGER PARTIAL: ${failedPatches.length}/${eagerPatches.length} patches failed at chunk ${chunkCount}`);
                console.warn(`[StreamingTransformExecutor] Failed eager patches:`, failedPatches);

                // For eager patches, we're more tolerant of partial failures
                // Return the partially modified data rather than throwing
                return originalCopy;
            }

        } catch (error) {
            console.error(`[StreamingTransformExecutor] Eager patch application failed for ${templateName} at chunk ${chunkCount}:`, error);
            // For eager patches, gracefully degrade to original data
            return originalJsondoc;
        }
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
     * Upsert patch jsondocs using op+path as stable identifier
     * Handles the fact that patches can change positions and content during streaming
     */
    private async upsertPatchJsondocs(
        patches: any[],
        originalJsondoc: any,
        templateName: string,
        projectId: string,
        transformId: string,
        jsondocRepo: TransformJsondocRepository,
        transformRepo: TransformJsondocRepository,
        chunkCount: number
    ): Promise<void> {
        // console.log(`[upsertPatchJsondocs] Called with ${patches.length} patches at chunk ${chunkCount}`);

        // Filter out empty or invalid patches
        const validPatches = patches.filter(patch =>
            patch &&
            typeof patch === 'object' &&
            patch.op &&
            patch.path &&
            Object.keys(patch).length > 0
        );
        // console.log(`[upsertPatchJsondocs] Valid patches after filtering: ${validPatches.length}`);

        if (validPatches.length === 0) {
            // console.log(`[upsertPatchJsondocs] No valid patches to upsert, returning empty array`);
            return;
        }

        // Step 1: Fetch all existing patch jsondocs for this transform
        const existingOutputs = await transformRepo.getTransformOutputs(transformId);
        const existingPatchIds = existingOutputs
            .filter(o => o.output_role === 'patch_output')
            .map(o => o.jsondoc_id);

        const existingPatches: Map<string, { id: string; hash: string }> = new Map();

        for (const jsondocId of existingPatchIds) {
            const jsondoc = await jsondocRepo.getJsondoc(jsondocId);
            if (jsondoc && jsondoc.schema_type === 'json_patch') {
                const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
                if (data.patches && Array.isArray(data.patches) && data.patches.length > 0) {
                    const patch = data.patches[0]; // We store one patch per jsondoc
                    const identifier = `${patch.op}:${patch.path}`;
                    const hash = (jsondoc.metadata as any)?.content_hash || '';
                    existingPatches.set(identifier, { id: jsondoc.id, hash });
                }
            }
        }

        // console.log(`[upsertPatchJsondocs] Found ${existingPatches.size} existing patches in DB`);

        // Step 2: Process new patches
        const newPatchMap: Map<string, { patch: any; hash: string; index: number }> = new Map();

        for (let i = 0; i < validPatches.length; i++) {
            const patch = validPatches[i];
            const identifier = `${patch.op}:${patch.path}`;
            const hash = this.hashPatch(patch);
            newPatchMap.set(identifier, { patch, hash, index: i });
        }

        // console.log(`[upsertPatchJsondocs] New patch set has ${newPatchMap.size} unique patches`);

        // Step 3: Determine operations needed
        const toDelete: string[] = [];
        const toUpdate: Array<{ id: string; patch: any; index: number }> = [];
        const toInsert: Array<{ patch: any; index: number }> = [];

        // Find patches to delete (in existing but not in new)
        for (const [identifier, existing] of existingPatches) {
            if (!newPatchMap.has(identifier)) {
                console.log(`[upsertPatchJsondocs] Deleting patch jsondoc ${existing.id} for ${identifier}`);
                toDelete.push(existing.id);
            }
        }

        // Find patches to update or insert
        for (const [identifier, newPatch] of newPatchMap) {
            const existing = existingPatches.get(identifier);
            if (existing) {
                // Check if content changed
                if (existing.hash !== newPatch.hash) {
                    toUpdate.push({ id: existing.id, patch: newPatch.patch, index: newPatch.index });
                }
            } else {
                // New patch
                console.log(`[upsertPatchJsondocs] Inserting patch jsondoc for ${identifier}`);
                toInsert.push({ patch: newPatch.patch, index: newPatch.index });
            }
        }

        // console.log(`[upsertPatchJsondocs] Operations - Delete: ${toDelete.length}, Update: ${toUpdate.length}, Insert: ${toInsert.length}`);

        // Step 4: Execute operations

        // Update changed patches
        for (const { id, patch, index } of toUpdate) {
            // console.log(`[upsertPatchJsondocs] Updating patch jsondoc ${id} for ${patch.op}:${patch.path}`);
            const patchData = {
                patches: [patch],
                targetJsondocId: originalJsondoc.id,
                targetSchemaType: originalJsondoc.schema_type,
                patchIndex: index,
                applied: false,
                chunkCount: chunkCount
            };

            await jsondocRepo.updateJsondoc(
                id,
                patchData,
                {
                    last_updated: new Date().toISOString(),
                    chunk_count: chunkCount,
                    patch_index: index,
                    template_name: templateName,
                    content_hash: this.hashPatch(patch)
                }
            );
        }

        // Insert new patches
        for (const { patch, index } of toInsert) {
            // console.log(`[upsertPatchJsondocs] Creating new patch jsondoc for ${patch.op}:${patch.path}`);
            const patchData = {
                patches: [patch],
                targetJsondocId: originalJsondoc.id,
                targetSchemaType: originalJsondoc.schema_type,
                patchIndex: index,
                applied: false,
                chunkCount: chunkCount
            };

            const patchJsondoc = await jsondocRepo.createJsondoc(
                projectId,
                'json_patch',
                patchData,
                'v1',
                {
                    created_at: new Date().toISOString(),
                    template_name: templateName,
                    patch_index: index,
                    applied: false,
                    target_jsondoc_id: originalJsondoc.id,
                    target_schema_type: originalJsondoc.schema_type,
                    chunk_count: chunkCount,
                    content_hash: this.hashPatch(patch)
                },
                'streaming',
                'ai_generated'
            );

            // Link patch jsondoc as output to the transform
            await transformRepo.addTransformOutputs(transformId, [
                { jsondocId: patchJsondoc.id, outputRole: 'patch_output' }
            ], projectId);

        }


        // Delete removed patches
        for (const jsondocId of toDelete) {
            // console.log(`[upsertPatchJsondocs] Deleting patch jsondoc ${jsondocId}`);
            try {
                // First remove the transform output reference
                const { db } = await import('../database/connection.js');
                await db
                    .deleteFrom('transform_outputs')
                    .where('transform_id', '=', transformId)
                    .where('jsondoc_id', '=', jsondocId)
                    .execute();

                // Then delete the jsondoc
                await jsondocRepo.deleteJsondoc(jsondocId);
            } catch (error) {
                console.warn(`[upsertPatchJsondocs] Failed to delete jsondoc ${jsondocId}:`, error);
            }
        }


        return;
    }

    /**
     * Generate a hash for a patch to detect content changes
     */
    private hashPatch(patch: any): string {
        // Simple hash based on stringified content
        const content = JSON.stringify(patch);
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
    }

    /**
     * Process the debug-context-diff.ts pipeline eagerly during streaming
     * This internalizes the working logic from debug-context-diff.ts
     */
    private async processDebugPipeline(
        streamingData: any,
        chunkCount: number,
    ): Promise<{
        rawLLMOutput: string;
        modifiedJson: string | null;
        patches: JsonPatchArray;
        chunkCount: number;
        status: string;
        originalJsonLength: number | null;
        modifiedJsonLength: number | null;
        patchCount: number | null;
        error?: string;
    }> {
        // Static cache for intermediate results to avoid recomputation
        if (!this._pipelineCache) {
            this._pipelineCache = {
                lastRawOutput: '',
                lastModifiedJson: null,
                lastPatches: [],
                lastChunkCount: 0
            };
        }

        try {
            // Extract raw text from streaming data
            let rawLLMOutput = '';
            if (streamingData?.type === 'rawText' && streamingData.accumulatedText) {
                rawLLMOutput = streamingData.accumulatedText;
            } else if (streamingData?.rawText) {
                rawLLMOutput = streamingData.rawText;
            } else if (typeof streamingData === 'string') {
                rawLLMOutput = streamingData;
            }

            // Only process if we have new content
            if (!rawLLMOutput || rawLLMOutput === this._pipelineCache.lastRawOutput) {
                return {
                    ...streamingData,
                    pipelineResults: {
                        rawLLMOutput: this._pipelineCache.lastRawOutput,
                        modifiedJson: this._pipelineCache.lastModifiedJson,
                        patches: this._pipelineCache.lastPatches,
                        chunkCount: this._pipelineCache.lastChunkCount,
                        status: 'cached'
                    }
                };
            }

            let originalData = this.originalJsondocForFinalConversion.data || this.originalJsondocForFinalConversion;

            // Handle case where jsondoc data is stored as a string in the database
            if (typeof originalData === 'string') {
                try {
                    originalData = JSON.parse(originalData);
                } catch (parseError) {
                    // Fall back to treating it as-is
                }
            }

            const { formatJsonConsistently } = await import('../../common/jsonFormatting.js');
            const originalJsonString = formatJsonConsistently(originalData);

            // Step 1: Apply context diff to JSON
            const { applyContextDiffToJSON } = await import('../../common/contextDiff.js');
            const modifiedJson = applyContextDiffToJSON(originalJsonString, rawLLMOutput);

            let patches: any[] = [];
            if (modifiedJson && modifiedJson !== originalJsonString) {
                // Step 2: Generate RFC6902 patches
                const { applyContextDiffAndGeneratePatches } = await import('../../common/contextDiff.js');
                const patchResult = applyContextDiffAndGeneratePatches(originalJsonString, rawLLMOutput);

                if (Array.isArray(patchResult)) {
                    patches = patchResult;
                } else if (patchResult && typeof patchResult === 'object' && 'rfc6902Patches' in patchResult) {
                    patches = (patchResult as any).rfc6902Patches || [];
                }
            }

            // Update cache with successful results
            this._pipelineCache = {
                lastRawOutput: rawLLMOutput,
                lastModifiedJson: modifiedJson,
                lastPatches: patches,
                lastChunkCount: chunkCount
            };

            return {
                rawLLMOutput,
                modifiedJson,
                patches,
                chunkCount,
                status: 'success',
                originalJsonLength: originalJsonString.length,
                modifiedJsonLength: modifiedJson?.length || 0,
                patchCount: patches.length
            }

        } catch (error) {
            console.warn(`[StreamingTransformExecutor] Pipeline processing error at chunk ${chunkCount}:`, error);
            // Return cached results on error
            return {
                rawLLMOutput: this._pipelineCache.lastRawOutput,
                modifiedJson: this._pipelineCache.lastModifiedJson,
                patches: this._pipelineCache.lastPatches,
                chunkCount: this._pipelineCache.lastChunkCount,
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
                originalJsonLength: null,
                modifiedJsonLength: null,
                patchCount: null
            };
        }
    }

    // Cache for pipeline results
    private _pipelineCache?: {
        lastRawOutput: string;
        lastModifiedJson: string | null;
        lastPatches: any[];
        lastChunkCount: number;
    };
}

/**
 * Convenience function for tool implementations
 */
export async function executeStreamingTransform<TInput, TOutput>(
    params: StreamingTransformParams<TInput, TOutput>
): Promise<StreamingTransformResult> {
    // Try to get global particle processor if available
    const { getParticleTemplateProcessor } = await import('./particles/ParticleSystemInitializer.js');
    const particleProcessor = getParticleTemplateProcessor() || undefined;

    const executor = new StreamingTransformExecutor(particleProcessor);
    return executor.executeStreamingTransform(params);
} 
