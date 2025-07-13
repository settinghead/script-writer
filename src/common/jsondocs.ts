// ========== TRANSITION: Re-export from common types ==========
// TODO: Gradually migrate all server imports to use ../../common/types directly

export * from './types';
import { JsondocSchemaRegistry } from './schemas/jsondocs';
import type { TypedJsondoc } from './types';


// Project-related interfaces
export interface Project {
    id: string;
    name: string;
    description?: string;
    project_type: string;
    status: 'active' | 'archived' | 'deleted';
    created_at: string;
    updated_at: string;
}

export interface ProjectUser {
    id: number;
    project_id: string;
    user_id: string;
    role: 'owner' | 'collaborator' | 'viewer';
    joined_at: string;
}

// Base jsondoc interface
export interface Jsondoc {
    id: string;
    project_id: string;

    // NEW: Schema and origin types
    schema_type: TypedJsondoc['schema_type'];
    schema_version: string;
    origin_type: TypedJsondoc['origin_type'];
    data: any;
    metadata?: any;
    created_at: string;
}

// Base transform interface
export interface Transform {
    id: string;
    project_id: string;
    type: 'llm' | 'human';
    type_version: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    retry_count: number;
    max_retries: number;
    execution_context?: any;
    created_at: string;
}

// Transform input/output links
export interface TransformInput {
    id: number;
    transform_id: string;
    jsondoc_id: string;
    input_role?: string;
}

export interface TransformOutput {
    id: number;
    transform_id: string;
    jsondoc_id: string;
    output_role?: string;
}

// LLM-specific data
export interface LLMPrompt {
    id: string;
    transform_id: string;
    prompt_text: string;
    prompt_role: string;
}

export interface LLMTransform {
    transform_id: string;
    model_name: string;
    model_parameters?: any;
    raw_response?: string;
    token_usage?: any;
}

export interface HumanTransform {
    transform_id: string;
    action_type: string;
    interface_context?: any;
    change_description?: string;
}

// ========== JSONDOC TYPE DEFINITIONS ==========

// Container for ideation sessions (maintains API compatibility)
export interface IdeationSessionV1 {
    id: string;
    name?: string;
    status: 'active' | 'completed' | 'archived';
    created_at: string;
}

// Brainstorm parameters
export interface BrainstormParamsV1 {
    platform: string;
    genre_paths: string[][];
    requirements: string;
}

// Individual brainstorm ideas  
export interface BrainstormIdeaV1 {
    idea_text: string;
    idea_title?: string; // Optional title field (3-7 characters)
    order_index: number;
    confidence_score?: number;
}

// Job parameters for brainstorming (persistent across refreshes)
export interface BrainstormingJobParamsV1 {
    platform: string;
    genrePaths: string[][];
    requirements: string;
    requestedAt: string; // ISO timestamp
}

// Input parameters for brainstorm tool execution
export interface BrainstormToolInputV1 {
    platform: string;
    genre: string;
    other_requirements?: string;
}

// Input parameters for brainstorm edit tool execution
export interface BrainstormEditInputV1 {
    ideaIndex?: number;
    sourceJsondocId: string;
    editRequirements: string;
    agentInstructions?: string;
}

// Input parameters for outline generation tool execution
export interface OutlineGenerationInputV1 {
    sourceJsondocId: string;
    totalEpisodes?: number;
    episodeDuration?: number;
    selectedPlatform?: string;
    selectedGenrePaths?: string[][];
    requirements?: string;
}

// Collection of brainstorm ideas (output from brainstorm tool)
export interface BrainstormIdeaCollectionV1 extends Array<{
    title: string;
    body: string;
}> { }

// ========== WORKFLOW CASCADING PARAMETERS ==========

// Common parameters that cascade through workflow stages
export interface WorkflowCascadingParamsV1 {
    platform: string;
    genre_paths: string[][];
    requirements: string;
    // Add more cascading params as needed
}

// Extended job parameters for outline generation with cascading params
export interface OutlineJobParamsV1 {
    sourceJsondocId: string;
    totalEpisodes?: number;
    episodeDuration?: number;
    requestedAt: string;
    workflowContext?: WorkflowContextV1;

    // 🔥 NEW: Cascaded parameters from brainstorming (user can modify)
    cascadedParams?: WorkflowCascadingParamsV1;
}

// User input/selection (for user-modified or manually entered content)
export interface UserInputV1 {
    text: string;
    source: 'manual' | 'modified_brainstorm';
    source_jsondoc_id?: string; // ID of the original jsondoc this was derived from
}

// LLM-generated plot outline
export interface PlotOutlineV1 {
    media_type: string;
    platform: string;
    plot_outline: string;
    analysis: string;
}

// Script documents
export interface ScriptDocumentV1 {
    name: string;
    room_id: string;
    content_snapshot?: string; // YJS document state
}

// Outline session container
export interface OutlineSessionV1 {
    id: string;
    ideation_session_id: string;  // Link back to original ideation
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

// New episode generation jsondoc types
export interface OutlineSynopsisStageV1 {
    stageNumber: number;
    stageSynopsis: string;
    numberOfEpisodes: number;
    outlineSessionId: string;
}

export interface EpisodeGenerationSessionV1 {
    id: string;
    outlineSessionId: string;
    stageJsondocId: string;
    status: 'active' | 'completed' | 'failed';
    totalEpisodes: number;
    episodeDuration: number;
}

export interface EpisodeSynopsisV1 {
    episodeNumber: number;
    title: string;
    briefSummary: string;
    keyEvents: string[];  // 2-3 key events per episode
    hooks: string;        // End-of-episode hook to next episode
    stageJsondocId: string;
    episodeGenerationSessionId: string;
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

// Extended parameters for episode generation with cascading params
export interface EpisodeGenerationParamsV1 {
    stageJsondocId: string;
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

export interface ScriptGenerationJobParamsV1 {
    platform: string;
    genre_paths: string[][];
    requirements: string;
    totalEpisodes: number;
    episodeDuration: number;
    episode_synopsis: string;
    characters_info: string;
    user_requirements: string;
    episode_number: number;
}

// Episode script data structure (matches streaming types)
export interface EpisodeScriptV1 {
    episodeNumber: number;
    stageJsondocId: string;
    episodeGenerationSessionId: string;

    // Script content
    scriptContent: string;
    scenes: Array<{
        sceneNumber: number;
        location: string;
        timeOfDay: string;
        characters: string[];
        action: string;
        dialogue: Array<{
            character: string;
            line: string;
            direction?: string;
        }>;
    }>;

    // Metadata
    wordCount: number;
    estimatedDuration: number;
    generatedAt: string;

    // Source references
    episodeSynopsisJsondocId: string;
    userRequirements?: string;
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



export function validateJsondocData(schemaType: TypedJsondoc['schema_type'],
    schemaVersion: TypedJsondoc['schema_version'], data: any): boolean {

    // Use Zod schemas for new jsondoc types
    if (schemaType in JsondocSchemaRegistry) {
        const schema = JsondocSchemaRegistry[schemaType as keyof typeof JsondocSchemaRegistry];
        const result = schema.safeParse(data);
        return result.success;
    }

    return false;


}
