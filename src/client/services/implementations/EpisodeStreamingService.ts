import { LLMStreamingService } from '../streaming/LLMStreamingService';
import { jsonrepair } from 'jsonrepair';
import { cleanLLMContent, extractJSONFromContent } from '../../../common/utils/textCleaning';

// Interface for episode synopsis structure
export interface EpisodeSynopsis {
    episodeNumber: number;
    title: string;
    synopsis?: string;
    briefSummary?: string;
    keyEvents: string[];
    endHook?: string;
    hooks?: string;
    emotionDevelopments?: Array<{
        characters: string[];
        content: string;
    }>;
    relationshipDevelopments?: Array<{
        characters: string[];
        content: string;
    }>;
}

export class EpisodeStreamingService extends LLMStreamingService<EpisodeSynopsis> {
    validate(item: any): item is EpisodeSynopsis {
        return typeof item === 'object' &&
            item !== null &&
            typeof item.episodeNumber === 'number' &&
            typeof item.title === 'string';
    }

    parsePartial(content: string): EpisodeSynopsis[] {
        if (!content.trim()) return [];

        console.log('[EpisodeStreamingService] Original content length:', content.length);
        console.log('[EpisodeStreamingService] Original content preview:',
            content.substring(0, 100) + (content.length > 100 ? '...' : ''));

        // Clean the content first
        const cleanedContent = this.cleanContent(content);
        console.log('[EpisodeStreamingService] After cleaning, length:', cleanedContent.length);

        // Try to find JSON array
        let processableContent = cleanedContent;

        // Find the start of the JSON array
        const arrayStart = processableContent.indexOf('[');
        if (arrayStart >= 0) {
            processableContent = processableContent.substring(arrayStart);
            console.log('[EpisodeStreamingService] Found array start, processing from position:', arrayStart);
        } else {
            console.log('[EpisodeStreamingService] No array start found, content:', processableContent);
            return [];
        }

        // Try to parse as complete array first
        try {
            const extractedJSON = this.extractJSON(processableContent);
            console.log('[EpisodeStreamingService] Extracted JSON length:', extractedJSON.length);
            const parsed = JSON.parse(extractedJSON);
            if (Array.isArray(parsed)) {
                console.log('[EpisodeStreamingService] Successfully parsed complete array with', parsed.length, 'episodes');
                const episodes = parsed
                    .map(episode => this.normalizeEpisode(episode))
                    .filter(episode => this.validate(episode));
                console.log('[EpisodeStreamingService] Returning', episodes.length, 'valid episodes');
                return episodes;
            }
        } catch (error) {
            console.log('[EpisodeStreamingService] Failed to parse complete JSON:', error.message);
        }

        // Try jsonrepair for incomplete JSON
        try {
            const repaired = jsonrepair(processableContent);
            console.log('[EpisodeStreamingService] JSON repair attempted, length:', repaired.length);
            const parsed = JSON.parse(repaired);
            if (Array.isArray(parsed)) {
                console.log('[EpisodeStreamingService] Successfully parsed repaired JSON with', parsed.length, 'episodes');
                const episodes = parsed
                    .map(episode => this.normalizeEpisode(episode))
                    .filter(episode => this.validate(episode));
                console.log('[EpisodeStreamingService] Returning', episodes.length, 'valid episodes from repair');
                return episodes;
            }
        } catch (repairError) {
            console.log('[EpisodeStreamingService] JSON repair failed:', repairError.message);
        }

        // Try to extract individual complete episodes
        console.log('[EpisodeStreamingService] Falling back to partial episode extraction');
        const partialEpisodes = this.extractPartialEpisodes(processableContent);
        console.log('[EpisodeStreamingService] Extracted', partialEpisodes.length, 'partial episodes');
        return partialEpisodes;
    }

    private normalizeEpisode(data: any): EpisodeSynopsis {
        return {
            episodeNumber: Number(data.episodeNumber) || 1,
            title: String(data.title || ''),
            synopsis: data.synopsis ? String(data.synopsis) : undefined,
            briefSummary: data.briefSummary ? String(data.briefSummary) : undefined,
            keyEvents: Array.isArray(data.keyEvents)
                ? data.keyEvents.map((event: any) => String(event))
                : [],
            endHook: data.endHook ? String(data.endHook) : undefined,
            hooks: data.hooks ? String(data.hooks) : undefined,
            emotionDevelopments: data.emotionDevelopments ? data.emotionDevelopments.map((d: any) => ({
                characters: Array.isArray(d.characters) ? d.characters.map((c: any) => String(c)) : [],
                content: String(d.content)
            })) : undefined,
            relationshipDevelopments: data.relationshipDevelopments ? data.relationshipDevelopments.map((d: any) => ({
                characters: Array.isArray(d.characters) ? d.characters.map((c: any) => String(c)) : [],
                content: String(d.content)
            })) : undefined
        };
    }

    private extractPartialEpisodes(content: string): EpisodeSynopsis[] {
        const episodes: EpisodeSynopsis[] = [];

        // Find individual episode objects using regex
        const episodeMatches = content.match(/\{[^{}]*?"episodeNumber"\s*:\s*\d+[^{}]*?\}/g);

        if (episodeMatches) {
            for (const match of episodeMatches) {
                try {
                    const episode = JSON.parse(match);
                    const normalized = this.normalizeEpisode(episode);
                    if (this.validate(normalized)) {
                        episodes.push(normalized);
                    }
                } catch (e) {
                    // Try to extract fields manually
                    const partial = this.extractEpisodeFields(match);
                    if (partial && this.validate(partial)) {
                        episodes.push(partial);
                    }
                }
            }
        }

        return episodes;
    }

    private extractEpisodeFields(content: string): EpisodeSynopsis | null {
        // Extract basic fields using regex
        const episodeNumberMatch = content.match(/"episodeNumber"\s*:\s*(\d+)/);
        const titleMatch = content.match(/"title"\s*:\s*"([^"]*)"/);

        if (!episodeNumberMatch || !titleMatch) {
            return null;
        }

        const episode: EpisodeSynopsis = {
            episodeNumber: parseInt(episodeNumberMatch[1]),
            title: titleMatch[1],
            keyEvents: []
        };

        // Extract synopsis
        const synopsisMatch = content.match(/"synopsis"\s*:\s*"([^"]*)"/);
        if (synopsisMatch) {
            episode.synopsis = synopsisMatch[1];
        }

        // Extract briefSummary
        const briefSummaryMatch = content.match(/"briefSummary"\s*:\s*"([^"]*)"/);
        if (briefSummaryMatch) {
            episode.briefSummary = briefSummaryMatch[1];
        }

        // Extract keyEvents array
        const keyEventsMatch = content.match(/"keyEvents"\s*:\s*\[(.*?)\]/s);
        if (keyEventsMatch) {
            try {
                const events = JSON.parse(`[${keyEventsMatch[1]}]`);
                if (Array.isArray(events)) {
                    episode.keyEvents = events.map(event => String(event));
                }
            } catch (e) {
                // Try to extract individual strings
                const eventStrings = keyEventsMatch[1].match(/"([^"]*)"/g);
                if (eventStrings) {
                    episode.keyEvents = eventStrings.map(s => s.replace(/"/g, ''));
                }
            }
        }

        // Extract endHook
        const endHookMatch = content.match(/"endHook"\s*:\s*"([^"]*)"/);
        if (endHookMatch) {
            episode.endHook = endHookMatch[1];
        }

        // Extract hooks
        const hooksMatch = content.match(/"hooks"\s*:\s*"([^"]*)"/);
        if (hooksMatch) {
            episode.hooks = hooksMatch[1];
        }

        // 🔥 NEW: Extract emotionDevelopments
        const emotionDevelopmentsMatch = content.match(/"emotionDevelopments"\s*:\s*\[(.*?)\]/s);
        if (emotionDevelopmentsMatch) {
            try {
                const developments = JSON.parse(`[${emotionDevelopmentsMatch[1]}]`);
                episode.emotionDevelopments = developments.map((d: any) => ({
                    characters: Array.isArray(d.characters) ? d.characters : [],
                    content: String(d.content || '')
                }));
            } catch (e) {
                // Try partial extraction
                episode.emotionDevelopments = [];
            }
        }

        // 🔥 NEW: Extract relationshipDevelopments
        const relationshipDevelopmentsMatch = content.match(/"relationshipDevelopments"\s*:\s*\[(.*?)\]/s);
        if (relationshipDevelopmentsMatch) {
            try {
                const developments = JSON.parse(`[${relationshipDevelopmentsMatch[1]}]`);
                episode.relationshipDevelopments = developments.map((d: any) => ({
                    characters: Array.isArray(d.characters) ? d.characters : [],
                    content: String(d.content || '')
                }));
            } catch (e) {
                // Try partial extraction
                episode.relationshipDevelopments = [];
            }
        }

        return episode;
    }

    cleanContent(content: string): string {
        // Remove streaming protocol prefixes like '0:"' and decode JSON strings
        let cleaned = content
            .replace(/^\d+:"/, '') // Remove streaming protocol prefix like '0:"'
            .replace(/\\n/g, '\n')  // Decode newlines
            .replace(/\\"/g, '"')   // Decode quotes
            .replace(/\\t/g, '\t')  // Decode tabs
            .replace(/\\""/g, '"')  // Fix double-escaped quotes
            .trim();

        // Use the common text cleaning utility
        cleaned = cleanLLMContent(cleaned);

        console.log('[EpisodeStreamingService] Cleaned content preview:',
            cleaned.substring(0, 200) + (cleaned.length > 200 ? '...' : ''));

        return cleaned;
    }

    private extractJSON(content: string): string {
        return extractJSONFromContent(content);
    }

    protected convertArtifactToItem(artifactData: any): EpisodeSynopsis | null {
        try {
            return this.normalizeEpisode(artifactData);
        } catch (error) {
            return null;
        }
    }
} 