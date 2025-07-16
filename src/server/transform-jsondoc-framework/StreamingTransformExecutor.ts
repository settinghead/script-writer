import { z } from 'zod';
import { TemplateService } from '../services/templates/TemplateService';
import { LLMService } from './LLMService';
import { CachedLLMService, getCachedLLMService } from './CachedLLMService';
import { TransformRepository } from './TransformRepository';
import { JsondocRepository } from './JsondocRepository';
import { ParticleTemplateProcessor } from '../services/ParticleTemplateProcessor';
import { applyPatch, deepClone, Operation } from 'fast-json-patch';
import { TypedJsondoc } from '@/common/jsondocs';
import { dump } from 'js-yaml';

/**
 * Configuration for a streaming transform - minimal interface that tools provide
 */
export interface StreamingTransformConfig<TInput, TOutput> {
    templateName: string;  // 'brainstorming', 'brainstorm_edit', 'outline'
    inputSchema: z.ZodSchema<TInput>;
    outputSchema: z.ZodSchema<TOutput>;
    // OPTIONAL: Custom template variables function. If not provided, uses default schema-driven extraction
    prepareTemplateVariables?: (input: TInput, context?: any) => { params?: any; jsondocs?: any } | Promise<{ params?: any; jsondocs?: any }>;
    transformLLMOutput?: (llmOutput: TOutput, input: TInput) => any;  // Optional: transform LLM output before saving
}

/**
 * Default template variable extraction - automatically extracts all fields from input schema and jsondocs
 */
async function defaultPrepareTemplateVariables<TInput>(
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
                jsondocs[key] = {
                    description: jsondocRef.description,
                    schemaType: jsondocRef.schemaType,
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
    | { mode: 'patch', originalJsondoc: any };

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
}

/**
 * Result of a streaming transform execution
 */
export interface StreamingTransformResult {
    outputJsondocId: string;
    finishReason: string;
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
            onStreamChunk
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
                    const transform = await transformRepo.createTransform(
                        projectId,
                        'llm',
                        'v1',
                        'running',
                        {
                            template_name: config.templateName,
                            retry_count: retryCount,
                            max_retries: maxRetries,
                            ...transformMetadata
                        }
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
                    console.log(`[StreamingTransformExecutor] Dry run: Skipping transform creation/update for ${config.templateName}`);
                }

                // 3. Handle input jsondocs: both source jsondocs and tool input (only on first attempt)
                if (!dryRun && retryCount === 0) {
                    const transformInputs: Array<{ jsondocId: string; inputRole: string }> = [];

                    // 3a. Extract source jsondocs from input.jsondocs array
                    if ((validatedInput as any).jsondocs && Array.isArray((validatedInput as any).jsondocs)) {
                        for (const jsondocRef of (validatedInput as any).jsondocs) {
                            transformInputs.push({
                                jsondocId: jsondocRef.jsondocId,
                                inputRole: jsondocRef.description || 'source'
                            });
                        }
                    }

                    // 3b. Create tool input jsondoc from tool parameters (only if we don't have source jsondocs)
                    if (transformInputs.length === 0) {
                        const inputJsondocType = this.getInputJsondocType(config.templateName);
                        const inputJsondoc = await jsondocRepo.createJsondoc(
                            projectId,
                            inputJsondocType,
                            validatedInput,
                            'v1',
                            {},
                            'completed',
                            'user_input'
                        );
                        transformInputs.push({ jsondocId: inputJsondoc.id, inputRole: 'tool_input' });
                    }

                    // 3c. Add all transform inputs at once
                    if (!dryRun && transformId) {
                        await transformRepo.addTransformInputs(transformId, transformInputs, projectId);
                    } else if (dryRun) {
                        console.log(`[StreamingTransformExecutor] Dry run: Skipping transform inputs for ${config.templateName}`);
                    }
                }

                // 4. Create initial output jsondoc in streaming state (only on first attempt)
                if (!dryRun && !outputJsondocId) {
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
                    console.log(`[StreamingTransformExecutor] Dry run: Skipping initial output jsondoc creation for ${config.templateName}`);
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
                } else if (dryRun) {
                    console.log(`[StreamingTransformExecutor] Dry run: Skipping LLM prompt for ${config.templateName}`);
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
                    maxTokens
                });

                // 8. Process stream and update jsondoc periodically
                let chunkCount = 0;
                let updateCount = 0;
                let lastData: TOutput | null = null;

                for await (const partialData of stream) {
                    chunkCount++;
                    lastData = partialData as TOutput;

                    // Call streaming callback if provided
                    if (onStreamChunk) {
                        try {
                            await onStreamChunk(lastData, chunkCount);
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
                                    jsondocData = await this.applyPatchesToOriginal(
                                        partialData as TOutput,
                                        executionMode.originalJsondoc,
                                        config.templateName,
                                        retryCount
                                    );
                                } catch (patchError) {
                                    // If partial patch fails, keep original data and continue
                                    console.warn(`[StreamingTransformExecutor] Partial patch failed at chunk ${chunkCount}, continuing...`);
                                    jsondocData = executionMode.originalJsondoc;
                                }
                            } else {
                                // Transform LLM output to final jsondoc format if needed
                                jsondocData = config.transformLLMOutput
                                    ? config.transformLLMOutput(partialData as TOutput, validatedInput)
                                    : partialData;
                            }

                            if (!dryRun && outputJsondocId) {
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
                                console.log(`[StreamingTransformExecutor] Dry run: Skipping jsondoc update for ${config.templateName} at chunk ${chunkCount}`);
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
                    finalJsondocData = await this.applyPatchesToOriginal(
                        finalValidatedData,
                        executionMode.originalJsondoc,
                        config.templateName,
                        retryCount
                    );
                } else {
                    // Transform LLM output to final jsondoc format if needed (full-object mode)
                    finalJsondocData = config.transformLLMOutput
                        ? config.transformLLMOutput(finalValidatedData, validatedInput)
                        : finalValidatedData;
                }

                if (!dryRun && outputJsondocId) {
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
                } else if (dryRun) {
                    console.log(`[StreamingTransformExecutor] Dry run: Skipping all database operations for ${config.templateName}`);
                }

                return {
                    outputJsondocId: outputJsondocId || 'dry-run-no-output',
                    finishReason: 'stop'
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
     * Apply patches to original jsondoc with retry fallback mechanisms
     */
    private async applyPatchesToOriginal<TOutput>(
        llmOutput: TOutput,
        originalJsondoc: any,
        templateName: string,
        retryCount: number
    ): Promise<any> {
        try {
            // First, try JSON Patch format
            const patches = this.extractJsonPatches(llmOutput);
            if (patches && patches.length > 0) {
                console.log(`[StreamingTransformExecutor] Applying ${patches.length} JSON patches for ${templateName}`);

                const originalCopy = deepClone(originalJsondoc);
                const patchResults = applyPatch(originalCopy, patches);

                // Check if all patches applied successfully
                const failedPatches = patchResults.filter(r => r.test === false);
                if (failedPatches.length === 0) {
                    console.log(`[StreamingTransformExecutor] Successfully applied all JSON patches`);
                    return originalCopy;
                } else {
                    throw new Error(`Failed to apply ${failedPatches.length} JSON patches`);
                }
            }

            // If no valid JSON patches, try diff format (fallback)
            const diffText = this.extractDiffText(llmOutput);
            if (diffText) {
                console.log(`[StreamingTransformExecutor] Attempting diff format fallback for ${templateName}`);
                return this.applyDiffFormat(originalJsondoc, diffText);
            }

            throw new Error('No valid patches or diff found in LLM output');

        } catch (error) {
            console.error(`[StreamingTransformExecutor] Patch application failed for ${templateName} (attempt ${retryCount + 1}):`, error);
            throw error;
        }
    }

    /**
     * Extract JSON patches from LLM output with validation
     */
    private extractJsonPatches(llmOutput: any): Operation[] | null {
        try {
            let patches: any[] | null = null;

            // Handle different possible formats
            if (Array.isArray(llmOutput)) {
                patches = llmOutput;
            } else if (llmOutput.patches && Array.isArray(llmOutput.patches)) {
                patches = llmOutput.patches;
            } else if (llmOutput.data && Array.isArray(llmOutput.data)) {
                patches = llmOutput.data;
            }

            if (!patches) {
                return null;
            }

            // Validate each patch to ensure it's complete
            const validPatches = patches.filter(patch => {
                if (!patch || typeof patch !== 'object') {
                    return false;
                }

                // Check for required properties
                if (!patch.op || typeof patch.op !== 'string') {
                    return false;
                }

                if (!patch.path || typeof patch.path !== 'string') {
                    return false;
                }

                // Operations that require a value
                if (['add', 'replace', 'test'].includes(patch.op)) {
                    if (patch.value === undefined) {
                        return false;
                    }
                }

                // Operations that require a from path
                if (['move', 'copy'].includes(patch.op)) {
                    if (!patch.from || typeof patch.from !== 'string') {
                        return false;
                    }
                }

                return true;
            });

            // Only return patches if we have at least one valid patch
            return validPatches.length > 0 ? validPatches as Operation[] : null;
        } catch (error) {
            console.warn(`[StreamingTransformExecutor] Failed to extract JSON patches:`, error);
            return null;
        }
    }

    /**
     * Extract diff text from LLM output for fallback
     */
    private extractDiffText(llmOutput: any): string | null {
        try {
            if (typeof llmOutput === 'string') {
                return llmOutput;
            }

            if (llmOutput.diff && typeof llmOutput.diff === 'string') {
                return llmOutput.diff;
            }

            if (llmOutput.text && typeof llmOutput.text === 'string') {
                return llmOutput.text;
            }

            return null;
        } catch (error) {
            console.warn(`[StreamingTransformExecutor] Failed to extract diff text:`, error);
            return null;
        }
    }

    /**
     * Apply diff format patches (fallback mechanism)
     */
    private applyDiffFormat(originalJsondoc: any, diffText: string): any {
        // This is a simplified diff parser - in production you might want a more robust solution
        try {
            const originalJson = JSON.stringify(originalJsondoc, null, 2);

            // Look for @@ diff markers and apply simple text replacements
            const lines = diffText.split('\n');
            let modifiedJson = originalJson;

            for (const line of lines) {
                if (line.startsWith('-') && !line.startsWith('---')) {
                    // Remove line
                    const removeText = line.substring(1).trim();
                    modifiedJson = modifiedJson.replace(removeText, '');
                } else if (line.startsWith('+') && !line.startsWith('+++')) {
                    // Add line - this is simplified, real diff would need context
                    const addText = line.substring(1).trim();
                    // Simple heuristic: if it looks like a JSON property, try to merge it
                    if (addText.includes(':') && addText.includes('"')) {
                        // This is a very basic approach - production would need proper diff parsing
                        console.warn(`[StreamingTransformExecutor] Diff fallback is basic - line: ${addText}`);
                    }
                }
            }

            try {
                return JSON.parse(modifiedJson);
            } catch (parseError) {
                throw new Error(`Failed to parse modified JSON from diff: ${parseError}`);
            }

        } catch (error) {
            throw new Error(`Diff format application failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Execute streaming with single retry on failure
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
    }) {
        const {
            prompt,
            schema,
            templateName,
            enableCaching = false,
            seed,
            temperature,
            topP,
            maxTokens
        } = options;

        // Get model instance for explicit parameter passing
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
 * Map template names to their correct input jsondoc types
 */
    private getInputJsondocType(templateName: string): TypedJsondoc['schema_type'] {
        const inputJsondocTypeMap: Record<string, TypedJsondoc['schema_type']> = {
            'brainstorming': 'brainstorm_input_params',
            'brainstorm_edit': 'brainstorm_input_params',
            'outline': 'outline_settings',
            'outline_settings': 'outline_settings',
            'chronicles': 'chronicles'
        };

        return inputJsondocTypeMap[templateName] || `${templateName}_input`;
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