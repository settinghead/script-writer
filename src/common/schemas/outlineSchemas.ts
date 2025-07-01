import { z } from 'zod';

// ===========================================
// OUTLINE SETTINGS SCHEMAS
// ===========================================

// Input schema for outline settings generation
export const OutlineSettingsInputSchema = z.object({
    sourceArtifactId: z.string().describe('ID of the brainstorm idea to use'),
    totalEpisodes: z.number().min(6).max(200).describe('Total number of episodes'),
    episodeDuration: z.number().min(1).max(30).describe('Duration per episode in minutes'),
    selectedPlatform: z.string().describe('Target platform (抖音, 快手, etc.)'),
    selectedGenrePaths: z.array(z.array(z.string())).describe('Selected genre paths'),
    requirements: z.string().optional().describe('Special requirements')
});

export type OutlineSettingsInput = z.infer<typeof OutlineSettingsInputSchema>;

// Character schema (shared between settings and chronicles)
export const CharacterSchema = z.object({
    name: z.string(),
    type: z.enum(['male_lead', 'female_lead', 'male_second', 'female_second', 'male_supporting', 'female_supporting', 'antagonist', 'other']),
    description: z.string(),
    age: z.string(),
    gender: z.string(),
    occupation: z.string(),
    personality_traits: z.array(z.string()),
    character_arc: z.string(),
    relationships: z.record(z.string()),
    key_scenes: z.array(z.string())
});

// Outline settings output schema - everything except chronological stages
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

export type OutlineSettingsOutput = z.infer<typeof OutlineSettingsOutputSchema>;

// ===========================================
// CHRONICLES SCHEMAS
// ===========================================

// Input schema for chronicles generation
export const ChroniclesInputSchema = z.object({
    outlineSettingsArtifactId: z.string().describe('ID of the outline settings artifact to use'),
    totalEpisodes: z.number().min(6).max(200).describe('Total number of episodes'),
    episodeDuration: z.number().min(1).max(30).describe('Duration per episode in minutes'),
    requirements: z.string().optional().describe('Special requirements for chronological development')
});

export type ChroniclesInput = z.infer<typeof ChroniclesInputSchema>;

// Stage schema - focused on chronological story development
export const StageSchema = z.object({
    title: z.string(),
    stageSynopsis: z.string(),
    event: z.string(),
    emotionArcs: z.array(z.object({
        characters: z.array(z.string()),
        content: z.string()
    })),
    relationshipDevelopments: z.array(z.object({
        characters: z.array(z.string()),
        content: z.string()
    })),
    insights: z.array(z.string())
});

// Chronicles output schema - only chronological stages
export const ChroniclesOutputSchema = z.object({
    stages: z.array(StageSchema)
});

export type ChroniclesOutput = z.infer<typeof ChroniclesOutputSchema>;

// ===========================================
// LEGACY SCHEMAS (for backward compatibility)
// ===========================================

// Legacy input schema - maintained for backward compatibility
export const OutlineGenerationInputSchema = OutlineSettingsInputSchema;
export type OutlineGenerationInput = OutlineSettingsInput;

// Legacy output schema - maintained for backward compatibility
export const OutlineGenerationOutputSchema = z.object({
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
    characters: z.array(CharacterSchema),
    stages: z.array(StageSchema)
});

export type OutlineGenerationOutput = z.infer<typeof OutlineGenerationOutputSchema>; 