import { z } from 'zod';

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
  'brainstorm_idea_collection': BrainstormIdeaCollectionSchema,
  'brainstorm_idea': BrainstormIdeaSchema,
  'outline_input': OutlineInputSchema,
  'user_input': UserInputSchema
} as const;

export type BrainstormIdeaCollection = z.infer<typeof BrainstormIdeaCollectionSchema>;
export type BrainstormIdea = z.infer<typeof BrainstormIdeaSchema>;
export type OutlineInput = z.infer<typeof OutlineInputSchema>;
export type UserInput = z.infer<typeof UserInputSchema>;
export type ArtifactType = keyof typeof ARTIFACT_SCHEMAS; 