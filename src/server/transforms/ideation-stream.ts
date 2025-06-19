import { LLMService } from '../services/LLMService.js';
import { brainstormingTemplate } from '../services/templates/brainstorming.js';
import {
  IdeationInputSchema,
  IdeationOutputSchema,
  IdeationInput
} from '../../common/transform_schemas.js';

/**
 * A simple template renderer.
 * Replaces all occurrences of `%%key%%` in a template string with the provided values.
 */
function renderTemplate(template: string, variables: Record<string, string>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.split(`%%${key}%%`).join(value);
  }
  const unresolvedMatches = rendered.match(/%%([^%]+)%%/g);
  if (unresolvedMatches) {
    throw new Error(`Template contains unresolved variables: ${unresolvedMatches.join(', ')}`);
  }
  return rendered;
}

/**
 * Executes the ideation transform in streaming mode.
 * This function validates the input, renders a prompt, and then initiates a
 * streaming call to the LLM to receive partial objects.
 *
 * @param input The user-provided input for the ideation transform.
 * @returns A promise that resolves to an async iterable of partial story idea objects.
 */
export async function executeStreamingIdeationTransform(input: IdeationInput) {
  // 1. Validate the input
  const validatedInput = IdeationInputSchema.parse(input);

  // 2. Use hardcoded user request with dynamic genre and platform
  const hardcodedUserRequest = `I need to create story ideas for ${validatedInput.platform} videos. The genre should be time travel and power fantasy (穿越, 爽文). The main story is about a modern CEO who accidentally travels back to ancient times, becomes a fallen noble family's young master, uses modern knowledge for business and court intrigue, eventually becomes incredibly wealthy and wins the heart of a beautiful woman. Keywords should include business warfare, political schemes, and face-slapping moments. The style should be fast-paced with many plot twists.`;

  // 3. Construct the 'requirementsSection' with hardcoded content and optional user requirements
  const requirementsSection = [
    hardcodedUserRequest,
    validatedInput.other_requirements ? `其他要求: ${validatedInput.other_requirements}` : ''
  ].filter(Boolean).join('\n');

  // 4. Render the prompt
  const prompt = renderTemplate(brainstormingTemplate.promptTemplate, {
    'params.genre': validatedInput.genre,
    'params.platform': validatedInput.platform,
    'params.requirementsSection': requirementsSection,
  });

  // 5. Call the LLM to get a stream of partial objects
  const llmService = new LLMService();
  const partialObjectStream = await llmService.streamObject({
    prompt,
    schema: IdeationOutputSchema,
  });

  return partialObjectStream;
} 