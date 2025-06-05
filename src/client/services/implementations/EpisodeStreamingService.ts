import { LLMStreamingService } from '../streaming/LLMStreamingService';

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
        return this.parseWithCommonFlow(content, 'EpisodeStreamingService');
    }

    protected normalizeItem(data: any): EpisodeSynopsis | null {
        try {
            return this.normalizeEpisode(data);
        } catch (error) {
            console.warn('Failed to normalize episode:', data, error);
            return null;
        }
    }

    protected extractPartialItems(content: string): EpisodeSynopsis[] {
        const episodes: EpisodeSynopsis[] = [];

        // Find individual episode objects using regex
        const episodeMatches = content.match(/\{[^{}]*?"episodeNumber"\s*:\s*\d+[^{}]*?\}/g);

        if (episodeMatches) {
            for (const match of episodeMatches) {
                try {
                    const episode = JSON.parse(match);
                    const normalized = this.normalizeItem(episode);
                    if (normalized && this.validate(normalized)) {
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

        // Extract emotionDevelopments
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

        // Extract relationshipDevelopments
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

    protected convertArtifactToItem(artifactData: any): EpisodeSynopsis | null {
        try {
            return this.normalizeEpisode(artifactData);
        } catch (error) {
            return null;
        }
    }
} 