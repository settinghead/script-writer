import { executeStreamingIdeationTransform } from '../transforms/ideation-stream';
import { IdeationInputSchema, IdeationOutputSchema, IdeationInput, IdeationOutput } from '../../common/transform_schemas';
import { StreamingToolDefinition } from '../services/StreamingAgentFramework';

/**
 * Factory function that creates a brainstorm tool definition
 */
export function createBrainstormToolDefinition(): StreamingToolDefinition<IdeationInput, IdeationOutput> {
  return {
    name: 'brainstorm',
    description: 'Generates creative story ideas based on platform, genre, story points, keywords, and style preferences. Use this tool when users want to brainstorm, generate, or create story concepts for short-form video content.',
    inputSchema: IdeationInputSchema,
    outputSchema: IdeationOutputSchema,
    executeFunction: executeStreamingIdeationTransform,
  };
} 