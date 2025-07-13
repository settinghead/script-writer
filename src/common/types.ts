import { z } from 'zod';
import { UseMutationResult } from '@tanstack/react-query';
import type { LineageGraph } from './transform-jsonDoc-framework/lineageResolution.js';
import type { ChroniclesStage } from './schemas/outlineSchemas.js';

// ========== SHARED TYPES FOR CLIENT AND SERVER ==========

// Base jsonDoc interface
export interface JsonDoc {
    id: string;
    user_id: string;

    // SCHEMA TYPE: What data structure/format does this jsonDoc contain?
    schema_type: TypedJsonDoc['schema_type'];
    schema_version: TypedJsonDoc['schema_version'];

    // ORIGIN TYPE: Who/what created this jsonDoc?
    origin_type: 'ai_generated' | 'user_input';

    data: any; // Will be refined by specific jsonDoc types
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

// ========== JSONDOC DATA TYPE DEFINITIONS ==========

// Brainstorm parameters
export interface BrainstormParamsV1 {
    platform: string;
    genre_paths: string[][];
    requirements: string;
    numberOfIdeas: number;
}

// Individual brainstorm ideas  
export interface BrainstormIdeaV1 {
    idea_text: string;  // ✅ The correct field name!
    idea_title?: string;
    order_index: number;
    confidence_score?: number;
}

// Brainstorm idea collection (NEW: single jsonDoc containing multiple ideas)
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
    jsonDocId?: string;
}

// User input/selection (for user-modified or manually entered content)
export interface UserInputV1 {
    text: string;
    source: 'manual' | 'modified_brainstorm';
    source_jsonDoc_id?: string;
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

// Job parameters for chronological outline generation
export interface ChronologicalOutlineJobParamsV1 {
    sourceJsonDocId: string;
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

// Outline component jsonDocs
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
    stageJsonDocId: string;
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
    stageJsonDocId: string;
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
    stageJsonDocId: string;
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

// Use the consolidated Character type from streaming.ts
import type { Character } from './schemas/streaming';
export type OutlineCharacter = Character;

export interface OutlineCharactersV1 {
    characters: Character[];
}

export interface Chronicle {
    title: string;
    body: string;
}

export interface ChroniclesV1 {
    chronicles: Chronicle[];
}



// ========== STRONGLY TYPED JSONDOC INTERFACES ==========

// Discriminated union for strongly typed jsonDocs
export type TypedJsonDoc =
    | JsonDocWithData<'brainstorm_collection', 'v1', BrainstormIdeaCollectionV1>
    | JsonDocWithData<'brainstorm_idea', 'v1', BrainstormIdeaV1>
    | JsonDocWithData<'brainstorm_input_params', 'v1', BrainstormParamsV1>
    | JsonDocWithData<'brainstorm_input', 'v1', BrainstormParamsV1>
    | JsonDocWithData<'outline_settings', 'v1', OutlineSettingV1>
    | JsonDocWithData<'chronicles', 'v1', ChroniclesV1>
    | JsonDocWithData<'user_input', 'v1', UserInputV1>
    | JsonDocWithData<'outline_title', 'v1', OutlineTitleV1>
    | JsonDocWithData<'outline_genre', 'v1', OutlineGenreV1>
    | JsonDocWithData<'outline_selling_points', 'v1', OutlineSellingPointsV1>
    | JsonDocWithData<'outline_setting', 'v1', OutlineSettingV1>
    | JsonDocWithData<'outline_synopsis', 'v1', OutlineSynopsisV1>
    | JsonDocWithData<'outline_characters', 'v1', OutlineCharactersV1>


// Helper type for creating strongly typed jsonDocs
export interface JsonDocWithData<
    SchemaType extends string, SchemaVersion extends string, Data> extends Omit<JsonDoc, 'schema_type' | 'schema_version' | 'data'> {
    schema_type: SchemaType;
    schema_version: SchemaVersion;
    data: Data;
}

// Helper function to get text content from any jsonDoc type
export function getJsonDocTextContent(jsonDoc: TypedJsonDoc): string {
    if (jsonDoc.schema_type === 'brainstorm_idea') {
        return jsonDoc.data.idea_text; // ✅ Correctly typed!
    }


    // Fallback for unknown types
    const data = jsonDoc.data as any;
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
    jsonDocCounts: {
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
    numberOfIdeas: z.number().min(1).max(4),
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
export interface ElectricJsonDoc {
    id: string;
    project_id: string;

    // NEW: Schema and origin types
    schema_type: TypedJsonDoc['schema_type'];
    schema_version: TypedJsonDoc['schema_version'];
    origin_type: 'ai_generated' | 'user_input';

    data: string;
    metadata?: string;
    created_at: string;
    updated_at?: string;
    streaming_status?: 'streaming' | 'completed' | 'failed' | 'cancelled';
}

// Extended jsonDoc with lineage information
export interface ElectricJsonDocWithLineage extends ElectricJsonDoc {
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
    source_jsonDoc_id?: string;
    derivation_path: string;
    derived_jsonDoc_id?: string;
    transform_name?: string;
    [key: string]: unknown;
}

export interface ElectricTransformInput {
    id: number;
    project_id: string;
    transform_id: string;
    jsonDoc_id: string;
    input_role?: string;
    [key: string]: unknown;
}

export interface ElectricTransformOutput {
    id: number;
    project_id: string;
    transform_id: string;
    jsonDoc_id: string;
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

export interface UpdateJsonDocRequest {
    jsonDocId: string;
    data?: any;
    text?: string;
    metadata?: any;
}

export interface HumanTransformRequest {
    transformName: string;
    sourceJsonDocId: string;
    derivationPath: string;
    fieldUpdates?: Record<string, any>;
}

// Project Data Context interface
export interface ProjectDataContextType {
    // Data subscriptions
    jsonDocs: ElectricJsonDoc[] | "pending" | "error";
    transforms: ElectricTransform[] | "pending" | "error";
    humanTransforms: ElectricHumanTransform[] | "pending" | "error";
    transformInputs: ElectricTransformInput[] | "pending" | "error";
    transformOutputs: ElectricTransformOutput[] | "pending" | "error";
    llmPrompts: ElectricLLMPrompt[] | "pending" | "error";
    llmTransforms: ElectricLLMTransform[] | "pending" | "error";

    // Loading states
    isLoading: boolean;
    isError: boolean;
    error: Error | null;

    // Lineage graph (globally shared)
    lineageGraph: LineageGraph | "pending" | "error";

    // Selectors (memoized)
    // NEW: Collection-aware selectors
    getIdeaCollections: () => ElectricJsonDoc[] | "pending" | "error";
    getJsonDocAtPath: (jsonDocId: string, jsonDocPath: string) => any | null;
    getLatestVersionForPath: (jsonDocId: string, jsonDocPath: string) => string | null;

    getLineageGraph: () => LineageGraph | "pending" | "error";
    getJsonDocById: (id: string) => ElectricJsonDocWithLineage | undefined;
    getTransformById: (id: string) => ElectricTransform | undefined;
    getHumanTransformsForJsonDoc: (jsonDocId: string, path?: string) => ElectricHumanTransform[] | "pending" | "error";
    getTransformInputsForTransform: (transformId: string) => ElectricTransformInput[] | "pending" | "error";
    getTransformOutputsForTransform: (transformId: string) => ElectricTransformOutput[] | "pending" | "error";

    // Mutations (TanStack Query + optimistic updates)
    createTransform: UseMutationResult<any, Error, CreateTransformRequest>;
    updateJsonDoc: UseMutationResult<any, Error, UpdateJsonDocRequest>;
    createHumanTransform: UseMutationResult<any, Error, HumanTransformRequest>;

    // Local state management for optimistic updates
    localUpdates: Map<string, any>;
    addLocalUpdate: (key: string, update: any) => void;
    removeLocalUpdate: (key: string) => void;
    hasLocalUpdate: (key: string) => boolean;

    // Mutation state management - expose maps directly for easy access
    mutationStates: {
        jsonDocs: Map<string, { status: 'idle' | 'pending' | 'success' | 'error'; error?: string; timestamp?: number; }>;
        transforms: Map<string, { status: 'idle' | 'pending' | 'success' | 'error'; error?: string; timestamp?: number; }>;
        humanTransforms: Map<string, { status: 'idle' | 'pending' | 'success' | 'error'; error?: string; timestamp?: number; }>;
    };
    setEntityMutationState: (entityType: 'jsonDocs' | 'transforms' | 'humanTransforms', entityId: string, state: { status: 'idle' | 'pending' | 'success' | 'error'; error?: string; timestamp?: number; }) => void;
    clearEntityMutationState: (entityType: 'jsonDocs' | 'transforms' | 'humanTransforms', entityId: string) => void;
}

// Existing types for backward compatibility...
export interface BrainstormJsonDocData {
    ideas: Array<{
        title: string;
        body: string;
    }>;
}

export interface BrainstormJsonDocMetadata {
    status?: 'streaming' | 'completed' | 'failed';
    chunkCount?: number;
    totalExpected?: number;
}
