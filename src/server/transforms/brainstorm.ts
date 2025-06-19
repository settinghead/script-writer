import { LLMService } from '../services/LLMService.js';
import { brainstormingTemplate } from '../services/templates/brainstorming.js';
import { 
  IdeationInputSchema, 
  IdeationOutputSchema, 
  IdeationInput, 
  IdeationOutput 
} from '../../common/transform_schemas.js';
import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';

/**
 * A simple template renderer.
 * Replaces all occurrences of `%%key%%` in a template string with the provided values.
 * @param template The template string.
 * @param variables An object where keys correspond to the placeholders in the template.
 * @returns The rendered string.
 */
function renderTemplate(template: string, variables: Record<string, string>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.split(`%%${key}%%`).join(value);
  }

  // Check for any unresolved template variables
  const unresolvedMatches = rendered.match(/%%([^%]+)%%/g);
  if (unresolvedMatches) {
    throw new Error(`Template contains unresolved variables: ${unresolvedMatches.join(', ')}`);
  }
  
  return rendered;
}

/**
 * Cleans the raw LLM output by attempting to extract a valid JSON array string.
 * It removes markdown code fences and other leading/trailing garbage.
 * @param rawOutput The raw string from the LLM.
 * @returns A string that is likely a JSON array.
 */
function cleanLlmOutput(rawOutput: string): string {
    const jsonMatch = rawOutput.match(/(\[.*\])/s);
    if (jsonMatch && jsonMatch[1]) {
        return jsonMatch[1];
    }
    // Fallback for outputs that might be missing brackets but are otherwise object-like
    const objectMatch = rawOutput.match(/(\{.*\})/s);
    if (objectMatch && objectMatch[1]) {
        // Wrap a single object in an array to match the expected schema
        return `[${objectMatch[1]}]`;
    }
    // Return the trimmed raw output if no JSON is found
    return rawOutput.trim();
}


/**
 * Executes the ideation transform.
 * This function takes user input, validates it, renders a prompt for the LLM,
 * calls the LLM, and then validates the output.
 *
 * @param input The user-provided input for the ideation transform.
 * @returns A promise that resolves to the validated list of story ideas.
 */
export async function executeIdeationTransform(input: IdeationInput): Promise<IdeationOutput> {
  // 1. Validate the input against the Zod schema
  const validatedInput = IdeationInputSchema.parse(input);

  // 2. Construct the 'requirementsSection' from validated input fields
  const requirementsSection = [
    `主要看点: ${validatedInput.main_story_points}`,
    `情节关键词: ${validatedInput.plot_keywords}`,
    `风格修饰: ${validatedInput.style_modifiers}`,
    validatedInput.other_requirements ? `其他要求: ${validatedInput.other_requirements}` : ''
  ].filter(Boolean).join('\n');

  // 3. Render the prompt template
  const prompt = renderTemplate(brainstormingTemplate.promptTemplate, {
    'params.genre': validatedInput.genre,
    'params.platform': validatedInput.platform,
    'params.requirementsSection': requirementsSection,
  });

  // 4. Call the LLM
  const llmService = new LLMService();
  const llmResult = await llmService.generateText(prompt);
  let rawOutput = llmResult.text;

  // 5. Clean and parse the LLM output
  let parsedJson: any;
  try {
    const cleanedOutput = cleanLlmOutput(rawOutput);
    parsedJson = JSON.parse(cleanedOutput);
  } catch (e) {
    console.warn("Initial JSON parsing failed, attempting to repair...", e);
    try {
        const repairedJson = jsonrepair(rawOutput);
        parsedJson = JSON.parse(repairedJson);
    } catch (repairError) {
        console.error("JSON repair failed:", repairError);
        throw new Error(`Failed to parse or repair LLM output. Raw output:\n${rawOutput}`);
    }
  }

  // 6. Validate the output against the Zod schema
  const validatedOutput = IdeationOutputSchema.parse(parsedJson);

  return validatedOutput;
} 