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
                // Load the specific episode synopsis jsondoc to ensure faithful alignment
                let synopsisData: any = null;
                try {
                    const synopsisDoc = await jsondocProcessor.getJsondocWithAccess(input.episodeSynopsisJsondocId);
                    if (synopsisDoc) {
                        synopsisData = typeof synopsisDoc.data === 'string' ? JSON.parse(synopsisDoc.data) : synopsisDoc.data;
                    }
                } catch (err) {
                    console.warn('[EpisodeScriptTool] Failed to load episode synopsis jsondoc', err);
                }

                // Try to derive simple background anchors from any provided settings doc (characters, key scenes)
                const candidateSettings = Object.values(jsondocData).find((d: any) => d && Array.isArray((d as any).characters));
                const characters = Array.isArray((candidateSettings as any)?.characters) ? (candidateSettings as any).characters : [];
                const keyScenes = Array.isArray((candidateSettings as any)?.setting?.key_scenes) ? (candidateSettings as any).setting.key_scenes : [];

                const backgroundAnchors = {
                    timePlaceHint: keyScenes[0] || '老地点/主要场景（如：银行外/医院天台/老街咖啡馆）',
                    characterNames: characters.slice(0, 5).map((c: any) => c.name).filter(Boolean),
                    occupations: characters.slice(0, 5).map((c: any) => c.occupation).filter(Boolean),
                    synopsisHook: synopsisData?.openingHook ?? '',
                    synopsisMainPlot: synopsisData?.mainPlot ?? '',
                    synopsisClimax: synopsisData?.emotionalClimax ?? '',
                    synopsisCliffhanger: synopsisData?.cliffhanger ?? ''
                };

                const params_data = {
                    episodeNumber: input.episodeNumber,
                    episodeSynopsisJsondocId: input.episodeSynopsisJsondocId,
                    userRequirements: input.userRequirements || '',
                    synopsis: synopsisData,
                    anchors: backgroundAnchors,
                    guidance: [
                        '严格对齐分集大纲字段：openingHook/mainPlot/emotionalClimax/cliffhanger，不得改写设定，仅可细化',
                        '片头20秒标注时间与地点（如：银行外 日 外）；片内60秒交代三角人物关系与起因锚点',
                        '至少一次【回忆/插叙/闪回】，用标签标注；用物件/动作/微表情交代背景，减少直白讲述'
                    ]
                };

                return {
                    params: params_data,
                    jsondocs: {
                        ...jsondocData,
                        单集大纲: synopsisData || jsondocData['单集大纲'] // ensure present under常用键
                    }
                };
            };

            // Transform LLM output to final format
            const transformLLMOutput = (llmOutput: EpisodeScriptV1, input: EpisodeScriptInput): EpisodeScriptV1 => {
                const safeScript = llmOutput.scriptContent ?? '';
                const safeDuration = llmOutput.estimatedDuration ?? 2;
                const safeSynopsisId = input.episodeSynopsisJsondocId ?? llmOutput.episodeSynopsisJsondocId ?? '';
                // Lightweight validation to encourage background anchoring
                const hasTimePlace = /场景：.*?(日|夜).*(内|外)/.test(safeScript);
                const hasFlash = /(回忆|插叙|闪回)/.test(safeScript);
                if (!hasTimePlace || !hasFlash) {
                    console.warn('[EpisodeScriptTool] Background anchoring missing parts:', { hasTimePlace, hasFlash });
                }
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