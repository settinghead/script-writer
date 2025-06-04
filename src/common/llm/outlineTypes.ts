// Enhanced outline types for better character and relationship development integration

export interface CharacterDetail {
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

export interface RelationshipDevelopment {
    characters: string[]; // Must match names from character array
    content: string; // Description of relationship development
}

export interface EmotionArcDevelopment {
    characters: string[]; // Must match names from character array  
    content: string; // Description of emotion arc development
}

export interface KeyPointObject {
    event: string; // Event content description
    timeSpan?: string; // Time span for the event
    emotionArcs: EmotionArcDevelopment[];
    relationshipDevelopments: RelationshipDevelopment[];
}

export interface EnhancedOutlineStage {
    title: string;
    stageSynopsis?: string;
    numberOfEpisodes?: number;
    timeframe?: string;
    startingCondition?: string;
    endingCondition?: string;
    stageStartEvent?: string;
    stageEndEvent?: string;
    keyPoints: KeyPointObject[]; // Array of key point objects
    externalPressure?: string;
}

export interface EnhancedOutlineResponseV1 {
    title?: string;
    genre?: string;
    target_audience?: {
        demographic?: string;
        core_themes?: string[];
    };
    selling_points?: string | string[];
    satisfaction_points?: string[];
    setting?: string;
    characters?: CharacterDetail[];
    synopsis_stages?: string[];
    stages?: EnhancedOutlineStage[];
}

// Legacy compatibility types
export interface CharacterEmotionArc {
    characters: string[];
    content: string;
}

export interface EnhancedKeyPoint {
    event: string;
    timespan: string;
    emotionArcs: CharacterEmotionArc[];
    relationshipDevelopments: RelationshipDevelopment[];
}

// Migration helpers for backward compatibility
export function migrateKeyMilestonesToKeyPoints(keyMilestones: any[]): KeyPointObject[] {
    if (!keyMilestones || !Array.isArray(keyMilestones)) {
        return [];
    }

    return keyMilestones.map(milestone => ({
        event: typeof milestone === 'string' ? milestone : milestone.event || milestone.content || '',
        timeSpan: milestone.timeSpan || '',
        emotionArcs: milestone.emotionArcs || [],
        relationshipDevelopments: milestone.relationshipDevelopments || []
    }));
}

export function migrateEnhancedKeyPointsToKeyPoints(enhancedKeyPoints: EnhancedKeyPoint[]): KeyPointObject[] {
    if (!enhancedKeyPoints || !Array.isArray(enhancedKeyPoints)) {
        return [];
    }

    return enhancedKeyPoints.map(point => ({
        event: point.event,
        timeSpan: point.timespan,
        emotionArcs: point.emotionArcs,
        relationshipDevelopments: point.relationshipDevelopments
    }));
}

// Response format for LLM to generate
export interface OutlineResponseV2 {
    title: string;
    genre: string;
    target_audience: {
        demographic: string;
        core_themes: string[];
    };
    selling_points: string[];
    satisfaction_points: string[];
    setting: string;
    synopsis: string;
    characters: OutlineCharacterV2[];
    synopsis_stages: EnhancedOutlineStage[];
}

export interface OutlineCharacterV2 {
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

// Backward compatibility - migration helper types
export interface LegacyKeyMilestone {
    event: string;
    timeSpan: string;
}

export interface LegacyOutlineStage {
    stageSynopsis: string;
    numberOfEpisodes: number;
    timeframe?: string;
    startingCondition: string;
    endingCondition: string;
    stageStartEvent: string;
    stageEndEvent: string;
    keyMilestones: Array<{
        event: string;
        timeSpan: string;
    }>;
    externalPressure: string;
}

// Migration functions
export function migrateLegacyToEnhanced(legacyStage: LegacyOutlineStage): EnhancedOutlineStage {
    return {
        title: legacyStage.stageSynopsis,
        stageSynopsis: legacyStage.stageSynopsis,
        numberOfEpisodes: legacyStage.numberOfEpisodes,
        timeframe: legacyStage.timeframe,
        startingCondition: legacyStage.startingCondition,
        endingCondition: legacyStage.endingCondition,
        stageStartEvent: legacyStage.stageStartEvent,
        stageEndEvent: legacyStage.stageEndEvent,
        keyPoints: legacyStage.keyMilestones.map(milestone => ({
            event: milestone.event,
            timeSpan: milestone.timeSpan,
            emotionArcs: [],
            relationshipDevelopments: []
        })),
        externalPressure: legacyStage.externalPressure
    };
}

export function migrateEnhancedToLegacy(enhancedStage: EnhancedOutlineStage): LegacyOutlineStage {
    return {
        stageSynopsis: enhancedStage.title || enhancedStage.stageSynopsis || '',
        numberOfEpisodes: enhancedStage.numberOfEpisodes || 1,
        timeframe: enhancedStage.timeframe,
        startingCondition: enhancedStage.startingCondition || '',
        endingCondition: enhancedStage.endingCondition || '',
        stageStartEvent: enhancedStage.stageStartEvent || '',
        stageEndEvent: enhancedStage.stageEndEvent || '',
        keyMilestones: enhancedStage.keyPoints.map(point => ({
            event: point.event,
            timeSpan: point.timeSpan || ''
        })),
        externalPressure: enhancedStage.externalPressure || ''
    };
} 