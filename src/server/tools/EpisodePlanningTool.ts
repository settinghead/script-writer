import { z } from 'zod';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import {
    EpisodePlanningInputSchema,
    EpisodePlanningInput,
    EpisodePlanningOutputSchema,
    EpisodePlanningOutput,
    EpisodePlanningEditInputSchema,
    EpisodePlanningEditInput,
    EpisodePlanningEditToolResultSchema,
    EpisodePlanningEditToolResult,
} from '@/common/schemas/outlineSchemas';
import {
    executeStreamingTransform,
    StreamingTransformConfig
} from '../transform-jsondoc-framework/StreamingTransformExecutor';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { TypedJsondoc } from '@/common/jsondocs';
import { defaultPrepareTemplateVariables } from '../transform-jsondoc-framework/StreamingTransformExecutor';
import { createJsondocProcessor } from './shared/JsondocProcessor';
import { JsonPatchOperationsSchema, JsonPatchOperation } from '@/common/schemas/transforms';

const EpisodePlanningToolResultSchema = z.object({
    outputJsondocId: z.string(),
    finishReason: z.string()
});

interface EpisodePlanningToolResult {
    outputJsondocId: string;
    finishReason: string;
}

/**
 * Extract source episode planning data from different jsondoc types
 */
async function extractSourceEpisodePlanningData(
    params: EpisodePlanningEditInput,
    jsondocRepo: TransformJsondocRepository,
    userId: string
): Promise<{
    originalEpisodePlanning: any;
    additionalContexts: any[];
    totalEpisodes: number;
    firstGroupTitle: string;
}> {
    let originalEpisodePlanning: any;
    let additionalContexts: any[] = [];
    let totalEpisodes = 0;
    let firstGroupTitle = '';

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

        if (index === 0) { // First is always the episode planning
            originalEpisodePlanning = sourceData;
            totalEpisodes = sourceData.totalEpisodes || 0;
            firstGroupTitle = sourceData.episodeGroups && sourceData.episodeGroups.length > 0 ? sourceData.episodeGroups[0].groupTitle || '' : '';
        } else {
            // Additional contexts (e.g., updated chronicles, 故事设定)
            additionalContexts.push({
                description: jsondocRef.description,
                data: sourceData
            });
        }
    }

    if (!originalEpisodePlanning) {
        throw new Error('No episode planning jsondoc provided');
    }

    return { originalEpisodePlanning, additionalContexts, totalEpisodes, firstGroupTitle };
}

/**
 * Factory function that creates an episode planning edit tool definition using JSON patch
 */
export function createEpisodePlanningEditToolDefinition(
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
): StreamingToolDefinition<EpisodePlanningEditInput, EpisodePlanningEditToolResult> {
    return {
        name: 'edit_分集结构',
        description: '编辑和改进现有分集结构。适用场景：用户对现有分集结构有具体的修改要求或改进建议，如调整剧集分组、修改情感节拍、更新关键事件等。使用JSON Patch格式进行精确修改，只改变需要改变的部分。系统会自动处理相关的上下文信息。',
        inputSchema: EpisodePlanningEditInputSchema,
        outputSchema: EpisodePlanningEditToolResultSchema,
        execute: async (params: EpisodePlanningEditInput, { toolCallId }): Promise<EpisodePlanningEditToolResult> => {
            const sourceJsondocRef = params.jsondocs[0];
            console.log(`[EpisodePlanningEditTool] Starting JSON patch edit for jsondoc ${sourceJsondocRef.jsondocId}`);

            // Extract source episode planning data for context
            const { originalEpisodePlanning, additionalContexts, totalEpisodes, firstGroupTitle } = await extractSourceEpisodePlanningData(params, jsondocRepo, userId);

            // Determine output jsondoc type
            const sourceJsondoc = await jsondocRepo.getJsondoc(sourceJsondocRef.jsondocId);
            if (!sourceJsondoc) {
                throw new Error('Source jsondoc not found');
            }

            const outputJsondocType: TypedJsondoc['schema_type'] = '分集结构';

            // Create config for JSON patch generation
            const config: StreamingTransformConfig<EpisodePlanningEditInput, JsonPatchOperation[]> = {
                templateName: '分集结构_edit_diff',
                inputSchema: EpisodePlanningEditInputSchema,
                outputSchema: JsonPatchOperationsSchema, // JSON patch operations for external output
                prepareTemplateVariables: async (input) => {
                    const defaultVars = await defaultPrepareTemplateVariables(input, jsondocRepo);
                    return {
                        ...defaultVars,
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
                        originalJsondoc: originalEpisodePlanning
                    },
                    transformMetadata: {
                        toolName: 'edit_分集结构',
                        source_jsondoc_id: sourceJsondocRef.jsondocId,
                        edit_requirements: params.editRequirements,
                        original_分集结构: originalEpisodePlanning,
                        total_episodes: totalEpisodes,
                        first_group_title: firstGroupTitle,
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

                // Get the final jsondoc to extract the edited episode planning
                const finalJsondoc = await jsondocRepo.getJsondoc(result.outputJsondocId);
                const editedEpisodePlanning = finalJsondoc?.data || originalEpisodePlanning;

                console.log(`[EpisodePlanningEditTool] Successfully completed JSON patch edit with jsondoc ${result.outputJsondocId}`);

                return {
                    outputJsondocId: result.outputJsondocId,
                    finishReason: result.finishReason
                };

            } catch (error) {
                console.error(`[EpisodePlanningEditTool] JSON patch edit failed:`, error);
                throw new Error(`Episode planning edit failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    };
}

/**
 * Factory function that creates an episode planning tool definition
 */
export function createEpisodePlanningToolDefinition(
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
): StreamingToolDefinition<EpisodePlanningInput, EpisodePlanningToolResult> {
    return {
        name: 'generate_分集结构',
        description: '生成分集结构（优化观看顺序和情感节奏）。适用场景：用户已完成相关创作步骤，需要生成适合短视频平台的分集结构。系统会自动处理所有相关的上下文信息作为参考资料。',
        inputSchema: EpisodePlanningInputSchema,
        outputSchema: EpisodePlanningToolResultSchema,
        execute: async (params: EpisodePlanningInput, { toolCallId }): Promise<EpisodePlanningToolResult> => {
            console.log(`[EpisodePlanningTool] Starting streaming episode planning generation with ${params.jsondocs.length} jsondocs`);

            // Use shared jsondoc processor
            const jsondocProcessor = createJsondocProcessor(jsondocRepo, userId);
            const { jsondocData, jsondocMetadata, processedCount } = await jsondocProcessor.processJsondocs(params.jsondocs);

            console.log(`[EpisodePlanningTool] Processed ${processedCount} jsondocs, target episodes: ${params.numberOfEpisodes}`);

            // Create streaming config with all extracted data
            const config: StreamingTransformConfig<EpisodePlanningInput, EpisodePlanningOutput> = {
                templateName: '分集结构',
                inputSchema: EpisodePlanningInputSchema,
                outputSchema: EpisodePlanningOutputSchema
                // No custom prepareTemplateVariables - use default schema-driven extraction
            };

            const result = await executeStreamingTransform({
                config,
                input: params,
                projectId,
                userId,
                transformRepo,
                jsondocRepo,
                outputJsondocType: '分集结构',
                executionMode: { mode: 'full-object' },
                transformMetadata: {
                    toolName: 'generate_分集结构',
                    ...jsondocMetadata, // Include all jsondoc IDs with their schema types as keys
                    numberOfEpisodes: params.numberOfEpisodes,
                    requirements: params.requirements
                },
                // Pass caching options from factory
                enableCaching: cachingOptions?.enableCaching,
                seed: cachingOptions?.seed,
                temperature: cachingOptions?.temperature,
                topP: cachingOptions?.topP,
                maxTokens: cachingOptions?.maxTokens
            });

            console.log(`[EpisodePlanningTool] Episode planning generation completed. Output jsondoc: ${result.outputJsondocId}`);

            return {
                outputJsondocId: result.outputJsondocId,
                finishReason: 'completed'
            };
        }
    };
} 