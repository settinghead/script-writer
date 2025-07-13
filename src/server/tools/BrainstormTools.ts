import { IdeationInputSchema, IdeationOutputSchema, IdeationInput, IdeationOutput } from '../../common/transform_schemas';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import {
    executeStreamingTransform,
    StreamingTransformConfig,
    StreamingExecutionMode
} from '../transform-jsondoc-framework/StreamingTransformExecutor';

import {
    BrainstormEditInputSchema,
    BrainstormEditInput,

} from '../../common/schemas/transforms';
import { extractDataAtPath } from '../services/transform-instantiations/pathTransforms';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { z } from 'zod';
import { TypedJsondoc } from '@/common/types';

const BrainstormEditToolResultSchema = z.object({
    outputJsondocId: z.string(),
    finishReason: z.string(),
    originalIdea: z.object({
        title: z.string(),
        body: z.string()
    }).optional(),
    editedIdea: z.object({
        title: z.string(),
        body: z.string()
    }).optional()
});

const BrainstormToolResultSchema = z.object({
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
    originalIdea: { title: string; body: string };
    targetPlatform: string;
    storyGenre: string;
}> {
    // Get source jsondoc and extract the idea to edit
    const sourceJsondoc = await jsondocRepo.getJsondoc(params.sourceJsondocId);
    if (!sourceJsondoc) {
        throw new Error('Source jsondoc not found');
    }

    // Verify user has access to this jsondoc's project
    const hasAccess = await jsondocRepo.userHasProjectAccess(userId, sourceJsondoc.project_id);
    if (!hasAccess) {
        throw new Error('Access denied to source jsondoc');
    }

    const sourceData = sourceJsondoc.data;
    let originalIdea: { title: string; body: string };
    let targetPlatform = 'unknown';
    let storyGenre = 'unknown';

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

            // Get platform/genre from collection metadata
            targetPlatform = sourceData.platform || 'unknown';
            storyGenre = sourceData.genre || 'unknown';
        } catch (extractError) {
            throw new Error(`Failed to extract idea at index ${params.ideaIndex}: ${extractError instanceof Error ? extractError.message : String(extractError)}`);
        }
    } else if (sourceJsondoc.schema_type === 'brainstorm_idea') {
        // Direct brainstorm idea jsondoc
        if (!sourceData.title || !sourceData.body) {
            throw new Error('Invalid brainstorm idea jsondoc');
        }

        originalIdea = {
            title: sourceData.title,
            body: sourceData.body
        };

        if (sourceJsondoc.metadata) {
            targetPlatform = sourceJsondoc.metadata.platform || 'unknown';
            storyGenre = sourceJsondoc.metadata.genre || 'unknown';
        }
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
            if (originalJsondoc?.metadata) {
                targetPlatform = originalJsondoc.metadata.platform || 'unknown';
                storyGenre = originalJsondoc.metadata.genre || 'unknown';
            }
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
        name: 'edit_brainstorm_idea',
        description: '使用JSON补丁方式编辑和改进现有故事创意。适用场景：用户对现有创意有具体的修改要求或改进建议。使用JSON Patch格式进行精确修改，只改变需要改变的部分，提高效率和准确性。重要：必须使用项目背景信息中显示的完整ID作为sourceJsondocId参数。支持各种编辑类型：内容扩展、风格调整、情节修改、结构调整等。',
        inputSchema: BrainstormEditInputSchema,
        outputSchema: BrainstormEditToolResultSchema,
        execute: async (params: BrainstormEditInput, { toolCallId }): Promise<BrainstormEditToolResult> => {
            console.log(`[BrainstormEditTool] Starting unified patch edit for jsondoc ${params.sourceJsondocId}`);

            // Extract source idea data for context
            const { originalIdea, targetPlatform, storyGenre } = await extractSourceIdeaData(params, jsondocRepo, userId);

            // Determine output jsondoc type based on source jsondoc type
            const sourceJsondoc = await jsondocRepo.getJsondoc(params.sourceJsondocId);
            if (!sourceJsondoc) {
                throw new Error('Source jsondoc not found');
            }

            let outputJsondocType: TypedJsondoc['schema_type'];
            if (sourceJsondoc.schema_type === 'brainstorm_idea') {
                outputJsondocType = 'brainstorm_idea'; // Use new schema type
            } else {
                outputJsondocType = 'brainstorm_idea'; // Legacy type
            }

            // Create config for unified patch generation using existing edit template
            const config: StreamingTransformConfig<BrainstormEditInput, any> = {
                templateName: 'brainstorm_edit',
                inputSchema: BrainstormEditInputSchema,
                outputSchema: z.any(), // JSON patch output schema
                prepareTemplateVariables: (input) => ({
                    originalTitle: originalIdea.title,
                    originalBody: originalIdea.body,
                    targetPlatform: targetPlatform,
                    storyGenre: storyGenre,
                    editRequirements: input.editRequirements,
                    agentInstructions: input.agentInstructions || '请根据用户要求进行适当的改进和优化。'
                }),
                extractSourceJsondocs: (input) => [{
                    jsondocId: input.sourceJsondocId,
                    inputRole: 'source'
                }]
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
                        originalJsondoc: originalIdea
                    },
                    transformMetadata: {
                        toolName: 'edit_brainstorm_idea',
                        source_jsondoc_id: params.sourceJsondocId,
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

                // Get the final jsondoc to extract the edited idea
                const finalJsondoc = await jsondocRepo.getJsondoc(result.outputJsondocId);
                const editedIdea = finalJsondoc?.data || originalIdea;

                console.log(`[BrainstormEditTool] Successfully completed unified patch edit with jsondoc ${result.outputJsondocId}`);

                return {
                    outputJsondocId: result.outputJsondocId,
                    finishReason: result.finishReason,
                    originalIdea,
                    editedIdea: {
                        title: editedIdea.title || originalIdea.title,
                        body: editedIdea.body || originalIdea.body
                    }
                };

            } catch (error) {
                console.error(`[BrainstormEditTool] Unified patch edit failed:`, error);
                throw new Error(`Brainstorm edit failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    };
}



// Tool execution result type - now returns single collection jsondoc ID
interface BrainstormToolResult {
    outputJsondocId: string; // Single collection jsondoc ID
    finishReason: string;
}

// Collection-based brainstorm tool - no longer needs individual idea caching

/**
 * Extract brainstorm parameters from source jsondoc
 */
async function extractBrainstormParams(
    sourceJsondocId: string,
    jsondocRepo: JsondocRepository,
    userId: string
): Promise<{
    platform: string;
    genre: string;
    other_requirements: string;
    numberOfIdeas: number;
}> {
    // Get source jsondoc
    const sourceJsondoc = await jsondocRepo.getJsondoc(sourceJsondocId);
    if (!sourceJsondoc) {
        throw new Error('Source jsondoc not found');
    }

    // Verify user has access to this jsondoc's project
    const hasAccess = await jsondocRepo.userHasProjectAccess(userId, sourceJsondoc.project_id);
    if (!hasAccess) {
        throw new Error('Access denied to source jsondoc');
    }

    // Parse source data
    let sourceData;
    try {
        sourceData = typeof sourceJsondoc.data === 'string'
            ? JSON.parse(sourceJsondoc.data)
            : sourceJsondoc.data;
    } catch (error) {
        throw new Error('Failed to parse source jsondoc data');
    }

    // Extract parameters
    return {
        platform: sourceData.platform || '抖音',
        genre: sourceData.genre || '甜宠',
        other_requirements: sourceData.other_requirements || '',
        numberOfIdeas: sourceData.numberOfIdeas || 3
    };
}

/**
 * Build requirements section for brainstorming template
 */
function buildRequirementsSection(params: {
    platform: string;
    genre: string;
    other_requirements: string;
    numberOfIdeas: number;
}): string {
    // Build requirements based on extracted parameters
    const parts: string[] = [];

    // Add platform and genre context
    parts.push(`请为${params.platform}平台创作${params.genre}类型的故事创意。`);

    // Add number of ideas requirement
    parts.push(`请生成${params.numberOfIdeas}个故事创意（不多不少）。`);

    // Add user requirements if provided
    if (params.other_requirements) {
        parts.push(`用户要求: ${params.other_requirements}`);
    }

    return parts.join('\n');
}

/**
 * Transform LLM output (array of ideas) to collection jsondoc format
 */
function transformToCollectionFormat(llmOutput: IdeationOutput, extractedParams: {
    platform: string;
    genre: string;
    other_requirements: string;
    numberOfIdeas: number;
}): any {
    const collectionIdeas = llmOutput
        .filter((idea: any) => idea && idea.title && idea.body && idea.body.length >= 10)
        .map((idea: any, index: number) => ({
            title: idea.title,
            body: idea.body,
            metadata: {
                ideaIndex: index,
                confidence_score: 0.8 // Default confidence
            }
        }));

    return {
        ideas: collectionIdeas,
        platform: extractedParams.platform,
        genre: extractedParams.genre,
        total_ideas: collectionIdeas.length
    };
}

/**
 * Factory function that creates a brainstorm tool definition using the new streaming framework
 */
export function createBrainstormToolDefinition(
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
): StreamingToolDefinition<IdeationInput, BrainstormToolResult> {
    return {
        name: 'generate_brainstorm_ideas',
        description: '生成新的故事创意。适用场景：用户想要全新的故事想法、需要更多创意选择、或当前没有满意的故事创意时。例如："给我一些新的故事想法"、"再想几个不同的创意"。基于平台和类型生成适合短视频内容的创意故事概念。',
        inputSchema: IdeationInputSchema,
        outputSchema: BrainstormToolResultSchema,
        execute: async (params: IdeationInput): Promise<BrainstormToolResult> => {
            // Extract parameters from source jsondoc
            const extractedParams = await extractBrainstormParams(params.sourceJsondocId, jsondocRepo, userId);

            // Create config with extracted parameters
            const config: StreamingTransformConfig<IdeationInput, IdeationOutput> = {
                templateName: 'brainstorming',
                inputSchema: IdeationInputSchema,
                outputSchema: IdeationOutputSchema,
                prepareTemplateVariables: (input) => ({
                    genre: extractedParams.genre,
                    platform: extractedParams.platform,
                    numberOfIdeas: extractedParams.numberOfIdeas.toString(),
                    requirementsSection: buildRequirementsSection(extractedParams),
                    otherRequirements: input.otherRequirements
                }),
                transformLLMOutput: (llmOutput) => transformToCollectionFormat(llmOutput, extractedParams),
                // Extract source jsondoc for proper lineage
                extractSourceJsondocs: (input) => [{
                    jsondocId: input.sourceJsondocId,
                    inputRole: 'source'
                }]
            };

            const result = await executeStreamingTransform({
                config,
                input: params,
                projectId,
                userId,
                transformRepo,
                jsondocRepo,
                outputJsondocType: 'brainstorm_collection',
                transformMetadata: {
                    toolName: 'generate_brainstorm_ideas',
                    platform: extractedParams.platform,
                    genre: extractedParams.genre,
                    numberOfIdeas: extractedParams.numberOfIdeas,
                    source_jsondoc_id: params.sourceJsondocId,
                    initialData: {
                        ideas: [],
                        platform: extractedParams.platform,
                        genre: extractedParams.genre,
                        total_ideas: 0
                    }
                },
                // Pass caching options from factory
                enableCaching: cachingOptions?.enableCaching,
                seed: cachingOptions?.seed,
                temperature: cachingOptions?.temperature,
                topP: cachingOptions?.topP,
                maxTokens: cachingOptions?.maxTokens
            });

            console.log(`[BrainstormTool] Successfully completed brainstorm generation with jsondoc ${result.outputJsondocId}`);

            return {
                outputJsondocId: result.outputJsondocId,
                finishReason: result.finishReason
            };
        }
    };
} 