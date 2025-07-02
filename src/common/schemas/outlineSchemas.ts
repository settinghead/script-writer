import { z } from 'zod';

// ===========================================
// OUTLINE SETTINGS SCHEMAS
// ===========================================

// Character details for outline - updated to match LLM prompt format
export const CharacterDetailSchema = z.object({
    name: z.string(),
    type: z.enum(['male_lead', 'female_lead', 'male_second', 'female_second', 'male_supporting', 'female_supporting', 'antagonist', 'other']),
    description: z.string().optional().default(''),
    age: z.string().optional().default(''),
    gender: z.string().optional().default(''),
    occupation: z.string().optional().default(''),
    personality_traits: z.array(z.string()).optional().default([]),
    character_arc: z.string().optional().default(''),
    relationships: z.record(z.string(), z.string()).optional().default({}),
    key_scenes: z.array(z.string()).optional().default([])
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
        demographic: z.string().optional().default(''),
        core_themes: z.array(z.string()).optional().default([])
    }),
    selling_points: z.array(z.string()).optional().default([]),
    satisfaction_points: z.array(z.string()).optional().default([]),
    setting: z.object({
        core_setting_summary: z.string().optional().default(''),
        key_scenes: z.array(z.string()).optional().default([])
    }),
    characters: z.array(CharacterDetailSchema).optional().default([])
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