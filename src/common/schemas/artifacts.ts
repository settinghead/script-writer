import { z } from 'zod';
import {
  OutlineSettingsInputSchema,
  OutlineSettingsOutputSchema,
  ChroniclesInputSchema,
  ChroniclesOutputSchema
} from './outlineSchemas';

// Import schemas from streaming.ts 
import { IdeaSchema, ScriptSchema } from './streaming';

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
  'user_input_schema': z.object({
    title: z.string(),
    body: z.string()
  }),

  // New outline schemas
  'outline_settings_input_schema': OutlineSettingsInputSchema,
  'outline_settings_schema': OutlineSettingsOutputSchema,
  'chronicles_input_schema': ChroniclesInputSchema,
  'chronicles_schema': ChroniclesOutputSchema,

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