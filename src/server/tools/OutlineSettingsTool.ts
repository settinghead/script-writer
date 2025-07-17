import { z } from 'zod';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { defaultPrepareTemplateVariables } from '../transform-jsondoc-framework/StreamingTransformExecutor';
import {
    OutlineSettingsInputSchema,
    OutlineSettingsInput,
    OutlineSettingsOutputSchema,
    OutlineSettingsOutput
} from '../../common/schemas/outlineSchemas';
import {
    OutlineSettingsEditInputSchema,
    OutlineSettingsEditInput
} from '../../common/schemas/transforms';
import {
    executeStreamingTransform,
    StreamingTransformConfig
} from '../transform-jsondoc-framework/StreamingTransformExecutor';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { TypedJsondoc } from '@/common/jsondocs';
import { createJsondocProcessor } from './shared/JsondocProcessor';

const OutlineSettingsToolResultSchema = z.object({
    outputJsondocId: z.string(),
    finishReason: z.string()
});

const OutlineSettingsEditToolResultSchema = z.object({
    outputJsondocId: z.string(),
    finishReason: z.string(),
    originalSettings: z.object({
        title: z.string(),
        genre: z.string(),
        // Add other key fields for reference
    }).optional(),
    editedSettings: z.object({
        title: z.string(),
        genre: z.string(),
        // Add other key fields for reference
    }).optional()
});

interface OutlineSettingsToolResult {
    outputJsondocId: string;
    finishReason: string;
}

export type OutlineSettingsEditToolResult = z.infer<typeof OutlineSettingsEditToolResultSchema>;

/**
 * Extract source outline settings data from different jsondoc types
 */
async function extractSourceOutlineSettingsData(
    params: OutlineSettingsEditInput,
    jsondocRepo: JsondocRepository,
    userId: string
): Promise<{
    originalSettings: any;
    additionalContexts: any[];
    targetPlatform: string;
    storyGenre: string;
}> {
    let originalSettings: any;
    let additionalContexts: any[] = [];
    let targetPlatform = 'unknown';
    let storyGenre = 'unknown';

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

        if (index === 0) { // First is always the outline
            originalSettings = sourceData;
            targetPlatform = sourceData.platform || 'unknown';
            storyGenre = sourceData.genre || 'unknown';
        } else {
            // Additional contexts (e.g., updated idea)
            additionalContexts.push({
                description: jsondocRef.description,
                data: sourceData
            });
        }
    }

    if (!originalSettings) {
        throw new Error('No outline settings jsondoc provided');
    }

    return { originalSettings, additionalContexts, targetPlatform, storyGenre };
}

/**
 * Factory function that creates an outline settings edit tool definition using JSON patch
 */
export function createOutlineSettingsEditToolDefinition(
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository,
    projectId: string,
    userId: string,
    cachingOptions?: {
        enableCaching?: boolean;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }
): StreamingToolDefinition<OutlineSettingsEditInput, OutlineSettingsEditToolResult> {
    return {
        name: 'edit_outline_settings',
        description: '使用JSON补丁方式编辑和改进现有剧本框架设置。适用场景：用户对现有剧本框架有具体的修改要求或改进建议，如修改角色设定、调整卖点、更新故事背景等。使用JSON Patch格式进行精确修改，只改变需要改变的部分。重要：必须使用项目背景信息中显示的完整ID作为sourceJsondocId参数。',
        inputSchema: OutlineSettingsEditInputSchema,
        outputSchema: OutlineSettingsEditToolResultSchema,
        execute: async (params: OutlineSettingsEditInput, { toolCallId }): Promise<OutlineSettingsEditToolResult> => {
            const sourceJsondocRef = params.jsondocs[0];
            console.log(`[OutlineSettingsEditTool] Starting JSON patch edit for jsondoc ${sourceJsondocRef.jsondocId}`);

            // Extract source outline settings data for context
            const { originalSettings, additionalContexts, targetPlatform, storyGenre } = await extractSourceOutlineSettingsData(params, jsondocRepo, userId);

            // Determine output jsondoc type
            const sourceJsondoc = await jsondocRepo.getJsondoc(sourceJsondocRef.jsondocId);
            if (!sourceJsondoc) {
                throw new Error('Source jsondoc not found');
            }

            const outputJsondocType: TypedJsondoc['schema_type'] = 'outline_settings';

            // Create config for JSON patch generation using patch template
            const config: StreamingTransformConfig<OutlineSettingsEditInput, any> = {
                templateName: 'outline_settings_edit_patch',
                inputSchema: OutlineSettingsEditInputSchema,
                outputSchema: z.array(z.object({
                    op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),
                    path: z.string(),
                    value: z.any().optional(),
                    from: z.string().optional()
                })), // RFC6902 JSON patch array schema
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
                        mode: 'patch',
                        originalJsondoc: originalSettings
                    },
                    transformMetadata: {
                        toolName: 'edit_outline_settings',
                        source_jsondoc_id: sourceJsondocRef.jsondocId,
                        edit_requirements: params.editRequirements,
                        original_settings: originalSettings,
                        platform: targetPlatform,
                        genre: storyGenre,
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

                // Get the final jsondoc to extract the edited settings
                const finalJsondoc = await jsondocRepo.getJsondoc(result.outputJsondocId);
                const editedSettings = finalJsondoc?.data || originalSettings;

                console.log(`[OutlineSettingsEditTool] Successfully completed JSON patch edit with jsondoc ${result.outputJsondocId}`);

                return {
                    outputJsondocId: result.outputJsondocId,
                    finishReason: result.finishReason,
                    originalSettings: {
                        title: originalSettings.title || '',
                        genre: originalSettings.genre || ''
                    },
                    editedSettings: {
                        title: editedSettings.title || originalSettings.title || '',
                        genre: editedSettings.genre || originalSettings.genre || ''
                    }
                };

            } catch (error) {
                console.error(`[OutlineSettingsEditTool] JSON patch edit failed:`, error);
                throw new Error(`Outline settings edit failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    };
}

/**
 * Factory function that creates an outline settings generation tool definition
 */
export function createOutlineSettingsToolDefinition(
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository,
    projectId: string,
    userId: string,
    cachingOptions?: {
        enableCaching?: boolean;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }
): StreamingToolDefinition<OutlineSettingsInput, OutlineSettingsToolResult> {
    return {
        name: 'generate_outline_settings',
        description: '基于提供的所有jsondocs生成剧本框架（人物角色、故事背景、商业定位等），为后续时间顺序大纲奠定基础。适用场景：用户已有相关创作内容，需要先确定基础设定再进行时序发展。将处理所有传入的jsondocs作为参考资料。',
        inputSchema: OutlineSettingsInputSchema,
        outputSchema: OutlineSettingsToolResultSchema,
        execute: async (params: OutlineSettingsInput, { toolCallId }): Promise<OutlineSettingsToolResult> => {
            console.log(`[OutlineSettingsTool] Starting streaming outline settings generation with ${params.jsondocs.length} jsondocs`);

            // Use shared jsondoc processor
            const jsondocProcessor = createJsondocProcessor(jsondocRepo, userId);
            const { jsondocData, jsondocMetadata, processedCount } = await jsondocProcessor.processJsondocs(params.jsondocs);

            console.log(`[OutlineSettingsTool] Processed ${processedCount} jsondocs`);

            // Create streaming config with all extracted data
            const config: StreamingTransformConfig<OutlineSettingsInput, OutlineSettingsOutput> = {
                templateName: 'outline_settings',
                inputSchema: OutlineSettingsInputSchema,
                outputSchema: OutlineSettingsOutputSchema
                // No custom prepareTemplateVariables - use default schema-driven extraction
            };

            const result = await executeStreamingTransform({
                config,
                input: params,
                projectId,
                userId,
                transformRepo,
                jsondocRepo,
                outputJsondocType: 'outline_settings',
                transformMetadata: {
                    toolName: 'generate_outline_settings',
                    ...jsondocMetadata, // Include all jsondoc IDs with their schema types as keys
                    title: params.title,
                    requirements: params.requirements
                },
                // Pass caching options from factory
                enableCaching: cachingOptions?.enableCaching,
                seed: cachingOptions?.seed,
                temperature: cachingOptions?.temperature,
                topP: cachingOptions?.topP,
                maxTokens: cachingOptions?.maxTokens || 4000  // Set default max tokens to prevent truncation
            });

            console.log(`[OutlineSettingsTool] Successfully completed streaming outline settings generation with jsondoc ${result.outputJsondocId}`);

            return {
                outputJsondocId: result.outputJsondocId,
                finishReason: result.finishReason
            };
        },
    };
} 