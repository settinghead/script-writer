import { z } from 'zod';
import { CharacterSchema } from './streaming';
import { BaseToolInputSchema } from './common';
import { MIN_EPISODES, MAX_EPISODES } from '../config/constants';

// ===========================================
// 剧本设定 SCHEMAS
// ===========================================

// Outline Settings Schemas
export const OutlineSettingsInputSchema = BaseToolInputSchema.extend({
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
export const ChroniclesInputSchema = BaseToolInputSchema.extend({
    totalEpisodes: z.number().min(MIN_EPISODES).max(MAX_EPISODES).describe('总集数'),
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
export const EpisodePlanningInputSchema = BaseToolInputSchema.extend({
    numberOfEpisodes: z.number().min(MIN_EPISODES).max(MAX_EPISODES).describe('要规划的总集数'),
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

// Episode Planning Edit Schemas
export const EpisodePlanningEditInputSchema = BaseToolInputSchema.extend({
    editRequirements: z.string().min(1, '编辑要求不能为空').describe('具体的编辑要求，如：调整剧集分组、修改情感节拍、更新关键事件等')
});

export const EpisodePlanningEditToolResultSchema = z.object({
    outputJsondocId: z.string(),
    finishReason: z.string()
});

export type EpisodePlanningEditInput = z.infer<typeof EpisodePlanningEditInputSchema>;
export type EpisodePlanningEditToolResult = z.infer<typeof EpisodePlanningEditToolResultSchema>;

// Episode Synopsis Schemas
export const EpisodeSynopsisSchema = z.object({
    episodeNumber: z.number(),
    title: z.string(),
    openingHook: z.string().describe('开场钩子 - 前3秒抓住观众'),
    mainPlot: z.string().describe('主要剧情发展'),
    emotionalClimax: z.string().describe('情感高潮点'),
    cliffhanger: z.string().describe('结尾悬念'),
    suspenseElements: z.array(z.string()).describe('悬念元素'),
    estimatedDuration: z.number().describe('预估时长(秒)')
});

export const EpisodeSynopsisGroupSchema = z.object({
    groupTitle: z.string(),
    episodeRange: z.string(), // "1-3"
    episodes: z.array(EpisodeSynopsisSchema)
});

export const EpisodeSynopsisInputSchema = BaseToolInputSchema.extend({
    groupTitle: z.string(),
    episodeRange: z.string(),
    episodes: z.array(z.number()) // [1, 2, 3]
});

// Episode Synopsis Tool Result
export const EpisodeSynopsisToolResultSchema = z.object({
    outputJsondocId: z.string(),
    finishReason: z.string()
});

// Type exports
export type EpisodeSynopsisV1 = z.infer<typeof EpisodeSynopsisSchema>;
export type EpisodeSynopsisGroupV1 = z.infer<typeof EpisodeSynopsisGroupSchema>;
export type EpisodeSynopsisInputV1 = z.infer<typeof EpisodeSynopsisInputSchema>;
export type EpisodeSynopsisToolResult = z.infer<typeof EpisodeSynopsisToolResultSchema>; 