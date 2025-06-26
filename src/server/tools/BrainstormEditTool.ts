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
    execute: (params: TInput) => Promise<any>;
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
        description: 'Edit and improve existing brainstorm ideas based on user requirements. Use this tool when users want to modify, improve, or refine existing story concepts.',
        inputSchema: BrainstormEditInputSchema,
        outputSchema: BrainstormEditOutputSchema,
        execute: async (params: BrainstormEditInput): Promise<BrainstormEditToolResult> => {
            let toolTransformId: string | null = null;
            const llmService = new LLMService();

            try {
                console.log(`[BrainstormEditTool] Starting edit for artifact ${params.sourceArtifactId}, idea ${params.ideaIndex}`);

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
                    }
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