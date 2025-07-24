import { z } from 'zod';
import { UseMutationResult } from '@tanstack/react-query';
import type { LineageGraph } from './transform-jsondoc-framework/lineageResolution.js';
import type { ChroniclesStage } from './schemas/outlineSchemas.js';

// ========== SHARED TYPES FOR CLIENT AND SERVER ==========

// Base jsondoc interface
export interface Jsondoc {
    id: string;
    user_id: string;

    // SCHEMA TYPE: What data structure/format does this jsondoc contain?
    schema_type: TypedJsondoc['schema_type'];
    schema_version: TypedJsondoc['schema_version'];

    // ORIGIN TYPE: Who/what created this jsondoc?
    origin_type: 'ai_generated' | 'user_input';

    data: any; // Will be refined by specific jsondoc types
    metadata?: any;
    created_at: string;
}

// Base transform interface
export interface Transform {
    id: string;
    user_id: string;
    type: 'llm' | 'human' | 'ai_patch' | 'human_patch_approval';
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

// Brainstorm idea collection (NEW: single jsondoc containing multiple ideas)
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
    jsondocId?: string;
    originalJsondocId?: string;  // For lineage resolution - the original jsondoc ID for transform lookup
    jsondocPath: string;        // JSONPath within collection jsondocs (e.g., '$.ideas[0]', '$' for root)
    index?: number;  // For consistent ordering
    debugInfo?: string; // DEBUG: Add debug info property
}

// User input/selection (for user-modified or manually entered content)
export interface UserInputV1 {
    text: string;
    source: 'manual' | 'modified_brainstorm';
    source_jsondoc_id?: string;
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
    sourceJsondocId: string;
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

// Outline component jsondocs
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

export interface EpisodePlanningV1 {
    totalEpisodes: number;
    episodeGroups: Array<{
        groupTitle: string;
        episodes: string;
        keyEvents: string[];
        hooks: string[];
        emotionalBeats: string[];
    }>;
    overallStrategy: string;
}

export interface EpisodePlanningInputV1 {
    jsondocs: Array<{
        jsondocId: string;
        description: string;
        schemaType: string;
    }>;
    numberOfEpisodes: number;
    requirements?: string;
}

export interface EpisodeSynopsisV1 {
    episodeNumber: number;
    title: string;
    openingHook: string;
    mainPlot: string;
    emotionalClimax: string;
    cliffhanger: string;
    suspenseElements: string[];
    estimatedDuration: number;
}

export interface EpisodeSynopsisGroupV1 {
    groupTitle: string;
    episodeRange: string;
    episodes: EpisodeSynopsisV1[];
}

export interface EpisodeSynopsisInputV1 {
    jsondocs: Array<{
        jsondocId: string;
        description: string;
        schemaType: string;
    }>;
    groupTitle: string;
    episodeRange: string;
    episodes: number[];
}

// ========== STRONGLY TYPED JSONDOC INTERFACES ==========

// JSON Patch interface for intermediate patch storage
export interface JsonPatchV1 {
    patches: Array<{
        op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
        path: string;
        value?: any;
        from?: string;
    }>;
    targetJsondocId?: string;
    targetSchemaType?: string;
    patchIndex?: number; // For ordering patches in a sequence
    applied?: boolean; // Whether this patch was successfully applied
    errorMessage?: string; // Error message if patch failed to apply
}

// Discriminated union for strongly typed jsondocs
export type TypedJsondoc =
    | JsondocWithData<'brainstorm_collection', 'v1', BrainstormIdeaCollectionV1>
    | JsondocWithData<'灵感创意', 'v1', BrainstormIdeaV1>
    | JsondocWithData<'brainstorm_input_params', 'v1', BrainstormParamsV1>
    | JsondocWithData<'brainstorm_input', 'v1', BrainstormParamsV1>
    | JsondocWithData<'剧本设定', 'v1', OutlineSettingV1>
    | JsondocWithData<'chronicles', 'v1', ChroniclesV1>
    | JsondocWithData<'episode_planning', 'v1', EpisodePlanningV1>
    | JsondocWithData<'episode_planning_input', 'v1', EpisodePlanningInputV1>
    | JsondocWithData<'episode_synopsis', 'v1', EpisodeSynopsisGroupV1>
    | JsondocWithData<'episode_synopsis_input', 'v1', EpisodeSynopsisInputV1>
    | JsondocWithData<'user_input', 'v1', UserInputV1>
    | JsondocWithData<'outline_title', 'v1', OutlineTitleV1>
    | JsondocWithData<'outline_genre', 'v1', OutlineGenreV1>
    | JsondocWithData<'outline_selling_points', 'v1', OutlineSellingPointsV1>
    | JsondocWithData<'outline_synopsis', 'v1', OutlineSynopsisV1>
    | JsondocWithData<'outline_characters', 'v1', OutlineCharactersV1>
    | JsondocWithData<'json_patch', 'v1', JsonPatchV1>


// Helper type for creating strongly typed jsondocs
export interface JsondocWithData<
    SchemaType extends string, SchemaVersion extends string, Data> extends Omit<Jsondoc, 'schema_type' | 'schema_version' | 'data'> {
    schema_type: SchemaType;
    schema_version: SchemaVersion;
    data: Data;
}

// Helper function to get text content from any jsondoc type
export function getJsondocTextContent(jsondoc: TypedJsondoc): string {
    if (jsondoc.schema_type === '灵感创意') {
        return jsondoc.data.idea_text; // ✅ Correctly typed!
    }


    // Fallback for unknown types
    const data = jsondoc.data as any;
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
    jsondocCounts: {
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
export interface ElectricJsondoc {
    id: string;
    project_id: string;

    // NEW: Schema and origin types
    schema_type: TypedJsondoc['schema_type'];
    schema_version: TypedJsondoc['schema_version'];
    origin_type: 'ai_generated' | 'user_input';

    data: string;
    metadata?: string;
    created_at: string;
    updated_at?: string;
    streaming_status?: 'streaming' | 'completed' | 'failed' | 'cancelled';
}

// Extended jsondoc with lineage information
export interface ElectricJsondocWithLineage extends ElectricJsondoc {
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
    type: 'llm' | 'human' | 'ai_patch' | 'human_patch_approval';
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
    source_jsondoc_id?: string;
    derivation_path: string;
    derived_jsondoc_id?: string;
    transform_name?: string;
    [key: string]: unknown;
}

export interface ElectricTransformInput {
    id: number;
    project_id: string;
    transform_id: string;
    jsondoc_id: string;
    input_role?: string;
    [key: string]: unknown;
}

export interface ElectricTransformOutput {
    id: number;
    project_id: string;
    transform_id: string;
    jsondoc_id: string;
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

export interface UpdateJsondocRequest {
    jsondocId: string;
    data?: any;
    text?: string;
    metadata?: any;
}

export interface HumanTransformRequest {
    transformName: string;
    sourceJsondocId: string;
    derivationPath: string;
    fieldUpdates?: Record<string, any>;
}

// Project Data Context interface
export interface ProjectDataContextType {
    // Data subscriptions
    jsondocs: ElectricJsondoc[] | "pending" | "error";
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
    getIdeaCollections: () => ElectricJsondoc[] | "pending" | "error";
    getJsondocAtPath: (jsondocId: string, jsondocPath: string) => any | null;
    getLatestVersionForPath: (jsondocId: string, jsondocPath: string) => string | null;

    getLineageGraph: () => LineageGraph | "pending" | "error";
    getJsondocById: (id: string) => ElectricJsondocWithLineage | undefined;
    getTransformById: (id: string) => ElectricTransform | undefined;
    getHumanTransformsForJsondoc: (jsondocId: string, path?: string) => ElectricHumanTransform[] | "pending" | "error";
    getTransformInputsForTransform: (transformId: string) => ElectricTransformInput[] | "pending" | "error";
    getTransformOutputsForTransform: (transformId: string) => ElectricTransformOutput[] | "pending" | "error";

    // Mutations (TanStack Query + optimistic updates)
    createTransform: UseMutationResult<any, Error, CreateTransformRequest>;
    updateJsondoc: UseMutationResult<any, Error, UpdateJsondocRequest>;
    createHumanTransform: UseMutationResult<any, Error, HumanTransformRequest>;

    // Local state management for optimistic updates
    localUpdates: Map<string, any>;
    addLocalUpdate: (key: string, update: any) => void;
    removeLocalUpdate: (key: string) => void;
    hasLocalUpdate: (key: string) => boolean;

    // Mutation state management - expose maps directly for easy access
    mutationStates: {
        jsondocs: Map<string, { status: 'idle' | 'pending' | 'success' | 'error'; error?: string; timestamp?: number; }>;
        transforms: Map<string, { status: 'idle' | 'pending' | 'success' | 'error'; error?: string; timestamp?: number; }>;
        humanTransforms: Map<string, { status: 'idle' | 'pending' | 'success' | 'error'; error?: string; timestamp?: number; }>;
    };
    setEntityMutationState: (entityType: 'jsondocs' | 'transforms' | 'humanTransforms', entityId: string, state: { status: 'idle' | 'pending' | 'success' | 'error'; error?: string; timestamp?: number; }) => void;
    clearEntityMutationState: (entityType: 'jsondocs' | 'transforms' | 'humanTransforms', entityId: string) => void;
}

// Existing types for backward compatibility...
export interface BrainstormJsondocData {
    ideas: Array<{
        title: string;
        body: string;
    }>;
}

export interface BrainstormJsondocMetadata {
    status?: 'streaming' | 'completed' | 'failed';
    chunkCount?: number;
    totalExpected?: number;
}
