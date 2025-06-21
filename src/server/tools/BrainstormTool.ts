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

// Tool execution result type
interface BrainstormToolResult {
    outputArtifactId: string;
    finishReason: string;
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

                // 2. Create initial output artifact that will be updated with streaming chunks
                const outputArtifact = await artifactRepo.createArtifact(
                    projectId,
                    'brainstorm_idea_collection',
                    [], // Start with empty array - matches BrainstormIdeaCollectionV1 validation
                    'v1',
                    {
                        chunkCount: 0,
                        startedAt: new Date().toISOString()
                    },
                    'streaming' // Start with streaming status
                );

                console.log(`[BrainstormTool] Created artifact ${outputArtifact.id} for project ${projectId}`);

                await transformRepo.addTransformOutputs(toolTransformId, [
                    { artifactId: outputArtifact.id, outputRole: 'streaming_result' }
                ], projectId);

                // 3. Execute the underlying transform which returns a stream
                const stream = await executeStreamingIdeationTransform(params);

                let finalResult: IdeationOutput = [];
                let chunkCount = 0;
                let lastUpdateTime = 0;
                const UPDATE_THROTTLE_MS = 500; // Throttle updates to max once per 500ms to avoid Electric conflicts

                // 4. Process the stream: throttle updates to avoid overwhelming Electric
                for await (const partial of stream) {
                    chunkCount++;
                    const currentTime = Date.now();

                    // Throttle updates to prevent Electric 409 conflicts
                    // Only update if enough time has passed or this is the final chunk
                    const shouldUpdate = (currentTime - lastUpdateTime) >= UPDATE_THROTTLE_MS;

                    if (shouldUpdate) {
                        try {
                            // Update the artifact with the current partial result
                            // This will trigger Electric to sync the update to the frontend
                            await artifactRepo.updateArtifact(
                                outputArtifact.id,
                                partial, // Direct array - matches BrainstormIdeaCollectionV1 validation
                                {
                                    chunkCount,
                                    lastUpdated: new Date().toISOString()
                                },
                                'streaming' // Set streaming status
                            );

                            console.log(`[BrainstormTool] Updated artifact ${outputArtifact.id} with chunk ${chunkCount} (throttled)`);
                            lastUpdateTime = currentTime;
                        } catch (updateError) {
                            // Log but don't fail on update errors - Electric may be handling conflicts
                            console.warn(`[BrainstormTool] Failed to update artifact ${outputArtifact.id} at chunk ${chunkCount}:`, updateError);
                        }
                    }

                    finalResult = partial; // Keep track of the latest result
                }



                // 5. Final update to mark as completed (always do this one)
                try {
                    await artifactRepo.updateArtifact(
                        outputArtifact.id,
                        finalResult, // Direct array - matches BrainstormIdeaCollectionV1 validation
                        {
                            chunkCount,
                            completedAt: new Date().toISOString()
                        },
                        'completed' // Set streaming status to completed
                    );
                    console.log(`[BrainstormTool] Completed artifact ${outputArtifact.id} with ${chunkCount} total chunks`);
                    console.log(`[BrainstormTool] Final data:`, JSON.stringify(finalResult).substring(0, 200) + '...');
                } catch (finalUpdateError) {
                    console.error(`[BrainstormTool] Failed to mark artifact ${outputArtifact.id} as completed:`, finalUpdateError);
                    // Don't throw here - the data is still valid
                }

                // 6. Mark transform as completed
                await transformRepo.updateTransformStatus(toolTransformId, 'completed');

                // The agent framework expects a result object, which includes the ID of the artifact created
                return {
                    outputArtifactId: outputArtifact.id,
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