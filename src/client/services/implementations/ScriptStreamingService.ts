import { LLMStreamingService } from '../streaming/LLMStreamingService';
import { jsonrepair } from 'jsonrepair';
import { cleanLLMContent, extractJSONFromContent } from '../../../common/utils/textCleaning';
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
        if (!content.trim()) return [];

        console.log('[ScriptStreamingService] Original content length:', content.length);
        console.log('[ScriptStreamingService] Original content preview:',
            content.substring(0, 200) + (content.length > 200 ? '...' : ''));

        // Clean the content first
        const cleanedContent = this.cleanContent(content);
        console.log('[ScriptStreamingService] After cleaning, length:', cleanedContent.length);

        // Try to find the script object - could be direct object or array with one script
        let processableContent = cleanedContent;

        // Look for script object or array start
        const objectStart = processableContent.indexOf('{');
        const arrayStart = processableContent.indexOf('[');
        
        if (arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart)) {
            // Array format
            processableContent = processableContent.substring(arrayStart);
            console.log('[ScriptStreamingService] Found array start, processing from position:', arrayStart);
        } else if (objectStart >= 0) {
            // Direct object format
            processableContent = processableContent.substring(objectStart);
            console.log('[ScriptStreamingService] Found object start, processing from position:', objectStart);
        } else {
            console.log('[ScriptStreamingService] No valid JSON start found, content:', processableContent);
            return [];
        }

        // Try to parse as complete JSON first
        try {
            const extractedJSON = this.extractJSON(processableContent);
            console.log('[ScriptStreamingService] Extracted JSON length:', extractedJSON.length);
            const parsed = JSON.parse(extractedJSON);
            
            if (Array.isArray(parsed)) {
                console.log('[ScriptStreamingService] Successfully parsed array with', parsed.length, 'scripts');
                const scripts = parsed
                    .map(script => this.normalizeScript(script))
                    .filter(script => this.validate(script));
                console.log('[ScriptStreamingService] Returning', scripts.length, 'valid scripts');
                return scripts;
            } else if (typeof parsed === 'object') {
                console.log('[ScriptStreamingService] Successfully parsed single script object');
                const script = this.normalizeScript(parsed);
                if (this.validate(script)) {
                    return [script];
                }
            }
        } catch (error) {
            console.log('[ScriptStreamingService] Failed to parse complete JSON:', error.message);
        }

        // Try jsonrepair for incomplete JSON
        try {
            const repaired = jsonrepair(processableContent);
            console.log('[ScriptStreamingService] JSON repair attempted, length:', repaired.length);
            const parsed = JSON.parse(repaired);
            
            if (Array.isArray(parsed)) {
                console.log('[ScriptStreamingService] Successfully parsed repaired array with', parsed.length, 'scripts');
                const scripts = parsed
                    .map(script => this.normalizeScript(script))
                    .filter(script => this.validate(script));
                console.log('[ScriptStreamingService] Returning', scripts.length, 'valid scripts from repair');
                return scripts;
            } else if (typeof parsed === 'object') {
                console.log('[ScriptStreamingService] Successfully parsed repaired script object');
                const script = this.normalizeScript(parsed);
                if (this.validate(script)) {
                    return [script];
                }
            }
        } catch (repairError) {
            console.log('[ScriptStreamingService] JSON repair failed:', repairError.message);
        }

        // Try to extract partial script data
        console.log('[ScriptStreamingService] Falling back to partial script extraction');
        const partialScript = this.extractPartialScript(processableContent);
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
                contentLength: script.scriptContent.length
            });

            return script;
        } catch (error) {
            console.log('[ScriptStreamingService] Error extracting partial script:', error);
            return null;
        }
    }

    cleanContent(content: string): string {
        return cleanLLMContent(content);
    }

    private extractJSON(content: string): string {
        return extractJSONFromContent(content);
    }

    protected convertArtifactToItem(artifactData: any): StreamingScript | null {
        // Convert EpisodeScriptV1 artifact to StreamingScript format
        if (artifactData && typeof artifactData === 'object') {
            return this.normalizeScript(artifactData);
        }
        return null;
    }
} 
 
 