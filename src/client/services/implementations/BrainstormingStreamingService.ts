import { jsonrepair } from 'jsonrepair';
import { LLMStreamingService } from '../streaming/LLMStreamingService';

export interface IdeaWithTitle {
    title: string;
    body: string;
    artifactId?: string; // Add artifact ID to track real database IDs
}

export class BrainstormingStreamingService extends LLMStreamingService<IdeaWithTitle> {
    private artifactIdMap = new Map<string, string>(); // Map idea text to artifact ID

    validate(item: any): item is IdeaWithTitle {
        return typeof item === 'object' &&
            typeof item.title === 'string' &&
            typeof item.body === 'string';
    }

    parsePartial(content: string): IdeaWithTitle[] {
        if (!content.trim()) return [];

        try {
            // Clean the content first
            const cleaned = this.cleanContent(content);

            const parsed = JSON.parse(cleaned);

            if (Array.isArray(parsed)) {
                const ideas = parsed.map(item => ({
                    title: item.title || '无标题',
                    body: item.body || item.text || String(item)
                }));
                return ideas;
            }

            return [];
        } catch (error) {
            // Try to extract valid JSON objects using regex
            return this.extractValidObjects(content);
        }
    }

    private extractValidObjects(content: string): IdeaWithTitle[] {
        const items: IdeaWithTitle[] = [];

        // Match complete JSON objects in the content
        const jsonPattern = /\{[^{}]*"title"\s*:\s*"[^"]*"[^{}]*"body"\s*:\s*"[^"]*"[^{}]*\}/g;
        const matches = content.match(jsonPattern);

        if (matches) {
            for (const match of matches) {
                try {
                    const parsed = JSON.parse(match);
                    if (this.validate(parsed)) {
                        items.push(parsed);
                    }
                } catch (e) {
                    // Skip invalid JSON
                }
            }
        }

        return items;
    }

    cleanContent(content: string): string {
        return content
            .replace(/^```json\s*/m, '')
            .replace(/\s*```$/m, '')
            .trim();
    }

    // Override to handle completed transforms and extract artifact IDs
    async connectToTransform(transformId: string): Promise<void> {
        // First, establish the SSE connection through the parent class
        // This ensures we don't miss any streaming data
        await super.connectToTransform(transformId);

        // The parent class will handle:
        // 1. Setting up the EventSource connection
        // 2. Parsing streaming chunks
        // 3. Emitting content through the observables
        // 4. Handling completion events

        // Note: We can't fetch completed results here because it would interfere
        // with the SSE connection. The artifact IDs will be available after
        // the transform completes through the transform outputs.
    }

    // Fetch real artifact IDs after streaming completes
    async fetchArtifactIds(transformId: string): Promise<Map<string, string>> {
        const idMap = new Map<string, string>();

        try {
            const response = await fetch(`/api/streaming/transform/${transformId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'completed' && data.results) {
                    // Extract artifact IDs from completed results
                    for (const result of data.results) {
                        if (result.artifact && result.artifact.data && result.artifact.type === 'brainstorm_idea') {
                            const artifactData = result.artifact.data;
                            const ideaText = artifactData.idea_text || '';
                            const artifactId = result.artifact.id;

                            if (ideaText && artifactId) {
                                idMap.set(ideaText, artifactId);
                                this.artifactIdMap.set(ideaText, artifactId);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to fetch artifact IDs:', error);
        }

        return idMap;
    }

    // Parse completed transform results to extract artifact IDs
    private parseCompletedResults(results: any[]): IdeaWithTitle[] {
        const items: IdeaWithTitle[] = [];

        for (const result of results) {
            try {
                if (result.artifact && result.artifact.data && result.artifact.type === 'brainstorm_idea') {
                    const artifactData = result.artifact.data;
                    const idea: IdeaWithTitle = {
                        title: artifactData.idea_title || '无标题',
                        body: artifactData.idea_text || '',
                        artifactId: result.artifact.id // Use the real artifact ID
                    };

                    if (this.validate(idea)) {
                        // Store the mapping for future reference
                        this.artifactIdMap.set(idea.body, result.artifact.id);
                        items.push(idea);
                    }
                }
            } catch (error) {
                console.warn('Failed to parse completed result:', result, error);
            }
        }

        // Sort by order_index if available
        items.sort((a, b) => {
            const aOrderIndex = results.find(r => r.artifact?.id === a.artifactId)?.artifact?.data?.order_index || 0;
            const bOrderIndex = results.find(r => r.artifact?.id === b.artifactId)?.artifact?.data?.order_index || 0;
            return aOrderIndex - bOrderIndex;
        });

        return items;
    }

    // Get artifact ID for a given idea text
    getArtifactId(ideaText: string): string | undefined {
        return this.artifactIdMap.get(ideaText);
    }

    // NEW: Convert artifact data to IdeaWithTitle format
    protected convertArtifactToItem(artifactData: any): IdeaWithTitle | null {
        try {
            // Handle brainstorm_idea artifact format
            if (artifactData.idea_text) {
                return {
                    title: artifactData.idea_title || '无标题',
                    body: artifactData.idea_text,
                    artifactId: artifactData.id // Include artifact ID if available
                };
            }

            // Handle direct format
            if (artifactData.title && artifactData.body) {
                return {
                    title: artifactData.title,
                    body: artifactData.body,
                    artifactId: artifactData.id
                };
            }

            return null;
        } catch (error) {
            console.warn('Failed to convert artifact to idea:', artifactData, error);
            return null;
        }
    }
} 