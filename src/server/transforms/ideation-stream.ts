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

  // 2. Construct the 'requirementsSection'
  const requirementsSection = [
    `主要看点: ${validatedInput.main_story_points}`,
    `情节关键词: ${validatedInput.plot_keywords}`,
    `风格修饰: ${validatedInput.style_modifiers}`,
    validatedInput.other_requirements ? `其他要求: ${validatedInput.other_requirements}` : ''
  ].filter(Boolean).join('\n');

  // 3. Render the prompt
  const prompt = renderTemplate(brainstormingTemplate.promptTemplate, {
    'params.genre': validatedInput.genre,
    'params.platform': validatedInput.platform,
    'params.requirementsSection': requirementsSection,
  });

  // 4. Call the LLM to get a stream of partial objects
  const llmService = new LLMService();
  const partialObjectStream = await llmService.streamObject({
    prompt,
    schema: IdeationOutputSchema,
  });

  return partialObjectStream;
} 