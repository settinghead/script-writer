import { z } from 'zod';
import { ARTIFACT_SCHEMAS, ArtifactType } from './artifacts';

// Transform definition schema
export const HumanTransformDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  sourceArtifactType: z.string(),
  targetArtifactType: z.string(),
  pathPattern: z.string(), // Regex pattern for valid paths
  instantiationFunction: z.string()
});

export type HumanTransformDefinition = z.infer<typeof HumanTransformDefinitionSchema>;

// LLM Transform definition schema
export const LLMTransformDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputTypes: z.array(z.string()), // Can accept multiple input types
  outputType: z.string(),
  templateName: z.string(), // Reference to LLM template
  inputSchema: z.any(), // Zod schema for input validation
  outputSchema: z.any() // Zod schema for output validation
});

export type LLMTransformDefinition = z.infer<typeof LLMTransformDefinitionSchema>;

// Input schema for brainstorm editing
export const BrainstormEditInputSchema = z.object({
  sourceArtifactId: z.string().min(1, '源内容ID不能为空'),
  ideaIndex: z.number().int().min(0, '想法索引必须为非负整数'),
  editRequirements: z.string().min(1, '编辑要求不能为空'),
  agentInstructions: z.string().optional() // Additional context from agent
});

export type BrainstormEditInput = z.infer<typeof BrainstormEditInputSchema>;

// Output schema for brainstorm editing (single brainstorm idea)
export const BrainstormEditOutputSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(50, '标题不能超过50个字符'),
  body: z.string().min(1, '内容不能为空').max(500, '内容不能超过500个字符')
});

export type BrainstormEditOutput = z.infer<typeof BrainstormEditOutputSchema>;

// Transform registry
export const HUMAN_TRANSFORM_DEFINITIONS: Record<string, HumanTransformDefinition> = {
  'brainstorm_to_outline': {
    name: 'brainstorm_to_outline',
    description: 'Convert a brainstorm idea to outline input',
    sourceArtifactType: 'brainstorm_idea_collection',
    targetArtifactType: 'outline_input',
    pathPattern: '^\\[\\d+\\]$', // Matches [0], [1], etc.
    instantiationFunction: 'createOutlineInputFromBrainstormIdea'
  },
  'edit_brainstorm_idea': {
    name: 'edit_brainstorm_idea',
    description: 'Edit entire brainstorm idea object',
    sourceArtifactType: 'brainstorm_idea_collection',
    targetArtifactType: 'brainstorm_idea',
    pathPattern: '^\\[\\d+\\]$', // Matches [0], [1], etc. - entire object
    instantiationFunction: 'createBrainstormIdeaFromBrainstormIdea'
  },
  'edit_brainstorm_idea_field': {
    name: 'edit_brainstorm_idea_field',
    description: 'Edit individual fields of brainstorm ideas',
    sourceArtifactType: 'brainstorm_idea_collection',
    targetArtifactType: 'user_input',
    pathPattern: '^\\[\\d+\\]\\.(title|body)$', // Matches [0].title, [1].body, etc.
    instantiationFunction: 'createUserInputFromBrainstormField'
  }
};

// LLM Transform registry
export const LLM_TRANSFORM_DEFINITIONS: Record<string, LLMTransformDefinition> = {
  'llm_edit_brainstorm_idea': {
    name: 'llm_edit_brainstorm_idea',
    description: 'AI-powered editing of brainstorm ideas based on user requirements',
    inputTypes: ['brainstorm_idea_collection', 'brainstorm_idea', 'user_input'],
    outputType: 'brainstorm_idea',
    templateName: 'brainstormEdit',
    inputSchema: BrainstormEditInputSchema,
    outputSchema: BrainstormEditOutputSchema
  }
};

// Validation function for human transforms
export function validateTransformPath(transformName: string, path: string): boolean {
  const definition = HUMAN_TRANSFORM_DEFINITIONS[transformName];
  if (!definition) return false;

  const regex = new RegExp(definition.pathPattern);
  return regex.test(path);
}

// Validation function for LLM transforms
export function validateLLMTransformInput(transformName: string, input: any): boolean {
  const definition = LLM_TRANSFORM_DEFINITIONS[transformName];
  if (!definition) return false;

  const result = definition.inputSchema.safeParse(input);
  return result.success;
} 