import {
    EnhancedOutlineStage,
    EnhancedKeyPoint,
    CharacterEmotionArc,
    RelationshipDevelopment,
    OutlineCharacterV2,
} from './llm/outlineTypes.js';
import { z } from 'zod';
import { UseMutationResult } from '@tanstack/react-query';
import type { LineageGraph } from './utils/lineageResolution';

// ========== SHARED TYPES FOR CLIENT AND SERVER ==========

// Base artifact interface
export interface Artifact {
    id: string;
    user_id: string;

    // SCHEMA TYPE: What data structure/format does this artifact contain?
    schema_type: string;
    schema_version: string;

    // ORIGIN TYPE: Who/what created this artifact?
    origin_type: 'ai_generated' | 'user_input';

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

// Brainstorm idea collection (NEW: single artifact containing multiple ideas)
export interface BrainstormIdeaCollectionV1 {
    ideas: Array<{
        title: string;
        body: string;
        metadata?: {
            ideaIndex: number;
            confidence_score?: number;
        };
    }>;
    platform: string;
    genre: string;
    total_ideas: number;
}

// Idea interface used throughout the application
export interface IdeaWithTitle {
    title: string;
    body: string;
    artifactId?: string;
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
    | ArtifactWithData<'brainstorm_collection_schema', 'v1', BrainstormIdeaCollectionV1>
    | ArtifactWithData<'brainstorm_idea_schema', 'v1', BrainstormIdeaV1>
    | ArtifactWithData<'user_input_schema', 'v1', UserInputV1>
    | ArtifactWithData<'brainstorm_params_schema', 'v1', BrainstormParamsV1>
    | ArtifactWithData<'brainstorming_job_params', 'v1', BrainstormingJobParamsV1>
    | ArtifactWithData<'outline_job_params', 'v1', OutlineJobParamsV1>
    | ArtifactWithData<'outline_session', 'v1', OutlineSessionV1>
    | ArtifactWithData<'outline_title_schema', 'v1', OutlineTitleV1>
    | ArtifactWithData<'outline_genre_schema', 'v1', OutlineGenreV1>
    | ArtifactWithData<'outline_selling_points_schema', 'v1', OutlineSellingPointsV1>
    | ArtifactWithData<'outline_setting_schema', 'v1', OutlineSettingV1>
    | ArtifactWithData<'outline_synopsis_schema', 'v1', OutlineSynopsisV1>
    | ArtifactWithData<'outline_characters_schema', 'v1', OutlineCharactersV1>;

// Helper type for creating strongly typed artifacts
export interface ArtifactWithData<SchemaType extends string, SchemaVersion extends string, Data> extends Omit<Artifact, 'schema_type' | 'schema_version' | 'data'> {
    schema_type: SchemaType;
    schema_version: SchemaVersion;
    data: Data;
}

// Type guards for runtime type checking
export function isBrainstormIdeaArtifact(artifact: Artifact): artifact is ArtifactWithData<'brainstorm_idea_schema', 'v1', BrainstormIdeaV1> {
    return artifact.schema_type === 'brainstorm_idea_schema' && artifact.schema_version === 'v1';
}

export function isUserInputArtifact(artifact: Artifact): artifact is ArtifactWithData<'user_input_schema', 'v1', UserInputV1> {
    return artifact.schema_type === 'user_input_schema' && artifact.schema_version === 'v1';
}

export function isBrainstormCollectionArtifact(artifact: Artifact): artifact is ArtifactWithData<'brainstorm_collection_schema', 'v1', BrainstormIdeaCollectionV1> {
    return artifact.schema_type === 'brainstorm_collection_schema' && artifact.schema_version === 'v1';
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

// Existing types...
export interface User {
    id: string;
    username: string;
    email?: string;
    created_at: string;
    updated_at: string;
}

export interface Project {
    id: string;
    name: string;
    description?: string;
    project_type: string;
    status: string;
    created_at: string;
    updated_at: string;
}

// Electric SQL types for real-time subscriptions
export interface ElectricArtifact {
    id: string;
    project_id: string;

    // NEW: Schema and origin types
    schema_type: string;
    schema_version: string;
    origin_type: 'ai_generated' | 'user_input';

    data: string;
    metadata?: string;
    created_at: string;
    updated_at?: string;
    streaming_status?: 'streaming' | 'completed' | 'failed' | 'cancelled';
    [key: string]: unknown;
}

// Extended artifact with lineage information
export interface ElectricArtifactWithLineage extends ElectricArtifact {
    sourceTransform?: {
        id: string;
        type: 'human' | 'llm';
        transformType: 'human' | 'llm'; // Redundant but matches LineageNode structure
    } | 'none';
    isEditable?: boolean; // Computed based on source transform type
}

export interface ElectricTransform {
    id: string;
    project_id: string;
    type: 'llm' | 'human';
    type_version: string;
    status: string;
    retry_count: number;
    max_retries: number;
    execution_context?: string;
    created_at: string;
    updated_at: string;
    streaming_status?: string;
    progress_percentage?: number;
    error_message?: string;
    [key: string]: unknown;
}

export interface ElectricHumanTransform {
    transform_id: string;
    project_id: string;
    action_type: string;
    interface_context?: string;
    change_description?: string;
    source_artifact_id?: string;
    derivation_path: string;
    derived_artifact_id?: string;
    transform_name?: string;
    [key: string]: unknown;
}

export interface ElectricTransformInput {
    id: number;
    project_id: string;
    transform_id: string;
    artifact_id: string;
    input_role?: string;
    [key: string]: unknown;
}

export interface ElectricTransformOutput {
    id: number;
    project_id: string;
    transform_id: string;
    artifact_id: string;
    output_role?: string;
    [key: string]: unknown;
}

export interface ElectricLLMPrompt {
    id: string;
    project_id: string;
    transform_id: string;
    prompt_text: string;
    prompt_role: string;
    [key: string]: unknown;
}

export interface ElectricLLMTransform {
    transform_id: string;
    project_id: string;
    model_name: string;
    model_parameters?: string;
    raw_response?: string;
    token_usage?: string;
    [key: string]: unknown;
}

export interface ElectricChatMessage {
    id: string;
    project_id: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    display_type: 'message' | 'tool_summary' | 'thinking';
    status: 'pending' | 'streaming' | 'completed' | 'failed';
    raw_message_id?: string;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
}

export interface ElectricRawChatMessage {
    id: string;
    project_id: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    metadata?: string;
    tool_name?: string;
    tool_parameters?: string;
    tool_result?: string;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
}

// Mutation request types
export interface CreateTransformRequest {
    projectId: string;
    type: 'llm' | 'human';
    typeVersion?: string;
    status?: string;
    executionContext?: any;
}

export interface UpdateArtifactRequest {
    artifactId: string;
    data?: any;
    metadata?: any;
}

export interface HumanTransformRequest {
    transformName: string;
    sourceArtifactId: string;
    derivationPath: string;
    fieldUpdates?: Record<string, any>;
}

// Project Data Context interface
export interface ProjectDataContextType {
    // Data subscriptions
    artifacts: ElectricArtifact[];
    transforms: ElectricTransform[];
    humanTransforms: ElectricHumanTransform[];
    transformInputs: ElectricTransformInput[];
    transformOutputs: ElectricTransformOutput[];
    llmPrompts: ElectricLLMPrompt[];
    llmTransforms: ElectricLLMTransform[];

    // Loading states
    isLoading: boolean;
    isError: boolean;
    error: Error | null;

    // Selectors (memoized)
    // NEW: Collection-aware selectors
    getBrainstormCollections: () => ElectricArtifact[];
    getArtifactAtPath: (artifactId: string, artifactPath: string) => any | null;
    getLatestVersionForPath: (artifactId: string, artifactPath: string) => string | null;

    // LEGACY: Keep existing selectors for backward compatibility
    getBrainstormArtifacts: () => ElectricArtifact[];
    getLineageGraph: () => LineageGraph;
    getOutlineArtifacts: () => ElectricArtifact[];
    getArtifactById: (id: string) => ElectricArtifactWithLineage | undefined;
    getTransformById: (id: string) => ElectricTransform | undefined;
    getHumanTransformsForArtifact: (artifactId: string, path?: string) => ElectricHumanTransform[];
    getTransformInputsForTransform: (transformId: string) => ElectricTransformInput[];
    getTransformOutputsForTransform: (transformId: string) => ElectricTransformOutput[];

    // Mutations (TanStack Query + optimistic updates)
    createTransform: UseMutationResult<any, Error, CreateTransformRequest>;
    updateArtifact: UseMutationResult<any, Error, UpdateArtifactRequest>;
    createHumanTransform: UseMutationResult<any, Error, HumanTransformRequest>;

    // Local state management for optimistic updates
    localUpdates: Map<string, any>;
    addLocalUpdate: (key: string, update: any) => void;
    removeLocalUpdate: (key: string) => void;
    hasLocalUpdate: (key: string) => boolean;

    // Mutation state management - expose maps directly for easy access
    mutationStates: {
        artifacts: Map<string, { status: 'idle' | 'pending' | 'success' | 'error'; error?: string; timestamp?: number; }>;
        transforms: Map<string, { status: 'idle' | 'pending' | 'success' | 'error'; error?: string; timestamp?: number; }>;
        humanTransforms: Map<string, { status: 'idle' | 'pending' | 'success' | 'error'; error?: string; timestamp?: number; }>;
    };
    setEntityMutationState: (entityType: 'artifacts' | 'transforms' | 'humanTransforms', entityId: string, state: { status: 'idle' | 'pending' | 'success' | 'error'; error?: string; timestamp?: number; }) => void;
    clearEntityMutationState: (entityType: 'artifacts' | 'transforms' | 'humanTransforms', entityId: string) => void;
}

// Existing types for backward compatibility...
export interface BrainstormArtifactData {
    ideas: Array<{
        title: string;
        body: string;
    }>;
}

export interface BrainstormArtifactMetadata {
    status?: 'streaming' | 'completed' | 'failed';
    chunkCount?: number;
    totalExpected?: number;
}
