import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import {
    OutlineGenerationInputSchema,
    OutlineGenerationInput,
    OutlineGenerationOutputSchema,
    OutlineGenerationOutput
} from '../../common/schemas/outlineSchemas';
import {
    executeStreamingTransform,
    StreamingTransformConfig
} from '../services/StreamingTransformExecutor';

// Temporary type definition for Electric Sync migration - matches actual StreamingAgentFramework
interface StreamingToolDefinition<TInput, TOutput> {
    name: string;
    description: string;
    inputSchema: any;
    outputSchema: any;
    execute: (params: TInput, options: { toolCallId: string }) => Promise<any>;
}

interface OutlineToolResult {
    outputArtifactId: string;
    finishReason: string;
}

/**
 * Factory function that creates an outline generation tool definition
 */
export function createOutlineToolDefinition(
    transformRepo: TransformRepository,
    artifactRepo: ArtifactRepository,
    projectId: string,
    userId: string,
    cachingOptions?: {
        enableCaching?: boolean;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }
): StreamingToolDefinition<OutlineGenerationInput, OutlineToolResult> {
    return {
        name: 'generate_outline',
        description: '基于选定的故事创意生成详细的剧集大纲。适用场景：用户已有满意的故事创意，需要生成可执行的剧集结构和角色发展。要求用户提供集数配置、平台要求等参数。必须使用项目背景信息中显示的完整artifact ID作为sourceArtifactId参数。',
        inputSchema: OutlineGenerationInputSchema,
        outputSchema: OutlineGenerationOutputSchema,
        execute: async (params: OutlineGenerationInput, { toolCallId }): Promise<OutlineToolResult> => {
            console.log(`[OutlineTool] Starting streaming outline generation for artifact ${params.sourceArtifactId}`);

            // Extract source idea data first
            const sourceArtifact = await artifactRepo.getArtifact(params.sourceArtifactId);
            if (!sourceArtifact) {
                throw new Error('Source brainstorm idea not found');
            }

            // Verify user has access to this artifact's project
            const hasAccess = await artifactRepo.userHasProjectAccess(userId, sourceArtifact.project_id);
            if (!hasAccess) {
                throw new Error('Access denied to source artifact');
            }

            // Extract source idea data
            let sourceIdeaData: { title: string; body: string };
            if (sourceArtifact.type === 'brainstorm_idea') {
                sourceIdeaData = {
                    title: sourceArtifact.data.title,
                    body: sourceArtifact.data.body
                };
            } else if (sourceArtifact.type === 'user_input') {
                const derivedData = sourceArtifact.metadata?.derived_data;
                if (!derivedData || !derivedData.title || !derivedData.body) {
                    throw new Error('Invalid user input artifact for outline generation');
                }
                sourceIdeaData = {
                    title: derivedData.title,
                    body: derivedData.body
                };
            } else {
                throw new Error(`Unsupported source artifact type: ${sourceArtifact.type}`);
            }

            console.log(`[OutlineTool] Using source idea: ${sourceIdeaData.title}`);

            // Create streaming config with extracted data
            const config: StreamingTransformConfig<OutlineGenerationInput, OutlineGenerationOutput> = {
                templateName: 'outline',
                inputSchema: OutlineGenerationInputSchema,
                outputSchema: OutlineGenerationOutputSchema,
                prepareTemplateVariables: (input) => {
                    const genreString = input.selectedGenrePaths
                        .map(path => path.join(' > '))
                        .join(', ');
                    const episodeInfo = `总共${input.totalEpisodes}集，每集${input.episodeDuration}分钟`;

                    // Calculate recommended number of stages based on episode count
                    const recommendedStages = Math.ceil(input.totalEpisodes / 6) + 2; // Roughly 1 stage per 6 episodes, minimum 3
                    const stageGuidance = `请创建${recommendedStages}个左右的故事阶段（${input.totalEpisodes}集适合${recommendedStages}个阶段）`;

                    return ({
                        userInput: `${sourceIdeaData.title}\n\n${sourceIdeaData.body}`,
                        totalEpisodes: input.totalEpisodes.toString(),
                        episodeInfo: episodeInfo,
                        platform: input.selectedPlatform,
                        genre: genreString,
                        requirements: input.requirements || '无特殊要求',
                        stageGuidance: stageGuidance
                    });
                },
                // NEW: Extract source artifact for proper lineage
                extractSourceArtifacts: (input) => [{
                    artifactId: input.sourceArtifactId,
                    inputRole: 'source'
                }]
            };

            const result = await executeStreamingTransform({
                config,
                input: params,
                projectId,
                userId,
                transformRepo,
                artifactRepo,
                outputArtifactType: 'outline',
                transformMetadata: {
                    toolName: 'generate_outline',
                    source_artifact_id: params.sourceArtifactId,
                    source_idea_title: sourceIdeaData.title,
                    total_episodes: params.totalEpisodes,
                    episode_duration: params.episodeDuration,
                    platform: params.selectedPlatform,
                    genre_paths: params.selectedGenrePaths,
                    requirements: params.requirements
                },
                // Pass caching options from factory
                enableCaching: cachingOptions?.enableCaching,
                seed: cachingOptions?.seed,
                temperature: cachingOptions?.temperature,
                topP: cachingOptions?.topP,
                maxTokens: cachingOptions?.maxTokens
            });

            console.log(`[OutlineTool] Successfully completed streaming outline generation with artifact ${result.outputArtifactId}`);

            return {
                outputArtifactId: result.outputArtifactId,
                finishReason: result.finishReason
            };
        },
    };
} 