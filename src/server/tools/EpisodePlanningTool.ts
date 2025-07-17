import { z } from 'zod';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import {
    EpisodePlanningInputSchema,
    EpisodePlanningInput,
    EpisodePlanningOutputSchema,
    EpisodePlanningOutput
} from '../../common/schemas/outlineSchemas';
import {
    executeStreamingTransform,
    StreamingTransformConfig
} from '../transform-jsondoc-framework/StreamingTransformExecutor';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { createJsondocProcessor } from './shared/JsondocProcessor';

const EpisodePlanningToolResultSchema = z.object({
    outputJsondocId: z.string(),
    finishReason: z.string()
});

interface EpisodePlanningToolResult {
    outputJsondocId: string;
    finishReason: string;
}

/**
 * Factory function that creates an episode planning tool definition
 */
export function createEpisodePlanningToolDefinition(
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
): StreamingToolDefinition<EpisodePlanningInput, EpisodePlanningToolResult> {
    return {
        name: 'generate_episode_planning',
        description: '生成剧集框架（优化观看顺序和情感节奏）。适用场景：用户已完成相关创作步骤，需要生成适合短视频平台的剧集框架。系统会自动处理所有相关的上下文信息作为参考资料。',
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
                templateName: 'episode_planning',
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
                outputJsondocType: 'episode_planning',
                transformMetadata: {
                    toolName: 'generate_episode_planning',
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