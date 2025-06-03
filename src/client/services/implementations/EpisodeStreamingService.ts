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

        // Clean the content first
        const cleanedContent = this.cleanContent(content);

        // Try to find JSON array
        let processableContent = cleanedContent;

        // Find the start of the JSON array
        const arrayStart = processableContent.indexOf('[');
        if (arrayStart >= 0) {
            processableContent = processableContent.substring(arrayStart);
        } else {
            // If no array, return empty
            return [];
        }

        // Try to parse as complete array first
        try {
            const extractedJSON = this.extractJSON(processableContent);
            const parsed = JSON.parse(extractedJSON);
            if (Array.isArray(parsed)) {
                return parsed
                    .map(episode => this.normalizeEpisode(episode))
                    .filter(episode => this.validate(episode));
            }
        } catch (error) {
            // Continue to partial parsing
        }

        // Try jsonrepair for incomplete JSON
        try {
            const repaired = jsonrepair(processableContent);
            const parsed = JSON.parse(repaired);
            if (Array.isArray(parsed)) {
                return parsed
                    .map(episode => this.normalizeEpisode(episode))
                    .filter(episode => this.validate(episode));
            }
        } catch (repairError) {
            // Continue to individual episode parsing
        }

        // Try to extract individual complete episodes
        return this.extractPartialEpisodes(processableContent);
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
            hooks: data.hooks ? String(data.hooks) : undefined
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

        return episode;
    }

    cleanContent(content: string): string {
        return cleanLLMContent(content);
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