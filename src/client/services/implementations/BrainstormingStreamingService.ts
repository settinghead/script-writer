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
        console.log('[BrainstormingStreamingService] parsePartial called with content length:', content.length);
        console.log('[BrainstormingStreamingService] Content sample:', content.substring(0, 500));

        if (!content.trim()) return [];

        try {
            const cleaned = this.cleanContent(content);
            console.log('[BrainstormingStreamingService] Cleaned content length:', cleaned.length);
            console.log('[BrainstormingStreamingService] Cleaned sample:', cleaned.substring(0, 300));

            if (!cleaned.trim()) return [];

            // First try to parse as complete JSON
            try {
                const repaired = jsonrepair(cleaned);
                const parsed = JSON.parse(repaired);
                if (Array.isArray(parsed)) {
                    const validItems = parsed.filter(item => this.validate(item));
                    console.log('[BrainstormingStreamingService] Complete JSON parse successful:', validItems.length, 'items');
                    return validItems;
                }
            } catch (completeError) {
                console.log('[BrainstormingStreamingService] Complete JSON parse failed:', completeError.message);
                // Continue to partial parsing
            }

            // Handle streaming/partial JSON array - extract valid complete objects
            const items: IdeaWithTitle[] = [];

            // Try to extract items from partial JSON array
            // Look for complete {"title":"...","body":"..."} objects with proper escaping support
            const itemPattern = /\{\s*"title"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"body"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
            let match;

            while ((match = itemPattern.exec(cleaned)) !== null) {
                try {
                    const itemJson = match[0];
                    const item = JSON.parse(itemJson);
                    if (this.validate(item)) {
                        items.push(item);
                    }
                } catch (itemError) {
                    console.warn('[BrainstormingStreamingService] Failed to parse individual item:', itemError);
                }
            }

            console.log('[BrainstormingStreamingService] Regex extraction found:', items.length, 'items');

            // If no items found with strict pattern, try jsonrepair on partial content
            if (items.length === 0) {
                console.log('[BrainstormingStreamingService] Attempting jsonrepair on partial content');
                try {
                    // Attempt to repair incomplete JSON array
                    let partialContent = cleaned;

                    // If content looks like it's starting an array but incomplete
                    if (partialContent.startsWith('[') && !partialContent.endsWith(']')) {
                        // Add closing bracket to make it valid
                        partialContent = partialContent + ']';
                    }

                    // If content has incomplete objects, try to clean them up
                    if (partialContent.includes('{') && !partialContent.endsWith('}')) {
                        // Find the last complete object
                        const lastCompleteObject = partialContent.lastIndexOf('}');
                        if (lastCompleteObject > 0) {
                            // Truncate to last complete object and add array closing
                            partialContent = partialContent.substring(0, lastCompleteObject + 1);
                            if (partialContent.startsWith('[') && !partialContent.endsWith(']')) {
                                partialContent = partialContent + ']';
                            }
                        }
                    }

                    console.log('[BrainstormingStreamingService] Attempting to repair:', partialContent.substring(0, 200));
                    const repairedPartial = jsonrepair(partialContent);
                    const parsedPartial = JSON.parse(repairedPartial);
                    if (Array.isArray(parsedPartial)) {
                        const validPartialItems = parsedPartial.filter(item => this.validate(item));
                        console.log('[BrainstormingStreamingService] Partial repair successful:', validPartialItems.length, 'items');
                        return validPartialItems;
                    }
                } catch (partialError) {
                    console.log('[BrainstormingStreamingService] Partial repair failed:', partialError.message);
                    // Continue to fallback
                }
            }

            console.log('[BrainstormingStreamingService] Returning final items:', items.length);
            return items;

        } catch (error) {
            console.warn('[BrainstormingStreamingService] Failed to parse partial content:', error);
            return [];
        }
    }
} 