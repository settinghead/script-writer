import { z } from 'zod';
import { CharacterSchema } from './streaming';

// ===========================================
// OUTLINE SETTINGS SCHEMAS
// ===========================================

// Outline Settings Schemas
export const OutlineSettingsInputSchema = z.object({
    sourceArtifactId: z.string(),
    title: z.string().describe('故事标题'),
    requirements: z.string().describe('故事要求'),
});

export const OutlineSettingsOutputSchema = z.object({
    title: z.string(),
    genre: z.string(),
    target_audience: z.object({
        demographic: z.string(),
        core_themes: z.array(z.string())
    }),
    selling_points: z.array(z.string()),
    satisfaction_points: z.array(z.string()),
    setting: z.object({
        core_setting_summary: z.string(),
        key_scenes: z.array(z.string())
    }),
    characters: z.array(CharacterSchema)
});

export type OutlineSettingsInput = z.infer<typeof OutlineSettingsInputSchema>;
export type OutlineSettingsOutput = z.infer<typeof OutlineSettingsOutputSchema>;

// ===========================================
// CHRONICLES SCHEMAS
// ===========================================

// Emotion arc schema for chronicles stages
export const EmotionArcSchema = z.object({
    characters: z.array(z.string()),
    content: z.string()
});

// Relationship development schema for chronicles stages
export const RelationshipDevelopmentSchema = z.object({
    characters: z.array(z.string()),
    content: z.string()
});

// Chronicles stage schema - matches the template requirements
export const ChroniclesStageSchema = z.object({
    title: z.string(),
    stageSynopsis: z.string(),
    event: z.string(),
    emotionArcs: z.array(EmotionArcSchema),
    relationshipDevelopments: z.array(RelationshipDevelopmentSchema),
    insights: z.array(z.string())
});

// Chronicles Schemas
export const ChroniclesInputSchema = z.object({
    sourceArtifactId: z.string(),
    requirements: z.string().optional()
});

export const ChroniclesOutputSchema = z.object({
    stages: z.array(ChroniclesStageSchema)
});

export type EmotionArc = z.infer<typeof EmotionArcSchema>;
export type RelationshipDevelopment = z.infer<typeof RelationshipDevelopmentSchema>;
export type ChroniclesStage = z.infer<typeof ChroniclesStageSchema>;
export type ChroniclesInput = z.infer<typeof ChroniclesInputSchema>;
export type ChroniclesOutput = z.infer<typeof ChroniclesOutputSchema>; 