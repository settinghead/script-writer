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
        description: '基于时间顺序大纲生成剧集规划（优化观看顺序和情感节奏）。适用场景：用户已完成时间顺序大纲，需要生成适合短视频平台的剧集规划。必须使用项目背景信息中显示的完整chronicles jsondoc ID作为sourceJsondocId参数。',
        inputSchema: EpisodePlanningInputSchema,
        outputSchema: EpisodePlanningToolResultSchema,
        execute: async (params: EpisodePlanningInput, { toolCallId }): Promise<EpisodePlanningToolResult> => {
            const sourceJsondocRef = params.jsondocs[0];
            console.log(`[EpisodePlanningTool] Starting streaming episode planning generation for chronicles jsondoc ${sourceJsondocRef.jsondocId}`);

            // Extract chronicles data first
            const chroniclesJsondoc = await jsondocRepo.getJsondoc(sourceJsondocRef.jsondocId);
            if (!chroniclesJsondoc) {
                throw new Error('Chronicles jsondoc not found');
            }

            // Verify user has access to this jsondoc's project
            const hasAccess = await jsondocRepo.userHasProjectAccess(userId, chroniclesJsondoc.project_id);
            if (!hasAccess) {
                throw new Error('Access denied to chronicles jsondoc');
            }

            // Verify jsondoc is chronicles type
            if (chroniclesJsondoc.schema_type !== 'chronicles') {
                throw new Error(`Expected chronicles jsondoc, got: ${chroniclesJsondoc.schema_type}`);
            }

            // Extract chronicles data
            const chroniclesData = chroniclesJsondoc.data;
            if (!chroniclesData.stages || !Array.isArray(chroniclesData.stages)) {
                throw new Error('Invalid chronicles jsondoc data - missing stages array');
            }

            console.log(`[EpisodePlanningTool] Using chronicles with ${chroniclesData.stages.length} stages, target episodes: ${params.numberOfEpisodes}`);

            // Create streaming config with extracted data
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
                    chronicles_jsondoc_id: sourceJsondocRef.jsondocId,
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