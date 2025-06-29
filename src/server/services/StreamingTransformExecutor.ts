import { z } from 'zod';
import { TemplateService } from './templates/TemplateService';
import { LLMService } from './LLMService';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';

/**
 * Configuration for a streaming transform - minimal interface that tools provide
 */
export interface StreamingTransformConfig<TInput, TOutput> {
    templateName: string;  // 'brainstorming', 'brainstorm_edit', 'outline'
    inputSchema: z.ZodSchema<TInput>;
    outputSchema: z.ZodSchema<TOutput>;
    prepareTemplateVariables: (input: TInput, context?: any) => Record<string, string>;
    transformLLMOutput?: (llmOutput: TOutput, input: TInput) => any;  // Optional: transform LLM output to final artifact format
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

    constructor() {
        this.templateService = new TemplateService();
        this.llmService = new LLMService();
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
            updateIntervalChunks = 3
        } = params;

        let transformId: string | null = null;
        let outputArtifactId: string | null = null;

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

            // 3. Create and link input artifact
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
            await transformRepo.addTransformInputs(transformId, [
                { artifactId: inputArtifact.id, inputRole: 'tool_input' }
            ], projectId);

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
                templateName: config.templateName
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

            // 10. Link output artifact to transform
            await transformRepo.addTransformOutputs(transformId, [
                { artifactId: outputArtifactId, outputRole: 'generated_output' }
            ], projectId);

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
    }) {
        const { prompt, schema, templateName } = options;

        try {
            return await this.llmService.streamObject({
                prompt,
                schema: schema as any
            });
        } catch (error) {
            console.warn(`[StreamingTransformExecutor] First attempt failed for ${templateName}, retrying...`, error);

            // Single retry
            try {
                return await this.llmService.streamObject({
                    prompt,
                    schema: schema as any
                });
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
            'outline': 'outline_generation_input'
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