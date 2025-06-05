import { LLMStreamingService } from '../streaming/LLMStreamingService';
import type { EpisodeScriptV1 } from '../../../common/streaming/types';

// Interface for script structure during streaming
export interface StreamingScript {
    episodeNumber: number;
    title: string;
    scriptContent: string;
    wordCount?: number;
    estimatedDuration?: number;
    scenes?: Array<{
        sceneNumber: number;
        location: string;
        timeOfDay: string;
        description: string;
        dialogue: Array<{
            character: string;
            line: string;
        }>;
    }>;
    characterList?: string[];
    generatedAt?: string;
}

export class ScriptStreamingService extends LLMStreamingService<StreamingScript> {
    validate(item: any): item is StreamingScript {
        return typeof item === 'object' &&
            item !== null &&
            typeof item.episodeNumber === 'number' &&
            typeof item.title === 'string' &&
            typeof item.scriptContent === 'string';
    }

    parsePartial(content: string): StreamingScript[] {
        return this.parseWithCommonFlow(content, 'ScriptStreamingService');
    }

    protected normalizeItem(data: any): StreamingScript | null {
        try {
            return this.normalizeScript(data);
        } catch (error) {
            console.warn('Failed to normalize script:', data, error);
            return null;
        }
    }

    protected extractPartialItems(content: string): StreamingScript[] {
        // Try to extract partial script data
        const partialScript = this.extractPartialScript(content);
        return partialScript ? [partialScript] : [];
    }

    private normalizeScript(data: any): StreamingScript {
        return {
            episodeNumber: Number(data.episodeNumber) || 1,
            title: String(data.title || ''),
            scriptContent: String(data.scriptContent || data.content || ''),
            wordCount: data.wordCount ? Number(data.wordCount) : undefined,
            estimatedDuration: data.estimatedDuration ? Number(data.estimatedDuration) : undefined,
            scenes: Array.isArray(data.scenes) ? data.scenes.map((scene: any) => ({
                sceneNumber: Number(scene.sceneNumber) || 0,
                location: String(scene.location || ''),
                timeOfDay: String(scene.timeOfDay || ''),
                description: String(scene.description || ''),
                dialogue: Array.isArray(scene.dialogue) ? scene.dialogue.map((line: any) => ({
                    character: String(line.character || ''),
                    line: String(line.line || '')
                })) : []
            })) : undefined,
            characterList: Array.isArray(data.characterList) 
                ? data.characterList.map((char: any) => String(char))
                : undefined,
            generatedAt: data.generatedAt ? String(data.generatedAt) : new Date().toISOString()
        };
    }

    private extractPartialScript(content: string): StreamingScript | null {
        try {
            // Try to extract basic fields manually
            const episodeNumberMatch = content.match(/"episodeNumber"\s*:\s*(\d+)/);
            const titleMatch = content.match(/"title"\s*:\s*"([^"]*)"/);
            const scriptContentMatch = content.match(/"scriptContent"\s*:\s*"((?:[^"\\]|\\.)*)"/s) ||
                                      content.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/s);

            if (!episodeNumberMatch || !titleMatch) {
                console.log('[ScriptStreamingService] Could not extract basic fields');
                return null;
            }

            const script: StreamingScript = {
                episodeNumber: parseInt(episodeNumberMatch[1]),
                title: titleMatch[1],
                scriptContent: scriptContentMatch ? scriptContentMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : ''
            };

            // Extract optional fields
            const wordCountMatch = content.match(/"wordCount"\s*:\s*(\d+)/);
            if (wordCountMatch) {
                script.wordCount = parseInt(wordCountMatch[1]);
            }

            const durationMatch = content.match(/"estimatedDuration"\s*:\s*(\d+)/);
            if (durationMatch) {
                script.estimatedDuration = parseInt(durationMatch[1]);
            }

            console.log('[ScriptStreamingService] Extracted partial script:', {
                episodeNumber: script.episodeNumber,
                title: script.title,
                contentLength: script.scriptContent.length,
                contentPreview: script.scriptContent.substring(0, 50)
            });

            return script;
        } catch (error) {
            console.log('[ScriptStreamingService] Error extracting partial script:', error);
            return null;
        }
    }

    protected convertArtifactToItem(artifactData: any): StreamingScript | null {
        // Convert EpisodeScriptV1 artifact to StreamingScript format
        if (artifactData && typeof artifactData === 'object') {
            return this.normalizeScript(artifactData);
        }
        return null;
    }
} 
 
 