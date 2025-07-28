import { z } from 'zod';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
/**
 * Extract patch content from ai_patch transform outputs for agent context
 */
export async function extractPatchContentForAgent(
    transformId: string,
    transformRepo: TransformJsondocRepository,
    jsondocRepo: TransformJsondocRepository
): Promise<Array<{ path: string; operation: string; summary: string; newValue: any }>> {
    try {
        // Get all output jsondocs from the ai_patch transform
        const outputs = await transformRepo.getTransformOutputs(transformId);
        const patchContent: Array<{ path: string; operation: string; summary: string; newValue: any }> = [];

        for (const output of outputs) {
            const patchJsondoc = await jsondocRepo.getJsondoc(output.jsondoc_id);
            if (patchJsondoc && patchJsondoc.schema_type === 'json_patch') {
                const patchData = typeof patchJsondoc.data === 'string'
                    ? JSON.parse(patchJsondoc.data)
                    : patchJsondoc.data;

                // Extract patch operations for agent context
                if (patchData.patches && Array.isArray(patchData.patches)) {
                    for (const patch of patchData.patches) {
                        const pathParts = patch.path.replace(/^\//, '').split('/');
                        const fieldName = pathParts[pathParts.length - 1];

                        let summary = '';
                        switch (patch.op) {
                            case 'replace':
                                summary = `Update ${fieldName}`;
                                break;
                            case 'add':
                                summary = `Add ${fieldName}`;
                                break;
                            case 'remove':
                                summary = `Remove ${fieldName}`;
                                break;
                            default:
                                summary = `${patch.op} ${fieldName}`;
                        }

                        patchContent.push({
                            path: patch.path,
                            operation: patch.op,
                            summary,
                            newValue: patch.value
                        });
                    }
                }
            }
        }

        return patchContent;
    } catch (error) {
        console.warn(`[extractPatchContentForAgent] Failed to extract patch content:`, error);
        return [];
    }
}
import {
    OutlineSettingsInputSchema,
    OutlineSettingsInput,
    OutlineSettingsOutputSchema,
    OutlineSettingsOutput
} from '../../common/schemas/outlineSchemas';
import {
    OutlineSettingsEditInputSchema,
    OutlineSettingsEditInput,
    JsonPatchOperationsSchema,
    JsonPatchOperation
} from '../../common/schemas/transforms';
import {
    executeStreamingTransform,
    StreamingTransformConfig
} from '../transform-jsondoc-framework/StreamingTransformExecutor';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { TypedJsondoc } from '@/common/jsondocs';
import { createJsondocProcessor } from './shared/JsondocProcessor';
import { CanonicalJsondocService } from '../services/CanonicalJsondocService';
import { db } from '../database/connection';

const OutlineSettingsToolResultSchema = z.object({
    outputJsondocId: z.string(),
    finishReason: z.string()
});

const OutlineSettingsEditToolResultSchema = z.object({
    outputJsondocId: z.string(),
    finishReason: z.string(),
    patchContent: z.array(z.object({
        path: z.string(),
        operation: z.string(),
        summary: z.string(),
        newValue: z.any()
    })).optional(),
    patchCount: z.number().optional(),
    message: z.string().optional()
});

interface OutlineSettingsToolResult {
    outputJsondocId: string;
    finishReason: string;
}

export type OutlineSettingsEditToolResult = z.infer<typeof OutlineSettingsEditToolResultSchema>;

/**
 * Extract source 剧本设定 data using canonical jsondoc logic
 */
async function extractSourceOutlineSettingsData(
    params: OutlineSettingsEditInput,
    jsondocRepo: TransformJsondocRepository,
    userId: string,
    projectId: string
): Promise<{
    originalSettings: any;
    canonicalOutlineSettingsJsondoc: any; // Add this to return the actual jsondoc
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

    // Use centralized canonical service to avoid duplicating computation
    const transformRepo = new TransformJsondocRepository(db);
    const canonicalService = new CanonicalJsondocService(db, jsondocRepo, transformRepo);
    const { canonicalContext } = await canonicalService.getProjectCanonicalData(projectId);

    // Get the canonical 剧本设定
    const canonicalOutlineSettings = canonicalContext.canonicalOutlineSettings;

    if (!canonicalOutlineSettings) {
        throw new Error('No canonical 剧本设定 found in project');
    }

    // Validate user access
    const hasAccess = await jsondocRepo.userHasProjectAccess(userId, canonicalOutlineSettings.project_id);
    if (!hasAccess) {
        throw new Error(`Access denied to canonical 剧本设定 ${canonicalOutlineSettings.id}`);
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

        // Only add as additional context if it's not the canonical 剧本设定
        if (sourceJsondoc.id !== canonicalOutlineSettings.id) {
            additionalContexts.push({
                description: jsondocRef.description,
                data: typeof sourceJsondoc.data === 'string'
                    ? JSON.parse(sourceJsondoc.data)
                    : sourceJsondoc.data
            });
        }
    }

    // Remove platform and genre validation - these aren't part of the outline settings schema
    // and aren't essential for the tool's functionality

    return {
        originalSettings,
        canonicalOutlineSettingsJsondoc: canonicalOutlineSettings, // Return the actual jsondoc
        additionalContexts,
        targetPlatform: 'N/A', // Not needed for outline settings
        storyGenre: originalSettings.genre || 'N/A' // Use genre from outline settings if available
    };
}

/**
 * Factory function that creates an 剧本设定 edit tool definition using JSON patch
 */
export function createOutlineSettingsEditToolDefinition(
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
): StreamingToolDefinition<OutlineSettingsEditInput, OutlineSettingsEditToolResult> {
    return {
        name: 'edit_剧本设定',
        description: '编辑和改进现有剧本设定设置。适用场景：用户对现有剧本设定有具体的修改要求或改进建议，如修改角色设定、调整卖点、更新故事背景等。使用JSON Patch格式进行精确修改，只改变需要改变的部分。系统会自动处理相关的上下文信息。',
        inputSchema: OutlineSettingsEditInputSchema,
        outputSchema: OutlineSettingsEditToolResultSchema,
        execute: async (params: OutlineSettingsEditInput, { toolCallId }): Promise<OutlineSettingsEditToolResult> => {
            console.log(`[OutlineSettingsEditTool] Starting outline settings edit: `, params.editRequirements);

            // Extract source 剧本设定 data for context
            const { originalSettings, canonicalOutlineSettingsJsondoc, additionalContexts, targetPlatform, storyGenre } = await extractSourceOutlineSettingsData(params, jsondocRepo, userId, projectId);

            console.log(`[OutlineSettingsEditTool] Using canonical outline settings jsondoc ${canonicalOutlineSettingsJsondoc.id}`);

            const outputJsondocType: TypedJsondoc['schema_type'] = '剧本设定';

            // Create enhanced input that includes the canonical 剧本设定 as the primary input
            const enhancedInput = {
                ...params,
                jsondocs: [
                    // 1. Always include the canonical 剧本设定 as the first (primary) input
                    {
                        jsondocId: canonicalOutlineSettingsJsondoc.id,
                        description: '剧本设定',
                        schemaType: '剧本设定'
                    },
                    // 2. Add all other input jsondocs as context (excluding the canonical one if it's already there)
                    ...params.jsondocs.filter(jsondocRef => jsondocRef.jsondocId !== canonicalOutlineSettingsJsondoc.id)
                ]
            };

            console.log(`[OutlineSettingsEditTool] Enhanced input jsondocs:`, enhancedInput.jsondocs.map(j => ({ id: j.jsondocId, description: j.description })));

            // Create config for JSON patch generation
            const config: StreamingTransformConfig<OutlineSettingsEditInput, JsonPatchOperation[]> = {
                templateName: '剧本设定_edit_diff',
                inputSchema: OutlineSettingsEditInputSchema,
                outputSchema: JsonPatchOperationsSchema, // JSON patch operations for external output
                prepareTemplateVariables: async (input) => {
                    console.log(`[OutlineSettingsEditTool] Preparing template variables with canonical 剧本设定 as patch target`);

                    // Create a custom jsondocs object that clearly marks the patch target and includes context
                    const templateJsondocs: Record<string, any> = {};

                    // 1. Add the canonical 剧本设定 as the PATCH TARGET
                    templateJsondocs['PATCH_TARGET_剧本设定'] = {
                        id: canonicalOutlineSettingsJsondoc.id,
                        schemaType: '剧本设定',
                        schema_type: '剧本设定',
                        content: originalSettings,
                        data: originalSettings,
                        role: 'PATCH_TARGET',
                        description: 'This is the canonical 剧本设定 that should receive the patches'
                    };

                    // 2. Add all input jsondocs as CONTEXT (excluding the canonical one if it's already there)
                    for (const jsondocRef of input.jsondocs) {
                        const sourceJsondoc = await jsondocRepo.getJsondoc(jsondocRef.jsondocId);
                        if (sourceJsondoc && sourceJsondoc.id !== canonicalOutlineSettingsJsondoc.id) {
                            const contextKey = jsondocRef.description || sourceJsondoc.schema_type;
                            templateJsondocs[`CONTEXT_${contextKey}`] = {
                                id: sourceJsondoc.id,
                                schemaType: sourceJsondoc.schema_type,
                                schema_type: sourceJsondoc.schema_type,
                                content: typeof sourceJsondoc.data === 'string'
                                    ? JSON.parse(sourceJsondoc.data)
                                    : sourceJsondoc.data,
                                data: typeof sourceJsondoc.data === 'string'
                                    ? JSON.parse(sourceJsondoc.data)
                                    : sourceJsondoc.data,
                                role: 'CONTEXT',
                                description: `Context jsondoc: ${jsondocRef.description || sourceJsondoc.schema_type}`
                            };
                        }
                    }

                    console.log(`[OutlineSettingsEditTool] Template jsondocs keys:`, Object.keys(templateJsondocs));

                    // Return raw objects - let TemplateService handle format conversion
                    // For unified diff templates, TemplateService will convert to JSON with line numbers
                    // For other templates, TemplateService will convert to YAML
                    const { jsondocs, ...otherParams } = input;

                    return {
                        jsondocs: templateJsondocs, // Raw objects, not YAML string
                        params: otherParams, // Raw objects, not YAML string  
                        additionalContexts
                    };
                }
            };

            try {
                // Execute the streaming transform with patch mode
                const result = await executeStreamingTransform({
                    config,
                    input: enhancedInput, // Use the enhanced input
                    projectId,
                    userId,
                    transformRepo,
                    jsondocRepo,
                    outputJsondocType,
                    executionMode: {
                        mode: 'patch-approval',
                        originalJsondoc: canonicalOutlineSettingsJsondoc // Use the canonical outline settings jsondoc
                    },
                    transformMetadata: {
                        toolName: 'edit_剧本设定',
                        source_jsondoc_id: canonicalOutlineSettingsJsondoc.id, // Use the canonical outline settings jsondoc ID
                        canonical_剧本设定_id: canonicalOutlineSettingsJsondoc.id,
                        edit_requirements: params.editRequirements,
                        original_settings: originalSettings,
                        platform: targetPlatform,
                        genre: storyGenre,
                        method: 'json_patch',
                        source_jsondoc_type: canonicalOutlineSettingsJsondoc.schema_type,
                        output_jsondoc_type: outputJsondocType,
                        additionalContexts: additionalContexts
                    },
                    enableCaching: cachingOptions?.enableCaching,
                    seed: cachingOptions?.seed,
                    temperature: cachingOptions?.temperature,
                    topP: cachingOptions?.topP,
                    maxTokens: cachingOptions?.maxTokens
                });

                // Extract patch content for agent context
                const patchContent = await extractPatchContentForAgent(result.transformId, transformRepo, jsondocRepo);

                console.log(`[OutlineSettingsEditTool] Successfully created ${patchContent.length} patches for review`);

                return {
                    outputJsondocId: result.transformId,
                    finishReason: result.finishReason,
                    patchContent: patchContent,
                    patchCount: patchContent.length,
                    message: `Created ${patchContent.length} patches for your 剧本设定. The changes will be applied after you approve them in the review modal.`
                };

            } catch (error) {
                console.error(`[OutlineSettingsEditTool] JSON patch edit failed:`, error);
                throw new Error(`Outline settings edit failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    };
}

/**
 * Factory function that creates an 剧本设定 generation tool definition
 */
export function createOutlineSettingsToolDefinition(
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
): StreamingToolDefinition<OutlineSettingsInput, OutlineSettingsToolResult> {
    return {
        name: 'generate_剧本设定',
        description: '生成剧本设定（人物角色、故事背景、商业定位等），为后续时间顺序大纲奠定基础。适用场景：用户已有相关创作内容，需要先确定基础设定再进行时序发展。系统会自动处理所有相关的上下文信息作为参考资料。',
        inputSchema: OutlineSettingsInputSchema,
        outputSchema: OutlineSettingsToolResultSchema,
        execute: async (params: OutlineSettingsInput, { toolCallId }): Promise<OutlineSettingsToolResult> => {
            console.log(`[OutlineSettingsTool] Starting streaming 剧本设定 generation with ${params.jsondocs.length} jsondocs`);

            // Use shared jsondoc processor
            const jsondocProcessor = createJsondocProcessor(jsondocRepo, userId);
            const { jsondocData, jsondocMetadata, processedCount } = await jsondocProcessor.processJsondocs(params.jsondocs);

            console.log(`[OutlineSettingsTool] Processed ${processedCount} jsondocs`);

            // Create streaming config with all extracted data
            const config: StreamingTransformConfig<OutlineSettingsInput, OutlineSettingsOutput> = {
                templateName: '剧本设定',
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
                outputJsondocType: '剧本设定',
                transformMetadata: {
                    toolName: 'generate_剧本设定',
                    ...jsondocMetadata, // Include all jsondoc IDs with their schema types as keys
                    title: params.title,
                    requirements: params.requirements
                },
                // Pass caching options from factory
                enableCaching: cachingOptions?.enableCaching,
                seed: cachingOptions?.seed,
                temperature: cachingOptions?.temperature,
                topP: cachingOptions?.topP,
                maxTokens: cachingOptions?.maxTokens || 4000,  // Set default max tokens to prevent truncation,
                executionMode: {
                    mode: 'full-object'
                }
            });

            console.log(`[OutlineSettingsTool] Successfully completed streaming 剧本设定 generation with jsondoc ${result.outputJsondocId}`);

            return {
                outputJsondocId: result.outputJsondocId,
                finishReason: result.finishReason
            };
        },
    };
} 