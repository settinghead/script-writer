import { z } from 'zod';

// ===========================================
// OUTLINE SETTINGS SCHEMAS
// ===========================================

// Character details for outline - updated to match LLM prompt format
export const CharacterDetailSchema = z.object({
    name: z.string(),
    type: z.enum(['male_lead', 'female_lead', 'male_second', 'female_second', 'male_supporting', 'female_supporting', 'antagonist', 'other']),
    description: z.string(),
    age: z.string(),
    gender: z.string(),
    occupation: z.string(),
    personality_traits: z.array(z.string()),
    character_arc: z.string(),
    relationships: z.record(z.string(), z.string()),
    key_scenes: z.array(z.string())
});

export type CharacterDetail = z.infer<typeof CharacterDetailSchema>;

// Outline Settings Schemas
export const OutlineSettingsInputSchema = z.object({
    sourceArtifactId: z.string(),
    title: z.string(),
    requirements: z.string()
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
    characters: z.array(CharacterDetailSchema)
});

export type OutlineSettingsInput = z.infer<typeof OutlineSettingsInputSchema>;
export type OutlineSettingsOutput = z.infer<typeof OutlineSettingsOutputSchema>;

// ===========================================
// CHRONICLES SCHEMAS
// ===========================================

// Chronicles Schemas
export const ChroniclesInputSchema = z.object({
    sourceArtifactId: z.string(),
    requirements: z.string().optional()
});

export const ChroniclesOutputSchema = z.object({
    synopsis_stages: z.array(z.string())
});

export type ChroniclesInput = z.infer<typeof ChroniclesInputSchema>;
export type ChroniclesOutput = z.infer<typeof ChroniclesOutputSchema>; 