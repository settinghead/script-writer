import { z } from 'zod';
import { OutlineSettingsInputSchema, OutlineSettingsOutputSchema, ChroniclesInputSchema, ChroniclesOutputSchema } from './outlineSchemas';
import { BrainstormToolInputSchema } from './jsonDocs';

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

// Validate transform name
export function validateTransformName(name: string): boolean {
  return name in TransformRegistry;
}

// Get transform definition
export function getTransformDefinition(name: string) {
  if (!validateTransformName(name)) {
    throw new Error(`Unknown transform: ${name}`);
  }
  return TransformRegistry[name as keyof typeof TransformRegistry];
}

// Transform definition schema
export const HumanTransformDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  sourceJsonDocType: z.string(),
  targetJsonDocType: z.string(),
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
  sourceJsonDocId: z.string().min(1, 'Source jsonDoc ID不能为空').describe('要编辑的故事创意所在的source jsonDoc ID，从项目背景信息中获取'),
  editRequirements: z.string().min(1, '编辑要求不能为空').describe('具体的编辑要求，如：扩展内容、调整风格、修改情节、增加元素等'),
  agentInstructions: z.string().optional().describe('来自智能体的额外指导信息，用于更好地理解编辑意图')
});

export type BrainstormEditInput = z.infer<typeof BrainstormEditInputSchema>;

// Output schema for brainstorm editing (single brainstorm idea)
export const BrainstormEditOutputSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(50, '标题不能超过50个字符').describe('编辑后的故事标题，简洁有吸引力'),
  body: z.string().min(1, '内容不能为空').max(500, '内容不能超过500个字符').describe('编辑后的故事详细内容，包含完整的情节和人物设定')
});

export type BrainstormEditOutput = z.infer<typeof BrainstormEditOutputSchema>;

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
export const BrainstormEditJsonPatchInputSchema = BrainstormEditInputSchema; // Same input as regular edit

export type BrainstormEditJsonPatchInput = z.infer<typeof BrainstormEditJsonPatchInputSchema>;

// Output schema for JSON patch-based brainstorm editing
export const BrainstormEditJsonPatchOutputSchema = JsonPatchArraySchema;

export type BrainstormEditJsonPatchOutput = z.infer<typeof BrainstormEditJsonPatchOutputSchema>;

// Transform registry
export const HUMAN_TRANSFORM_DEFINITIONS: Record<string, HumanTransformDefinition> = {
  // Brainstorm input creation transform
  'create_brainstorm_input': {
    name: 'create_brainstorm_input',
    description: 'Create brainstorm input parameters',
    sourceJsonDocType: '*', // Can be created from any source or standalone
    targetJsonDocType: 'brainstorm_input_params',
    pathPattern: '^\\$$', // Root path for new creation
    instantiationFunction: 'createBrainstormToolInput'
  },
  // Collection-specific transforms
  'edit_brainstorm_collection_idea': {
    name: 'edit_brainstorm_collection_idea',
    description: 'Edit individual idea within brainstorm collection',
    sourceJsonDocType: 'brainstorm_collection',
    targetJsonDocType: 'brainstorm_idea',
    pathPattern: '^\\$.ideas\\[\\d+\\]$', // JSONPath for ideas[n]
    instantiationFunction: 'createBrainstormIdeaFromPath'
  },



  'edit_jsonDoc_field': {
    name: 'edit_jsonDoc_field',
    description: 'Generic field editing using JSONPath',
    sourceJsonDocType: '*', // Any jsonDoc type
    targetJsonDocType: '*', // Flexible output type
    pathPattern: '^\\$\\.[a-zA-Z_][a-zA-Z0-9_]*.*$', // Any valid JSONPath
    instantiationFunction: 'createFieldEditFromPath'
  },
  'brainstorm_to_outline': {
    name: 'brainstorm_to_outline',
    description: 'Convert a brainstorm idea to outline input',
    sourceJsonDocType: 'brainstorm_idea',
    targetJsonDocType: 'outline_input',
    pathPattern: '^\\$$', // Root path indicator ($)
    instantiationFunction: 'createOutlineInputFromBrainstormIdea'
  },
  'edit_brainstorm_idea': {
    name: 'edit_brainstorm_idea',
    description: 'Edit entire brainstorm idea object',
    sourceJsonDocType: 'brainstorm_idea',
    targetJsonDocType: 'brainstorm_idea',
    pathPattern: '^\\$$', // Root path indicator ($)
    instantiationFunction: 'createBrainstormIdeaFromBrainstormIdea'
  },
  'edit_brainstorm_idea_field': {
    name: 'edit_brainstorm_idea_field',
    description: 'Edit individual fields of brainstorm ideas',
    sourceJsonDocType: 'brainstorm_idea',
    targetJsonDocType: 'brainstorm_idea',
    pathPattern: '^(title|body)$', // Matches title or body fields
    instantiationFunction: 'createUserInputFromBrainstormField'
  },
  'edit_outline_settings': {
    name: 'edit_outline_settings',
    description: 'Edit outline settings with fine-grained field tracking',
    sourceJsonDocType: 'outline_settings',
    targetJsonDocType: 'outline_settings',
    pathPattern: '^\\$(\\..*)?$', // Root or any path like $.title, $.characters[0].name, etc.
    instantiationFunction: 'createOutlineSettingsFromOutlineSettings'
  },
  'edit_chronicles': {
    name: 'edit_chronicles',
    description: 'Edit chronicles document with whole-document editing',
    sourceJsonDocType: 'chronicles',
    targetJsonDocType: 'chronicles',
    pathPattern: '^\\$(\\..*)?$', // Root or any path like $.stages[0].title, $.stages[1].event, etc.
    instantiationFunction: 'createChroniclesFromChronicles'
  }
};

// Generic edit input schema for path-based editing
export const GenericEditInputSchema = z.object({
  sourceJsonDocId: z.string().min(1, '源内容ID不能为空'),
  jsonDocPath: z.string().min(1, '路径不能为空'),
  editRequirements: z.string().min(1, '编辑要求不能为空'),
  agentInstructions: z.string().optional()
});

export type GenericEditInput = z.infer<typeof GenericEditInputSchema>;

// Generic edit output schema
export const GenericEditOutputSchema = z.any(); // Flexible output type

export type GenericEditOutput = z.infer<typeof GenericEditOutputSchema>;

// LLM Transform registry
export const LLM_TRANSFORM_DEFINITIONS: Record<string, LLMTransformDefinition> = {
  // Collection-specific LLM transforms
  'llm_edit_brainstorm_collection_idea': {
    name: 'llm_edit_brainstorm_collection_idea',
    description: 'AI editing of ideas within brainstorm collections',
    inputTypes: ['brainstorm_collection'],
    outputType: 'brainstorm_idea',
    templateName: 'brainstormEdit',
    inputSchema: BrainstormEditInputSchema,
    outputSchema: BrainstormEditOutputSchema
  },
  'llm_edit_jsonDoc_path': {
    name: 'llm_edit_jsonDoc_path',
    description: 'Generic AI editing using JSONPath',
    inputTypes: ['*'], // Any jsonDoc type
    outputType: '*', // Flexible output type
    templateName: 'genericEdit',
    inputSchema: GenericEditInputSchema,
    outputSchema: GenericEditOutputSchema
  },
  'llm_edit_brainstorm_idea': {
    name: 'llm_edit_brainstorm_idea',
    description: 'AI-powered editing of brainstorm ideas based on user requirements',
    inputTypes: ['brainstorm_idea', 'user_input'],
    outputType: 'brainstorm_idea',
    templateName: 'brainstormEdit',
    inputSchema: BrainstormEditInputSchema,
    outputSchema: BrainstormEditOutputSchema
  },
  'llm_generate_outline_settings': {
    name: 'llm_generate_outline_settings',
    description: 'AI generation of outline settings from brainstorm idea',
    inputTypes: ['brainstorm_idea', 'user_input'],
    outputType: 'outline_settings',
    templateName: 'outline_settings',
    inputSchema: OutlineSettingsInputSchema,
    outputSchema: OutlineSettingsOutputSchema
  },
  'llm_generate_chronicles': {
    name: 'llm_generate_chronicles',
    description: 'AI generation of chronicles from outline settings',
    inputTypes: ['outline_settings'],
    templateName: 'chronicles',
    inputSchema: ChroniclesInputSchema,
    outputSchema: ChroniclesOutputSchema,
    outputType: 'chronicles'
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