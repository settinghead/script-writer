import { z } from 'zod';

// Configuration constants
export const MAX_TOKENS_GENERATION = 3000;
export const MAX_TOKENS_EVALUATION = 2000;

// Data structures following ax patterns
export const StoryIdeaSchema = z.object({
    title: z.string().describe('故事创意的标题（3-7个字符）'),
    body: z.string().describe('完整的故事梗概（180字以内，包含起承转合结构）'),
});

export const BrainstormRequestSchema = z.object({
    genre: z.string().describe('故事类型/题材'),
    platform: z.string().describe('目标平台'),
    requirements_section: z.string().default('').describe('额外要求'),
});

export const EvaluationResultSchema = z.object({
    novelty_score: z.number().min(0).max(10).describe('新颖性评分(1-10分)'),
    feasibility_score: z.number().min(0).max(10).describe('拍摄可行性评分(1-10分)'),
    structure_score: z.number().min(0).max(10).describe('结构明晰度评分(1-10分)'),
    detail_score: z.number().min(0).max(10).describe('详细程度评分(1-10分)'),
    logical_coherence_score: z.number().min(0).max(10).describe('逻辑连贯性评分(1-10分)'),
    genre_score: z.number().min(0).max(10).describe('题材一致性评分(1-10分)'),
    engagement_score: z.number().min(0).max(10).describe('吸引力评分(1-10分)'),
    overall_score: z.number().min(0).max(10).describe('综合评分'),
    feedback: z.string().describe('评估反馈'),
});

export type StoryIdea = z.infer<typeof StoryIdeaSchema>;
export type BrainstormRequest = z.infer<typeof BrainstormRequestSchema>;
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

// Training example type for ax optimization
export interface TrainingExample {
    genre: string;
    platform: string;
    requirements_section: string;
    expected_ideas?: StoryIdea[];
}

// Evaluation weights for scoring
export const EVALUATION_WEIGHTS = {
    novelty: 0.18,
    feasibility: 0.12,
    structure: 0.08,
    detail: 0.18,
    logical_coherence: 0.16,
    genre: 0.10,
    engagement: 0.18,
} as const;

// Platform mapping for different genres (from Python code)
export const PLATFORM_MAPPING: Record<string, string> = {
    "甜宠": "抖音",
    "虐恋": "小红书",
    "复仇": "快手",
    "穿越": "抖音",
    "重生": "小红书",
    "马甲": "快手",
    "霸总": "抖音",
    "战神": "快手",
    "神豪": "抖音",
    "赘婿": "小红书",
    "玄幻": "快手",
    "末世": "抖音",
    "娱乐圈": "小红书",
    "萌宝": "抖音",
    "团宠": "快手"
};

// Golden examples structure
export interface GoldenExample {
    genre_path: string[];
    tags: string[];
    content: string;
} 