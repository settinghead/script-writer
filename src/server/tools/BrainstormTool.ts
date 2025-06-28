import { executeStreamingIdeationTransform } from '../transforms/ideation-stream';
import { IdeationInputSchema, IdeationOutputSchema, IdeationInput, IdeationOutput } from '../../common/transform_schemas';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { LLMService } from '../services/LLMService';
import { brainstormEditTemplate } from '../services/templates/brainstormEdit';
import {
    BrainstormEditInputSchema,
    BrainstormEditInput,
    BrainstormEditOutputSchema,
    BrainstormEditOutput
} from '../../common/schemas/transforms';
import { extractDataAtPath } from '../services/transform-instantiations/pathTransforms';
import { cleanLLMContent, robustJSONParse } from '../../common/utils/textCleaning';

// Temporary type definition for Electric Sync migration - matches actual StreamingAgentFramework
interface StreamingToolDefinition<TInput, TOutput> {
    name: string;
    description: string;
    inputSchema: any;
    outputSchema: any;
    execute: (params: TInput, options: { toolCallId: string }) => Promise<any>;
}

interface BrainstormEditToolResult {
    outputArtifactId: string;
    finishReason: string;
    originalIdea?: {
        title: string;
        body: string;
    };
    editedIdea?: {
        title: string;
        body: string;
    };
}

/**
 * Factory function that creates a brainstorm edit tool definition
 */
export function createBrainstormEditToolDefinition(
    transformRepo: TransformRepository,
    artifactRepo: ArtifactRepository,
    projectId: string,
    userId: string,
): StreamingToolDefinition<BrainstormEditInput, BrainstormEditToolResult> {
    return {
        name: 'edit_brainstorm_idea',
        description: '编辑和改进现有故事创意。适用场景：用户对现有创意有具体的修改要求或改进建议。重要：必须使用项目背景信息中显示的完整ID作为sourceArtifactId参数。支持各种编辑类型：内容扩展（"每个再长一点"、"详细一些"）、风格调整（"太老套，创新一点"、"更有趣一些"）、情节修改（"改成现代背景"、"加入悬疑元素"）、结构调整（"重新安排情节"、"调整人物关系"）、其他改进（"更符合年轻人口味"、"增加商业价值"）等。',
        inputSchema: BrainstormEditInputSchema,
        outputSchema: BrainstormEditOutputSchema,
        execute: async (params: BrainstormEditInput, {
            toolCallId
        }): Promise<BrainstormEditToolResult> => {
            let toolTransformId: string | null = null;
            const llmService = new LLMService();

            try {
                console.log(`[BrainstormEditTool] Starting edit for artifact ${params.sourceArtifactId}.`);

                // 1. Validate input
                const validationResult = BrainstormEditInputSchema.safeParse(params);
                if (!validationResult.success) {
                    throw new Error(`Input validation failed: ${validationResult.error.message}`);
                }

                // 2. Get source artifact and extract the idea to edit
                const sourceArtifact = await artifactRepo.getArtifact(params.sourceArtifactId);
                if (!sourceArtifact) {
                    throw new Error('Source artifact not found');
                }

                // Verify user has access to this artifact's project
                const hasAccess = await artifactRepo.userHasProjectAccess(userId, sourceArtifact.project_id);
                if (!hasAccess) {
                    throw new Error('Access denied to source artifact');
                }

                // 3. Extract the specific idea to edit
                let sourceData = sourceArtifact.data;
                let originalIdea: { title: string; body: string };
                let targetPlatform = 'unknown';
                let storyGenre = 'unknown';

                if (sourceArtifact.type === 'brainstorm_idea_collection') {
                    // NEW: Collection artifact - extract specific idea using JSONPath
                    const ideaPath = `$.ideas[${params.ideaIndex}]`;

                    try {
                        const extractedIdea = extractDataAtPath(sourceData, ideaPath);
                        if (!extractedIdea || !extractedIdea.title || !extractedIdea.body) {
                            throw new Error(`Invalid idea at index ${params.ideaIndex} in collection`);
                        }

                        originalIdea = {
                            title: extractedIdea.title,
                            body: extractedIdea.body
                        };

                        // Get platform/genre from collection metadata
                        targetPlatform = sourceData.platform || 'unknown';
                        storyGenre = sourceData.genre || 'unknown';
                    } catch (extractError) {
                        throw new Error(`Failed to extract idea at index ${params.ideaIndex}: ${extractError instanceof Error ? extractError.message : String(extractError)}`);
                    }
                } else if (sourceArtifact.type === 'brainstorm_idea') {
                    // Direct brainstorm idea artifact
                    if (!sourceData.title || !sourceData.body) {
                        throw new Error('Invalid brainstorm idea artifact');
                    }

                    originalIdea = {
                        title: sourceData.title,
                        body: sourceData.body
                    };

                    if (sourceArtifact.metadata) {
                        targetPlatform = sourceArtifact.metadata.platform || 'unknown';
                        storyGenre = sourceArtifact.metadata.genre || 'unknown';
                    }
                } else if (sourceArtifact.type === 'user_input') {
                    // User-edited artifact - extract from derived data
                    let derivedData = sourceArtifact.metadata?.derived_data;
                    if (!derivedData && sourceData.text) {
                        try {
                            derivedData = JSON.parse(sourceData.text);
                        } catch (e) {
                            throw new Error('Failed to parse user input data');
                        }
                    }

                    if (!derivedData || !derivedData.title || !derivedData.body) {
                        throw new Error('Invalid user input artifact');
                    }

                    originalIdea = {
                        title: derivedData.title,
                        body: derivedData.body
                    };

                    // Try to get platform/genre from original artifact metadata
                    if (sourceArtifact.metadata?.original_artifact_id) {
                        const originalArtifact = await artifactRepo.getArtifact(sourceArtifact.metadata.original_artifact_id);
                        if (originalArtifact?.metadata) {
                            targetPlatform = originalArtifact.metadata.platform || 'unknown';
                            storyGenre = originalArtifact.metadata.genre || 'unknown';
                        }
                    }
                } else {
                    throw new Error(`Unsupported source artifact type: ${sourceArtifact.type}`);
                }

                console.log(`[BrainstormEditTool] Original idea: ${originalIdea.title}`);

                // 4. Create transform for this tool execution
                const artifactPath = sourceArtifact.type === 'brainstorm_idea_collection'
                    ? `$.ideas[${params.ideaIndex}]`  // JSONPath for collection items
                    : '$';  // Root path for individual artifacts

                const transform = await transformRepo.createTransform(
                    projectId,
                    'llm',
                    'v1',
                    'running',
                    {
                        transform_name: sourceArtifact.type === 'brainstorm_idea_collection'
                            ? 'llm_edit_brainstorm_collection_idea'
                            : 'llm_edit_brainstorm_idea',
                        source_artifact_id: params.sourceArtifactId,
                        idea_index: params.ideaIndex,
                        artifact_path: artifactPath, // JSONPath for lineage resolution
                        edit_requirements: params.editRequirements,
                        agent_instructions: params.agentInstructions || '',
                        original_idea: originalIdea
                    }
                );
                toolTransformId = transform.id;

                // 5. Link input artifact with JSONPath
                await transformRepo.addTransformInputs(toolTransformId, [
                    {
                        artifactId: params.sourceArtifactId,
                        inputRole: 'source_collection',
                        artifactPath: artifactPath // NEW: Specify which part of artifact using JSONPath
                    }
                ], projectId);

                // 6. Prepare template variables
                const templateVariables = {
                    originalTitle: originalIdea.title,
                    originalBody: originalIdea.body,
                    targetPlatform: targetPlatform,
                    storyGenre: storyGenre,
                    editRequirements: params.editRequirements,
                    agentInstructions: params.agentInstructions || '请根据用户要求进行适当的改进和优化。'
                };

                // 7. Render template
                let finalPrompt = brainstormEditTemplate.promptTemplate;
                for (const [key, value] of Object.entries(templateVariables)) {
                    finalPrompt = finalPrompt.replace(new RegExp(`%%${key}%%`, 'g'), value);
                }

                // 8. Store the prompt
                await transformRepo.addLLMPrompts(transform.id, [
                    { promptText: finalPrompt, promptRole: 'primary' }
                ], projectId);

                console.log(`[BrainstormEditTool] Calling LLM for editing...`);

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
                let editedIdea: BrainstormEditOutput;

                try {
                    const parsedData = await robustJSONParse(cleanedContent);

                    // Validate against output schema
                    const outputValidation = BrainstormEditOutputSchema.safeParse(parsedData);
                    if (!outputValidation.success) {
                        throw new Error(`LLM output validation failed: ${outputValidation.error.message}`);
                    }

                    editedIdea = outputValidation.data;
                } catch (parseError) {
                    console.error(`[BrainstormEditTool] Failed to parse LLM response:`, parseError);
                    throw new Error(`Failed to parse LLM response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
                }

                console.log(`[BrainstormEditTool] Edited idea: ${editedIdea.title}`);

                // 12. Create output artifact
                const outputArtifact = await artifactRepo.createArtifact(
                    projectId,
                    'brainstorm_idea',
                    editedIdea,
                    'v1',
                    {
                        transform_name: 'llm_edit_brainstorm_idea',
                        source_artifact_id: params.sourceArtifactId,
                        idea_index: params.ideaIndex,
                        edit_requirements: params.editRequirements,
                        original_idea: originalIdea,
                        platform: targetPlatform,
                        genre: storyGenre
                    }, // metadata
                    'completed', // streamingStatus
                    'ai_generated' // originType - AI-generated edited brainstorm idea
                );

                // 13. Link output artifact
                await transformRepo.addTransformOutputs(toolTransformId, [
                    { artifactId: outputArtifact.id, outputRole: 'edited_idea' }
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

                console.log(`[BrainstormEditTool] Successfully created edited idea artifact ${outputArtifact.id}`);

                return {
                    outputArtifactId: outputArtifact.id,
                    finishReason: 'stop',
                    originalIdea,
                    editedIdea
                };

            } catch (error) {
                console.error(`[BrainstormEditTool] Error executing tool for project ${projectId}:`, error);

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
                        console.error(`[BrainstormEditTool] Failed to update transform status to failed:`, statusUpdateError);
                    }
                }

                throw error;
            }
        },
    };
}
// Temporary type definition for Electric Sync migration - matches actual StreamingAgentFramework
interface StreamingToolDefinition<TInput, TOutput> {
    name: string;
    description: string;
    inputSchema: any;
    outputSchema: any;
    execute: (params: TInput, options: { toolCallId: string }) => Promise<any>; // Changed to match actual framework
}

// Tool execution result type - now returns single collection artifact ID
interface BrainstormToolResult {
    outputArtifactId: string; // Single collection artifact ID
    finishReason: string;
}

// Collection-based brainstorm tool - no longer needs individual idea caching

/**
 * Factory function that creates a brainstorm tool definition
 */
export function createBrainstormToolDefinition(
    transformRepo: TransformRepository,
    artifactRepo: ArtifactRepository,
    projectId: string,
    userId: string,
): StreamingToolDefinition<IdeationInput, BrainstormToolResult> {
    return {
        name: 'generate_brainstorm_ideas',
        description: '生成新的故事创意。适用场景：用户想要全新的故事想法、需要更多创意选择、或当前没有满意的故事创意时。例如："给我一些新的故事想法"、"再想几个不同的创意"。基于平台和类型生成适合短视频内容的创意故事概念。',
        inputSchema: IdeationInputSchema,
        outputSchema: IdeationOutputSchema,
        execute: async (params: IdeationInput): Promise<BrainstormToolResult> => {
            let toolTransformId: string | null = null;
            let collectionArtifactId: string | null = null;
            try {
                // 1. Create a transform for this specific tool execution
                const transform = await transformRepo.createTransform(
                    projectId,
                    'llm', // The tool is an LLM operation
                    'running',
                    JSON.stringify({
                        toolName: 'generate_brainstorm_ideas',
                        params
                    })
                );
                toolTransformId = transform.id;

                // Create and link input artifact
                const inputArtifact = await artifactRepo.createArtifact(
                    projectId,
                    'brainstorm_tool_input',
                    params,
                    'v1',
                    {}, // metadata
                    'completed', // streamingStatus
                    'user_input' // originType - tool input is user-provided data
                );
                await transformRepo.addTransformInputs(toolTransformId, [
                    { artifactId: inputArtifact.id, inputRole: 'tool_input' }
                ], projectId);

                // 2. Create single collection artifact instead of multiple individual artifacts
                const initialCollectionData = {
                    ideas: [],
                    platform: params.platform,
                    genre: params.genre,
                    total_ideas: 0
                };

                const collectionArtifact = await artifactRepo.createArtifact(
                    projectId,
                    'brainstorm_idea_collection', // NEW: Single collection type
                    initialCollectionData,
                    'v1',
                    {
                        startedAt: new Date().toISOString(),
                        platform: params.platform,
                        genre: params.genre
                    }, // metadata
                    'streaming', // streamingStatus - will be updated as ideas are generated
                    'ai_generated' // originType - AI-generated brainstorm collection
                );
                collectionArtifactId = collectionArtifact.id;

                console.log(`[BrainstormTool] Created collection artifact ${collectionArtifactId} for project ${projectId}`);

                // 3. Execute the underlying transform which returns a stream
                const stream = await executeStreamingIdeationTransform(params);

                let finalResult: IdeationOutput = [];
                let chunkCount = 0;
                let totalUpdates = 0;

                console.log(`[BrainstormTool] Starting brainstorm generation with collection updates for project ${projectId}`);

                // 4. Process the stream and update the single collection artifact
                for await (const partial of stream) {
                    chunkCount++;
                    finalResult = partial as IdeationOutput; // Keep track of the latest result

                    // Convert individual ideas to collection format
                    const collectionIdeas = (partial as IdeationOutput)
                        .filter((idea: any) => idea && idea.title && idea.body && idea.body.length >= 10)
                        .map((idea: any, index: number) => ({
                            title: idea.title,
                            body: idea.body,
                            metadata: {
                                ideaIndex: index,
                                confidence_score: 0.8 // Default confidence
                            }
                        }));

                    // Update collection with current ideas
                    const updatedCollection = {
                        ideas: collectionIdeas,
                        platform: params.platform,
                        genre: params.genre,
                        total_ideas: collectionIdeas.length
                    };

                    try {
                        await artifactRepo.updateArtifact(
                            collectionArtifactId,
                            updatedCollection,
                            {
                                chunkCount,
                                lastUpdated: new Date().toISOString(),
                                updateCount: totalUpdates + 1
                            }
                        );

                        totalUpdates++;
                        console.log(`[BrainstormTool] Updated collection with ${collectionIdeas.length} ideas (update #${totalUpdates})`);
                    } catch (updateError) {
                        console.warn(`[BrainstormTool] Failed to update collection at chunk ${chunkCount}:`, updateError);
                    }
                }

                console.log(`[BrainstormTool] Streaming completed. Total collection updates: ${totalUpdates}`);

                // 5. Final update to mark collection as completed
                const finalCollectionIdeas = finalResult
                    .filter((idea) => idea && idea.title && idea.body && idea.body.length >= 10)
                    .map((idea, index: number) => ({
                        title: idea.title,
                        body: idea.body,
                        metadata: {
                            ideaIndex: index,
                            confidence_score: 0.8
                        }
                    }));

                const finalCollection = {
                    ideas: finalCollectionIdeas,
                    platform: params.platform,
                    genre: params.genre,
                    total_ideas: finalCollectionIdeas.length
                };

                await artifactRepo.updateArtifact(
                    collectionArtifactId,
                    finalCollection,
                    {
                        chunkCount,
                        completedAt: new Date().toISOString(),
                        totalUpdates
                    }
                );

                console.log(`[BrainstormTool] Completed collection artifact ${collectionArtifactId} with ${finalCollectionIdeas.length} ideas`);

                // 6. Link collection artifact to the transform
                await transformRepo.addTransformOutputs(toolTransformId, [
                    { artifactId: collectionArtifactId, outputRole: 'brainstorm_collection' }
                ], projectId);

                // 7. Mark transform as completed
                await transformRepo.updateTransformStatus(toolTransformId, 'completed');

                console.log(`[BrainstormTool] Completed brainstorm generation with single collection artifact`);

                // Return single collection artifact ID
                return {
                    outputArtifactId: collectionArtifactId,
                    finishReason: 'stop'
                };

            } catch (error) {
                console.error(`[BrainstormTool] Error executing tool for project ${projectId}:`, error);
                if (toolTransformId) {
                    try {
                        await transformRepo.updateTransformStatus(toolTransformId, 'failed');
                    } catch (statusUpdateError) {
                        console.error(`[BrainstormTool] Failed to update transform status to failed:`, statusUpdateError);
                    }
                }
                throw error;
            }
        },
    };
} 