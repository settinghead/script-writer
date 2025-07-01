import { z } from 'zod';

// ===========================================
// OUTLINE SETTINGS SCHEMAS
// ===========================================

// Character details for outline
export const CharacterDetailSchema = z.object({
    name: z.string(),
    type: z.enum(['male_lead', 'female_lead', 'male_second', 'female_second', 'male_supporting', 'female_supporting', 'antagonist', 'other']),
    age: z.string(),
    occupation: z.string(),
    personality: z.string(),
    appearance: z.string(),
    background: z.string()
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
    target_audience: z.string(),
    platform: z.string(),
    selling_points: z.array(z.string()),
    satisfaction_points: z.array(z.string()),
    setting: z.object({
        time_period: z.string(),
        location: z.string(),
        social_context: z.string()
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