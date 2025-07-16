import { z } from 'zod';
import { OutlineSettingsInputSchema, OutlineSettingsOutputSchema, ChroniclesInputSchema, ChroniclesOutputSchema } from './outlineSchemas';
import { BrainstormToolInputSchema } from './jsondocs';
import { JsondocReferencesSchema } from './common';

// Base transform definition
export const BaseTransformDefinition = z.object({
  pathPattern: z.string(),
  inputSchema: z.any(),
  outputSchema: z.any(),
  outputType: z.string()
});

// Transform registry
export const TransformRegistry = {
  // Outline Settings Transform
  'outline_settings_generation': {
    pathPattern: '^\\$\\[outline_settings\\]$',
    inputSchema: OutlineSettingsInputSchema,
    outputSchema: OutlineSettingsOutputSchema,
    outputType: 'outline_settings'
  },

  // Chronicles Transform
  'chronicles_generation': {
    pathPattern: '^\\$\\[chronicles\\]$',
    inputSchema: ChroniclesInputSchema,
    outputSchema: ChroniclesOutputSchema,
    outputType: 'chronicles'
  },

  // Brainstorm edit transforms
  'brainstorm_idea_edit': {
    pathPattern: '^\\$\\.ideas\\[\\d+\\]$',
    inputSchema: z.object({
      title: z.string(),
      body: z.string()
    }),
    outputSchema: z.object({
      title: z.string(),
      body: z.string()
    }),
    outputType: 'brainstorm_idea'
  }
} as const;

// Type for transform registry keys
export type TransformRegistryKey = keyof typeof TransformRegistry;

// Type for transform definitions
export type TransformDefinition = typeof TransformRegistry[TransformRegistryKey];

// Human Transform definition schema
export const HumanTransformDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  sourceJsondocType: z.string(),
  targetJsondocType: z.string(),
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
  ideaIndex: z.number().min(0).optional().describe('要编辑的故事创意在集合中的索引位置（从0开始）'),
  jsondocs: JsondocReferencesSchema.describe('引用的jsondoc列表。可以是以下类型： brainstorm_idea, brainstorm_collection'),
  editRequirements: z.string().min(1, '编辑要求不能为空').describe('具体的编辑要求，如：扩展内容、调整风格、修改情节、增加元素等'),
  agentInstructions: z.string().optional().describe('来自智能体的额外指导信息，用于更好地理解编辑意图')
});

export type BrainstormEditInput = z.infer<typeof BrainstormEditInputSchema>;

// Input schema for outline settings editing
export const OutlineSettingsEditInputSchema = z.object({
  jsondocs: JsondocReferencesSchema.describe('引用的jsondoc列表，包含要编辑的剧本框架设置'),
  editRequirements: z.string().min(1, '编辑要求不能为空').describe('具体的编辑要求，如：修改角色设定、调整卖点、更新故事背景等'),
  agentInstructions: z.string().optional().describe('来自智能体的额外指导信息，用于更好地理解编辑意图')
});

export type OutlineSettingsEditInput = z.infer<typeof OutlineSettingsEditInputSchema>;

// JSON Patch operation schema (RFC 6902)
export const JsonPatchOperationSchema = z.object({
  op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']).describe('JSON Patch操作类型'),
  path: z.string().describe('要修改的JSON路径，如/title或/body'),
  value: z.any().optional().describe('新的值（用于add、replace、copy操作）'),
  from: z.string().optional().describe('源路径（用于move、copy操作）')
});

export type JsonPatchOperation = z.infer<typeof JsonPatchOperationSchema>;

// JSON Patch array schema
export const JsonPatchArraySchema = z.array(JsonPatchOperationSchema);

export type JsonPatchArray = z.infer<typeof JsonPatchArraySchema>;

// Input schema for JSON patch-based brainstorm editing
export const BrainstormEditJsonPatchInputSchema = BrainstormEditInputSchema;

// Output schema for JSON patch-based brainstorm editing
export const BrainstormEditJsonPatchOutputSchema = JsonPatchArraySchema;

// Input schema for JSON patch-based outline settings editing
export const OutlineSettingsEditJsonPatchInputSchema = OutlineSettingsEditInputSchema;

// Output schema for JSON patch-based outline settings editing
export const OutlineSettingsEditJsonPatchOutputSchema = JsonPatchArraySchema;

// Transform registry
export const HUMAN_TRANSFORM_DEFINITIONS: Record<string, HumanTransformDefinition> = {
  // Brainstorm input creation transform
  'create_brainstorm_input': {
    name: 'create_brainstorm_input',
    description: 'Create brainstorm input parameters',
    sourceJsondocType: '*', // Can be created from any source or standalone
    targetJsondocType: 'brainstorm_input_params',
    pathPattern: '^\\$$', // Root path for new creation
    instantiationFunction: 'createBrainstormToolInput'
  },
  // Collection-specific transforms
  'edit_brainstorm_collection_idea': {
    name: 'edit_brainstorm_collection_idea',
    description: 'Edit individual idea within brainstorm collection',
    sourceJsondocType: 'brainstorm_collection',
    targetJsondocType: 'brainstorm_idea',
    pathPattern: '^\\$.ideas\\[\\d+\\]$', // JSONPath for ideas[n]
    instantiationFunction: 'createBrainstormIdeaFromPath'
  },

  'edit_jsondoc_field': {
    name: 'edit_jsondoc_field',
    description: 'Generic field editing using JSONPath',
    sourceJsondocType: '*', // Any jsondoc type
    targetJsondocType: '*', // Flexible output type
    pathPattern: '^\\$\\.[a-zA-Z_][a-zA-Z0-9_]*.*$', // Any valid JSONPath
    instantiationFunction: 'createFieldEditFromPath'
  },
  'brainstorm_to_outline': {
    name: 'brainstorm_to_outline',
    description: 'Convert a brainstorm idea to outline input',
    sourceJsondocType: 'brainstorm_idea',
    targetJsondocType: 'outline_input',
    pathPattern: '^\\$$', // Root path indicator ($)
    instantiationFunction: 'createOutlineInputFromBrainstormIdea'
  },
  'edit_brainstorm_idea': {
    name: 'edit_brainstorm_idea',
    description: 'Edit entire brainstorm idea object',
    sourceJsondocType: 'brainstorm_idea',
    targetJsondocType: 'brainstorm_idea',
    pathPattern: '^\\$$', // Root path indicator ($)
    instantiationFunction: 'createBrainstormIdeaFromBrainstormIdea'
  },
  'edit_brainstorm_idea_field': {
    name: 'edit_brainstorm_idea_field',
    description: 'Edit individual fields of brainstorm ideas',
    sourceJsondocType: 'brainstorm_idea',
    targetJsondocType: 'brainstorm_idea',
    pathPattern: '^(title|body)$', // Matches title or body fields
    instantiationFunction: 'createUserInputFromBrainstormField'
  },
  'edit_outline_settings': {
    name: 'edit_outline_settings',
    description: 'Edit outline settings with fine-grained field tracking',
    sourceJsondocType: 'outline_settings',
    targetJsondocType: 'outline_settings',
    pathPattern: '^\\$(\\..*)?$', // Root or any path like $.title, $.characters[0].name, etc.
    instantiationFunction: 'createOutlineSettingsFromOutlineSettings'
  },
  'edit_chronicles': {
    name: 'edit_chronicles',
    description: 'Edit chronicles document with whole-document editing',
    sourceJsondocType: 'chronicles',
    targetJsondocType: 'chronicles',
    pathPattern: '^\\$(\\..*)?$', // Root or any path like $.stages[0].title, $.stages[1].event, etc.
    instantiationFunction: 'createChroniclesFromChronicles'
  }
};

// Generic edit input schema for path-based editing
export const GenericEditInputSchema = z.object({
  jsondocs: JsondocReferencesSchema.describe('引用的jsondoc列表，包含要编辑的源内容'),
  jsondocPath: z.string().min(1, '路径不能为空'),
  editRequirements: z.string().min(1, '编辑要求不能为空'),
  agentInstructions: z.string().optional()
});

export type GenericEditInput = z.infer<typeof GenericEditInputSchema>;

// Generic edit output schema
export const GenericEditOutputSchema = z.any(); // Flexible output type

export type GenericEditOutput = z.infer<typeof GenericEditOutputSchema>;

// Validation function for human transforms
export function validateTransformPath(transformName: string, path: string): boolean {
  const definition = HUMAN_TRANSFORM_DEFINITIONS[transformName];
  if (!definition) return false;

  const regex = new RegExp(definition.pathPattern);
  return regex.test(path);
}
