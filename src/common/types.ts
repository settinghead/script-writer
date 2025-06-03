// ========== SHARED TYPES FOR CLIENT AND SERVER ==========

// Base artifact interface
export interface Artifact {
    id: string;
    user_id: string;
    type: string;
    type_version: string;
    data: any; // Will be refined by specific artifact types
    metadata?: any;
    created_at: string;
}

// Base transform interface
export interface Transform {
    id: string;
    user_id: string;
    type: 'llm' | 'human';
    type_version: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    retry_count: number;
    max_retries: number;
    execution_context?: any;
    created_at: string;
}

// ========== ARTIFACT DATA TYPE DEFINITIONS ==========

// Brainstorm parameters
export interface BrainstormParamsV1 {
    platform: string;
    genre_paths: string[][];
    genre_proportions: number[];
    requirements: string;
}

// Individual brainstorm ideas  
export interface BrainstormIdeaV1 {
    idea_text: string;  // ✅ The correct field name!
    idea_title?: string;
    order_index: number;
    confidence_score?: number;
}

// User input/selection (for user-modified or manually entered content)
export interface UserInputV1 {
    text: string;
    source: 'manual' | 'modified_brainstorm';
    source_artifact_id?: string;
}

// Job parameters for brainstorming
export interface BrainstormingJobParamsV1 {
    platform: string;
    genrePaths: string[][];
    genreProportions: number[];
    requirements: string;
    requestedAt: string;
}

// Job parameters for outline generation
export interface OutlineJobParamsV1 {
    sourceArtifactId: string;
    totalEpisodes?: number;
    episodeDuration?: number;
    requestedAt: string;
    workflowContext?: WorkflowContextV1;
}

// Outline session container
export interface OutlineSessionV1 {
    id: string;
    ideation_session_id: string;
    status: 'active' | 'completed';
    created_at: string;
}

// Outline component artifacts
export interface OutlineTitleV1 {
    title: string;
}

export interface OutlineGenreV1 {
    genre: string;
}

export interface OutlineSellingPointsV1 {
    selling_points: string;
}

export interface OutlineSettingV1 {
    setting: string;
}

export interface OutlineSynopsisV1 {
    synopsis: string;
}

export interface OutlineTargetAudienceV1 {
    demographic: string;
    core_themes: string[];
}

export interface OutlineSatisfactionPointsV1 {
    satisfaction_points: string[];
}

export interface OutlineSynopsisStagesV1 {
    synopsis_stages: Array<{
        stageSynopsis: string;
        numberOfEpisodes: number;
    }>;
}

// New episode generation types
export interface OutlineSynopsisStageV1 {
    stageNumber: number;
    stageSynopsis: string;
    numberOfEpisodes: number;
    outlineSessionId: string;
}

export interface EpisodeGenerationSessionV1 {
    id: string;
    outlineSessionId: string;
    stageArtifactId: string;
    status: 'active' | 'completed' | 'failed';
    totalEpisodes: number;
    episodeDuration: number;
}

export interface EpisodeSynopsisV1 {
    episodeNumber: number;
    title: string;
    briefSummary: string;
    keyEvents: string[];
    hooks: string;
    stageArtifactId: string;
    episodeGenerationSessionId: string;
}

export interface EpisodeGenerationParamsV1 {
    stageArtifactId: string;
    numberOfEpisodes: number;
    stageSynopsis: string;
    customRequirements?: string;
}

export interface OutlineCharacter {
    name: string;
    type: 'male_lead' | 'female_lead' | 'male_second' | 'female_second' | 'male_supporting' | 'female_supporting' | 'antagonist' | 'other';
    description: string;
    age?: string;        // e.g., "25岁", "30多岁", "中年"
    gender?: string;     // e.g., "男", "女"
    occupation?: string; // e.g., "CEO", "学生", "医生"
    personality_traits?: string[];
    character_arc?: string;
    relationships?: { [key: string]: string };
    key_scenes?: string[];
}

export interface OutlineCharactersV1 {
    characters: OutlineCharacter[];
}

// ========== STRONGLY TYPED ARTIFACT INTERFACES ==========

// Discriminated union for strongly typed artifacts
export type TypedArtifact =
    | ArtifactWithData<'brainstorm_idea', 'v1', BrainstormIdeaV1>
    | ArtifactWithData<'user_input', 'v1', UserInputV1>
    | ArtifactWithData<'brainstorm_params', 'v1', BrainstormParamsV1>
    | ArtifactWithData<'brainstorming_job_params', 'v1', BrainstormingJobParamsV1>
    | ArtifactWithData<'outline_job_params', 'v1', OutlineJobParamsV1>
    | ArtifactWithData<'outline_session', 'v1', OutlineSessionV1>
    | ArtifactWithData<'outline_title', 'v1', OutlineTitleV1>
    | ArtifactWithData<'outline_genre', 'v1', OutlineGenreV1>
    | ArtifactWithData<'outline_selling_points', 'v1', OutlineSellingPointsV1>
    | ArtifactWithData<'outline_setting', 'v1', OutlineSettingV1>
    | ArtifactWithData<'outline_synopsis', 'v1', OutlineSynopsisV1>
    | ArtifactWithData<'outline_characters', 'v1', OutlineCharactersV1>;

// Helper type for creating strongly typed artifacts
export interface ArtifactWithData<T extends string, V extends string, D> extends Omit<Artifact, 'type' | 'type_version' | 'data'> {
    type: T;
    type_version: V;
    data: D;
}

// Type guards for runtime type checking
export function isBrainstormIdeaArtifact(artifact: Artifact): artifact is ArtifactWithData<'brainstorm_idea', 'v1', BrainstormIdeaV1> {
    return artifact.type === 'brainstorm_idea' && artifact.type_version === 'v1';
}

export function isUserInputArtifact(artifact: Artifact): artifact is ArtifactWithData<'user_input', 'v1', UserInputV1> {
    return artifact.type === 'user_input' && artifact.type_version === 'v1';
}

// Helper function to get text content from any artifact type
export function getArtifactTextContent(artifact: TypedArtifact | Artifact): string {
    if (isBrainstormIdeaArtifact(artifact)) {
        return artifact.data.idea_text; // ✅ Correctly typed!
    }
    if (isUserInputArtifact(artifact)) {
        return artifact.data.text;
    }

    // Fallback for unknown types
    const data = artifact.data as any;
    return data.idea_text || data.text || data.content || JSON.stringify(data, null, 2);
}

// Workflow context for carrying parameters between stages
export interface WorkflowContextV1 {
    totalEpisodes?: number;
    episodeDuration?: number;
    platform?: string;
    genre?: string;
    requirements?: string;
    // Add more parameters as needed for future stages
    [key: string]: any;
}

// Enhanced stage structure with temporal and event boundaries
export interface StageStructure {
    stageSynopsis: string;
    numberOfEpisodes: number;

    // Option A: Temporal Constraints
    timeframe?: string; // e.g., "Days 1-10: Initial setup period"
    startingCondition: string; // e.g., "Neighbors are strangers"
    endingCondition: string; // e.g., "Successfully convince first outsider they're dating"

    // Option B: Event-Based Stage Boundaries
    stageStartEvent: string; // e.g., "Mother calls demanding to meet boyfriend"
    stageEndEvent: string; // e.g., "Mother books train ticket to visit"
    keyMilestones: string[]; // e.g., ["First fake date in public", "Neighbors start gossiping"]

    // Option C: Relationship Progression Levels
    relationshipLevel: string; // e.g., "Strangers → Awkward actors"
    emotionalArc: string; // e.g., "Reluctant cooperation → Grudging respect"
    externalPressure: string; // e.g., "Family curiosity → Neighbor suspicion"
} 