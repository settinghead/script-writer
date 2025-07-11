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
  'brainstorm_collection': z.object({
    ideas: z.array(IdeaSchema),
    platform: z.string(),
    genre: z.string(),
    total_ideas: z.number()
  }),
  'brainstorm_idea': IdeaSchema,
  'brainstorm_input_params': BrainstormToolInputSchema,

  // New outline schemas
  'outline_settings_input': OutlineSettingsInputSchema,
  'outline_settings': OutlineSettingsOutputSchema,
  'chronicles_input': ChroniclesInputSchema,
  'chronicles': ChroniclesOutputSchema,




} as const;

// Type exports
export type OutlineSettingsOutput = z.infer<typeof OutlineSettingsOutputSchema>;
export type ChroniclesOutput = z.infer<typeof ChroniclesOutputSchema>;
export type ChroniclesStage = z.infer<typeof ChroniclesStageSchema>; 