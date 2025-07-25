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
        description: '生成新的故事创意。适用场景：用户想要全新的故事想法、需要更多创意选择、或当前没有满意的故事创意时。例如："给我一些新的故事想法"、"再想几个不同的创意"。系统会自动处理所有相关的上下文信息作为参考资料。',
        inputSchema: IdeationInputSchema,
        outputSchema: BrainstormToolResultSchema,
        execute: async (params: IdeationInput): Promise<BrainstormToolResult> => {
            console.log(`[BrainstormTool] Starting brainstorm generation with ${params.jsondocs.length} jsondocs`);

            // Use shared jsondoc processor
            const jsondocProcessor = createJsondocProcessor(jsondocRepo, userId);
            const { jsondocData, jsondocMetadata, processedCount } = await jsondocProcessor.processJsondocs(params.jsondocs);

            console.log(`[BrainstormTool] Processed ${processedCount} jsondocs`);

            // Extract parameters from first jsondoc for backward compatibility
            // This maintains the existing behavior while using the shared processor
            const sourceJsondocRef = params.jsondocs[0];
            const extractedParams = await extractBrainstormParams(sourceJsondocRef.jsondocId, jsondocRepo, userId);

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
                    ...jsondocMetadata, // Include all jsondoc IDs with their schema types as keys
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