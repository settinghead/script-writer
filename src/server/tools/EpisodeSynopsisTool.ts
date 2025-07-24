import { z } from 'zod';
import type { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import type { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { executeStreamingTransform, type StreamingTransformConfig } from '../transform-jsondoc-framework/StreamingTransformExecutor';
import {
    EpisodeSynopsisInputSchema,
    EpisodeSynopsisGroupSchema,
    EpisodeSynopsisToolResultSchema,
    type EpisodeSynopsisInputV1,
    type EpisodeSynopsisGroupV1,
    type EpisodeSynopsisToolResult
} from '../../common/schemas/outlineSchemas';
import { createJsondocProcessor } from './shared/JsondocProcessor';

// Type aliases for clarity - use z.infer to handle optional/default values properly
type EpisodeSynopsisInput = EpisodeSynopsisInputV1;
type EpisodeSynopsisOutput = z.infer<typeof EpisodeSynopsisGroupSchema>;

/**
 * Episode Synopsis Generation Tool
 * Generates detailed episode synopses for a specific episode group based on episode planning
 */
export function createEpisodeSynopsisToolDefinition(
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
): StreamingToolDefinition<EpisodeSynopsisInput, EpisodeSynopsisToolResult> {

    return {
        name: 'generate_episode_synopsis',
        description: '生成指定剧集组的详细每集大纲，包含2分钟短剧结构、钩子设计、悬念元素等',
        inputSchema: EpisodeSynopsisInputSchema,
        outputSchema: EpisodeSynopsisToolResultSchema,

        execute: async (params: EpisodeSynopsisInput, { toolCallId }) => {
            console.log(`[EpisodeSynopsisTool] Generating episode synopsis for group: ${params.groupTitle} (${params.episodeRange})`);

            // Use shared jsondoc processor
            const jsondocProcessor = createJsondocProcessor(jsondocRepo, userId);
            const { jsondocData, jsondocMetadata, processedCount } = await jsondocProcessor.processJsondocs(params.jsondocs);

            console.log(`[EpisodeSynopsisTool] Processed ${processedCount} jsondocs`);

            // Streaming transform configuration
            const config: StreamingTransformConfig<EpisodeSynopsisInput, EpisodeSynopsisOutput> = {
                templateName: 'episode_synopsis_generation',
                inputSchema: EpisodeSynopsisInputSchema,
                outputSchema: EpisodeSynopsisGroupSchema
                // No custom prepareTemplateVariables - use default schema-driven approach
            };

            // Execute the streaming transform
            const result = await executeStreamingTransform({
                config,
                input: params,
                projectId,
                userId,
                transformRepo,
                jsondocRepo,
                outputJsondocType: 'episode_synopsis',
                executionMode: { mode: 'full-object' },
                transformMetadata: {
                    toolName: 'generate_episode_synopsis',
                    ...jsondocMetadata, // Include all jsondoc IDs with their schema types as keys
                    target_group_title: params.groupTitle,
                    target_episode_range: params.episodeRange,
                    target_episodes: params.episodes.join(',')
                },
                // Pass caching options from factory
                enableCaching: cachingOptions?.enableCaching,
                seed: cachingOptions?.seed,
                temperature: cachingOptions?.temperature,
                topP: cachingOptions?.topP,
                maxTokens: cachingOptions?.maxTokens,
                // Pass tool call ID for conversation history tracking
                toolCallId
            });

            console.log(`[EpisodeSynopsisTool] Episode synopsis generation completed. Output jsondoc: ${result.outputJsondocId}`);

            return {
                outputJsondocId: result.outputJsondocId,
                finishReason: result.finishReason
            };
        }
    };
} 