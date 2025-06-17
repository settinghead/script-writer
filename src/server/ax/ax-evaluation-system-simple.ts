import { AxAI } from '@ax-llm/ax';
import { StoryIdea, EvaluationResult, EVALUATION_WEIGHTS } from './ax-brainstorm-types';

// Simplified evaluation system using direct AI calls
export class StoryEvaluationSystem {

    constructor() {
        // Simple constructor
    }

    // Create evaluation prompt for a specific aspect
    private createEvaluationPrompt(
        aspect: string,
        idea: StoryIdea,
        genre: string,
        platform: string
    ): string {
        const aspectPrompts = {
            novelty: `评估以下故事创意的新颖性（1-10分）：
题材：${genre}
平台：${platform}
标题：${idea.title}
梗概：${idea.body}

请从以下角度评分：
- 创意是否新颖独特
- 是否避免了俗套剧情
- 是否有吸引人的新元素

请只返回分数（1-10）和简短评价，格式：
分数: X
评价: [简短评价]`,

            feasibility: `评估以下故事创意的拍摄可行性（1-10分）：
题材：${genre}
平台：${platform}
标题：${idea.title}
梗概：${idea.body}

请从以下角度评分：
- 制作成本是否合理
- 拍摄难度是否适中
- 是否适合目标平台

请只返回分数（1-10）和简短评价，格式：
分数: X
评价: [简短评价]`,

            structure: `评估以下故事创意的结构明晰度（1-10分）：
标题：${idea.title}
梗概：${idea.body}

请从以下角度评分：
- 故事结构是否清晰
- 起承转合是否完整
- 逻辑脉络是否合理

请只返回分数（1-10）和简短评价，格式：
分数: X
评价: [简短评价]`,

            detail: `评估以下故事梗概的详细程度（1-10分）：
梗概：${idea.body}

请从以下角度评分：
- 信息是否充分
- 描述是否具体
- 细节是否丰富

请只返回分数（1-10）和简短评价，格式：
分数: X
评价: [简短评价]`,

            logical_coherence: `评估以下故事创意的逻辑连贯性（1-10分）：
标题：${idea.title}
梗概：${idea.body}

请从以下角度评分：
- 情节发展是否合理
- 前后逻辑是否一致
- 因果关系是否清晰

请只返回分数（1-10）和简短评价，格式：
分数: X
评价: [简短评价]`,

            genre: `评估以下故事创意的题材一致性（1-10分）：
目标题材：${genre}
标题：${idea.title}
梗概：${idea.body}

请从以下角度评分：
- 是否符合目标题材特点
- 是否体现题材核心元素
- 是否满足题材受众期待

请只返回分数（1-10）和简短评价，格式：
分数: X
评价: [简短评价]`,

            engagement: `评估以下故事创意的吸引力（1-10分）：
题材：${genre}
平台：${platform}
标题：${idea.title}
梗概：${idea.body}

请从以下角度评分：
- 是否能吸引目标受众
- 是否有观看欲望
- 是否适合平台特点

请只返回分数（1-10）和简短评价，格式：
分数: X
评价: [简短评价]`
        };

        return aspectPrompts[aspect as keyof typeof aspectPrompts] || '';
    }

    // Parse evaluation response
    private parseEvaluationResponse(response: string): { score: number; feedback: string } {
        const scoreMatch = response.match(/分数:\s*(\d+)/);
        const feedbackMatch = response.match(/评价:\s*(.+)/s);

        const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;
        const feedback = feedbackMatch ? feedbackMatch[1].trim() : '评估失败';

        return {
            score: Math.max(1, Math.min(10, score)), // Ensure score is between 1-10
            feedback
        };
    }

    // Evaluate a single aspect
    private async evaluateAspect(
        ai: AxAI,
        aspect: string,
        idea: StoryIdea,
        genre: string,
        platform: string
    ): Promise<{ score: number; feedback: string }> {
        try {
            const prompt = this.createEvaluationPrompt(aspect, idea, genre, platform);

            const response = await ai.chat({
                chatPrompt: [{ role: 'user', content: prompt }]
            });

            // Handle the response properly - need to check if it's streaming or not
            let content = '';
            if ('message' in response) {
                content = response.message?.content || '';
            } else {
                // Handle streaming response if needed
                content = 'Streaming response not implemented';
            }

            return this.parseEvaluationResponse(content);

        } catch (error) {
            console.warn(`Failed to evaluate ${aspect}:`, error);
            return { score: 5, feedback: `${aspect}评估失败` };
        }
    }

    async evaluateStoryIdea(
        ai: AxAI,
        idea: StoryIdea,
        genre: string,
        platform: string
    ): Promise<EvaluationResult> {
        try {
            // Run all evaluations in parallel for efficiency
            const aspects = ['novelty', 'feasibility', 'structure', 'detail', 'logical_coherence', 'genre', 'engagement'];

            const results = await Promise.all(
                aspects.map(aspect => this.evaluateAspect(ai, aspect, idea, genre, platform))
            );

            // Map results to evaluation result
            const [
                noveltyResult,
                feasibilityResult,
                structureResult,
                detailResult,
                logicalCoherenceResult,
                genreResult,
                engagementResult,
            ] = results;

            // Calculate overall score using weights
            const overallScore =
                (noveltyResult.score * EVALUATION_WEIGHTS.novelty) +
                (feasibilityResult.score * EVALUATION_WEIGHTS.feasibility) +
                (structureResult.score * EVALUATION_WEIGHTS.structure) +
                (detailResult.score * EVALUATION_WEIGHTS.detail) +
                (logicalCoherenceResult.score * EVALUATION_WEIGHTS.logical_coherence) +
                (genreResult.score * EVALUATION_WEIGHTS.genre) +
                (engagementResult.score * EVALUATION_WEIGHTS.engagement);

            // Combine feedback
            const combinedFeedback = [
                `新颖性: ${noveltyResult.feedback}`,
                `可行性: ${feasibilityResult.feedback}`,
                `结构: ${structureResult.feedback}`,
                `详细程度: ${detailResult.feedback}`,
                `逻辑连贯性: ${logicalCoherenceResult.feedback}`,
                `题材一致性: ${genreResult.feedback}`,
                `吸引力: ${engagementResult.feedback}`,
            ].join('\n\n');

            return {
                novelty_score: noveltyResult.score,
                feasibility_score: feasibilityResult.score,
                structure_score: structureResult.score,
                detail_score: detailResult.score,
                logical_coherence_score: logicalCoherenceResult.score,
                genre_score: genreResult.score,
                engagement_score: engagementResult.score,
                overall_score: overallScore,
                feedback: combinedFeedback,
            };
        } catch (error) {
            console.error('Evaluation failed:', error);
            throw new Error(`Story evaluation failed: ${error}`);
        }
    }

    // Evaluate multiple ideas
    async evaluateMultipleIdeas(
        ai: AxAI,
        ideas: StoryIdea[],
        genre: string,
        platform: string
    ): Promise<EvaluationResult[]> {
        const results: EvaluationResult[] = [];

        for (const idea of ideas) {
            try {
                const result = await this.evaluateStoryIdea(ai, idea, genre, platform);
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