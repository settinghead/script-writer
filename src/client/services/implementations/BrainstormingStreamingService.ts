import { jsonrepair } from 'jsonrepair';
import { LLMStreamingService } from '../streaming/LLMStreamingService';

export interface IdeaWithTitle {
    title: string;
    body: string;
}

export class BrainstormingStreamingService extends LLMStreamingService<IdeaWithTitle> {
    validate(item: any): item is IdeaWithTitle {
        return (
            typeof item === 'object' &&
            typeof item.title === 'string' &&
            typeof item.body === 'string' &&
            item.title.trim() !== '' &&
            item.body.trim() !== ''
        );
    }

    // NEW: Convert artifact data to IdeaWithTitle format
    protected convertArtifactToItem(artifactData: any): IdeaWithTitle | null {
        try {
            // Handle brainstorm_idea artifact format
            if (artifactData.idea_text) {
                return {
                    title: artifactData.idea_title || '无标题',
                    body: artifactData.idea_text
                };
            }

            // Handle direct format
            if (artifactData.title && artifactData.body) {
                return {
                    title: artifactData.title,
                    body: artifactData.body
                };
            }

            return null;
        } catch (error) {
            console.warn('Failed to convert artifact to idea:', artifactData, error);
            return null;
        }
    }

    cleanContent(content: string): string {
        let cleaned = content.trim();
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        return cleaned;
    }

    parsePartial(content: string): IdeaWithTitle[] {
        if (!content.trim()) return [];

        const cleaned = this.cleanContent(content);
        if (!cleaned.trim()) return [];

        // Simple approach: try to parse with jsonrepair
        try {
            const repaired = jsonrepair(cleaned);
            const parsed = JSON.parse(repaired);

            if (Array.isArray(parsed)) {
                const validItems = parsed.filter(item => this.validate(item));
                console.log(`[BrainstormingStreamingService] Parsed ${validItems.length} valid items`);
                return validItems;
            }
        } catch (error) {
            // If full parse fails, accumulate until we get valid JSON
            console.log('[BrainstormingStreamingService] Partial content, waiting for more data');
        }

        return [];
    }
} 