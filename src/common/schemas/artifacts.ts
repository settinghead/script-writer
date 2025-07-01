import { z } from 'zod';
import {
  OutlineGenerationOutputSchema,
  OutlineGenerationInputSchema,
  OutlineSettingsOutputSchema,
  ChroniclesOutputSchema,
} from './outlineSchemas';

// Unified brainstorm idea schema - aligns frontend and backend
export const BrainstormIdeaSchema = z.object({
  title: z.string().min(1).max(50),
  body: z.string().min(10).max(2000)
});

// Brainstorm idea collection schema (NEW: single artifact containing multiple ideas)
export const BrainstormIdeaCollectionSchema = z.object({
  ideas: z.array(z.object({
    title: z.string().min(1).max(50),
    body: z.string().min(10).max(2000),
    metadata: z.object({
      ideaIndex: z.number(),
      confidence_score: z.number().optional()
    }).optional()
  })),
  platform: z.string(),
  genre: z.string(),
  total_ideas: z.number()
});

// Schema for outline input (derived from brainstorm ideas)
export const OutlineInputSchema = z.object({
  content: z.string().min(10).max(5000),
  source_metadata: z.object({
    original_idea_title: z.string(),
    original_idea_body: z.string(),
    derivation_path: z.string(),
    source_artifact_id: z.string()
  }).optional()
});

// User input schema (for manual edits)
export const UserInputSchema = z.object({
  text: z.string(),
  source: z.enum(['manual', 'modified_brainstorm']),
  source_artifact_id: z.string().optional()
});

// Schema registry
export const ARTIFACT_SCHEMAS = {
  'brainstorm_collection_schema': BrainstormIdeaCollectionSchema,
  'brainstorm_idea_schema': BrainstormIdeaSchema,
  'outline_input_schema': OutlineInputSchema,
  'chronological_outline_input': OutlineGenerationInputSchema,
  'user_input_schema': UserInputSchema,
  'outline_schema': OutlineGenerationOutputSchema,
  // NEW: Split outline schemas
  'outline_settings_schema': OutlineSettingsOutputSchema,
  'chronicles_schema': ChroniclesOutputSchema
} as const;

export type BrainstormIdeaCollection = z.infer<typeof BrainstormIdeaCollectionSchema>;
export type BrainstormIdea = z.infer<typeof BrainstormIdeaSchema>;
export type OutlineInput = z.infer<typeof OutlineInputSchema>;
export type UserInput = z.infer<typeof UserInputSchema>;
export type OutlineGenerationOutput = z.infer<typeof OutlineGenerationOutputSchema>;
// NEW: Split outline types
export type OutlineSettingsOutput = z.infer<typeof OutlineSettingsOutputSchema>;
export type ChroniclesOutput = z.infer<typeof ChroniclesOutputSchema>;
export type ArtifactSchemaType = keyof typeof ARTIFACT_SCHEMAS; 