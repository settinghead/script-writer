import { executeStreamingIdeationTransform } from '../transforms/ideation-stream';
import { IdeationInputSchema, IdeationOutputSchema, IdeationInput, IdeationOutput } from '../../common/transform_schemas';
// Note: StreamingAgentFramework removed as part of Electric Sync migration
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';

// Temporary type definition for Electric Sync migration - matches actual StreamingAgentFramework
interface StreamingToolDefinition<TInput, TOutput> {
    name: string;
    description: string;
    inputSchema: any;
    outputSchema: any;
    execute: (params: TInput) => Promise<any>; // Changed to match actual framework
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
        name: 'brainstorm',
        description: 'Generates creative story ideas based on platform and genre. Use this tool when users want to brainstorm, generate, or create story concepts for short-form video content.',
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
                        toolName: 'brainstorm',
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
                    finalResult = partial; // Keep track of the latest result

                    // Convert individual ideas to collection format
                    const collectionIdeas = partial
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