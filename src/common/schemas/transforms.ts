import { z } from 'zod';
import { OutlineSettingsInputSchema, OutlineSettingsOutputSchema, ChroniclesInputSchema, ChroniclesOutputSchema, EpisodePlanningInputSchema, EpisodePlanningOutputSchema } from './outlineSchemas';
import { BrainstormToolInputSchema } from './jsondocs';
import { BaseToolInputSchema } from './common';

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
  '剧本设定_generation': {
    pathPattern: '^\\$\\[剧本设定\\]$',
    inputSchema: OutlineSettingsInputSchema,
    outputSchema: OutlineSettingsOutputSchema,
    outputType: '剧本设定'
  },

  // Chronicles Transform
  'chronicles_generation': {
    pathPattern: '^\\$\\[chronicles\\]$',
    inputSchema: ChroniclesInputSchema,
    outputSchema: ChroniclesOutputSchema,
    outputType: 'chronicles'
  },

  // Episode Planning Transform
  'episode_planning_generation': {
    pathPattern: '^\\$\\[episode_planning\\]$',
    inputSchema: EpisodePlanningInputSchema,
    outputSchema: EpisodePlanningOutputSchema,
    outputType: 'episode_planning'
  },

  // Brainstorm edit transforms
  '灵感创意_edit': {
    pathPattern: '^\\$\\.ideas\\[\\d+\\]$',
    inputSchema: z.object({
      title: z.string(),
      body: z.string()
    }),
    outputSchema: z.object({
      title: z.string(),
      body: z.string()
    }),
    outputType: '灵感创意'
  },

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
export const BrainstormEditInputSchema = BaseToolInputSchema.extend({
  ideaIndex: z.number().min(0).optional().describe('要编辑的故事创意在集合中的索引位置（从0开始）'),
  editRequirements: z.string().min(1, '编辑要求不能为空').describe('具体的编辑要求，如：扩展内容、调整风格、修改情节、增加元素等'),
});

export type BrainstormEditInput = z.infer<typeof BrainstormEditInputSchema>;

// Input schema for 剧本设定 editing
export const OutlineSettingsEditInputSchema = BaseToolInputSchema.extend({
  editRequirements: z.string().min(1, '编辑要求不能为空').describe('具体的编辑要求，如：修改角色设定、调整卖点、更新故事背景等'),
});

export type OutlineSettingsEditInput = z.infer<typeof OutlineSettingsEditInputSchema>;

// Input schema for chronicles editing
export const ChroniclesEditInputSchema = BaseToolInputSchema.extend({
  editRequirements: z.string().min(1, '编辑要求不能为空').describe('具体的编辑要求，如：修改时间线、调整角色发展、更新情节推进等'),
});

export type ChroniclesEditInput = z.infer<typeof ChroniclesEditInputSchema>;



// JSON Patch operation schema (RFC 6902)
export const JsonPatchOperationSchema = z.object({
  op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']).describe('JSON Patch操作类型'),
  path: z.string().describe('要修改的JSON路径，如/title或/body'),
  value: z.any().optional().describe('新的值（用于add、replace、copy操作）'),
  from: z.string().optional().describe('源路径（用于move、copy操作）')
});

export const JsonPatchOperationsSchema = z.array(JsonPatchOperationSchema);

export type JsonPatchOperation = z.infer<typeof JsonPatchOperationSchema>;

// JSON Patch array schema
export const JsonPatchArraySchema = z.array(JsonPatchOperationSchema);

export type JsonPatchArray = z.infer<typeof JsonPatchArraySchema>;

// Input schema for JSON patch-based brainstorm editing
export const BrainstormEditJsonPatchInputSchema = BrainstormEditInputSchema;

// Output schema for JSON patch-based brainstorm editing
export const BrainstormEditJsonPatchOutputSchema = JsonPatchArraySchema;

// Input schema for JSON patch-based 剧本设定 editing
export const OutlineSettingsEditJsonPatchInputSchema = OutlineSettingsEditInputSchema;

// Output schema for JSON patch-based 剧本设定 editing
export const OutlineSettingsEditJsonPatchOutputSchema = JsonPatchArraySchema;

// Transform registry
export const HUMAN_TRANSFORM_DEFINITIONS: Record<string, HumanTransformDefinition> = {
  // Brainstorm input creation transform (from existing brainstorm collection)
  'create_brainstorm_input': {
    name: 'create_brainstorm_input',
    description: 'Create brainstorm input parameters from existing collection',
    sourceJsondocType: 'brainstorm_collection',
    targetJsondocType: 'brainstorm_input_params',
    pathPattern: '^\\$$', // Root path for new creation
    instantiationFunction: 'createBrainstormToolInput'
  },
  // Collection-specific transforms
  'edit_brainstorm_collection_idea': {
    name: 'edit_brainstorm_collection_idea',
    description: 'Edit individual idea within brainstorm collection',
    sourceJsondocType: 'brainstorm_collection',
    targetJsondocType: '灵感创意',
    pathPattern: '^\\$.ideas\\[\\d+\\]$', // JSONPath for ideas[n]
    instantiationFunction: 'createBrainstormIdeaFromPath'
  },

  'edit_json_patch': {
    name: 'edit_json_patch',
    description: 'Edit JSON patch jsondoc',
    sourceJsondocType: 'json_patch',
    targetJsondocType: 'json_patch',
    pathPattern: '^\\$$', // Root path for patch editing
    instantiationFunction: 'createEditableJsondocCopy'
  },

  'edit_brainstorm_input_params': {
    name: 'edit_brainstorm_input_params',
    description: 'Edit brainstorm input parameters',
    sourceJsondocType: 'brainstorm_input_params',
    targetJsondocType: 'brainstorm_input_params',
    pathPattern: '^\\$\\.[a-zA-Z_][a-zA-Z0-9_]*.*$',
    instantiationFunction: 'createFieldEditFromPath'
  },

  // Generic field edit for JSON patch jsondocs (most common use case)
  'edit_jsondoc_field': {
    name: 'edit_jsondoc_field',
    description: 'Edit fields in JSON patch jsondocs',
    sourceJsondocType: 'json_patch',
    targetJsondocType: 'json_patch',
    pathPattern: '^\\$\\.[a-zA-Z_][a-zA-Z0-9_]*.*$',
    instantiationFunction: 'createEditableJsondocCopy'
  },
  'brainstorm_to_outline': {
    name: 'brainstorm_to_outline',
    description: 'Convert a brainstorm idea to outline input',
    sourceJsondocType: '灵感创意',
    targetJsondocType: 'outline_input',
    pathPattern: '^\\$$', // Root path indicator ($)
    instantiationFunction: 'createOutlineInputFromBrainstormIdea'
  },
  'edit_灵感创意': {
    name: 'edit_灵感创意',
    description: 'Edit entire brainstorm idea object',
    sourceJsondocType: '灵感创意',
    targetJsondocType: '灵感创意',
    pathPattern: '^\\$$', // Root path indicator ($)
    instantiationFunction: 'createBrainstormIdeaFromBrainstormIdea'
  },
  'edit_灵感创意_field': {
    name: 'edit_灵感创意_field',
    description: 'Edit individual fields of brainstorm ideas',
    sourceJsondocType: '灵感创意',
    targetJsondocType: '灵感创意',
    pathPattern: '^(title|body)$', // Matches title or body fields
    instantiationFunction: 'createUserInputFromBrainstormField'
  },
  'edit_剧本设定': {
    name: 'edit_剧本设定',
    description: 'Edit 剧本设定 with fine-grained field tracking',
    sourceJsondocType: '剧本设定',
    targetJsondocType: '剧本设定',
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
  },
  'edit_episode_planning': {
    name: 'edit_episode_planning',
    description: 'Edit episode planning document with whole-document editing',
    sourceJsondocType: 'episode_planning',
    targetJsondocType: 'episode_planning',
    pathPattern: '^\\$(\\..*)?$', // Root or any path like $.episodeGroups[0].groupTitle, $.overallStrategy, etc.
    instantiationFunction: 'createEpisodePlanningFromEpisodePlanning'
  }
};

// Generic edit input schema for path-based editing
export const GenericEditInputSchema = BaseToolInputSchema.extend({
  jsondocPath: z.string().min(1, '路径不能为空'),
  editRequirements: z.string().min(1, '编辑要求不能为空'),
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
