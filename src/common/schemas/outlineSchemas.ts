import { z } from 'zod';
import { CharacterSchema } from './streaming';
import { JsondocReferencesSchema } from './common';
import { MIN_EPISODES, MAX_EPISODES } from '../config/constants';

// ===========================================
// OUTLINE SETTINGS SCHEMAS
// ===========================================

// Outline Settings Schemas
export const OutlineSettingsInputSchema = z.object({
    jsondocs: JsondocReferencesSchema.describe('引用的jsondoc列表，包含故事创意等'),
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
    jsondocs: JsondocReferencesSchema.describe('引用的jsondoc列表，包含大纲设置等'),
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

// ===========================================
// EPISODE PLANNING SCHEMAS
// ===========================================

// Episode group schema for episode planning
export const EpisodeGroupSchema = z.object({
    groupTitle: z.string().min(1).describe('阶段标题'),
    episodes: z.string().min(1).describe('集数范围，如 "1-3"'),
    keyEvents: z.array(z.string()).describe('关键事件列表'),
    hooks: z.array(z.string()).describe('悬念钩子列表'),
    emotionalBeats: z.array(z.string()).describe('情感节拍')
});

// Episode Planning Schemas
export const EpisodePlanningInputSchema = z.object({
    jsondocs: JsondocReferencesSchema.describe('引用的jsondoc列表，包含时间顺序大纲等'),
    numberOfEpisodes: z.number().min(MIN_EPISODES).max(MAX_EPISODES).describe('总集数'),
    requirements: z.string().optional().describe('额外要求')
});

export const EpisodePlanningOutputSchema = z.object({
    totalEpisodes: z.number(),
    episodeGroups: z.array(EpisodeGroupSchema),
    overallStrategy: z.string().describe('整体策略说明')
});

export type EpisodeGroup = z.infer<typeof EpisodeGroupSchema>;
export type EpisodePlanningInput = z.infer<typeof EpisodePlanningInputSchema>;
export type EpisodePlanningOutput = z.infer<typeof EpisodePlanningOutputSchema>; 