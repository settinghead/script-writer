import { BrainstormEditInput, BrainstormEditInputSchema, JsonPatchOperation, JsonPatchOperationsSchema } from '@/common/schemas/transforms';
import { TypedJsondoc } from '@/common/types';
import { z } from 'zod';
import { extractDataAtPath } from '../services/transform-instantiations/pathTransforms';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { StreamingTransformConfig, executeStreamingTransform } from '../transform-jsondoc-framework/StreamingTransformExecutor';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';

/**
 * Extract patch content from ai_patch transform outputs for agent context
 */

async function extractPatchContentForAgent(
    transformId: string,
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository
): Promise<Array<{ path: string; operation: string; summary: string; newValue: any; }>> {
    try {
        // Get all output jsondocs from the ai_patch transform
        const outputs = await transformRepo.getTransformOutputs(transformId);
        const patchContent: Array<{ path: string; operation: string; summary: string; newValue: any; }> = [];

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
// Discriminated union for brainstorm edit results
const BrainstormEditToolResultSchema = z.discriminatedUnion('status', [
    z.object({
        status: z.literal('success'),
        outputJsondocId: z.string(),
        finishReason: z.string(),
        originalIdea: z.object({
            title: z.string(),
            body: z.string()
        }).optional(),
        patchContent: z.array(z.object({
            path: z.string(),
            operation: z.string(),
            summary: z.string(),
            newValue: z.any()
        })).optional(),
        patchCount: z.number().optional(),
        message: z.string().optional()
    }),
    z.object({
        status: z.literal('rejected'),
        reason: z.string(),
        originalIdea: z.object({
            title: z.string(),
            body: z.string()
        }).optional()
    }),
    z.object({
        status: z.literal('error'),
        error: z.string(),
        originalIdea: z.object({
            title: z.string(),
            body: z.string()
        }).optional()
    })
]);
export const BrainstormToolResultSchema = z.object({
    outputJsondocId: z.string(),
    finishReason: z.string()
});

export type BrainstormEditToolResult = z.infer<typeof BrainstormEditToolResultSchema>;
/**
 * Extract source idea data from different jsondoc types
 */

async function extractSourceIdeaData(
    params: BrainstormEditInput,
    jsondocRepo: JsondocRepository,
    userId: string
): Promise<{
    originalIdea: { title: string; body: string; };
    targetPlatform: string;
    storyGenre: string;
}> {
    console.log(`[extractSourceIdeaData] Starting extraction with params:`, {
        jsondocsCount: params.jsondocs.length,
        firstJsondocId: params.jsondocs[0]?.jsondocId,
        ideaIndex: params.ideaIndex
    });

    // Get the first jsondoc from the array (primary source)
    const sourceJsondocRef = params.jsondocs[0];
    console.log(`[extractSourceIdeaData] Loading jsondoc ${sourceJsondocRef.jsondocId}`);
    const sourceJsondoc = await jsondocRepo.getJsondoc(sourceJsondocRef.jsondocId);
    if (!sourceJsondoc) {
        console.log(`[extractSourceIdeaData] ERROR: Source jsondoc ${sourceJsondocRef.jsondocId} not found`);
        throw new Error('Source jsondoc not found');
    }

    console.log(`[extractSourceIdeaData] Loaded jsondoc:`, {
        id: sourceJsondoc.id,
        schema_type: sourceJsondoc.schema_type,
        origin_type: sourceJsondoc.origin_type,
        project_id: sourceJsondoc.project_id,
        data_keys: Object.keys(sourceJsondoc.data || {}),
        data_preview: JSON.stringify(sourceJsondoc.data).substring(0, 200) + '...'
    });

    // Verify user has access to this jsondoc's project
    const hasAccess = await jsondocRepo.userHasProjectAccess(userId, sourceJsondoc.project_id);
    if (!hasAccess) {
        throw new Error('Access denied to source jsondoc');
    }

    const sourceData = sourceJsondoc.data;
    let originalIdea: { title: string; body: string; };
    let targetPlatform: string;
    let storyGenre: string;

    if (sourceJsondoc.schema_type === 'brainstorm_collection') {
        const ideaPath = `$.ideas[${params.ideaIndex}]`;
        try {
            const extractedIdea = extractDataAtPath(sourceData, ideaPath);
            if (!extractedIdea || !extractedIdea.title || !extractedIdea.body) {
                throw new Error(`Invalid idea at index ${params.ideaIndex} in collection`);
            }

            originalIdea = {
                title: extractedIdea.title,
                body: extractedIdea.body
            };

            // Get platform/genre from collection metadata - these are required
            if (!sourceData.platform) {
                throw new Error(`Missing platform in brainstorm_collection jsondoc ${sourceJsondoc.id}. sourceData: ${JSON.stringify(sourceData, null, 2)}`);
            }
            if (!sourceData.genre) {
                throw new Error(`Missing genre in brainstorm_collection jsondoc ${sourceJsondoc.id}. sourceData: ${JSON.stringify(sourceData, null, 2)}`);
            }
            targetPlatform = sourceData.platform;
            storyGenre = sourceData.genre;
        } catch (extractError) {
            throw new Error(`Failed to extract idea at index ${params.ideaIndex}: ${extractError instanceof Error ? extractError.message : String(extractError)}`);
        }
    } else if (sourceJsondoc.schema_type === '灵感创意') {
        console.log(`[extractSourceIdeaData] Processing 灵感创意 jsondoc`);
        // Direct brainstorm idea jsondoc
        if (!sourceData.title || !sourceData.body) {
            console.log(`[extractSourceIdeaData] ERROR: Invalid 灵感创意 jsondoc - missing title or body:`, {
                hasTitle: !!sourceData.title,
                hasBody: !!sourceData.body,
                sourceData
            });
            throw new Error('Invalid brainstorm idea jsondoc');
        }

        originalIdea = {
            title: sourceData.title,
            body: sourceData.body
        };

        // Extract platform and genre from metadata if available, but don't require them
        // These fields aren't essential for brainstorm editing functionality
        if (sourceJsondoc.metadata) {
            targetPlatform = sourceJsondoc.metadata.platform || 'N/A';
            storyGenre = sourceJsondoc.metadata.genre || 'N/A';
        } else {
            targetPlatform = 'N/A';
            storyGenre = 'N/A';
        }
        console.log(`[extractSourceIdeaData] Successfully extracted 灵感创意:`, { originalIdea, targetPlatform, storyGenre });
    } else if (sourceJsondoc.origin_type === 'user_input') {
        // User-edited jsondoc - extract from derived data
        let derivedData = sourceJsondoc.metadata?.derived_data;
        if (!derivedData && sourceData.text) {
            try {
                derivedData = JSON.parse(sourceData.text);
            } catch (e) {
                throw new Error('Failed to parse user input data');
            }
        }

        if (!derivedData || !derivedData.title || !derivedData.body) {
            throw new Error('Invalid user input jsondoc');
        }

        originalIdea = {
            title: derivedData.title,
            body: derivedData.body
        };

        // Try to get platform/genre from original jsondoc metadata
        if (sourceJsondoc.metadata?.original_jsondoc_id) {
            const originalJsondoc = await jsondocRepo.getJsondoc(sourceJsondoc.metadata.original_jsondoc_id);
            if (!originalJsondoc) {
                throw new Error(`Original jsondoc ${sourceJsondoc.metadata.original_jsondoc_id} not found for user input jsondoc ${sourceJsondoc.id}`);
            }
            if (!originalJsondoc.metadata) {
                throw new Error(`Missing metadata in original jsondoc ${originalJsondoc.id} for user input jsondoc ${sourceJsondoc.id}`);
            }
            if (!originalJsondoc.metadata.platform) {
                throw new Error(`Missing platform in original jsondoc metadata ${originalJsondoc.id}. metadata: ${JSON.stringify(originalJsondoc.metadata, null, 2)}`);
            }
            if (!originalJsondoc.metadata.genre) {
                throw new Error(`Missing genre in original jsondoc metadata ${originalJsondoc.id}. metadata: ${JSON.stringify(originalJsondoc.metadata, null, 2)}`);
            }
            targetPlatform = originalJsondoc.metadata.platform;
            storyGenre = originalJsondoc.metadata.genre;
        } else {
            throw new Error(`Missing original_jsondoc_id in user input jsondoc metadata ${sourceJsondoc.id}. metadata: ${JSON.stringify(sourceJsondoc.metadata, null, 2)}`);
        }
    } else {
        throw new Error(`Unsupported source jsondoc schema_type: ${sourceJsondoc.schema_type}, origin_type: ${sourceJsondoc.origin_type}`);
    }

    return { originalIdea, targetPlatform, storyGenre };
}
/**
 * Factory function that creates a JSON patch-based brainstorm edit tool definition
 * This tool asks the LLM to generate JSON patches instead of complete new ideas,
 * and applies them with retry logic if the patches fail to apply.
 * Falls back to regular editing if JSON patch approach fails.
 */

export function createBrainstormEditToolDefinition(
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
): StreamingToolDefinition<BrainstormEditInput, BrainstormEditToolResult> {
    return {
        name: 'edit_灵感创意',
        description: '编辑和改进现有故事创意。适用场景：用户对现有创意有具体的修改要求或改进建议。使用JSON Patch格式进行精确修改，只改变需要改变的部分，提高效率和准确性。支持各种编辑类型：内容扩展、风格调整、情节修改、结构调整等。系统会自动处理相关的上下文信息。',
        inputSchema: BrainstormEditInputSchema,
        outputSchema: BrainstormEditToolResultSchema,
        execute: async (params: BrainstormEditInput, { toolCallId, userContext }): Promise<BrainstormEditToolResult> => {
            const sourceJsondocRef = params.jsondocs[0];
            console.log(`[BrainstormEditTool] Starting unified patch edit for jsondoc ${sourceJsondocRef.jsondocId}`);
            console.log(`[BrainstormEditTool] Full params:`, JSON.stringify(params, null, 2));

            // Log user context information
            if (userContext?.originalUserRequest) {
                console.log(`[BrainstormEditTool] Original user request: "${userContext.originalUserRequest}"`);
                console.log(`[BrainstormEditTool] Agent interpreted as: "${params.editRequirements}"`);
            } else {
                console.log(`[BrainstormEditTool] No user context available, using agent interpretation only`);
            }

            let originalIdea: { title: string; body: string; } | undefined;

            try {
                // Extract source idea data for context
                const extractedData = await extractSourceIdeaData(params, jsondocRepo, userId);
                originalIdea = extractedData.originalIdea;
                const { targetPlatform, storyGenre } = extractedData;

                // Determine output jsondoc type based on source jsondoc type
                console.log(`[BrainstormEditTool] Loading source jsondoc ${sourceJsondocRef.jsondocId}`);
                const sourceJsondoc = await jsondocRepo.getJsondoc(sourceJsondocRef.jsondocId);
                if (!sourceJsondoc) {
                    console.log(`[BrainstormEditTool] ERROR: Source jsondoc ${sourceJsondocRef.jsondocId} not found`);
                    return {
                        status: 'error',
                        error: 'Source jsondoc not found',
                        originalIdea
                    };
                }
                console.log(`[BrainstormEditTool] Loaded source jsondoc:`, {
                    id: sourceJsondoc.id,
                    schema_type: sourceJsondoc.schema_type,
                    data_preview: typeof sourceJsondoc.data === 'string'
                        ? sourceJsondoc.data.substring(0, 100) + '...'
                        : JSON.stringify(sourceJsondoc.data).substring(0, 100) + '...'
                });

                let outputJsondocType: TypedJsondoc['schema_type'];
                if (sourceJsondoc.schema_type === '灵感创意') {
                    outputJsondocType = '灵感创意'; // Use new schema type
                } else {
                    outputJsondocType = '灵感创意'; // Legacy type
                }

                // Create config for JSON patch generation
                const config: StreamingTransformConfig<BrainstormEditInput, JsonPatchOperation[]> = {
                    templateName: 'brainstorm_edit_diff',
                    inputSchema: BrainstormEditInputSchema,
                    outputSchema: JsonPatchOperationsSchema, // JSON patch operations for external output

                    // Custom template preparation to include user context
                    prepareTemplateVariables: async (input) => {
                        console.log(`[BrainstormEditTool] Preparing template variables for input:`, {
                            jsondocsCount: input.jsondocs.length,
                            editRequirements: input.editRequirements?.substring(0, 100) + '...',
                            ideaIndex: input.ideaIndex
                        });

                        // Create a custom jsondocs object similar to OutlineSettingsTool
                        const templateJsondocs: Record<string, any> = {};

                        // Process each jsondoc reference
                        for (const jsondocRef of input.jsondocs) {
                            const sourceJsondoc = await jsondocRepo.getJsondoc(jsondocRef.jsondocId);
                            if (sourceJsondoc) {
                                // Use description as key, fallback to schema type
                                const key = jsondocRef.description || sourceJsondoc.schema_type;

                                templateJsondocs[key] = {
                                    id: sourceJsondoc.id,
                                    schemaType: sourceJsondoc.schema_type,
                                    schema_type: sourceJsondoc.schema_type,
                                    content: typeof sourceJsondoc.data === 'string'
                                        ? JSON.parse(sourceJsondoc.data)
                                        : sourceJsondoc.data,
                                    data: typeof sourceJsondoc.data === 'string'
                                        ? JSON.parse(sourceJsondoc.data)
                                        : sourceJsondoc.data
                                };
                            }
                        }

                        console.log(`[BrainstormEditTool] Template jsondocs keys:`, Object.keys(templateJsondocs));

                        // Enhance with user context if available
                        let enhancedEditRequirements = params.editRequirements;
                        if (userContext?.originalUserRequest) {
                            enhancedEditRequirements = `用户原始完整请求: "${userContext.originalUserRequest}"

代理解释的编辑要求: "${params.editRequirements}"

请根据用户的原始完整请求进行编辑，而不仅仅是代理的解释。`;
                        }

                        // Return raw objects - let TemplateService handle format conversion
                        // For unified diff templates, TemplateService will convert to JSON with line numbers
                        const { jsondocs, ...otherParams } = input;

                        return {
                            jsondocs: templateJsondocs, // Raw objects, not YAML string
                            params: {
                                ...otherParams,
                                editRequirements: enhancedEditRequirements,
                                ...(userContext?.originalUserRequest && {
                                    originalUserRequest: userContext.originalUserRequest,
                                    agentInterpretation: params.editRequirements
                                })
                            } // Raw objects, not YAML string
                        };
                    }
                };

                // Execute the streaming transform with patch-approval mode
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
                        originalJsondoc: {
                            // Include the extracted idea data that the user wants to edit
                            ...originalIdea,
                            // Add the necessary metadata fields from the source jsondoc for patch creation
                            id: sourceJsondoc.id,
                            schema_type: sourceJsondoc.schema_type,
                            project_id: sourceJsondoc.project_id,
                            // Preserve other metadata that might be needed
                            metadata: sourceJsondoc.metadata,
                            origin_type: sourceJsondoc.origin_type
                        }
                    },
                    transformMetadata: {
                        toolName: 'edit_灵感创意',
                        source_jsondoc_id: sourceJsondocRef.jsondocId,
                        idea_index: params.ideaIndex,
                        edit_requirements: params.editRequirements,
                        original_idea: originalIdea,
                        platform: targetPlatform,
                        genre: storyGenre,
                        method: 'unified_patch',
                        source_jsondoc_type: sourceJsondoc.schema_type,
                        output_jsondoc_type: outputJsondocType
                    },
                    enableCaching: cachingOptions?.enableCaching,
                    seed: cachingOptions?.seed,
                    temperature: cachingOptions?.temperature,
                    topP: cachingOptions?.topP,
                    maxTokens: cachingOptions?.maxTokens
                });

                // Extract patch content for agent context
                const patchContent = await extractPatchContentForAgent(result.transformId, transformRepo, jsondocRepo);

                console.log(`[BrainstormEditTool] Successfully created ${patchContent.length} patches for review`);

                return {
                    status: 'success',
                    outputJsondocId: result.transformId, // Return the AI patch transform ID
                    finishReason: result.finishReason,
                    originalIdea,
                    patchContent: patchContent, // For agent awareness
                    patchCount: patchContent.length,
                    message: `Created ${patchContent.length} patches for your review. The changes will be applied after you approve them in the review modal.`
                };

            } catch (error) {
                console.error(`[BrainstormEditTool] Unified patch edit failed:`, error);
                return {
                    status: 'error',
                    error: `Brainstorm edit failed: ${error instanceof Error ? error.message : String(error)}`,
                    originalIdea: originalIdea || undefined
                };
            }
        }
    };
}
