import { AxAI, AxChainOfThought } from '@ax-llm/ax';
import { StoryIdea, BrainstormRequest } from './ax-brainstorm-types';

// Create signature using template literals (similar to DSPy signature)
export const brainstormSignature = `
Generate a creative story idea based on the given genre, platform, and requirements.

Given:
- Genre: {{genre}} (故事类型/题材)
- Platform: {{platform}} (目标平台)
- Requirements: {{requirements_section}} (额外要求)

Generate:
- Title: A creative title for the story (3-7 characters)
- Body: A complete story synopsis (within 180 characters, including beginning, development, climax, and ending)

Output the title and body in the following format:
Title: [story title]
Body: [story synopsis]
`;

// Brainstorm program extending AxChainOfThought for optimization compatibility
export class BrainstormProgram extends AxChainOfThought<BrainstormRequest, StoryIdea> {

    constructor() {
        // Initialize with improved signature for creative story generation
        super(
            `genre:string "Story genre like 甜宠, 虐恋, etc", platform:string "Platform like 抖音, 快手, etc", requirements_section:string "Specific requirements" -> title:string "Creative story title (3-7 Chinese characters)", body:string "Story synopsis describing plot, characters and conflict (50-180 characters)"`
        );

        // TODO: Add demos once we understand the correct format for ax library
    }

    // Override forward method for custom generation logic
    async forward(
        ai: AxAI,
        input: BrainstormRequest
    ): Promise<StoryIdea> {
        try {
            // Call the parent forward method which handles the prompt generation
            const result = await super.forward(ai, {
                genre: input.genre,
                platform: input.platform,
                requirements_section: input.requirements_section || '无特殊要求'
            });

            // Ensure we return a proper StoryIdea object with validation
            const title = result.title?.trim() || '未知标题';
            const body = result.body?.trim() || '暂无梗概';

            return {
                title: title.length > 10 ? title.substring(0, 10) : title,
                body: body.length > 200 ? body.substring(0, 200) + '...' : body
            };

        } catch (error) {
            console.error('Failed to generate story idea:', error);
            // Return fallback idea
            return {
                title: '故事标题',
                body: '故事梗概生成失败，请重试'
            };
        }
    }

    // Generate a single story idea (alias for forward method)
    async generateIdea(
        ai: AxAI,
        request: BrainstormRequest
    ): Promise<StoryIdea> {
        return this.forward(ai, request);
    }

    // Generate multiple ideas (for compatibility with Python version)
    async generateIdeas(
        ai: AxAI,
        request: BrainstormRequest,
        count: number = 2
    ): Promise<StoryIdea[]> {
        const ideas: StoryIdea[] = [];

        for (let i = 0; i < count; i++) {
            try {
                const idea = await this.forward(ai, request);
                ideas.push(idea);
            } catch (error) {
                console.warn(`Failed to generate idea ${i + 1}:`, error);
            }
        }

        return ideas;
    }

    // Streaming version for real-time generation
    async* streamingGenerateIdea(
        ai: AxAI,
        request: BrainstormRequest
    ): AsyncGenerator<Partial<StoryIdea>, StoryIdea, unknown> {
        try {
            // Use streamingForward from parent class if available
            if (typeof this.streamingForward === 'function') {
                const generator = this.streamingForward(ai, {
                    genre: request.genre,
                    platform: request.platform,
                    requirements_section: request.requirements_section || '无特殊要求'
                });

                let finalResult: StoryIdea = { title: '', body: '' };

                for await (const partial of generator) {
                    // Handle delta structure from streaming
                    if (partial.delta && partial.delta.title) {
                        finalResult.title = partial.delta.title;
                        yield { title: partial.delta.title };
                    }
                    if (partial.delta && partial.delta.body) {
                        finalResult.body = partial.delta.body;
                        yield { body: partial.delta.body };
                    }
                }

                return finalResult;
            } else {
                // Fallback to regular generation
                const idea = await this.forward(ai, request);
                yield { title: idea.title };
                yield { body: idea.body };
                return idea;
            }
        } catch (error) {
            console.error('Streaming generation failed:', error);
            const fallback = await this.forward(ai, request);
            yield { title: fallback.title };
            yield { body: fallback.body };
            return fallback;
        }
    }
}

// Factory function to create the brainstorm program
export function createBrainstormProgram(): BrainstormProgram {
    return new BrainstormProgram();
} 