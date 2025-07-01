import { z } from 'zod';

// Input schema for outline generation (agent-based system)
export const OutlineGenerationInputSchema = z.object({
    sourceArtifactId: z.string().describe('ID of the brainstorm idea to use'),
    totalEpisodes: z.number().min(6).max(200).describe('Total number of episodes'),
    episodeDuration: z.number().min(1).max(30).describe('Duration per episode in minutes'),
    selectedPlatform: z.string().describe('Target platform (抖音, 快手, etc.)'),
    selectedGenrePaths: z.array(z.array(z.string())).describe('Selected genre paths'),
    requirements: z.string().optional().describe('Special requirements')
});

export type OutlineGenerationInput = z.infer<typeof OutlineGenerationInputSchema>;

// Character schema (from outline.ts template)
const CharacterSchema = z.object({
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

// Simplified Stage schema - focused on chronological story development
const StageSchema = z.object({
    title: z.string(),
    stageSynopsis: z.string(),
    keyPoints: z.array(z.object({
        event: z.string(),
        emotionArcs: z.array(z.object({
            characters: z.array(z.string()),
            content: z.string()
        })),
        relationshipDevelopments: z.array(z.object({
            characters: z.array(z.string()),
            content: z.string()
        }))
    }))
});

// Complete outline output schema - simplified and focused on chronological development
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