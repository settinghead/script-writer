// ========== TRANSITION: Re-export from common types ==========
// TODO: Gradually migrate all server imports to use ../../common/types directly

export * from './types';
import { JsondocSchemaRegistry } from './schemas/jsondocs';
import type { TypedJsondoc } from './types';




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


