import { z } from 'zod';

// ===============================
// Character Schemas
// ===============================

export const CharacterSchema = z.object({
    name: z.string(),
    type: z.enum([
        'male_lead',
        'female_lead',
        'male_second',
        'female_second',
        'male_supporting',
        'female_supporting',
        'antagonist',
        'other'
    ]),
    description: z.string(),
    age: z.string().optional(),
    gender: z.string().optional(),
    occupation: z.string().optional(),
    personality_traits: z.array(z.string()).optional(),
    character_arc: z.string().optional(),
    relationships: z.record(z.string(), z.string()).optional(),
    key_scenes: z.array(z.string()).optional()
});

// ===============================
// Outline Schemas
// ===============================

export const SynopsisStageSchema = z.object({
    stageSynopsis: z.string(),
    numberOfEpisodes: z.number(),
    startingCondition: z.string().optional(),
    endingCondition: z.string().optional(),
    stageStartEvent: z.string().optional(),
    stageEndEvent: z.string().optional(),
    keyMilestones: z.array(z.object({
        event: z.string(),
    })).optional(),
    relationshipLevel: z.string().optional(),
    emotionalArc: z.string().optional(),
    externalPressure: z.string().optional()
});

export const OutlineSchema = z.object({
    title: z.string(),
    genre: z.string(),
    target_audience: z.object({
        demographic: z.string().optional(),
        core_themes: z.array(z.string()).optional()
    }).optional(),
    selling_points: z.array(z.string()),
    satisfaction_points: z.array(z.string()),
    setting: z.object({
        core_setting_summary: z.string().optional(),
        key_scenes: z.array(z.string()).optional()
    }).optional(),
    characters: z.array(CharacterSchema),
    synopsis_stages: z.array(SynopsisStageSchema)
});

// ===============================
// Episode Schemas
// ===============================

export const EmotionDevelopmentSchema = z.object({
    characters: z.array(z.string()),
    content: z.string()
});

export const RelationshipDevelopmentSchema = z.object({
    characters: z.array(z.string()),
    content: z.string()
});

export const EpisodeSchema = z.object({
    episodeNumber: z.number(),
    title: z.string(),
    synopsis: z.string().optional(),
    briefSummary: z.string().optional(),
    keyEvents: z.array(z.string()),
    endHook: z.string().optional(),
    hooks: z.string().optional(),
    emotionDevelopments: z.array(EmotionDevelopmentSchema).optional(),
    relationshipDevelopments: z.array(RelationshipDevelopmentSchema).optional(),
    stageArtifactId: z.string().optional(),
    episodeGenerationSessionId: z.string().optional()
});

export const EpisodeArraySchema = z.array(EpisodeSchema);

// ===============================
// Script Schemas
// ===============================

export const DialogueSchema = z.object({
    character: z.string(),
    line: z.string(),
    direction: z.string().optional()
});

export const SceneSchema = z.object({
    sceneNumber: z.number(),
    location: z.string(),
    timeOfDay: z.string(),
    characters: z.array(z.string()),
    action: z.string(),
    dialogue: z.array(DialogueSchema)
});

export const ScriptSchema = z.object({
    episodeNumber: z.number(),
    title: z.string(),
    scriptContent: z.string(),
    scenes: z.array(SceneSchema).optional(),
    wordCount: z.number().optional(),
    estimatedDuration: z.number().optional()
});

// ===============================
// Brainstorming/Ideas Schemas
// ===============================

export const IdeaSchema = z.object({
    title: z.string(),
    body: z.string(),
    artifactId: z.string().optional()
});

export const IdeaArraySchema = z.array(IdeaSchema);

// ===============================
// Export Types (Generated from Schemas)
// ===============================

export type Character = z.infer<typeof CharacterSchema>;
export type SynopsisStage = z.infer<typeof SynopsisStageSchema>;
export type Outline = z.infer<typeof OutlineSchema>;
export type EmotionDevelopment = z.infer<typeof EmotionDevelopmentSchema>;
export type RelationshipDevelopment = z.infer<typeof RelationshipDevelopmentSchema>;
export type Episode = z.infer<typeof EpisodeSchema>;
export type EpisodeArray = z.infer<typeof EpisodeArraySchema>;
export type Dialogue = z.infer<typeof DialogueSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Script = z.infer<typeof ScriptSchema>;
export type Idea = z.infer<typeof IdeaSchema>;
export type IdeaArray = z.infer<typeof IdeaArraySchema>;

// ===============================
// Template to Schema Mapping
// ===============================

export const TEMPLATE_SCHEMAS = {
    brainstorming: IdeaArraySchema,
    outline: OutlineSchema,
    episode_synopsis_generation: EpisodeArraySchema,
    script_generation: ScriptSchema
} as const;

export type TemplateSchemaMap = typeof TEMPLATE_SCHEMAS; 