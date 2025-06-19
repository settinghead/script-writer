import { executeStreamingIdeationTransform } from '../transforms/ideation-stream';
import { IdeationInputSchema, IdeationOutputSchema, IdeationInput, IdeationOutput } from '../../common/transform_schemas';
// Note: StreamingAgentFramework removed as part of Electric Sync migration
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';

// Temporary type definition for Electric Sync migration
interface StreamingToolDefinition<TInput, TOutput> {
    name: string;
    description: string;
    inputSchema: any;
    outputSchema: any;
    execute: (params: TInput) => Promise<TOutput>;
}
/**
 * Factory function that creates a brainstorm tool definition
 */
export function createBrainstormToolDefinition(
    transformRepo: TransformRepository,
    artifactRepo: ArtifactRepository,
    projectId: string,
    userId: string,
): StreamingToolDefinition<IdeationInput, IdeationOutput> {
    return {
        name: 'brainstorm',
        description: 'Generates creative story ideas based on platform and genre. Use this tool when users want to brainstorm, generate, or create story concepts for short-form video content.',
        inputSchema: IdeationInputSchema,
        outputSchema: IdeationOutputSchema,
        execute: async (params: IdeationInput) => {
            let toolTransformId: string | null = null;
            try {
                // 1. Create a transform for this specific tool execution
                const transform = await transformRepo.createTransform(
                    projectId,
                    'llm', // The tool is an LLM operation
                    'running',
                    { 
                        toolName: 'brainstorm',
                        params 
                    }
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
                ]);

                // 2. Create initial output artifact that will be updated with streaming chunks
                const outputArtifact = await artifactRepo.createArtifact(
                    projectId,
                    'brainstorm_idea_collection',
                    [], // Start with empty array
                    'v1',
                    { 
                        status: 'streaming',
                        chunkCount: 0,
                        startedAt: new Date().toISOString()
                    }
                );
                
                await transformRepo.addTransformOutputs(toolTransformId, [
                    { artifactId: outputArtifact.id, outputRole: 'streaming_result' }
                ]);

                // 3. Execute the underlying transform which returns a stream
                const stream = await executeStreamingIdeationTransform(params);

                let finalResult: any = [];
                let chunkCount = 0;

                // 4. Process the stream: update artifact with each chunk for real-time Electric sync
                for await (const partial of stream) {
                    chunkCount++;
                    
                    // Update the artifact with the current partial result
                    // This will trigger Electric to sync the update to the frontend immediately
                    await artifactRepo.updateArtifact(
                        outputArtifact.id,
                        partial, // The current partial result
                        { 
                            status: 'streaming',
                            chunkCount,
                            lastUpdated: new Date().toISOString()
                        }
                    );

                    console.log(`[BrainstormTool] Updated artifact ${outputArtifact.id} with chunk ${chunkCount}`);
                    
                    finalResult = partial; // Keep track of the latest result
                }

                // 5. Final update to mark as completed
                await artifactRepo.updateArtifact(
                    outputArtifact.id,
                    finalResult,
                    { 
                        status: 'completed',
                        chunkCount,
                        completedAt: new Date().toISOString()
                    }
                );

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
                    await transformRepo.updateTransformStatus(toolTransformId, 'failed');
                }
                throw error;
            }
        },
    };
} 