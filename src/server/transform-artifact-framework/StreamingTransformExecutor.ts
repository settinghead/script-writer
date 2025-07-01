import { z } from 'zod';
import { TemplateService } from '../services/templates/TemplateService';
import { LLMService } from './LLMService';
import { CachedLLMService, getCachedLLMService } from './CachedLLMService';
import { TransformRepository } from './TransformRepository';
import { ArtifactRepository } from './ArtifactRepository';

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
            maxTokens
        } = params;

        let transformId: string | null = null;
        let outputArtifactId: string | null = null;
        let outputLinked = false; // Track if we've linked the output artifact to transform

        try {
            // 1. Input validation against schema
            const validatedInput = config.inputSchema.parse(input);
            console.log(`[StreamingTransformExecutor] Input validated for template ${config.templateName}`);

            // 2. Create transform for this execution
            const transform = await transformRepo.createTransform(
                projectId,
                'llm',
                'v1',
                'running',
                {
                    template_name: config.templateName,
                    ...transformMetadata
                }
            );
            transformId = transform.id;

            // 3. Handle input artifacts: both source artifacts and tool input
            const transformInputs: Array<{ artifactId: string; inputRole: string }> = [];

            // 3a. Link source artifacts if specified by the tool
            if (config.extractSourceArtifacts) {
                const sourceArtifacts = config.extractSourceArtifacts(validatedInput);
                console.log(`[StreamingTransformExecutor] Linking ${sourceArtifacts.length} source artifacts for ${config.templateName}`);
                transformInputs.push(...sourceArtifacts);
            }

            // 3b. Create tool input artifact from tool parameters
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

            // 3c. Add all transform inputs at once
            await transformRepo.addTransformInputs(transformId, transformInputs, projectId);

            // 4. Create initial output artifact in streaming state
            const initialData = this.createInitialArtifactData(outputArtifactType, transformMetadata);
            const outputArtifact = await artifactRepo.createArtifact(
                projectId,
                outputArtifactType,
                initialData,
                'v1',
                {
                    started_at: new Date().toISOString(),
                    template_name: config.templateName,
                    ...transformMetadata
                },
                'streaming',
                'ai_generated'
            );
            outputArtifactId = outputArtifact.id;

            console.log(`[StreamingTransformExecutor] Created output artifact ${outputArtifactId} for ${config.templateName}`);

            // 5. Template rendering
            const template = this.templateService.getTemplate(config.templateName);
            if (!template) {
                throw new Error(`Template '${config.templateName}' not found`);
            }

            const templateVariables = config.prepareTemplateVariables(validatedInput);
            const finalPrompt = await this.templateService.renderTemplate(template, {
                params: templateVariables
            });

            // 6. Store the prompt
            await transformRepo.addLLMPrompts(transformId, [
                { promptText: finalPrompt, promptRole: 'primary' }
            ], projectId);

            console.log(`[StreamingTransformExecutor] Starting LLM streaming for ${config.templateName}...`);

            // 7. Execute streaming with single retry
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
                        // Transform LLM output to final artifact format if needed
                        const artifactData = config.transformLLMOutput
                            ? config.transformLLMOutput(partialData as TOutput, validatedInput)
                            : partialData;

                        await artifactRepo.updateArtifact(
                            outputArtifactId,
                            artifactData,
                            {
                                chunk_count: chunkCount,
                                last_updated: new Date().toISOString(),
                                update_count: ++updateCount
                            }
                        );
                        console.log(`[StreamingTransformExecutor] Updated artifact (update #${updateCount})`);

                        // Link output artifact to transform eagerly on first update
                        if (!outputLinked) {
                            try {
                                await transformRepo.addTransformOutputs(transformId, [
                                    { artifactId: outputArtifactId, outputRole: 'generated_output' }
                                ], projectId);
                                outputLinked = true;
                                console.log(`[StreamingTransformExecutor] Eagerly linked output artifact ${outputArtifactId} to transform`);
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

            const finalValidatedData = config.outputSchema.parse(lastData);

            // Transform LLM output to final artifact format if needed
            const finalArtifactData = config.transformLLMOutput
                ? config.transformLLMOutput(finalValidatedData, validatedInput)
                : finalValidatedData;

            await artifactRepo.updateArtifact(
                outputArtifactId,
                finalArtifactData,
                {
                    chunk_count: chunkCount,
                    completed_at: new Date().toISOString(),
                    total_updates: updateCount + 1
                },
                'completed'  // Mark as completed to trigger validation
            );

            // 10. Link output artifact to transform (if not already linked during streaming)
            if (!outputLinked) {
                await transformRepo.addTransformOutputs(transformId, [
                    { artifactId: outputArtifactId, outputRole: 'generated_output' }
                ], projectId);
                console.log(`[StreamingTransformExecutor] Linked output artifact ${outputArtifactId} to transform at completion`);
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
                    ...transform.execution_context,
                    completed_at: new Date().toISOString(),
                    output_artifact_id: outputArtifactId,
                    total_chunks: chunkCount,
                    total_updates: updateCount + 1
                }
            });

            console.log(`[StreamingTransformExecutor] Successfully completed ${config.templateName} with artifact ${outputArtifactId}`);

            return {
                outputArtifactId,
                finishReason: 'stop'
            };

        } catch (error) {
            console.error(`[StreamingTransformExecutor] Error executing ${config.templateName}:`, error);

            // Update transform status to failed
            if (transformId) {
                try {
                    await transformRepo.updateTransform(transformId, {
                        status: 'failed',
                        execution_context: {
                            error_message: error instanceof Error ? error.message : String(error),
                            failed_at: new Date().toISOString()
                        }
                    });
                } catch (statusUpdateError) {
                    console.error(`[StreamingTransformExecutor] Failed to update transform status:`, statusUpdateError);
                }
            }

            throw error;
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
            return await service.streamObject(streamOptions);
        } catch (error) {
            console.warn(`[StreamingTransformExecutor] First attempt failed for ${templateName}, retrying...`, error);

            // Single retry with the same service
            try {
                return await service.streamObject(streamOptions);
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
            'brainstorming': 'brainstorm_tool_input',
            'brainstorm_edit': 'brainstorm_edit_input',
            'outline': 'outline_generation_input',
            'outline_settings': 'outline_settings_input'
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