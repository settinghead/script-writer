import { z } from 'zod';

import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import { executeStreamingTransform } from '../transform-jsondoc-framework/StreamingTransformExecutor';
import { EpisodeScriptInputSchema, EpisodeScriptSchema, EpisodeScriptToolResultSchema } from '../../common/schemas/outlineSchemas';
import { episodeScriptTemplate } from '../services/templates/episodeScript';
import { createJsondocProcessor } from '../tools/shared/JsondocProcessor';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';

export type EpisodeScriptInput = z.infer<typeof EpisodeScriptInputSchema>;
export type EpisodeScriptV1 = z.infer<typeof EpisodeScriptSchema>;
export type EpisodeScriptToolResult = z.infer<typeof EpisodeScriptToolResultSchema>;

/**
 * Creates episode script tool definition for generating complete script content
 * Based on episode synopsis and outline settings
 */
export function createEpisodeScriptToolDefinition(
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
): StreamingToolDefinition<EpisodeScriptInput, EpisodeScriptToolResult> {
    return {
        name: 'generate_单集剧本',
        description: '为指定集数生成完整的剧本内容，包含对话、动作指导和场景描述',
        inputSchema: EpisodeScriptInputSchema,
        outputSchema: EpisodeScriptToolResultSchema,

        execute: async (params: EpisodeScriptInput, { toolCallId }) => {
            console.log(`[EpisodeScriptTool] Generating script for episode ${params.episodeNumber}`);

            // Use shared jsondoc processor to get context
            const jsondocProcessor = createJsondocProcessor(jsondocRepo, userId);
            const { jsondocData, processedCount } = await jsondocProcessor.processJsondocs(params.jsondocs);

            console.log(`[EpisodeScriptTool] Processed ${processedCount} context jsondocs`);

            // Custom template variables for episode script generation
            const prepareTemplateVariables = async (input: EpisodeScriptInput) => {
                const params_data = {
                    episodeNumber: input.episodeNumber,
                    episodeSynopsisJsondocId: input.episodeSynopsisJsondocId,
                    userRequirements: input.userRequirements || ''
                };

                return {
                    params: params_data,
                    jsondocs: jsondocData
                };
            };

            // Transform LLM output to final format
            const transformLLMOutput = (llmOutput: EpisodeScriptV1, input: EpisodeScriptInput): EpisodeScriptV1 => {
                const safeScript = llmOutput.scriptContent ?? '';
                const safeDuration = llmOutput.estimatedDuration ?? 2;
                const safeSynopsisId = input.episodeSynopsisJsondocId ?? llmOutput.episodeSynopsisJsondocId ?? '';

                return {
                    ...llmOutput,
                    scriptContent: safeScript,
                    episodeNumber: input.episodeNumber,
                    episodeSynopsisJsondocId: safeSynopsisId,
                    wordCount: llmOutput.wordCount ?? safeScript.length,
                    estimatedDuration: safeDuration
                };
            };

            // Execute streaming transform
            const result = await executeStreamingTransform({
                config: {
                    templateName: episodeScriptTemplate.id,
                    inputSchema: EpisodeScriptInputSchema,
                    outputSchema: EpisodeScriptSchema,
                    prepareTemplateVariables,
                    transformLLMOutput
                },
                input: params,
                projectId,
                userId,
                transformRepo,
                jsondocRepo,
                outputJsondocType: '单集剧本',
                transformMetadata: {
                    episode_number: params.episodeNumber,
                    单集大纲_id: params.episodeSynopsisJsondocId,
                    tool_call_id: toolCallId
                },
                updateIntervalChunks: 3,
                executionMode: { mode: 'full-object' },
                toolCallId,
                ...cachingOptions
            });

            return {
                outputJsondocId: result.outputJsondocId,
                episodeNumber: params.episodeNumber,
                message: `第${params.episodeNumber}集剧本生成完成`
            };
        }
    };
} 