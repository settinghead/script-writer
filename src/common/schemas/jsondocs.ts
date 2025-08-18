import { z } from 'zod';
import {
  OutlineSettingsInputSchema,
  OutlineSettingsOutputSchema,
  ChroniclesInputSchema,
  ChroniclesOutputSchema,
  ChroniclesStageSchema,
  EpisodePlanningInputSchema,
  EpisodePlanningOutputSchema,
  EpisodeSynopsisInputSchema,
  EpisodeSynopsisSchema,
  EpisodeScriptInputSchema,
  EpisodeScriptSchema
} from './outlineSchemas';

// Import schemas from streaming.ts 
import { IdeaSchema} from './streaming';

// Import JSON patch schema from transforms
import { JsonPatchOperationsSchema } from './transforms';

// Brainstorm tool input schema
export const BrainstormToolInputSchema = z.object({
  platform: z.string().min(1, "平台不能为空"),
  genre: z.string().min(1, "类型不能为空"),
  genrePaths: z.array(z.array(z.string())).min(1, "必须选择至少一个类型"),
  other_requirements: z.string().optional(),
  numberOfIdeas: z.number().min(1).max(4).default(3)
});

export type BrainstormToolInput = z.infer<typeof BrainstormToolInputSchema>;

// Brainstorm collection schema that handles both old and new formats
const BrainstormCollectionSchema = z.union([
  // Old format: direct array
  z.array(IdeaSchema),
  // New format: object with ideas property
  z.object({
    ideas: z.array(IdeaSchema),
    platform: z.string(),
    genre: z.string(),
    total_ideas: z.number()
  })
]);

// JSON Patch schema for intermediate patch storage
const JsonPatchSchema = z.object({
  patches: JsonPatchOperationsSchema,
  targetJsondocId: z.string().optional(),
  targetSchemaType: z.string().optional(),
  patchIndex: z.number().optional(),
  applied: z.boolean().optional(),
  errorMessage: z.string().optional()
});

// Jsondoc Schema Registry
export const JsondocSchemaRegistry = {
  // Brainstorm schemas
  'brainstorm_collection': BrainstormCollectionSchema,
  '灵感创意': IdeaSchema,
  'brainstorm_input_params': BrainstormToolInputSchema,

  // New outline schemas
  '剧本设定_input': OutlineSettingsInputSchema,
  '剧本设定': OutlineSettingsOutputSchema,
  'chronicles_input': ChroniclesInputSchema,
  'chronicles': ChroniclesOutputSchema,

  // Episode planning schemas
  '分集结构_input': EpisodePlanningInputSchema,
  '分集结构': EpisodePlanningOutputSchema,

  // Episode synopsis schemas
  '单集大纲_input': EpisodeSynopsisInputSchema,
  '单集大纲': EpisodeSynopsisSchema,

  // Episode script schemas
  '单集剧本_input': EpisodeScriptInputSchema,
  '单集剧本': EpisodeScriptSchema,

  // JSON Patch schema for intermediate patch storage
  'json_patch': JsonPatchSchema,
} as const;

// Type exports
export type OutlineSettingsOutput = z.infer<typeof OutlineSettingsOutputSchema>;
export type ChroniclesOutput = z.infer<typeof ChroniclesOutputSchema>;
export type ChroniclesStage = z.infer<typeof ChroniclesStageSchema>; 