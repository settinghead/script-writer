import { z } from 'zod';
import {
  OutlineSettingsInputSchema,
  OutlineSettingsOutputSchema,
  ChroniclesInputSchema,
  ChroniclesOutputSchema,
  ChroniclesStageSchema
} from './outlineSchemas';

// Import schemas from streaming.ts 
import { IdeaSchema, ScriptSchema } from './streaming';

// Brainstorm tool input schema
export const BrainstormToolInputSchema = z.object({
  platform: z.string().min(1, "平台不能为空"),
  genre: z.string().min(1, "类型不能为空"),
  genrePaths: z.array(z.array(z.string())).min(1, "必须选择至少一个类型"),
  other_requirements: z.string().optional(),
  numberOfIdeas: z.number().min(1).max(4).default(3)
});

export type BrainstormToolInput = z.infer<typeof BrainstormToolInputSchema>;

// Artifact Schema Registry
export const ArtifactSchemaRegistry = {
  // Brainstorm schemas
  'brainstorm_collection_schema': z.object({
    ideas: z.array(IdeaSchema),
    platform: z.string(),
    genre: z.string(),
    total_ideas: z.number()
  }),
  'brainstorm_item_schema': IdeaSchema,
  'brainstorm_tool_input_schema': BrainstormToolInputSchema,
  'user_input_schema': z.object({
    title: z.string(),
    body: z.string()
  }),

  // New outline schemas
  'outline_settings_input_schema': OutlineSettingsInputSchema,
  'outline_settings_schema': OutlineSettingsOutputSchema,
  'chronicles_input_schema': ChroniclesInputSchema,
  'chronicles_schema': ChroniclesOutputSchema,

  // NEW: Individual chronicle stage schema for granular editing
  'chronicle_stage_schema': ChroniclesStageSchema,

  // Script schemas
  'script_schema': ScriptSchema,

  // Technical schemas
  'debug_schema': z.object({
    message: z.string(),
    timestamp: z.string()
  })
} as const;

// Type exports
export type OutlineSettingsOutput = z.infer<typeof OutlineSettingsOutputSchema>;
export type ChroniclesOutput = z.infer<typeof ChroniclesOutputSchema>;
export type ChroniclesStage = z.infer<typeof ChroniclesStageSchema>; 