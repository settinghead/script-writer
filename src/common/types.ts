import { z } from 'zod';
import { UseMutationResult } from '@tanstack/react-query';
import type { CanonicalJsondocContext } from './canonicalJsondocLogic';
import type { LineageGraph } from './transform-jsondoc-framework/lineageResolution.js';

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
import { JsondocWithData, JsonPatchV1 } from './transform-jsondoc-types.js';
import { ElectricJsondoc, ElectricTransform, ElectricHumanTransform, ElectricTransformInput, ElectricTransformOutput, ElectricLLMPrompt, ElectricLLMTransform, ElectricJsondocWithLineage, CreateTransformRequest, UpdateJsondocRequest, HumanTransformRequest } from './transform-jsondoc-types.js';
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
        plotDescription: string;
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

// Episode Script interfaces
export interface EpisodeScriptV1 {
    episodeNumber: number;
    title: string;
    scriptContent: string;
    wordCount?: number;
    estimatedDuration: number;
    episodeSynopsisJsondocId: string;
}

export interface EpisodeScriptInputV1 {
    jsondocs: Array<{
        jsondocId: string;
        description: string;
        schemaType: string;
    }>;
    episodeNumber: number;
    episodeSynopsisJsondocId: string;
    userRequirements?: string;
}

// Discriminated union for strongly typed jsondocs
export type TypedJsondoc =
    | JsondocWithData<'brainstorm_collection', 'v1', BrainstormIdeaCollectionV1>
    | JsondocWithData<'灵感创意', 'v1', BrainstormIdeaV1>
    | JsondocWithData<'brainstorm_input_params', 'v1', BrainstormParamsV1>
    | JsondocWithData<'brainstorm_input', 'v1', BrainstormParamsV1>
    | JsondocWithData<'剧本设定', 'v1', OutlineSettingV1>
    | JsondocWithData<'chronicles', 'v1', ChroniclesV1>
    | JsondocWithData<'分集结构', 'v1', EpisodePlanningV1>
    | JsondocWithData<'分集结构_input', 'v1', EpisodePlanningInputV1>
    | JsondocWithData<'单集大纲', 'v1', EpisodeSynopsisGroupV1>
    | JsondocWithData<'单集大纲_input', 'v1', EpisodeSynopsisInputV1>
    | JsondocWithData<'单集剧本', 'v1', EpisodeScriptV1>
    | JsondocWithData<'单集剧本_input', 'v1', EpisodeScriptInputV1>
    | JsondocWithData<'user_input', 'v1', UserInputV1>
    | JsondocWithData<'outline_title', 'v1', OutlineTitleV1>
    | JsondocWithData<'outline_genre', 'v1', OutlineGenreV1>
    | JsondocWithData<'outline_selling_points', 'v1', OutlineSellingPointsV1>
    | JsondocWithData<'outline_synopsis', 'v1', OutlineSynopsisV1>
    | JsondocWithData<'outline_characters', 'v1', OutlineCharactersV1>
    | JsondocWithData<'json_patch', 'v1', JsonPatchV1>


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



export const AgentBrainstormRequestSchema = z.object({
    userRequest: z.string(),
    platform: z.string().optional(),
    genre: z.string().optional(),
    other_requirements: z.string().optional(),
    numberOfIdeas: z.number().min(1).max(4),
});

export type AgentBrainstormRequest = z.infer<typeof AgentBrainstormRequestSchema>;

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

    // Canonical context (pre-computed)
    canonicalContext: CanonicalJsondocContext | "pending" | "error";

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
