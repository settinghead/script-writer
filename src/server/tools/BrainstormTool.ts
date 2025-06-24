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

// Tool execution result type - now returns multiple artifact IDs
interface BrainstormToolResult {
    outputArtifactIds: string[]; // Changed from single ID to array
    finishReason: string;
}

// Cache entry for tracking idea state
interface IdeaCache {
    title: string;
    body: string;
    lastUpdated: number;
    updateCount: number;
}

// Helper function to check if idea content has meaningfully changed
function hasSignificantChange(cached: IdeaCache | undefined, newIdea: any): boolean {
    if (!cached) return true; // First time seeing this idea

    // Check if title changed
    if (cached.title !== newIdea.title) return true;

    // Check if body length increased significantly (>10% or >20 characters)
    const bodyLengthDiff = newIdea.body.length - cached.body.length;
    const percentageIncrease = bodyLengthDiff / Math.max(cached.body.length, 1);

    if (bodyLengthDiff > 20 || percentageIncrease > 0.1) return true;

    // Check if it's been a while since last update (throttle to max 1 update per 2 seconds)
    const timeSinceLastUpdate = Date.now() - cached.lastUpdated;
    if (timeSinceLastUpdate > 2000) return true;

    return false;
}

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
            try {
                // 1. Create a transform for this specific tool execution
                const transform = await transformRepo.createTransform(
                    projectId,
                    'llm', // The tool is an LLM operation
                    'running',
                    JSON.stringify({ // Fix: Convert to string for execution_context
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
                    {}
                );
                await transformRepo.addTransformInputs(toolTransformId, [
                    { artifactId: inputArtifact.id, inputRole: 'tool_input' }
                ], projectId);

                // 2. Execute the underlying transform which returns a stream
                const stream = await executeStreamingIdeationTransform(params);

                let finalResult: IdeationOutput = [];
                let chunkCount = 0;
                const createdArtifacts: string[] = [];

                // Smart caching system to reduce unnecessary updates
                const ideaCache = new Map<number, IdeaCache>();
                let totalUpdates = 0;
                let skippedUpdates = 0;

                console.log(`[BrainstormTool] Starting brainstorm generation with smart caching for project ${projectId}`);

                // 3. Process the stream and create/update individual artifacts
                for await (const partial of stream) {
                    chunkCount++;
                    finalResult = partial; // Keep track of the latest result

                    // Create or update individual artifacts for each idea
                    for (let i = 0; i < partial.length; i++) {
                        const idea = partial[i];

                        // Skip empty or incomplete objects - only create/update when there's substantial content
                        if (!idea || !idea.title || !idea.body || idea.body.length < 10) {
                            continue;
                        }

                        const cachedIdea = ideaCache.get(i);
                        const shouldUpdate = hasSignificantChange(cachedIdea, idea);

                        if (!shouldUpdate) {
                            skippedUpdates++;
                            continue; // Skip this update - no significant change
                        }

                        // Update cache
                        ideaCache.set(i, {
                            title: idea.title,
                            body: idea.body,
                            lastUpdated: Date.now(),
                            updateCount: (cachedIdea?.updateCount || 0) + 1
                        });

                        if (i >= createdArtifacts.length) {
                            // Create new artifact for this idea
                            const ideaArtifact = await artifactRepo.createArtifact(
                                projectId,
                                'brainstorm_idea',
                                idea, // Individual {title, body} object
                                'v1',
                                {
                                    ideaIndex: i,
                                    chunkCount,
                                    startedAt: new Date().toISOString(),
                                    platform: params.platform,
                                    genre: params.genre
                                },
                                'streaming' // Start with streaming status
                            );

                            createdArtifacts.push(ideaArtifact.id);
                            totalUpdates++;

                            console.log(`[BrainstormTool] Created artifact ${ideaArtifact.id} for idea ${i} in project ${projectId}`);
                        } else {
                            // Update existing artifact
                            try {
                                await artifactRepo.updateArtifact(
                                    createdArtifacts[i],
                                    idea, // Individual {title, body} object
                                    {
                                        ideaIndex: i,
                                        chunkCount,
                                        lastUpdated: new Date().toISOString(),
                                        updateCount: ideaCache.get(i)?.updateCount || 0
                                    },
                                    'streaming'
                                );

                                totalUpdates++;
                                console.log(`[BrainstormTool] Updated artifact ${createdArtifacts[i]} for idea ${i} (update #${ideaCache.get(i)?.updateCount})`);
                            } catch (updateError) {
                                console.warn(`[BrainstormTool] Failed to update artifact ${createdArtifacts[i]} at chunk ${chunkCount}:`, updateError);
                            }
                        }
                    }
                }

                console.log(`[BrainstormTool] Streaming completed. Total updates: ${totalUpdates}, Skipped updates: ${skippedUpdates} (${Math.round(skippedUpdates / (totalUpdates + skippedUpdates) * 100)}% reduction)`);

                // 4. Final update to mark all artifacts as completed
                for (let i = 0; i < createdArtifacts.length; i++) {
                    try {
                        const finalIdea = finalResult[i];
                        await artifactRepo.updateArtifact(
                            createdArtifacts[i],
                            finalIdea,
                            {
                                ideaIndex: i,
                                chunkCount,
                                completedAt: new Date().toISOString(),
                                totalUpdates: ideaCache.get(i)?.updateCount || 0
                            },
                            'completed' // Set streaming status to completed
                        );
                        console.log(`[BrainstormTool] Completed artifact ${createdArtifacts[i]} for idea ${i}`);
                    } catch (finalUpdateError) {
                        console.error(`[BrainstormTool] Failed to mark artifact ${createdArtifacts[i]} as completed:`, finalUpdateError);
                    }
                }

                // 5. Link all output artifacts to the transform
                const outputArtifacts = createdArtifacts.map((artifactId, index) => ({
                    artifactId,
                    outputRole: `brainstorm_idea_${index}` // Use indexed roles
                }));

                await transformRepo.addTransformOutputs(toolTransformId, outputArtifacts, projectId);

                // 6. Mark transform as completed
                await transformRepo.updateTransformStatus(toolTransformId, 'completed');

                console.log(`[BrainstormTool] Completed brainstorm generation with ${createdArtifacts.length} individual artifacts`);

                // Return multiple artifact IDs
                return {
                    outputArtifactIds: createdArtifacts,
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