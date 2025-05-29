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

        try {
            const cleaned = this.cleanContent(content);
            if (!cleaned.trim()) return [];

            // Try to parse complete JSON first
            const repaired = jsonrepair(cleaned);
            const parsed = JSON.parse(repaired);

            if (Array.isArray(parsed)) {
                const validItems = parsed.filter(item => this.validate(item));
                return validItems;
            }

            return [];
        } catch (error) {
            // If complete parsing fails, try to extract individual complete objects
            try {
                const cleaned = this.cleanContent(content);
                const items: IdeaWithTitle[] = [];

                // Find complete JSON objects within the content
                const objectRegex = /\{\s*"title"\s*:\s*"[^"]*"\s*,\s*"body"\s*:\s*"[^"]*"\s*\}/g;
                let match;

                while ((match = objectRegex.exec(cleaned)) !== null) {
                    try {
                        const item = JSON.parse(match[0]);
                        if (this.validate(item)) {
                            items.push(item);
                        }
                    } catch (itemError) {
                        // Skip invalid items
                    }
                }

                return items;
            } catch (fallbackError) {
                return [];
            }
        }
    }
} 