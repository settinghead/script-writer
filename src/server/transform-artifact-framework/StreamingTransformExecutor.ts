import { z } from 'zod';
import { TemplateService } from '../services/templates/TemplateService';
import { LLMService } from './LLMService';
import { CachedLLMService, getCachedLLMService } from './CachedLLMService';
import { TransformRepository } from './TransformRepository';
import { ArtifactRepository } from './ArtifactRepository';
import { applyPatch, deepClone, Operation } from 'fast-json-patch';

/**
 * Configuration for a streaming transform - minimal interface that tools provide
 */
export interface StreamingTransformConfig<TInput, TOutput> {
    templateName: string;  // 'brainstorming', 'brainstorm_edit', 'outline'
    inputSchema: z.ZodSchema<TInput>;
    outputSchema: z.ZodSchema<TOutput>;
    prepareTemplateVariables: (input: TInput, context?: any) => Record<string, string>;
    transformLLMOutput?: (llmOutput: TOutput, input: TInput) => any;  // Optional: transform LLM output to final artifact format

    // NEW: Optional function to extract source artifact IDs from tool input
    // Return array of {artifactId, inputRole} for linking existing artifacts as transform inputs
    extractSourceArtifacts?: (input: TInput) => Array<{
        artifactId: string;
        inputRole: string;  // e.g., 'source', 'reference', 'context'
    }>;
}

/**
 * Execution mode for streaming transforms
 */
export type StreamingExecutionMode =
    | { mode: 'full-object' }
    | { mode: 'patch', originalArtifact: any };

/**
 * Parameters for executing a streaming transform
 */
export interface StreamingTransformParams<TInput, TOutput> {
    config: StreamingTransformConfig<TInput, TOutput>;
    input: TInput;
    projectId: string;
    userId: string;
    transformRepo: TransformRepository;
    artifactRepo: ArtifactRepository;
    outputArtifactType: string;  // e.g., 'brainstorm_idea_collection', 'outline'
    transformMetadata?: Record<string, any>;  // tool-specific metadata
    updateIntervalChunks?: number;  // How often to update artifact (default: 3)
    // Caching options
    enableCaching?: boolean;  // Enable LLM response caching (default: false)
    seed?: number;  // Seed for deterministic outputs
    temperature?: number;  // LLM temperature
    topP?: number;  // LLM top-p sampling
    maxTokens?: number;  // LLM max tokens
    // NEW: Execution mode for patch vs full-object generation
    executionMode?: StreamingExecutionMode;
}

/**
 * Result of a streaming transform execution
 */
export interface StreamingTransformResult {
    outputArtifactId: string;
    finishReason: string;
}

/**
 * Core streaming transform executor - handles all the boilerplate for streaming tools
 */
export class StreamingTransformExecutor {
    private templateService: TemplateService;
    private llmService: LLMService;
    private cachedLLMService: CachedLLMService;

    constructor() {
        this.templateService = new TemplateService();
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
            artifactRepo,
            outputArtifactType,
            transformMetadata = {},
            updateIntervalChunks = 3,
            enableCaching = false,
            seed,
            temperature,
            topP,
            maxTokens,
            executionMode
        } = params;

        let transformId: string | null = null;
        let outputArtifactId: string | null = null;
        let outputLinked = false; // Track if we've linked the output artifact to transform
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount <= maxRetries) {
            try {
                // 1. Input validation against schema
                const validatedInput = config.inputSchema.parse(input);

                // 2. Create transform for this execution (or update existing one on retry)
                if (!transformId) {
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
                } else {
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
                }

                // 3. Handle input artifacts: both source artifacts and tool input (only on first attempt)
                if (retryCount === 0) {
                    const transformInputs: Array<{ artifactId: string; inputRole: string }> = [];

                    // 3a. Link source artifacts if specified by the tool
                    if (config.extractSourceArtifacts) {
                        const sourceArtifacts = config.extractSourceArtifacts(validatedInput);
                        transformInputs.push(...sourceArtifacts);
                    }

                    // 3b. Create tool input artifact from tool parameters (only if we don't have source artifacts)
                    // For tools that use source artifacts, we don't need a separate tool input artifact
                    if (!config.extractSourceArtifacts || config.extractSourceArtifacts(validatedInput).length === 0) {
                        const inputArtifactType = this.getInputArtifactType(config.templateName);
                        const inputArtifact = await artifactRepo.createArtifact(
                            projectId,
                            inputArtifactType,
                            validatedInput,
                            'v1',
                            {},
                            'completed',
                            'user_input'
                        );
                        transformInputs.push({ artifactId: inputArtifact.id, inputRole: 'tool_input' });
                    }

                    // 3c. Add all transform inputs at once
                    await transformRepo.addTransformInputs(transformId, transformInputs, projectId);
                }

                // 4. Create initial output artifact in streaming state (only on first attempt)
                if (!outputArtifactId) {
                    let initialData: any;
                    if (executionMode?.mode === 'patch') {
                        // In patch mode, start with the original artifact data
                        initialData = deepClone(executionMode.originalArtifact);
                    } else {
                        // In full-object mode, use empty structure
                        initialData = this.createInitialArtifactData(outputArtifactType, transformMetadata);
                    }

                    const outputArtifact = await artifactRepo.createArtifact(
                        projectId,
                        outputArtifactType,
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
                    outputArtifactId = outputArtifact.id;
                }

                // 5. Template rendering
                const template = this.templateService.getTemplate(config.templateName);
                if (!template) {
                    throw new Error(`Template '${config.templateName}' not found`);
                }

                const templateVariables = config.prepareTemplateVariables(validatedInput);
                const finalPrompt = await this.templateService.renderTemplate(template, {
                    params: templateVariables
                });

                // 6. Store the prompt (only on first attempt)
                if (retryCount === 0) {
                    await transformRepo.addLLMPrompts(transformId, [
                        { promptText: finalPrompt, promptRole: 'primary' }
                    ], projectId);
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

                // 8. Process stream and update artifact periodically
                let chunkCount = 0;
                let updateCount = 0;
                let lastData: TOutput | null = null;

                for await (const partialData of stream) {
                    chunkCount++;
                    lastData = partialData as TOutput;

                    // Update artifact every N chunks or if this is the final chunk
                    if (chunkCount % updateIntervalChunks === 0) {
                        try {
                            let artifactData: any;
                            if (executionMode?.mode === 'patch') {
                                // In patch mode, try to apply partial patches (may fail, that's ok)
                                try {
                                    artifactData = await this.applyPatchesToOriginal(
                                        partialData as TOutput,
                                        executionMode.originalArtifact,
                                        config.templateName,
                                        retryCount
                                    );
                                } catch (patchError) {
                                    // If partial patch fails, keep original data and continue
                                    console.warn(`[StreamingTransformExecutor] Partial patch failed at chunk ${chunkCount}, continuing...`);
                                    artifactData = executionMode.originalArtifact;
                                }
                            } else {
                                // Transform LLM output to final artifact format if needed
                                artifactData = config.transformLLMOutput
                                    ? config.transformLLMOutput(partialData as TOutput, validatedInput)
                                    : partialData;
                            }

                            await artifactRepo.updateArtifact(
                                outputArtifactId,
                                artifactData,
                                {
                                    chunk_count: chunkCount,
                                    last_updated: new Date().toISOString(),
                                    update_count: ++updateCount,
                                    retry_count: retryCount,
                                    execution_mode: executionMode?.mode || 'full-object'
                                }
                            );

                            // Link output artifact to transform eagerly on first update
                            if (!outputLinked) {
                                try {
                                    await transformRepo.addTransformOutputs(transformId, [
                                        { artifactId: outputArtifactId, outputRole: 'generated_output' }
                                    ], projectId);
                                    outputLinked = true;
                                } catch (linkError) {
                                    console.warn(`[StreamingTransformExecutor] Failed to link output artifact during streaming:`, linkError);
                                    // Don't throw - we'll retry at completion
                                }
                            }
                        } catch (updateError) {
                            console.warn(`[StreamingTransformExecutor] Failed to update artifact at chunk ${chunkCount}:`, updateError);
                        }
                    }
                }

                // 9. Final validation and artifact update
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
                let finalArtifactData: any;
                if (executionMode?.mode === 'patch') {
                    // Apply patches to original artifact
                    finalArtifactData = await this.applyPatchesToOriginal(
                        finalValidatedData,
                        executionMode.originalArtifact,
                        config.templateName,
                        retryCount
                    );
                } else {
                    // Transform LLM output to final artifact format if needed (full-object mode)
                    finalArtifactData = config.transformLLMOutput
                        ? config.transformLLMOutput(finalValidatedData, validatedInput)
                        : finalValidatedData;
                }

                await artifactRepo.updateArtifact(
                    outputArtifactId,
                    finalArtifactData,
                    {
                        chunk_count: chunkCount,
                        completed_at: new Date().toISOString(),
                        total_updates: updateCount + 1,
                        retry_count: retryCount
                    },
                    'completed'  // Mark as completed to trigger validation
                );

                // 10. Link output artifact to transform (if not already linked during streaming)
                if (!outputLinked) {
                    await transformRepo.addTransformOutputs(transformId, [
                        { artifactId: outputArtifactId, outputRole: 'generated_output' }
                    ], projectId);
                }

                // 11. Store LLM metadata (simplified - we don't have detailed usage from streaming)
                await transformRepo.addLLMTransform({
                    transform_id: transformId,
                    model_name: 'streaming_model',
                    raw_response: JSON.stringify(finalValidatedData), // Store LLM output, not transformed
                    token_usage: null,
                    project_id: projectId
                });

                // 12. Mark transform as completed
                await transformRepo.updateTransform(transformId, {
                    status: 'completed',
                    execution_context: {
                        template_name: config.templateName,
                        completed_at: new Date().toISOString(),
                        output_artifact_id: outputArtifactId,
                        total_chunks: chunkCount,
                        total_updates: updateCount + 1,
                        retry_count: retryCount,
                        max_retries: maxRetries
                    }
                });

                return {
                    outputArtifactId,
                    finishReason: 'stop'
                };

            } catch (error) {
                console.error(`[StreamingTransformExecutor] Error executing ${config.templateName} (attempt ${retryCount + 1}):`, error);

                retryCount++;

                // If we've exhausted all retries, mark as permanently failed
                if (retryCount > maxRetries) {
                    console.error(`[StreamingTransformExecutor] All ${maxRetries + 1} attempts failed for ${config.templateName}`);

                    // Update transform status to failed
                    if (transformId) {
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

                    // Mark output artifact as failed if it exists
                    if (outputArtifactId) {
                        try {
                            await artifactRepo.updateArtifact(
                                outputArtifactId,
                                {},
                                {
                                    error_message: error instanceof Error ? error.message : String(error),
                                    failed_at: new Date().toISOString(),
                                    retry_count: retryCount - 1
                                },
                                'failed'
                            );
                        } catch (artifactUpdateError) {
                            console.error(`[StreamingTransformExecutor] Failed to update artifact status:`, artifactUpdateError);
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
     * Apply patches to original artifact with retry fallback mechanisms
     */
    private async applyPatchesToOriginal<TOutput>(
        llmOutput: TOutput,
        originalArtifact: any,
        templateName: string,
        retryCount: number
    ): Promise<any> {
        try {
            // First, try JSON Patch format
            const patches = this.extractJsonPatches(llmOutput);
            if (patches && patches.length > 0) {
                console.log(`[StreamingTransformExecutor] Applying ${patches.length} JSON patches for ${templateName}`);

                const originalCopy = deepClone(originalArtifact);
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
                return this.applyDiffFormat(originalArtifact, diffText);
            }

            throw new Error('No valid patches or diff found in LLM output');

        } catch (error) {
            console.error(`[StreamingTransformExecutor] Patch application failed for ${templateName} (attempt ${retryCount + 1}):`, error);
            throw error;
        }
    }

    /**
     * Extract JSON patches from LLM output
     */
    private extractJsonPatches(llmOutput: any): Operation[] | null {
        try {
            // Handle different possible formats
            if (Array.isArray(llmOutput)) {
                return llmOutput as Operation[];
            }

            if (llmOutput.patches && Array.isArray(llmOutput.patches)) {
                return llmOutput.patches as Operation[];
            }

            if (llmOutput.data && Array.isArray(llmOutput.data)) {
                return llmOutput.data as Operation[];
            }

            return null;
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
    private applyDiffFormat(originalArtifact: any, diffText: string): any {
        // This is a simplified diff parser - in production you might want a more robust solution
        try {
            const originalJson = JSON.stringify(originalArtifact, null, 2);

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
 * Map template names to their correct input artifact types
 */
    private getInputArtifactType(templateName: string): string {
        const inputArtifactTypeMap: Record<string, string> = {
            'brainstorming': 'brainstorm_input_params',
            'brainstorm_edit': 'brainstorm_edit_input',
            'outline': 'outline_generation_input',
            'outline_settings': 'outline_settings_input',
            'chronicles': 'chronicles_input'
        };

        return inputArtifactTypeMap[templateName] || `${templateName}_input`;
    }

    /**
     * Create initial data structure for different artifact types (universal JSON handling)
     * Can be customized by passing initialData in transformMetadata
     * Since validation is skipped during streaming, we can use simple empty structures
     */
    private createInitialArtifactData(artifactType: string, transformMetadata?: Record<string, any>): any {
        // If custom initial data is provided, use it
        if (transformMetadata?.initialData) {
            return transformMetadata.initialData;
        }

        // Universal approach - simple empty structures since validation is skipped during streaming
        if (artifactType.includes('collection') || artifactType.includes('array')) {
            return [];  // Array-based artifacts
        } else {
            return {};  // Object-based artifacts
        }
    }
}

/**
 * Convenience function for tool implementations
 */
export async function executeStreamingTransform<TInput, TOutput>(
    params: StreamingTransformParams<TInput, TOutput>
): Promise<StreamingTransformResult> {
    const executor = new StreamingTransformExecutor();
    return executor.executeStreamingTransform(params);
} 