import { AxChainOfThought, AxAI, s, f } from '@ax-llm/ax';
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

// Brainstorm program using simplified approach
export class BrainstormProgram {
    private prompt: string;

    constructor() {
        this.prompt = brainstormSignature;
    }

    // Generate a single story idea using direct AI call
    async generateIdea(
        ai: AxAI,
        request: BrainstormRequest
    ): Promise<StoryIdea> {
        try {
            // Create the complete prompt
            const fullPrompt = this.prompt
                .replace('{{genre}}', request.genre)
                .replace('{{platform}}', request.platform)
                .replace('{{requirements_section}}', request.requirements_section || '无特殊要求');

            // Call AI directly using proper ax API
            const response = await ai.chat({
                chatPrompt: [
                    { role: 'user', content: fullPrompt }
                ]
            });

            const content = response.message?.content || '';

            // Parse the response to extract title and body
            const titleMatch = content.match(/Title:\s*(.+)/i);
            const bodyMatch = content.match(/Body:\s*(.+)/is);

            const title = titleMatch?.[1]?.trim() || '未知标题';
            const body = bodyMatch?.[1]?.trim() || '暂无梗概';

            return { title, body };

        } catch (error) {
            console.error('Failed to generate story idea:', error);
            throw error;
        }
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
                const idea = await this.generateIdea(ai, request);
                ideas.push(idea);
            } catch (error) {
                console.warn(`Failed to generate idea ${i + 1}:`, error);
            }
        }

        return ideas;
    }

    // Streaming version for real-time generation (simplified)
    async* streamingGenerateIdea(
        ai: AxAI,
        request: BrainstormRequest
    ): AsyncGenerator<Partial<StoryIdea>, StoryIdea, unknown> {
        // For now, just return the regular generation
        // Full streaming would need proper parsing of streaming response
        const idea = await this.generateIdea(ai, request);

        // Yield partial updates
        yield { title: idea.title };
        yield { body: idea.body };

        return idea;
    }
}

// Factory function to create the brainstorm program
export function createBrainstormProgram(): BrainstormProgram {
    return new BrainstormProgram();
} 