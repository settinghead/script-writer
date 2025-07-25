import { z } from 'zod';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { StreamingTransformConfig, executeStreamingTransform } from '../transform-jsondoc-framework/StreamingTransformExecutor';

import {
    IdeationInputSchema,
    IdeationInput,
    IdeationOutput,
    IdeationOutputSchema
} from '@/common/transform_schemas';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { createJsondocProcessor } from './shared/JsondocProcessor';
import { BrainstormToolResultSchema } from './BrainstormEditTool';

// Tool execution result type - now returns single collection jsondoc ID
interface BrainstormToolResult {
    outputJsondocId: string; // Single collection jsondoc ID
    finishReason: string;
}

// Collection-based brainstorm tool - no longer needs individual idea caching

/**
 * Extract brainstorm parameters from brainstorm input jsondoc
 * Now validates that the jsondoc is of the correct schema type
 */
async function extractBrainstormParams(
    brainstormInputJsondocId: string,
    jsondocRepo: JsondocRepository,
    userId: string
): Promise<{
    platform: string;
    genre: string;
    other_requirements: string;
    numberOfIdeas: number;
}> {
    // Get brainstorm input jsondoc
    const brainstormInputJsondoc = await jsondocRepo.getJsondoc(brainstormInputJsondocId);
    if (!brainstormInputJsondoc) {
        throw new Error(`Brainstorm input jsondoc not found: ${brainstormInputJsondocId}`);
    }

    // Validate schema type
    if (brainstormInputJsondoc.schema_type !== 'brainstorm_input_params') {
        throw new Error(`Invalid jsondoc schema type: expected 'brainstorm_input_params', got '${brainstormInputJsondoc.schema_type}'`);
    }

    // Verify user has access to this jsondoc's project
    const hasAccess = await jsondocRepo.userHasProjectAccess(userId, brainstormInputJsondoc.project_id);
    if (!hasAccess) {
        throw new Error('Access denied to brainstorm input jsondoc');
    }

    // Parse source data
    let sourceData;
    try {
        sourceData = typeof brainstormInputJsondoc.data === 'string'
            ? JSON.parse(brainstormInputJsondoc.data)
            : brainstormInputJsondoc.data;
    } catch (error) {
        throw new Error('Failed to parse brainstorm input jsondoc data');
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
 * Transform LLM output (array of ideas) to collection jsondoc format
 */
function transformToCollectionFormat(llmOutput: IdeationOutput, extractedParams: {
    platform: string;
    genre: string;
    other_requirements: string;
    numberOfIdeas: number;
}): any {
    // Handle cases where llmOutput might not be an array during streaming
    let ideasArray: any[] = [];

    if (Array.isArray(llmOutput)) {
        ideasArray = llmOutput;
    } else if (llmOutput && typeof llmOutput === 'object') {
        // Handle case where LLM returns an object instead of array
        const outputObj = llmOutput as any;
        if ('ideas' in outputObj && Array.isArray(outputObj.ideas)) {
            ideasArray = outputObj.ideas;
        } else {
            // Treat the object as a single idea
            ideasArray = [llmOutput];
        }
    } else {
        // Fallback for unexpected types
        console.warn('[transformToCollectionFormat] Unexpected llmOutput type:', typeof llmOutput);
        ideasArray = [];
    }

    const collectionIdeas = ideasArray
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
        name: 'generate_灵感创意s',
        description: '生成新的故事创意。适用场景：用户想要全新的故事想法、需要更多创意选择、或当前没有满意的故事创意时。例如："给我一些新的故事想法"、"再想几个不同的创意"。需要明确指定brainstorm_input_params类型的jsondoc ID来获取创作参数（平台、题材等）。',
        inputSchema: IdeationInputSchema,
        outputSchema: BrainstormToolResultSchema,
        execute: async (params: IdeationInput): Promise<BrainstormToolResult> => {
            console.log(`[BrainstormTool] Starting brainstorm generation with brainstorm input: ${params.brainstormInputJsondocId}`);

            // Extract parameters from the explicit brainstorm input jsondoc
            const extractedParams = await extractBrainstormParams(params.brainstormInputJsondocId, jsondocRepo, userId);
            console.log(`[BrainstormTool] Extracted params:`, extractedParams);

            // Use shared jsondoc processor for any additional context jsondocs
            const jsondocProcessor = createJsondocProcessor(jsondocRepo, userId);
            const { jsondocData, jsondocMetadata, processedCount } = await jsondocProcessor.processJsondocs(params.jsondocs);

            console.log(`[BrainstormTool] Processed ${processedCount} additional context jsondocs`);

            // Create config with extracted parameters
            const config: StreamingTransformConfig<IdeationInput, any> = {
                templateName: 'brainstorming',
                inputSchema: IdeationInputSchema,
                outputSchema: z.object({
                    ideas: IdeationOutputSchema
                }),
                // Transform LLM output ({ ideas: [...] }) to collection format (object)
                transformLLMOutput: (llmOutput: any, input: IdeationInput) => {
                    return transformToCollectionFormat(llmOutput.ideas || llmOutput, extractedParams);
                }
                // No custom prepareTemplateVariables - use default schema-driven extraction
            };

            const result = await executeStreamingTransform({
                config,
                input: params,
                projectId,
                userId,
                transformRepo,
                jsondocRepo,
                outputJsondocType: 'brainstorm_collection',
                executionMode: { mode: 'full-object' },
                transformMetadata: {
                    toolName: 'generate_灵感创意s',
                    brainstormInputJsondocId: params.brainstormInputJsondocId, // Include the explicit brainstorm input jsondoc ID
                    ...jsondocMetadata, // Include all additional context jsondoc IDs with their schema types as keys
                    platform: extractedParams.platform,
                    genre: extractedParams.genre,
                    numberOfIdeas: extractedParams.numberOfIdeas,
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