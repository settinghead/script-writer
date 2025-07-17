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
    OutlineSettingsEditInput,
    JsonPatchOperationsSchema
} from '../../common/schemas/transforms';
import {
    executeStreamingTransform,
    StreamingTransformConfig
} from '../transform-jsondoc-framework/StreamingTransformExecutor';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { TypedJsondoc } from '@/common/jsondocs';
import { createJsondocProcessor } from './shared/JsondocProcessor';
import { computeCanonicalJsondocsFromLineage } from '../../common/canonicalJsondocLogic';
import { buildLineageGraph } from '../../common/transform-jsondoc-framework/lineageResolution';

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
 * Extract source outline settings data using canonical jsondoc logic
 */
async function extractSourceOutlineSettingsData(
    params: OutlineSettingsEditInput,
    jsondocRepo: JsondocRepository,
    userId: string,
    projectId: string
): Promise<{
    originalSettings: any;
    additionalContexts: any[];
    targetPlatform: string;
    storyGenre: string;
}> {
    // Get all project data for lineage computation
    const jsondocs = await jsondocRepo.getAllProjectJsondocsForLineage(projectId);
    const transforms = await jsondocRepo.getAllProjectTransformsForLineage(projectId);
    const humanTransforms = await jsondocRepo.getAllProjectHumanTransformsForLineage(projectId);
    const transformInputs = await jsondocRepo.getAllProjectTransformInputsForLineage(projectId);
    const transformOutputs = await jsondocRepo.getAllProjectTransformOutputsForLineage(projectId);

    // Build lineage graph
    const lineageGraph = buildLineageGraph(
        jsondocs,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    // Compute canonical jsondocs using the same logic as actionComputation.ts
    const canonicalContext = computeCanonicalJsondocsFromLineage(
        lineageGraph,
        jsondocs,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    // Get the canonical outline settings
    const canonicalOutlineSettings = canonicalContext.latestOutlineSettings;

    if (!canonicalOutlineSettings) {
        throw new Error('No canonical outline settings found in project');
    }

    // Validate user access
    const hasAccess = await jsondocRepo.userHasProjectAccess(userId, canonicalOutlineSettings.project_id);
    if (!hasAccess) {
        throw new Error(`Access denied to canonical outline settings ${canonicalOutlineSettings.id}`);
    }

    const originalSettings = typeof canonicalOutlineSettings.data === 'string'
        ? JSON.parse(canonicalOutlineSettings.data)
        : canonicalOutlineSettings.data;

    // Collect additional contexts from the input parameters
    let additionalContexts: any[] = [];
    for (const jsondocRef of params.jsondocs) {
        const sourceJsondoc = await jsondocRepo.getJsondoc(jsondocRef.jsondocId);
        if (!sourceJsondoc) {
            throw new Error(`Jsondoc ${jsondocRef.jsondocId} not found`);
        }

        const hasAccess = await jsondocRepo.userHasProjectAccess(userId, sourceJsondoc.project_id);
        if (!hasAccess) {
            throw new Error(`Access denied to jsondoc ${jsondocRef.jsondocId}`);
        }

        // Only add as additional context if it's not the canonical outline settings
        if (sourceJsondoc.id !== canonicalOutlineSettings.id) {
            additionalContexts.push({
                description: jsondocRef.description,
                data: typeof sourceJsondoc.data === 'string'
                    ? JSON.parse(sourceJsondoc.data)
                    : sourceJsondoc.data
            });
        }
    }

    const targetPlatform = originalSettings.platform || 'unknown';
    const storyGenre = originalSettings.genre || 'unknown';

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
        description: '编辑和改进现有剧本设定设置。适用场景：用户对现有剧本设定有具体的修改要求或改进建议，如修改角色设定、调整卖点、更新故事背景等。使用JSON Patch格式进行精确修改，只改变需要改变的部分。系统会自动处理相关的上下文信息。',
        inputSchema: OutlineSettingsEditInputSchema,
        outputSchema: OutlineSettingsEditToolResultSchema,
        execute: async (params: OutlineSettingsEditInput, { toolCallId }): Promise<OutlineSettingsEditToolResult> => {
            const sourceJsondocRef = params.jsondocs[0];
            console.log(`[OutlineSettingsEditTool] Starting JSON patch edit for jsondoc ${sourceJsondocRef.jsondocId}`);

            // Extract source outline settings data for context
            const { originalSettings, additionalContexts, targetPlatform, storyGenre } = await extractSourceOutlineSettingsData(params, jsondocRepo, userId, projectId);

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
                outputSchema: JsonPatchOperationsSchema, // RFC6902 JSON patch array schema
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
        description: '生成剧本设定（人物角色、故事背景、商业定位等），为后续时间顺序大纲奠定基础。适用场景：用户已有相关创作内容，需要先确定基础设定再进行时序发展。系统会自动处理所有相关的上下文信息作为参考资料。',
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