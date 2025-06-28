import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { LLMService } from '../services/LLMService';
import { TemplateService } from '../services/templates/TemplateService';
import {
    OutlineGenerationInputSchema,
    OutlineGenerationInput,
    OutlineGenerationOutputSchema,
    OutlineGenerationOutput
} from '../../common/schemas/outlineSchemas';
import { cleanLLMContent, robustJSONParse } from '../../common/utils/textCleaning';

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
): StreamingToolDefinition<OutlineGenerationInput, OutlineToolResult> {
    return {
        name: 'generate_outline',
        description: '基于选定的故事创意生成详细的剧集大纲。适用场景：用户已有满意的故事创意，需要生成可执行的剧集结构和角色发展。要求用户提供集数配置、平台要求等参数。必须使用项目背景信息中显示的完整artifact ID作为sourceArtifactId参数。',
        inputSchema: OutlineGenerationInputSchema,
        outputSchema: OutlineGenerationOutputSchema,
        execute: async (params: OutlineGenerationInput, { toolCallId }): Promise<OutlineToolResult> => {
            let toolTransformId: string | null = null;
            const llmService = new LLMService();
            const templateService = new TemplateService();

            try {
                console.log(`[OutlineTool] Starting outline generation for artifact ${params.sourceArtifactId}`);

                // 1. Validate input
                const validationResult = OutlineGenerationInputSchema.safeParse(params);
                if (!validationResult.success) {
                    throw new Error(`Input validation failed: ${validationResult.error.message}`);
                }

                // 2. Get source brainstorm idea artifact
                const sourceArtifact = await artifactRepo.getArtifact(params.sourceArtifactId);
                if (!sourceArtifact) {
                    throw new Error('Source brainstorm idea not found');
                }

                // Verify user has access to this artifact's project
                const hasAccess = await artifactRepo.userHasProjectAccess(userId, sourceArtifact.project_id);
                if (!hasAccess) {
                    throw new Error('Access denied to source artifact');
                }

                // 3. Extract source idea data
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

                // 4. Create transform for this tool execution
                const transform = await transformRepo.createTransform(
                    projectId,
                    'llm',
                    'v1',
                    'running',
                    {
                        transform_name: 'llm_generate_outline',
                        source_artifact_id: params.sourceArtifactId,
                        total_episodes: params.totalEpisodes,
                        episode_duration: params.episodeDuration,
                        platform: params.selectedPlatform,
                        genre_paths: params.selectedGenrePaths,
                        requirements: params.requirements || ''
                    }
                );
                toolTransformId = transform.id;

                // 5. Link input artifact
                await transformRepo.addTransformInputs(toolTransformId, [
                    {
                        artifactId: params.sourceArtifactId,
                        inputRole: 'source_idea',
                        artifactPath: '$' // Root path for entire idea
                    }
                ], projectId);

                // 6. Prepare template context
                const genreString = params.selectedGenrePaths
                    .map(path => path.join(' > '))
                    .join(', ');

                const episodeInfo = `总共${params.totalEpisodes}集，每集${params.episodeDuration}分钟`;

                const templateContext = {
                    params: {
                        userInput: `${sourceIdeaData.title}\n\n${sourceIdeaData.body}`,
                        totalEpisodes: params.totalEpisodes,
                        episodeInfo: episodeInfo,
                        platform: params.selectedPlatform,
                        genre: genreString,
                        requirements: params.requirements || '无特殊要求'
                    }
                };

                // 7. Get and render template
                const outlineTemplate = templateService.getTemplate('outline');
                if (!outlineTemplate) {
                    throw new Error('Outline template not found');
                }

                const finalPrompt = await templateService.renderTemplate(outlineTemplate, templateContext);

                // 8. Store the prompt
                await transformRepo.addLLMPrompts(transform.id, [
                    { promptText: finalPrompt, promptRole: 'primary' }
                ], projectId);

                console.log(`[OutlineTool] Calling LLM for outline generation...`);

                // 9. Execute LLM call
                const llmResult = await llmService.generateText(finalPrompt);

                // 10. Store LLM metadata
                await transformRepo.addLLMTransform({
                    transform_id: transform.id,
                    model_name: 'unknown', // LLMService doesn't expose model name in response
                    raw_response: llmResult.text,
                    token_usage: llmResult.usage ? {
                        prompt_tokens: llmResult.usage.promptTokens,
                        completion_tokens: llmResult.usage.completionTokens,
                        total_tokens: llmResult.usage.totalTokens
                    } : null,
                    project_id: projectId
                });

                // 11. Clean and parse response
                const cleanedContent = cleanLLMContent(llmResult.text);
                let outlineData: OutlineGenerationOutput;

                try {
                    const parsedData = await robustJSONParse(cleanedContent);
                    const outputValidation = OutlineGenerationOutputSchema.safeParse(parsedData);
                    if (!outputValidation.success) {
                        throw new Error(`LLM output validation failed: ${outputValidation.error.message}`);
                    }
                    outlineData = outputValidation.data;
                } catch (parseError) {
                    console.error(`[OutlineTool] Failed to parse LLM response:`, parseError);
                    throw new Error(`Failed to parse LLM response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
                }

                console.log(`[OutlineTool] Generated outline: ${outlineData.title}`);

                // 12. Create output artifact
                const outputArtifact = await artifactRepo.createArtifact(
                    projectId,
                    'outline', // Maps to 'outline_schema' which we registered
                    outlineData,
                    'v1',
                    {
                        transform_name: 'llm_generate_outline',
                        source_artifact_id: params.sourceArtifactId,
                        source_idea_title: sourceIdeaData.title,
                        total_episodes: params.totalEpisodes,
                        episode_duration: params.episodeDuration,
                        platform: params.selectedPlatform,
                        genre_paths: params.selectedGenrePaths,
                        requirements: params.requirements
                    },
                    'completed',
                    'ai_generated' // AI-generated outline
                );

                // 13. Link output artifact
                await transformRepo.addTransformOutputs(toolTransformId, [
                    { artifactId: outputArtifact.id, outputRole: 'generated_outline' }
                ], projectId);

                // 14. Mark transform as completed
                await transformRepo.updateTransform(toolTransformId, {
                    status: 'completed',
                    execution_context: {
                        ...transform.execution_context,
                        completed_at: new Date().toISOString(),
                        output_artifact_id: outputArtifact.id
                    }
                });

                console.log(`[OutlineTool] Successfully created outline artifact ${outputArtifact.id}`);

                return {
                    outputArtifactId: outputArtifact.id,
                    finishReason: 'stop'
                };

            } catch (error) {
                console.error(`[OutlineTool] Error executing tool for project ${projectId}:`, error);

                if (toolTransformId) {
                    try {
                        await transformRepo.updateTransform(toolTransformId, {
                            status: 'failed',
                            execution_context: {
                                error_message: error instanceof Error ? error.message : String(error),
                                failed_at: new Date().toISOString()
                            }
                        });
                    } catch (statusUpdateError) {
                        console.error(`[OutlineTool] Failed to update transform status to failed:`, statusUpdateError);
                    }
                }

                throw error;
            }
        },
    };
} 