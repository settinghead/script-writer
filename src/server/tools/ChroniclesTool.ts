import { z } from 'zod';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import {
    ChroniclesInputSchema,
    ChroniclesInput,
    ChroniclesOutputSchema,
    ChroniclesOutput
} from '../../common/schemas/outlineSchemas';
import {
    ChroniclesEditInputSchema,
    ChroniclesEditInput,
    JsonPatchOperationsSchema,
    JsonPatchOperation
} from '../../common/schemas/transforms';
import {
    executeStreamingTransform,
    StreamingTransformConfig
} from '../transform-jsondoc-framework/StreamingTransformExecutor';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { TypedJsondoc } from '@/common/jsondocs';
import { defaultPrepareTemplateVariables } from '../transform-jsondoc-framework/StreamingTransformExecutor';
import { createJsondocProcessor } from './shared/JsondocProcessor';

const ChroniclesToolResultSchema = z.object({
    outputJsondocId: z.string(),
    finishReason: z.string()
});

const ChroniclesEditToolResultSchema = z.object({
    outputJsondocId: z.string(),
    finishReason: z.string(),
    originalChronicles: z.object({
        stageCount: z.number(),
        firstStageTitle: z.string().optional(),
        // Add other key fields for reference
    }).optional(),
    editedChronicles: z.object({
        stageCount: z.number(),
        firstStageTitle: z.string().optional(),
        // Add other key fields for reference
    }).optional()
});

interface ChroniclesToolResult {
    outputJsondocId: string;
    finishReason: string;
}

export type ChroniclesEditToolResult = z.infer<typeof ChroniclesEditToolResultSchema>;

/**
 * Extract source chronicles data from different jsondoc types
 */
async function extractSourceChroniclesData(
    params: ChroniclesEditInput,
    jsondocRepo: TransformJsondocRepository,
    userId: string
): Promise<{
    originalChronicles: any;
    additionalContexts: any[];
    stageCount: number;
    firstStageTitle: string;
}> {
    let originalChronicles: any;
    let additionalContexts: any[] = [];
    let stageCount = 0;
    let firstStageTitle = '';

    for (const [index, jsondocRef] of params.jsondocs.entries()) {
        const sourceJsondoc = await jsondocRepo.getJsondoc(jsondocRef.jsondocId);
        if (!sourceJsondoc) {
            throw new Error(`Jsondoc ${jsondocRef.jsondocId} not found`);
        }

        const hasAccess = await jsondocRepo.userHasProjectAccess(userId, sourceJsondoc.project_id);
        if (!hasAccess) {
            throw new Error(`Access denied to jsondoc ${jsondocRef.jsondocId}`);
        }

        const sourceData = sourceJsondoc.data;

        if (index === 0) { // First is always the chronicles
            originalChronicles = sourceData;
            stageCount = sourceData.stages ? sourceData.stages.length : 0;
            firstStageTitle = sourceData.stages && sourceData.stages.length > 0 ? sourceData.stages[0].title || '' : '';
        } else {
            // Additional contexts (e.g., updated 故事设定)
            additionalContexts.push({
                description: jsondocRef.description,
                data: sourceData
            });
        }
    }

    if (!originalChronicles) {
        throw new Error('No chronicles jsondoc provided');
    }

    return { originalChronicles, additionalContexts, stageCount, firstStageTitle };
}

/**
 * Factory function that creates a chronicles edit tool definition using JSON patch
 */
export function createChroniclesEditToolDefinition(
    transformRepo: TransformJsondocRepository,
    jsondocRepo: TransformJsondocRepository,
    projectId: string,
    userId: string,
    cachingOptions?: {
        enableCaching?: boolean;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }
): StreamingToolDefinition<ChroniclesEditInput, ChroniclesEditToolResult> {
    return {
        name: 'edit_时间顺序大纲',
        description: '编辑和改进现有时间顺序大纲。适用场景：用户对现有时间顺序大纲有具体的修改要求或改进建议，如修改时间线、调整角色发展、更新情节推进等。使用JSON Patch格式进行精确修改，只改变需要改变的部分。系统会自动处理相关的上下文信息。',
        inputSchema: ChroniclesEditInputSchema,
        outputSchema: ChroniclesEditToolResultSchema,
        execute: async (params: ChroniclesEditInput, { toolCallId }): Promise<ChroniclesEditToolResult> => {
            const sourceJsondocRef = params.jsondocs[0];
            console.log(`[ChroniclesEditTool] Starting JSON patch edit for jsondoc ${sourceJsondocRef.jsondocId}`);

            // Extract source chronicles data for context
            const { originalChronicles, additionalContexts, stageCount, firstStageTitle } = await extractSourceChroniclesData(params, jsondocRepo, userId);

            // Determine output jsondoc type
            const sourceJsondoc = await jsondocRepo.getJsondoc(sourceJsondocRef.jsondocId);
            if (!sourceJsondoc) {
                throw new Error('Source jsondoc not found');
            }

            const outputJsondocType: TypedJsondoc['schema_type'] = 'chronicles';

            // Create config for JSON patch generation
            const config: StreamingTransformConfig<ChroniclesEditInput, JsonPatchOperation[]> = {
                templateName: 'chronicles_edit_diff',
                inputSchema: ChroniclesEditInputSchema,
                outputSchema: JsonPatchOperationsSchema, // JSON patch operations for external output
                prepareTemplateVariables: async (input) => {
                    // DRY: use shared builder so editRequirements are enriched consistently
                    const { buildToolTemplateContext } = await import('../services/TemplateContextBuilder.js');
                    const context = await buildToolTemplateContext({
                        toolName: 'edit_时间顺序大纲',
                        projectId,
                        userId,
                        input,
                        jsondocRepo,
                        transformRepo
                    });
                    return {
                        ...context,
                        additionalContexts
                    };
                }
            };

            try {
                // Execute the streaming transform with patch mode
                const result = await executeStreamingTransform({
                    config,
                    input: params,
                    projectId,
                    userId,
                    transformRepo,
                    jsondocRepo,
                    outputJsondocType,
                    executionMode: {
                        mode: 'patch-approval',
                        originalJsondoc: originalChronicles
                    },
                    transformMetadata: {
                        toolName: 'edit_时间顺序大纲',
                        source_jsondoc_id: sourceJsondocRef.jsondocId,
                        edit_requirements: params.editRequirements,
                        original_chronicles: originalChronicles,
                        stage_count: stageCount,
                        first_stage_title: firstStageTitle,
                        method: 'json_patch',
                        source_jsondoc_type: sourceJsondoc.schema_type,
                        output_jsondoc_type: outputJsondocType,
                        additionalContexts: additionalContexts
                    },
                    enableCaching: cachingOptions?.enableCaching,
                    seed: cachingOptions?.seed,
                    temperature: cachingOptions?.temperature,
                    topP: cachingOptions?.topP,
                    maxTokens: cachingOptions?.maxTokens
                });

                // Get the final jsondoc to extract the edited chronicles
                const finalJsondoc = await jsondocRepo.getJsondoc(result.outputJsondocId);
                const editedChronicles = finalJsondoc?.data || originalChronicles;

                console.log(`[ChroniclesEditTool] Successfully completed JSON patch edit with jsondoc ${result.outputJsondocId}`);

                return {
                    outputJsondocId: result.outputJsondocId,
                    finishReason: result.finishReason,
                    originalChronicles: {
                        stageCount: stageCount,
                        firstStageTitle: firstStageTitle
                    },
                    editedChronicles: {
                        stageCount: editedChronicles.stages ? editedChronicles.stages.length : stageCount,
                        firstStageTitle: editedChronicles.stages && editedChronicles.stages.length > 0 ? editedChronicles.stages[0].title || firstStageTitle : firstStageTitle
                    }
                };

            } catch (error) {
                console.error(`[ChroniclesEditTool] JSON patch edit failed:`, error);
                throw new Error(`Chronicles edit failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    };
}

/**
 * Factory function that creates a chronicles generation tool definition
 */
export function createChroniclesToolDefinition(
    transformRepo: TransformJsondocRepository,
    jsondocRepo: TransformJsondocRepository,
    projectId: string,
    userId: string,
    cachingOptions?: {
        enableCaching?: boolean;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }
): StreamingToolDefinition<ChroniclesInput, ChroniclesToolResult> {
    return {
        name: 'generate_chronicles',
        description: '生成时间顺序大纲（按时间顺序的故事发展阶段）。适用场景：用户已完成相关创作步骤，需要生成完整的时间发展脉络。系统会自动处理所有相关的上下文信息作为参考资料。',
        inputSchema: ChroniclesInputSchema,
        outputSchema: ChroniclesToolResultSchema,
        execute: async (params: ChroniclesInput, { toolCallId }): Promise<ChroniclesToolResult> => {
            console.log(`[ChroniclesTool] Starting streaming chronicles generation with ${params.jsondocs.length} jsondocs`);

            // Use shared jsondoc processor
            const jsondocProcessor = createJsondocProcessor(jsondocRepo, userId);
            const { jsondocData, jsondocMetadata, processedCount } = await jsondocProcessor.processJsondocs(params.jsondocs);

            console.log(`[ChroniclesTool] Processed ${processedCount} jsondocs`);

            // Create streaming config with all extracted data
            const config: StreamingTransformConfig<ChroniclesInput, ChroniclesOutput> = {
                templateName: 'chronicles',
                inputSchema: ChroniclesInputSchema,
                outputSchema: ChroniclesOutputSchema
                // No custom prepareTemplateVariables - use default schema-driven extraction
            };

            const result = await executeStreamingTransform({
                config,
                input: params,
                projectId,
                userId,
                transformRepo,
                jsondocRepo,
                outputJsondocType: 'chronicles',
                executionMode: { mode: 'full-object' },
                transformMetadata: {
                    toolName: 'generate_chronicles',
                    ...jsondocMetadata, // Include all jsondoc IDs with their schema types as keys
                    requirements: params.requirements
                },
                // Pass caching options from factory
                enableCaching: cachingOptions?.enableCaching,
                seed: cachingOptions?.seed,
                temperature: cachingOptions?.temperature,
                topP: cachingOptions?.topP,
                maxTokens: cachingOptions?.maxTokens
            });

            console.log(`[ChroniclesTool] Successfully completed streaming chronicles generation with jsondoc ${result.outputJsondocId}`);

            return {
                outputJsondocId: result.outputJsondocId,
                finishReason: result.finishReason
            };
        },
    };
} 