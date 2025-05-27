// Base artifact interface
export interface Artifact {
    id: string;
    user_id: string;
    type: string;
    type_version: string;
    data: any;
    metadata?: any;
    created_at: string;
}

// Base transform interface
export interface Transform {
    id: string;
    user_id: string;
    type: 'llm' | 'human';
    type_version: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    execution_context?: any;
    created_at: string;
}

// Transform input/output links
export interface TransformInput {
    id: number;
    transform_id: string;
    artifact_id: string;
    input_role?: string;
}

export interface TransformOutput {
    id: number;
    transform_id: string;
    artifact_id: string;
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

// ========== ARTIFACT TYPE DEFINITIONS ==========

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
    genre_proportions: number[];
    requirements: string;
}

// Individual brainstorm ideas  
export interface BrainstormIdeaV1 {
    idea_text: string;
    order_index: number;
    confidence_score?: number;
}

// User input/selection
export interface UserInputV1 {
    text: string;
    source: 'manual' | 'selected_idea';
    selected_idea_id?: string;
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

// Type guards for artifact data validation
export function validateArtifactData(type: string, typeVersion: string, data: any): boolean {
    switch (`${type}:${typeVersion}`) {
        case 'ideation_session:v1':
            return isIdeationSessionV1(data);
        case 'brainstorm_params:v1':
            return isBrainstormParamsV1(data);
        case 'brainstorm_idea:v1':
            return isBrainstormIdeaV1(data);
        case 'user_input:v1':
            return isUserInputV1(data);
        case 'plot_outline:v1':
            return isPlotOutlineV1(data);
        case 'script_document:v1':
            return isScriptDocumentV1(data);
        case 'outline_session:v1':
            return isOutlineSessionV1(data);
        case 'outline_title:v1':
            return isOutlineTitleV1(data);
        case 'outline_genre:v1':
            return isOutlineGenreV1(data);
        case 'outline_selling_points:v1':
            return isOutlineSellingPointsV1(data);
        case 'outline_setting:v1':
            return isOutlineSettingV1(data);
        case 'outline_synopsis:v1':
            return isOutlineSynopsisV1(data);
        default:
            return false;
    }
}

// Type guard implementations
function isIdeationSessionV1(data: any): data is IdeationSessionV1 {
    return typeof data === 'object' &&
        typeof data.id === 'string' &&
        ['active', 'completed', 'archived'].includes(data.status) &&
        typeof data.created_at === 'string';
}

function isBrainstormParamsV1(data: any): data is BrainstormParamsV1 {
    return typeof data === 'object' &&
        typeof data.platform === 'string' &&
        Array.isArray(data.genre_paths) &&
        Array.isArray(data.genre_proportions) &&
        typeof data.requirements === 'string';
}

function isBrainstormIdeaV1(data: any): data is BrainstormIdeaV1 {
    return typeof data === 'object' &&
        typeof data.idea_text === 'string' &&
        typeof data.order_index === 'number';
}

function isUserInputV1(data: any): data is UserInputV1 {
    return typeof data === 'object' &&
        typeof data.text === 'string' &&
        ['manual', 'selected_idea'].includes(data.source);
}

function isPlotOutlineV1(data: any): data is PlotOutlineV1 {
    return typeof data === 'object' &&
        typeof data.media_type === 'string' &&
        typeof data.platform === 'string' &&
        typeof data.plot_outline === 'string' &&
        typeof data.analysis === 'string';
}

function isScriptDocumentV1(data: any): data is ScriptDocumentV1 {
    return typeof data === 'object' &&
        typeof data.name === 'string' &&
        typeof data.room_id === 'string';
}

function isOutlineSessionV1(data: any): data is OutlineSessionV1 {
    return typeof data === 'object' &&
        typeof data.id === 'string' &&
        typeof data.ideation_session_id === 'string' &&
        ['active', 'completed'].includes(data.status) &&
        typeof data.created_at === 'string';
}

function isOutlineTitleV1(data: any): data is OutlineTitleV1 {
    return typeof data === 'object' &&
        typeof data.title === 'string';
}

function isOutlineGenreV1(data: any): data is OutlineGenreV1 {
    return typeof data === 'object' &&
        typeof data.genre === 'string';
}

function isOutlineSellingPointsV1(data: any): data is OutlineSellingPointsV1 {
    return typeof data === 'object' &&
        typeof data.selling_points === 'string';
}

function isOutlineSettingV1(data: any): data is OutlineSettingV1 {
    return typeof data === 'object' &&
        typeof data.setting === 'string';
}

function isOutlineSynopsisV1(data: any): data is OutlineSynopsisV1 {
    return typeof data === 'object' &&
        typeof data.synopsis === 'string';
} 