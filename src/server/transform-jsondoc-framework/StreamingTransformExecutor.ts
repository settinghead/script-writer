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
    // Context for final conversion to use the working algorithm
    private originalJsondocForFinalConversion: any = null;
    private llmServiceForFinalConversion: any = null;
    private originalMessagesForFinalConversion: any = null;
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

                // Store context for final conversion to use the working algorithm
                console.log(`[StreamingTransformExecutor] Execution mode:`, {
                    mode: executionMode?.mode,
                    hasOriginalJsondoc: !!(executionMode && executionMode.mode !== 'full-object' && 'originalJsondoc' in executionMode && executionMode.originalJsondoc),
                    originalJsondocId: executionMode && executionMode.mode !== 'full-object' && 'originalJsondoc' in executionMode ? executionMode.originalJsondoc?.id : 'N/A'
                });

                if (executionMode?.mode === 'patch-approval' && executionMode.originalJsondoc) {
                    this.originalJsondocForFinalConversion = executionMode.originalJsondoc;
                    this.llmServiceForFinalConversion = this.llmService;
                    console.log(`[StreamingTransformExecutor] Set originalJsondocForFinalConversion:`, executionMode.originalJsondoc.id);
                    // originalMessages will be set when they're built below
                } else {
                    const hasOriginal = executionMode && executionMode.mode !== 'full-object' && 'originalJsondoc' in executionMode && !!executionMode.originalJsondoc;
                    console.warn(`[StreamingTransformExecutor] Not setting originalJsondocForFinalConversion - mode: ${executionMode?.mode}, hasOriginal: ${hasOriginal}`);
                }

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

                // Keep minimal debug logging for diff templates
                if (config.templateName.includes('edit_diff')) {
                    console.log(`[DEBUG] Template context prepared for ${config.templateName}`);
                }

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
                        console.log(`[DEBUG] Saved prompt (${finalPrompt.length} chars) to: ${debugPromptPath}`);
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
                            console.log(`[StreamingTransformExecutor] Processing final patches at chunk ${chunkCount}: ${partialData.patches?.length || 0} patches from source: ${partialData.source}`);
                        } else if (partialData.type === 'patches') {
                            actualData = partialData.patches as TOutput;
                        } else if (partialData.type === 'eagerPatches') {
                            // EAGER PATCHES: Process immediately!
                            actualData = partialData.patches as TOutput;
                            isEagerPatch = true;
                            console.log(`[StreamingTransformExecutor] Processing eager patches at chunk ${chunkCount}: ${partialData.patches?.length || 0} patches from attempt ${partialData.attempt}`);
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
                    if (onStreamChunk && (isEagerPatch || isFinalPatch || chunkCount % updateIntervalChunks === 0)) {
                        try {
                            // Pass both the processed data and raw streaming info for debugging
                            const callbackData = streamingInfo || actualData;
                            await onStreamChunk(callbackData, chunkCount);
                        } catch (callbackError) {
                            console.warn(`[StreamingTransformExecutor] Streaming callback error at chunk ${chunkCount}:`, callbackError);
                        }
                    }

                    // EAGER PATCH PROCESSING: Apply immediately if we have eager patches
                    if (isEagerPatch && actualData && Array.isArray(actualData) && actualData.length > 0) {
                        try {
                            console.log(`[StreamingTransformExecutor] EAGER APPLICATION: Applying ${actualData.length} patches immediately at chunk ${chunkCount}`);

                            if (executionMode?.mode === 'patch') {
                                // Apply eager patches to original jsondoc immediately
                                const eagerResult = await this.applyEagerPatchesToOriginal(
                                    actualData,
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

                                if (eagerResult && !dryRun && outputJsondocId) {
                                    await jsondocRepo.updateJsondoc(
                                        outputJsondocId,
                                        eagerResult,
                                        {
                                            chunk_count: chunkCount,
                                            last_updated: new Date().toISOString(),
                                            update_count: ++updateCount,
                                            retry_count: retryCount,
                                            execution_mode: executionMode?.mode || 'full-object',
                                            eager_patch_applied: true,
                                            eager_patch_count: actualData.length
                                        }
                                    );
                                    console.log(`[StreamingTransformExecutor] EAGER SUCCESS: Applied ${actualData.length} patches and updated jsondoc ${outputJsondocId}`);
                                }
                            } else if (executionMode?.mode === 'patch-approval') {
                                // Create/update patch approval jsondocs immediately
                                await this.createStreamingPatchApprovalJsondocs(
                                    actualData as TOutput,
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
                                console.log(`[StreamingTransformExecutor] EAGER SUCCESS: Updated patch approval jsondocs with ${actualData.length} patches`);
                            }
                        } catch (eagerError) {
                            console.warn(`[StreamingTransformExecutor] EAGER FAILURE: Failed to apply eager patches at chunk ${chunkCount}:`, eagerError);
                            // Continue streaming - eager failures shouldn't stop the process
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
                                // In patch-approval mode, patch jsondocs are already created during eager processing
                                // Skip redundant streaming updates to prevent re-parsing failures
                                console.log(`[StreamingTransformExecutor] Patch-approval mode: Skipping streaming update at chunk ${chunkCount}`);
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
                        finalValidatedData as Operation[],
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
     * Convert context-based diff to JSON patches using the same simple 4-step approach
     */
    private async convertUnifiedDiffToJsonPatches(
        llmOutput: any,
        originalJsondoc: any,
        templateName: string,
        retryCount: number,
        llmService: any,
        originalMessages: any[]
    ): Promise<Operation[]> {
        try {
            // Extract unified diff from LLM output
            const diffString = this.extractUnifiedDiff(llmOutput);
            if (!diffString) {
                throw new Error('No unified diff found in LLM output');
            }

            // STEP 1: Apply text diff to stringified JSON data
            const originalData = originalJsondoc.data || originalJsondoc;
            const originalJsonString = JSON.stringify(originalData, null, 2);
            const modifiedJsonString = applyContextDiffToJSON(originalJsonString, diffString);

            if (!modifiedJsonString || modifiedJsonString === originalJsonString) {
                console.log(`[StreamingTransformExecutor] No changes detected in diff for ${templateName}`);
                return [];
            }

            // STEP 2: Parse resulting JSON (already handled by applyContextDiffToJSON with jsonrepair)
            const modifiedData = JSON.parse(modifiedJsonString);

            // STEP 3: Use rfc6902 to calculate patches
            const { createPatch } = await import('rfc6902');
            const jsonPatches = createPatch(originalData, modifiedData);

            console.log(`[StreamingTransformExecutor] Successfully converted unified diff to ${jsonPatches.length} JSON patches for ${templateName}`);
            return jsonPatches;

        } catch (error: any) {
            console.error(`[StreamingTransformExecutor] Failed to convert unified diff to JSON patches for ${templateName}:`, error);
            throw error;
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
            const messages = [{
                role: 'user' as const,
                content: prompt
            }];

            // Store messages for final conversion
            if (this.originalJsondocForFinalConversion) {
                this.originalMessagesForFinalConversion = messages;
            }

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

        const originalData = originalJsondoc.data || originalJsondoc;

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

                // DEBUG: Log eager parsing condition
                if (eagerParseAttempts <= 15 || eagerParseAttempts % 10 === 0) {
                    console.log(`[StreamingTransformExecutor] Chunk ${eagerParseAttempts}: textLength=${accumulatedText.length}, mod3=${eagerParseAttempts % 3}, condition=${eagerParseAttempts % 3 === 0 || accumulatedText.length > 50}`);
                }

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
                            console.log(`[StreamingTransformExecutor] Eager attempt ${eagerParseAttempts}: Generated ${eagerPatches.length} patches`);
                            if (eagerPatches.length === 0) {
                                // Check if data actually changed
                                const originalHash = JSON.stringify(originalData).length;
                                const modifiedHash = JSON.stringify(modifiedData).length;
                                console.log(`[StreamingTransformExecutor] No patches despite diff success - Original: ${originalHash} chars, Modified: ${modifiedHash} chars, Same: ${JSON.stringify(originalData) === JSON.stringify(modifiedData)}`);
                            }

                            if (eagerPatches.length > 0 && JSON.stringify(eagerPatches) !== JSON.stringify(lastValidPatches)) {
                                console.log(`[StreamingTransformExecutor] Eager parse SUCCESS for ${templateName}: ${eagerPatches.length} patches`);

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
                    console.log(`[StreamingTransformExecutor] Final conversion for ${templateName}: ${finalPatches.length} patches, data changed: ${dataChanged}`);

                    if (finalPatches.length === 0 && !dataChanged) {
                        // Write debug files for inspection if needed
                        const fs = await import('fs');
                        await fs.writeFileSync('./debug-streaming-accumulated-text.txt', accumulatedText);
                        await fs.writeFileSync('./debug-streaming-cleaned-diff.txt', cleanedDiff);
                        await fs.writeFileSync('./debug-streaming-original-string.txt', originalJsonString);
                        await fs.writeFileSync('./debug-streaming-modified-string.txt', finalModifiedJsonString);
                    }

                    console.log(`[StreamingTransformExecutor] Final conversion successful for ${templateName}: ${finalPatches.length} patches`);

                    // STEP 4: Emit final patches (always emit patches, even if empty - let the calling code decide)
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
        jsondocRepo?: JsondocRepository,
        transformId?: string | null,
        transformRepo?: TransformRepository,
        dryRun?: boolean,
        chunkCount?: number
    ): Promise<any> {
        try {
            console.log(`[StreamingTransformExecutor] Applying ${eagerPatches.length} eager patches for ${templateName} at chunk ${chunkCount}`);

            if (!eagerPatches || eagerPatches.length === 0) {
                console.log(`[StreamingTransformExecutor] No eager patches to apply`);
                return originalJsondoc;
            }

            // Use the same patch application logic as regular patches
            const originalCopy = deepClone(originalJsondoc);
            const patchResults = applyPatch(originalCopy, eagerPatches);

            // Check if all patches applied successfully
            const failedPatches = patchResults.filter(r => r.test === false);
            if (failedPatches.length === 0) {
                console.log(`[StreamingTransformExecutor] EAGER SUCCESS: Applied all ${eagerPatches.length} patches at chunk ${chunkCount}`);

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

                        console.log(`[StreamingTransformExecutor] Created eager patch jsondoc ${eagerPatchJsondoc.id} for chunk ${chunkCount}`);
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
            // For streaming patch approval, we might already have JSON patches in the llmOutput
            // Try to extract them directly first, fallback to unified diff conversion if needed
            let patches: any[] = [];

            // Check if llmOutput is already an array of patches (from eager parsing)
            if (Array.isArray(llmOutput) && llmOutput.length > 0) {
                // Validate that it looks like JSON patches
                const isJsonPatchArray = llmOutput.every((item: any) =>
                    item && typeof item === 'object' &&
                    'op' in item && 'path' in item &&
                    ['add', 'remove', 'replace', 'move', 'copy', 'test'].includes(item.op)
                );

                if (isJsonPatchArray) {
                    patches = llmOutput;
                    console.log(`[StreamingTransformExecutor] Using ${patches.length} patches directly from streaming data`);
                } else {
                    console.log(`[StreamingTransformExecutor] LLM output is array but not JSON patches, attempting diff conversion`);
                }
            }

            // If we don't have patches yet, try the unified diff approach
            if (patches.length === 0) {
                try {
                    patches = await this.convertUnifiedDiffToJsonPatches(
                        llmOutput,
                        originalJsondoc,
                        templateName,
                        retryCount,
                        this.llmService,
                        [] // Empty messages for streaming context
                    );
                } catch (diffError) {
                    console.warn(`[StreamingTransformExecutor] Unified diff conversion failed during streaming, skipping patch jsondoc creation:`, diffError);
                    // Don't throw - just skip patch jsondoc creation for this chunk
                    return;
                }
            }

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
        finalPatches: Operation[], // This is already the processed JSON patches array
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
            return;
        }

        try {
            // finalPatches is already the processed JSON patches array - no need to convert again

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

            // CRITICAL FIX: If we have more patches than existing jsondocs, create new ones
            if (finalPatches.length > patchOutputs.length) {
                console.log(`[StreamingTransformExecutor] Creating ${finalPatches.length - patchOutputs.length} missing patch jsondocs`);

                for (let i = patchOutputs.length; i < finalPatches.length; i++) {
                    const patch = finalPatches[i];

                    const patchData = {
                        patches: [patch], // Single patch per jsondoc
                        targetJsondocId: originalJsondoc.id || (() => {
                            throw new Error(`Missing originalJsondoc.id for new patch creation in template ${templateName}. originalJsondoc: ${JSON.stringify(originalJsondoc, null, 2)}`);
                        })(),
                        targetSchemaType: originalJsondoc.schema_type || (() => {
                            throw new Error(`Missing originalJsondoc.schema_type for new patch creation in template ${templateName}. originalJsondoc: ${JSON.stringify(originalJsondoc, null, 2)}`);
                        })(),
                        patchIndex: i,
                        applied: false,
                        chunkCount: chunkCount || 0,
                        streamingUpdate: false,
                        finalized: true
                    };

                    const patchJsondoc = await jsondocRepo.createJsondoc(
                        projectId,
                        'json_patch',
                        patchData,
                        'v1',
                        {
                            created_at: new Date().toISOString(),
                            completed_at: new Date().toISOString(),
                            template_name: templateName,
                            patch_index: i,
                            applied: false,
                            target_jsondoc_id: originalJsondoc.id,
                            target_schema_type: originalJsondoc.schema_type,
                            chunk_count: chunkCount || 0,
                            finalized: true
                        },
                        'completed', // Mark as completed immediately
                        'ai_generated'
                    );

                    // Link patch jsondoc as output to the transform
                    await transformRepo.addTransformOutputs(transformId, [
                        { jsondocId: patchJsondoc.id }
                    ], projectId);

                    console.log(`[StreamingTransformExecutor] Created new patch jsondoc ${patchJsondoc.id} (index ${i})`);
                }
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
