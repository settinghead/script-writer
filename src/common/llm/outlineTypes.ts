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
    emotionArcs: EmotionArcDevelopment[];
    relationshipDevelopments: RelationshipDevelopment[];
}

export interface EnhancedOutlineStage {
    title: string;
    stageSynopsis?: string;
    numberOfEpisodes?: number;
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
    emotionArcs: CharacterEmotionArc[];
    relationshipDevelopments: RelationshipDevelopment[];
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



