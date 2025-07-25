import { z } from 'zod';
import type { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import type { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';
import { executeStreamingTransform, type StreamingTransformConfig } from '../transform-jsondoc-framework/StreamingTransformExecutor';
import {
    EpisodeSynopsisInputSchema,
    EpisodeSynopsisSchema,
    EpisodeSynopsisToolResultSchema,
    type EpisodeSynopsisInputV1,
    type EpisodeSynopsisV1,
    type EpisodeSynopsisToolResult
} from '../../common/schemas/outlineSchemas';
import { createJsondocProcessor } from './shared/JsondocProcessor';

// Type aliases for clarity - use z.infer to handle optional/default values properly
type EpisodeSynopsisInput = EpisodeSynopsisInputV1;
type EpisodeSynopsisOutput = z.infer<typeof EpisodeSynopsisSchema>;

/**
 * Episode Synopsis Generation Tool
 * Generates detailed episode synopses for individual episodes with cumulative context
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
        description: '为指定范围的剧集生成详细的每集大纲，包含2分钟短剧结构、钩子设计、悬念元素等',
        inputSchema: EpisodeSynopsisInputSchema,
        outputSchema: EpisodeSynopsisToolResultSchema,

        execute: async (params: EpisodeSynopsisInput, { toolCallId }) => {
            console.log(`[EpisodeSynopsisTool] Generating episode synopsis for episodes ${params.episodeStart}-${params.episodeEnd}`);

            // Use shared jsondoc processor to get initial context
            const jsondocProcessor = createJsondocProcessor(jsondocRepo, userId);
            const { jsondocData, jsondocMetadata, processedCount } = await jsondocProcessor.processJsondocs(params.jsondocs);

            console.log(`[EpisodeSynopsisTool] Processed ${processedCount} initial jsondocs`);

            const outputJsondocIds: string[] = [];
            const generatedSynopses: Array<{ jsondocId: string; data: EpisodeSynopsisV1 }> = [];

            // Iterate through each episode in the range
            for (let episodeNumber = params.episodeStart; episodeNumber <= params.episodeEnd; episodeNumber++) {
                console.log(`[EpisodeSynopsisTool] Generating synopsis for episode ${episodeNumber}`);

                // Build cumulative context: original jsondocs + previous 2 episode synopses
                const contextJsondocs = [...params.jsondocs];

                // Add previous 2 episodes as context (if they exist)
                const previousEpisodes = generatedSynopses.slice(-2); // Get last 2 episodes
                for (const prevEpisode of previousEpisodes) {
                    contextJsondocs.push({
                        jsondocId: prevEpisode.jsondocId,
                        description: `第${prevEpisode.data.episodeNumber}集大纲`,
                        schemaType: 'episode_synopsis'
                    });
                }

                // Prepare input for this specific episode
                const episodeInput = {
                    jsondocs: contextJsondocs,
                    episodeNumber: episodeNumber,
                    groupTitle: params.groupTitle
                };

                // Streaming transform configuration for individual episode
                const config: StreamingTransformConfig<typeof episodeInput, EpisodeSynopsisOutput> = {
                    templateName: 'episode_synopsis_generation',
                    inputSchema: z.object({
                        jsondocs: z.array(z.object({
                            jsondocId: z.string(),
                            description: z.string(),
                            schemaType: z.string()
                        })),
                        episodeNumber: z.number(),
                        groupTitle: z.string()
                    }),
                    outputSchema: EpisodeSynopsisSchema
                };

                // Execute the streaming transform for this episode
                const result = await executeStreamingTransform({
                    config,
                    input: episodeInput,
                    projectId,
                    userId,
                    transformRepo,
                    jsondocRepo,
                    outputJsondocType: 'episode_synopsis',
                    executionMode: { mode: 'full-object' },
                    transformMetadata: {
                        toolName: 'generate_episode_synopsis',
                        ...jsondocMetadata, // Include all jsondoc IDs with their schema types as keys
                        target_episode_number: episodeNumber,
                        group_title: params.groupTitle,
                        episode_range: `${params.episodeStart}-${params.episodeEnd}`,
                        cumulative_context: previousEpisodes.length > 0 ?
                            previousEpisodes.map(ep => `第${ep.data.episodeNumber}集`).join(', ') : 'none'
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

                console.log(`[EpisodeSynopsisTool] Episode ${episodeNumber} synopsis generation completed. Output jsondoc: ${result.outputJsondocId}`);

                // Store the generated synopsis for use as context in next episodes
                const generatedJsondoc = await jsondocRepo.getJsondoc(result.outputJsondocId);
                if (generatedJsondoc) {
                    const synopsisData = typeof generatedJsondoc.data === 'string'
                        ? JSON.parse(generatedJsondoc.data)
                        : generatedJsondoc.data;

                    generatedSynopses.push({
                        jsondocId: result.outputJsondocId,
                        data: synopsisData
                    });
                }

                outputJsondocIds.push(result.outputJsondocId);
            }

            console.log(`[EpisodeSynopsisTool] All episodes generated. Total jsondocs: ${outputJsondocIds.length}`);

            return {
                outputJsondocIds: outputJsondocIds,
                finishReason: 'stop'
            };
        }
    };
} 