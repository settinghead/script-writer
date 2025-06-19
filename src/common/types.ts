import {
    EnhancedOutlineStage,
    EnhancedKeyPoint,
    CharacterEmotionArc,
    RelationshipDevelopment,
    OutlineCharacterV2,
    LegacyKeyMilestone,
    LegacyOutlineStage
} from './llm/outlineTypes.js';
import { z } from 'zod';

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
    requirements: string;
    requestedAt: string;
}

// ========== WORKFLOW CASCADING PARAMETERS ==========

// Common parameters that cascade through workflow stages
export interface WorkflowCascadingParamsV1 {
    platform: string;
    genre_paths: string[][];
    requirements: string;
    // Add more cascading params as needed
}

// Job parameters for outline generation
export interface OutlineJobParamsV1 {
    sourceArtifactId: string;
    totalEpisodes?: number;
    episodeDuration?: number;
    requestedAt: string;
    workflowContext?: WorkflowContextV1;

    // 🔥 NEW: Cascaded parameters from brainstorming (user can modify)
    cascadedParams?: WorkflowCascadingParamsV1;
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
    // Script status tracking
    hasScript?: boolean;
    // 🔥 NEW: Episode-level emotion and relationship development tracking
    emotionDevelopments?: Array<{
        characters: string[];  // Characters involved in this emotion development
        content: string;       // Detailed description of emotional change/progression
    }>;
    relationshipDevelopments?: Array<{
        characters: string[];  // Characters involved in this relationship development
        content: string;       // Detailed description of relationship change/progression
    }>;
}

export interface EpisodeGenerationParamsV1 {
    stageArtifactId: string;
    numberOfEpisodes: number;
    stageSynopsis: string;
    customRequirements?: string;

    // 🔥 NEW: Cascaded parameters from previous stages (user can modify)
    cascadedParams?: WorkflowCascadingParamsV1 & {
        // Additional episode-specific cascaded params
        totalEpisodes?: number;
        episodeDuration?: number;
    };
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

// Enhanced stage structure interface with comprehensive constraints
export interface StageStructure extends EnhancedOutlineStage {
    // This now extends the enhanced structure from LLM types
}

// Re-export enhanced types for convenience
export type {
    EnhancedOutlineStage,
    EnhancedKeyPoint,
    CharacterEmotionArc,
    RelationshipDevelopment,
    OutlineCharacterV2,
    LegacyKeyMilestone,
    LegacyOutlineStage
};

// ========== FLOW TYPES ==========

export interface ProjectFlow {
    id: string; // earliest session ID
    title: string;
    description: string;
    currentPhase: 'brainstorming' | 'outline' | 'episodes' | 'scripts';
    status: 'active' | 'completed' | 'failed';
    platform?: string;
    genre?: string;
    totalEpisodes?: number;
    episodeDuration?: number;
    createdAt: string;
    updatedAt: string;
    sourceType: 'brainstorm' | 'direct_outline';
    artifactCounts: {
        ideas: number;
        outlines: number;
        episodes: number;
        scripts: number;
    };
}

export interface IdeationRun {
    // ... existing code ...
}

export const AgentBrainstormRequestSchema = z.object({
    userRequest: z.string(),
    platform: z.string().optional(),
    genre: z.string().optional(),
    other_requirements: z.string().optional(),
});

export type AgentBrainstormRequest = z.infer<typeof AgentBrainstormRequestSchema>;

// Electric SQL Database Types
export interface ElectricArtifact {
    id: string
    project_id: string
    type: string
    type_version: string
    data: string // JSON string
    metadata: string | null // JSON string
    created_at: string
    updated_at: string
    streaming_status: 'streaming' | 'completed' | 'failed' | 'cancelled'
    streaming_progress: number
    partial_data: any | null // JSONB
}

export interface ElectricTransform {
    id: string
    project_id: string
    type: string
    type_version: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    execution_context: string | null
    created_at: string
    updated_at: string
    streaming_status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    progress_percentage: number
    error_message: string | null
    retry_count: number
    max_retries: number
}

export interface ElectricBrainstormFlow {
    project_id: string
    project_name: string
    transform_id: string
    transform_status: string
    progress_percentage: number
    error_message: string | null
    transform_created_at: string
    transform_updated_at: string
    artifact_id: string | null
    artifact_type: string | null
    artifact_status: string | null
    streaming_progress: number | null
    artifact_data: string | null
    artifact_partial_data: any | null
    artifact_created_at: string | null
    artifact_updated_at: string | null
}

// Brainstorm-specific types
export interface BrainstormArtifactData {
    ideas: IdeaWithTitle[]
}

export interface BrainstormArtifactMetadata {
    status: 'streaming' | 'completed' | 'failed'
    chunkCount: number
    startedAt?: string
    lastUpdated?: string
    completedAt?: string
}

export interface UseElectricBrainstormResult {
    ideas: IdeaWithTitle[]
    status: 'idle' | 'streaming' | 'completed' | 'failed'
    progress: number
    error: string | null
    isLoading: boolean
    lastSyncedAt: string | null
    chunkCount: number
} 