import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { StoryIdea, EvaluationResult, EvaluationResultSchema, EVALUATION_WEIGHTS } from './ax-brainstorm-types';
import { getLLMCredentials } from '../services/LLMConfig';

// Simplified evaluation system using Vercel AI SDK generateObject
export class StoryEvaluationSystem {

    constructor() {
        // Simple constructor
    }

    // Create comprehensive evaluation prompt for all aspects in one go
    private createEvaluationPrompt(
        idea: StoryIdea,
        genre: string,
        platform: string
    ): string {
        return `请全面评估以下故事创意：

故事信息：
- 题材：${genre}
- 平台：${platform}
- 标题：${idea.title}
- 梗概：${idea.body}

请从以下7个维度评分（每项1-10分）：

1. 新颖性 (novelty_score): 创意是否新颖独特，是否避免了俗套剧情，是否有吸引人的新元素
2. 可行性 (feasibility_score): 制作成本是否合理，拍摄难度是否适中，是否适合目标平台
3. 结构明晰度 (structure_score): 故事结构是否清晰，起承转合是否完整，逻辑脉络是否合理
4. 详细程度 (detail_score): 信息是否充分，描述是否具体，细节是否丰富
5. 逻辑连贯性 (logical_coherence_score): 情节发展是否合理，前后逻辑是否一致，因果关系是否清晰
6. 题材一致性 (genre_score): 是否符合目标题材特点，是否体现题材核心元素，是否满足题材受众期待
7. 吸引力 (engagement_score): 是否能吸引目标受众，是否有观看欲望，是否适合平台特点

请提供客观公正的评分，并在feedback中给出综合评价和具体的改进建议。`;
    }

    async evaluateStoryIdea(
        idea: StoryIdea,
        genre: string,
        platform: string
    ): Promise<EvaluationResult> {
        try {
            console.log(`   Evaluating story ${idea.title} with generateObject...`);

            // Get model configuration
            const { apiKey, baseUrl, modelName } = getLLMCredentials();
            const llmAI = createOpenAI({
                apiKey,
                baseURL: baseUrl,
            });

            // Create comprehensive evaluation prompt
            const prompt = this.createEvaluationPrompt(idea, genre, platform);

            // Generate structured evaluation using generateObject
            const result = await generateObject({
                model: llmAI(modelName),
                schema: EvaluationResultSchema.omit({ overall_score: true }), // We'll calculate this ourselves
                system: '你是一个专业的故事创意评估专家，善于分析剧本创意的各个维度。请严格按照要求的格式返回评估结果。',
                prompt,
                temperature: 0.3, // Lower temperature for consistent evaluation
                maxTokens: 2000,
            });

            // Calculate overall score using weights
            const overallScore =
                (result.object.novelty_score * EVALUATION_WEIGHTS.novelty) +
                (result.object.feasibility_score * EVALUATION_WEIGHTS.feasibility) +
                (result.object.structure_score * EVALUATION_WEIGHTS.structure) +
                (result.object.detail_score * EVALUATION_WEIGHTS.detail) +
                (result.object.logical_coherence_score * EVALUATION_WEIGHTS.logical_coherence) +
                (result.object.genre_score * EVALUATION_WEIGHTS.genre) +
                (result.object.engagement_score * EVALUATION_WEIGHTS.engagement);

            return {
                ...result.object,
                overall_score: overallScore,
            };
        } catch (error) {
            console.error('Evaluation failed:', error);
            throw new Error(`Story evaluation failed: ${error}`);
        }
    }

    // Evaluate multiple ideas
    async evaluateMultipleIdeas(
        ideas: StoryIdea[],
        genre: string,
        platform: string
    ): Promise<EvaluationResult[]> {
        const results: EvaluationResult[] = [];

        for (const idea of ideas) {
            try {
                const result = await this.evaluateStoryIdea(idea, genre, platform);
                results.push(result);
            } catch (error) {
                console.warn(`Failed to evaluate idea "${idea.title}":`, error);
            }
        }

        return results;
    }
}

// Factory function
export function createEvaluationSystem(): StoryEvaluationSystem {
    return new StoryEvaluationSystem();
} 