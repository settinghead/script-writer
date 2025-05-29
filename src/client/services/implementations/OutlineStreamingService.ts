import { LLMStreamingService } from '../streaming/LLMStreamingService';
import { jsonrepair } from 'jsonrepair';

// Interface for outline structure
export interface OutlineSection {
    title?: string;
    genre?: string;
    selling_points?: string[];
    setting?: {
        core_setting_summary?: string;
        key_scenes?: string[];
    };
    main_characters?: Array<{
        name: string;
        description: string;
    }>;
    synopsis?: string;
}

export class OutlineStreamingService extends LLMStreamingService<OutlineSection> {
    validate(item: any): item is OutlineSection {
        // Very permissive validation - we accept partial outlines
        return typeof item === 'object' && item !== null;
    }

    parsePartial(content: string): OutlineSection[] {
        if (!content.trim()) return [];

        try {
            // Try to parse the content as JSON
            const parsed = JSON.parse(content);

            // Always return array with single outline object
            return [this.normalizeOutline(parsed)];
        } catch (error) {
            // Try jsonrepair for incomplete JSON
            try {
                const repaired = jsonrepair(content);
                const parsed = JSON.parse(repaired);
                return [this.normalizeOutline(parsed)];
            } catch (repairError) {
                // Try to extract partial fields
                const partial = this.extractPartialOutline(content);
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

        if (data.main_characters !== undefined && Array.isArray(data.main_characters)) {
            outline.main_characters = data.main_characters
                .filter((char: any) => char && typeof char === 'object')
                .map((char: any) => ({
                    name: String(char.name || ''),
                    description: String(char.description || '')
                }));
        }

        if (data.synopsis !== undefined) outline.synopsis = String(data.synopsis);

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

        // Extract synopsis
        const synopsisMatch = content.match(/"synopsis"\s*:\s*"([^"]*)"/);
        if (synopsisMatch) outline.synopsis = synopsisMatch[1];

        return outline;
    }

    cleanContent(content: string): string {
        // Remove markdown code blocks and clean up
        return content
            .replace(/^```json\s*/m, '')
            .replace(/\s*```$/m, '')
            .trim();
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