import { z } from 'zod';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
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
        description: '基于选定的故事创意生成剧本框架（人物角色、故事背景、商业定位等），为后续时间顺序大纲奠定基础。适用场景：用户已有满意的故事创意，需要先确定基础设定再进行时序发展。必须使用项目背景信息中显示的完整jsondoc ID作为sourceJsondocId参数。',
        inputSchema: OutlineSettingsInputSchema,
        outputSchema: OutlineSettingsToolResultSchema,
        execute: async (params: OutlineSettingsInput, { toolCallId }): Promise<OutlineSettingsToolResult> => {
            const sourceJsondocRef = params.jsondocs[0];
            console.log(`[OutlineSettingsTool] Starting streaming outline settings generation for jsondoc ${sourceJsondocRef.jsondocId}`);
            console.log(`[OutlineSettingsTool] Input params:`, JSON.stringify(params, null, 2));

            // Extract source idea data first
            const sourceJsondoc = await jsondocRepo.getJsondoc(sourceJsondocRef.jsondocId);
            if (!sourceJsondoc) {
                console.error(`[OutlineSettingsTool] Source jsondoc not found: ${sourceJsondocRef.jsondocId}`);
                throw new Error('Source brainstorm idea not found');
            }

            console.log(`[OutlineSettingsTool] Found source jsondoc:`, {
                id: sourceJsondoc.id,
                schema_version: sourceJsondoc.schema_version,
                schema_type: sourceJsondoc.schema_type,
                origin_type: sourceJsondoc.origin_type,
                project_id: sourceJsondoc.project_id
            });

            // Verify user has access to this jsondoc's project
            const hasAccess = await jsondocRepo.userHasProjectAccess(userId, sourceJsondoc.project_id);
            if (!hasAccess) {
                throw new Error('Access denied to source jsondoc');
            }

            // Extract source content - flexible approach that works with any jsondoc
            console.log(`[OutlineSettingsTool] Processing jsondoc type: ${sourceJsondoc.schema_type}, schema_type: ${sourceJsondoc.schema_type}`);
            console.log(`[OutlineSettingsTool] Source jsondoc data:`, typeof sourceJsondoc.data === 'object' ?
                `{${Object.keys(sourceJsondoc.data || {}).join(', ')}} (${JSON.stringify(sourceJsondoc.data).length} chars)` :
                sourceJsondoc.data);
            console.log(`[OutlineSettingsTool] Source jsondoc metadata:`, typeof sourceJsondoc.metadata === 'object' ?
                `{${Object.keys(sourceJsondoc.metadata || {}).join(', ')}} (${JSON.stringify(sourceJsondoc.metadata).length} chars)` :
                sourceJsondoc.metadata);

            // Create a comprehensive source content by combining all available information
            let sourceContent = '';

            // Add basic jsondoc info
            sourceContent += `Jsondoc Type: ${sourceJsondoc.schema_type}\n`;
            sourceContent += `Schema Type: ${sourceJsondoc.schema_type || 'N/A'}\n`;
            sourceContent += `Origin: ${sourceJsondoc.origin_type || 'N/A'}\n\n`;

            // Add main data content
            sourceContent += `Main Content:\n${JSON.stringify(sourceJsondoc.data, null, 2)}\n\n`;

            // Add metadata if available and contains useful info
            if (sourceJsondoc.metadata && Object.keys(sourceJsondoc.metadata).length > 0) {
                sourceContent += `Metadata:\n${JSON.stringify(sourceJsondoc.metadata, null, 2)}\n\n`;
            }

            // Try to extract a title for logging purposes (best effort)
            let displayTitle = 'Unknown';
            try {
                if (sourceJsondoc.data && typeof sourceJsondoc.data === 'object') {
                    if ('title' in sourceJsondoc.data) {
                        displayTitle = String(sourceJsondoc.data.title);
                    } else if (sourceJsondoc.metadata?.derived_data?.title) {
                        displayTitle = String(sourceJsondoc.metadata.derived_data.title);
                    }
                }
            } catch (e) {
                // Ignore extraction errors, use default
            }

            console.log(`[OutlineSettingsTool] Using source content for jsondoc: ${displayTitle}`);
            console.log(`[OutlineSettingsTool] Source content length: ${sourceContent.length} characters`);

            // Create streaming config with extracted data
            console.log(`[OutlineSettingsTool] Creating streaming config for template: outline_settings`);
            const config: StreamingTransformConfig<OutlineSettingsInput, OutlineSettingsOutput> = {
                templateName: 'outline_settings',
                inputSchema: OutlineSettingsInputSchema,
                outputSchema: OutlineSettingsOutputSchema
                // No custom prepareTemplateVariables - use default schema-driven extraction
            };

            console.log(`[OutlineSettingsTool] Starting executeStreamingTransform with config:`, {
                templateName: config.templateName,
                outputJsondocType: 'outline_settings',
                projectId,
                userId,
                enableCaching: cachingOptions?.enableCaching
            });

            console.log(`[OutlineSettingsTool] About to call executeStreamingTransform with parameters:`);
            console.log(`[OutlineSettingsTool] - templateName: ${config.templateName}`);
            console.log(`[OutlineSettingsTool] - outputJsondocType: outline_settings`);
            console.log(`[OutlineSettingsTool] - projectId: ${projectId}`);
            console.log(`[OutlineSettingsTool] - userId: ${userId}`);
            console.log(`[OutlineSettingsTool] - enableCaching: ${cachingOptions?.enableCaching}`);
            console.log(`[OutlineSettingsTool] - maxTokens: ${cachingOptions?.maxTokens || 'undefined'}`);
            console.log(`[OutlineSettingsTool] - temperature: ${cachingOptions?.temperature || 'undefined'}`);

            let result;
            try {
                result = await executeStreamingTransform({
                    config,
                    input: params,
                    projectId,
                    userId,
                    transformRepo,
                    jsondocRepo,
                    outputJsondocType: 'outline_settings',
                    transformMetadata: {
                        toolName: 'generate_outline_settings',
                        source_jsondoc_id: sourceJsondocRef.jsondocId,
                        source_idea_title: displayTitle,
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
                console.log(`[OutlineSettingsTool] executeStreamingTransform completed successfully`);
                console.log(`[OutlineSettingsTool] Result:`, {
                    outputJsondocId: result.outputJsondocId,
                    finishReason: result.finishReason
                });
            } catch (error) {
                console.error(`[OutlineSettingsTool] executeStreamingTransform failed:`, error);
                console.error(`[OutlineSettingsTool] Error type:`, typeof error);
                console.error(`[OutlineSettingsTool] Error message:`, error instanceof Error ? error.message : String(error));
                console.error(`[OutlineSettingsTool] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
                throw error;
            }

            console.log(`[OutlineSettingsTool] Successfully completed streaming outline settings generation with jsondoc ${result.outputJsondocId}`);

            return {
                outputJsondocId: result.outputJsondocId,
                finishReason: result.finishReason
            };
        },
    };
} 