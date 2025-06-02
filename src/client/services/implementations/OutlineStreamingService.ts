import { LLMStreamingService } from '../streaming/LLMStreamingService';
import { jsonrepair } from 'jsonrepair';
import { cleanLLMContent, extractJSONFromContent } from '../../../common/utils/textCleaning';

// Character interface with normalized structure
export interface OutlineCharacter {
    name: string;
    type: 'male_lead' | 'female_lead' | 'male_second' | 'female_second' | 'male_supporting' | 'female_supporting' | 'antagonist' | 'other';
    description: string;
    age?: string;
    gender?: string;
    occupation?: string;
    personality_traits?: string[];
    character_arc?: string;
    relationships?: { [key: string]: string };
    key_scenes?: string[];
}

// Interface for outline structure
export interface OutlineSection {
    title?: string;
    genre?: string;
    target_audience?: {
        demographic?: string;
        core_themes?: string[];
    };
    selling_points?: string[];
    satisfaction_points?: string[];
    setting?: {
        core_setting_summary?: string;
        key_scenes?: string[];
    };
    characters?: OutlineCharacter[];
    synopsis_stages?: Array<{
        stageSynopsis: string;
        numberOfEpisodes: number;
    }>;
}

export class OutlineStreamingService extends LLMStreamingService<OutlineSection> {
    validate(item: any): item is OutlineSection {
        // Very permissive validation - we accept partial outlines
        return typeof item === 'object' && item !== null;
    }

    parsePartial(content: string): OutlineSection[] {
        if (!content.trim()) return [];

        // Clean the content first
        const cleanedContent = this.cleanContent(content);

        // Try to ensure we have a complete JSON structure
        let processableContent = cleanedContent;

        // Find the start of the JSON object
        const jsonStart = processableContent.indexOf('{');
        if (jsonStart > 0) {
            processableContent = processableContent.substring(jsonStart);
        }

        // If content doesn't look like it starts with a JSON object, return empty
        if (!processableContent.trim().startsWith('{')) {
            return [];
        }

        // Fallback to single object parsing
        try {
            // Extract clean JSON from content that may have additional text
            const extractedJSON = this.extractJSON(processableContent);
            const parsed = JSON.parse(extractedJSON);
            const normalized = this.normalizeOutline(parsed);
            return [normalized];
        } catch (error) {
            // Try jsonrepair for incomplete JSON
            try {
                const repaired = jsonrepair(processableContent);
                const parsed = JSON.parse(repaired);
                const normalized = this.normalizeOutline(parsed);
                return [normalized];
            } catch (repairError) {
                // Try to extract partial fields
                const partial = this.extractPartialOutline(processableContent);
                if (Object.keys(partial).length > 0) {
                    return [partial];
                }

                return [];
            }
        }
    }

    private normalizeOutline(data: any): OutlineSection {
        const outline: OutlineSection = {};

        // Extract all fields that exist
        if (data.title !== undefined) outline.title = String(data.title);
        if (data.genre !== undefined) outline.genre = String(data.genre);

        if (data.selling_points !== undefined && Array.isArray(data.selling_points)) {
            outline.selling_points = data.selling_points.map((sp: any) => String(sp));
        }

        if (data.setting !== undefined) {
            if (typeof data.setting === 'object') {
                outline.setting = {};
                if (data.setting.core_setting_summary !== undefined) {
                    outline.setting.core_setting_summary = String(data.setting.core_setting_summary);
                }
                if (data.setting.key_scenes !== undefined && Array.isArray(data.setting.key_scenes)) {
                    outline.setting.key_scenes = data.setting.key_scenes.map((ks: any) => String(ks));
                }
            } else {
                // Handle setting as string
                outline.setting = {
                    core_setting_summary: String(data.setting)
                };
            }
        }

        if (data.target_audience !== undefined) {
            outline.target_audience = {};
            if (data.target_audience.demographic !== undefined) {
                outline.target_audience.demographic = String(data.target_audience.demographic);
            }
            if (data.target_audience.core_themes !== undefined && Array.isArray(data.target_audience.core_themes)) {
                outline.target_audience.core_themes = data.target_audience.core_themes.map((theme: any) => String(theme));
            }
        }

        if (data.satisfaction_points !== undefined && Array.isArray(data.satisfaction_points)) {
            outline.satisfaction_points = data.satisfaction_points.map((sp: any) => String(sp));
        }

        if (data.characters !== undefined && Array.isArray(data.characters)) {
            outline.characters = data.characters
                .filter((char: any) => char && typeof char === 'object')
                .map((char: any) => ({
                    name: String(char.name || ''),
                    type: char.type || 'other',
                    description: String(char.description || ''),
                    age: char.age ? String(char.age) : undefined,
                    gender: char.gender ? String(char.gender) : undefined,
                    occupation: char.occupation ? String(char.occupation) : undefined,
                    personality_traits: Array.isArray(char.personality_traits)
                        ? char.personality_traits.map((trait: any) => String(trait))
                        : undefined,
                    character_arc: char.character_arc ? String(char.character_arc) : undefined,
                    relationships: char.relationships && typeof char.relationships === 'object'
                        ? char.relationships
                        : undefined,
                    key_scenes: Array.isArray(char.key_scenes)
                        ? char.key_scenes.map((scene: any) => String(scene))
                        : undefined
                }));
        }

        if (data.synopsis_stages !== undefined && Array.isArray(data.synopsis_stages)) {
            outline.synopsis_stages = data.synopsis_stages.map((stage: any) => ({
                stageSynopsis: String(stage.stageSynopsis),
                numberOfEpisodes: Number(stage.numberOfEpisodes)
            }));
        }

        return outline;
    }

    private extractPartialOutline(content: string): OutlineSection {
        const outline: OutlineSection = {};

        // Try to extract individual fields using regex
        const titleMatch = content.match(/"title"\s*:\s*"([^"]*)"/);
        if (titleMatch) outline.title = titleMatch[1];

        const genreMatch = content.match(/"genre"\s*:\s*"([^"]*)"/);
        if (genreMatch) outline.genre = genreMatch[1];

        // Extract selling points array
        const sellingPointsMatch = content.match(/"selling_points"\s*:\s*\[(.*?)\]/s);
        if (sellingPointsMatch) {
            try {
                // Add brackets back and parse
                const spArray = JSON.parse(`[${sellingPointsMatch[1]}]`);
                if (Array.isArray(spArray)) {
                    outline.selling_points = spArray.map(sp => String(sp));
                }
            } catch (e) {
                // Try to extract individual strings
                const spStrings = sellingPointsMatch[1].match(/"([^"]*)"/g);
                if (spStrings) {
                    outline.selling_points = spStrings.map(s => s.replace(/"/g, ''));
                }
            }
        }

        // Extract synopsis stages
        const synopsisStagesMatch = content.match(/"synopsis_stages"\s*:\s*\[(.*?)\]/s);
        if (synopsisStagesMatch) {
            try {
                const stagesArray = JSON.parse(`[${synopsisStagesMatch[1]}]`);
                if (Array.isArray(stagesArray)) {
                    outline.synopsis_stages = stagesArray.map(stage => ({
                        stageSynopsis: String(stage.stageSynopsis),
                        numberOfEpisodes: Number(stage.numberOfEpisodes)
                    }));
                }
            } catch (e) {
                // Try to extract individual strings
                const stageStrings = synopsisStagesMatch[1].match(/"([^"]*)"/g);
                if (stageStrings) {
                    outline.synopsis_stages = stageStrings.map(s => s.replace(/"/g, '')).map(s => ({
                        stageSynopsis: s,
                        numberOfEpisodes: 1
                    }));
                }
            }
        }

        return outline;
    }

    cleanContent(content: string): string {
        return cleanLLMContent(content);
    }

    private extractJSON(content: string): string {
        return extractJSONFromContent(content);
    }

    // Override to handle outline artifact format
    protected convertArtifactToItem(artifactData: any): OutlineSection | null {
        // For outline, we expect the artifact data to contain the outline fields
        if (!artifactData || typeof artifactData !== 'object') {
            return null;
        }

        // The artifact data might be the outline directly or wrapped
        return this.normalizeOutline(artifactData);
    }
} 