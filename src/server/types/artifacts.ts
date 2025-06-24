// ========== TRANSITION: Re-export from common types ==========
// TODO: Gradually migrate all server imports to use ../../common/types directly

export * from '../../common/types';
import type { OutlineCharacter, OutlineCharactersV1 } from '../../common/types';

// ========== LEGACY: These will be removed once migration is complete ==========

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

// Base artifact interface
export interface Artifact {
    id: string;
    project_id: string;
    type: string;
    type_version: string;
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
    sourceArtifactId: string;
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
    source_artifact_id?: string; // ID of the original artifact this was derived from
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

// New episode generation artifact types
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
    keyEvents: string[];  // 2-3 key events per episode
    hooks: string;        // End-of-episode hook to next episode
    stageArtifactId: string;
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
    stageArtifactId: string;
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
    episodeSynopsisArtifactId: string;
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

// Type guards for artifact data validation
// Add to existing validateArtifactData function
import { ARTIFACT_SCHEMAS } from '../../common/schemas/artifacts';

export function validateArtifactData(type: string, typeVersion: string, data: any): boolean {
    // Use Zod schemas for new artifact types
    if (type in ARTIFACT_SCHEMAS) {
        const schema = ARTIFACT_SCHEMAS[type as keyof typeof ARTIFACT_SCHEMAS];
        const result = schema.safeParse(data);
        return result.success;
    }

    // Fallback to existing validation for legacy types
    switch (`${type}:${typeVersion}`) {
        case 'ideation_session:v1':
            return isIdeationSessionV1(data);
        case 'brainstorm_params:v1':
            return isBrainstormParamsV1(data);
        case 'brainstorm_idea:v1':
            return isBrainstormIdeaV1(data);
        case 'brainstorming_job_params:v1':
            return isBrainstormingJobParamsV1(data);
        case 'brainstorm_tool_input:v1':
            return isBrainstormToolInputV1(data);
        case 'brainstorm_idea_collection:v1':
            return isBrainstormIdeaCollectionV1(data);
        case 'outline_job_params:v1':
            return isOutlineJobParamsV1(data);
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
        case 'outline_characters:v1':
            return isOutlineCharactersV1(data);
        case 'outline_target_audience:v1':
            return isOutlineTargetAudienceV1(data);
        case 'outline_satisfaction_points:v1':
            return isOutlineSatisfactionPointsV1(data);
        case 'outline_synopsis_stages:v1':
            return isOutlineSynopsisStagesV1(data);
        case 'outline_synopsis_stage:v1':
            return isOutlineSynopsisStageV1(data);
        case 'episode_generation_session:v1':
            return isEpisodeGenerationSessionV1(data);
        case 'episode_synopsis:v1':
            return isEpisodeSynopsisV1(data);
        case 'episode_generation_params:v1':
            return isEpisodeGenerationParamsV1(data);
        case 'script_generation_job_params:v1':
            return isScriptGenerationJobParamsV1(data);
        case 'episode_script:v1':
            return isEpisodeScriptV1(data);
        // Edit artifact types
        case 'title_edit:v1':
            return isOutlineTitleEditV1(data);
        case 'genre_edit:v1':
            return isOutlineGenreEditV1(data);
        case 'selling_points_edit:v1':
            return isOutlineSellingPointsEditV1(data);
        case 'setting_edit:v1':
            return isOutlineSettingEditV1(data);
        case 'synopsis_edit:v1':
            return isOutlineSynopsisEditV1(data);
        case 'target_audience_edit:v1':
            return isOutlineTargetAudienceEditV1(data);
        case 'satisfaction_points_edit:v1':
            return isOutlineSatisfactionPointsEditV1(data);
        case 'characters_edit:v1':
            return isOutlineCharactersEditV1(data);
        case 'synopsis_stages_edit:v1':
            return isOutlineSynopsisStagesEditV1(data);
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
        typeof data.requirements === 'string';
}

function isBrainstormIdeaV1(data: any): data is BrainstormIdeaV1 {
    return typeof data === 'object' &&
        typeof data.idea_text === 'string' &&
        typeof data.order_index === 'number' &&
        (data.idea_title === undefined || typeof data.idea_title === 'string');
}

function isBrainstormingJobParamsV1(data: any): data is BrainstormingJobParamsV1 {
    return typeof data === 'object' &&
        typeof data.platform === 'string' &&
        Array.isArray(data.genrePaths) &&
        typeof data.requirements === 'string' &&
        typeof data.requestedAt === 'string';
}

function isBrainstormToolInputV1(data: any): data is BrainstormToolInputV1 {
    return typeof data === 'object' &&
        typeof data.platform === 'string' &&
        typeof data.genre === 'string' &&
        (data.other_requirements === undefined || typeof data.other_requirements === 'string');
}

function isBrainstormIdeaCollectionV1(data: any): data is BrainstormIdeaCollectionV1 {
    return Array.isArray(data) &&
        data.every((idea: any) =>
            typeof idea === 'object' &&
            typeof idea.title === 'string' &&
            typeof idea.body === 'string'
        );
}

function isOutlineJobParamsV1(data: any): data is OutlineJobParamsV1 {
    return typeof data === 'object' &&
        typeof data.sourceArtifactId === 'string' &&
        (typeof data.totalEpisodes === 'number' || data.totalEpisodes === undefined) &&
        (typeof data.episodeDuration === 'number' || data.episodeDuration === undefined) &&
        typeof data.requestedAt === 'string';
}

function isUserInputV1(data: any): data is UserInputV1 {
    return typeof data === 'object' &&
        typeof data.text === 'string' &&
        ['manual', 'modified_brainstorm'].includes(data.source);
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

function isOutlineTargetAudienceV1(data: any): data is OutlineTargetAudienceV1 {
    return typeof data === 'object' &&
        typeof data.demographic === 'string' &&
        Array.isArray(data.core_themes);
}

function isOutlineSatisfactionPointsV1(data: any): data is OutlineSatisfactionPointsV1 {
    return typeof data === 'object' &&
        Array.isArray(data.satisfaction_points);
}

function isOutlineSynopsisStagesV1(data: any): data is OutlineSynopsisStagesV1 {
    return typeof data === 'object' &&
        Array.isArray(data.synopsis_stages);
}

function isOutlineSynopsisV1(data: any): data is OutlineSynopsisV1 {
    return typeof data === 'object' &&
        typeof data.synopsis === 'string';
}

function isOutlineCharactersV1(data: any): data is OutlineCharactersV1 {
    return typeof data === 'object' &&
        Array.isArray(data.characters) &&
        data.characters.every((character: any) => isOutlineCharacter(character));
}

function isOutlineCharacter(data: any): data is OutlineCharacter {
    const validTypes = ['male_lead', 'female_lead', 'male_second', 'female_second', 'male_supporting', 'female_supporting', 'antagonist', 'other'];

    return typeof data === 'object' &&
        typeof data.name === 'string' &&
        validTypes.includes(data.type) &&
        typeof data.description === 'string' &&
        (data.age === undefined || typeof data.age === 'string') &&
        (data.gender === undefined || typeof data.gender === 'string') &&
        (data.occupation === undefined || typeof data.occupation === 'string') &&
        (data.personality_traits === undefined || Array.isArray(data.personality_traits)) &&
        (data.character_arc === undefined || typeof data.character_arc === 'string') &&
        (data.relationships === undefined || (typeof data.relationships === 'object' && data.relationships !== null)) &&
        (data.key_scenes === undefined || Array.isArray(data.key_scenes));
}

function isOutlineSettingV1(data: any): data is OutlineSettingV1 {
    return typeof data === 'object' &&
        typeof data.setting === 'string';
}

function isOutlineSynopsisStageV1(data: any): data is OutlineSynopsisStageV1 {
    return typeof data === 'object' &&
        typeof data.stageNumber === 'number' &&
        typeof data.stageSynopsis === 'string' &&
        typeof data.numberOfEpisodes === 'number' &&
        typeof data.outlineSessionId === 'string';
}

function isEpisodeGenerationSessionV1(data: any): data is EpisodeGenerationSessionV1 {
    return typeof data === 'object' &&
        typeof data.id === 'string' &&
        typeof data.outlineSessionId === 'string' &&
        typeof data.stageArtifactId === 'string' &&
        ['active', 'completed', 'failed'].includes(data.status) &&
        typeof data.totalEpisodes === 'number' &&
        typeof data.episodeDuration === 'number';
}

function isEpisodeSynopsisV1(data: any): data is EpisodeSynopsisV1 {
    const isValid = typeof data === 'object' &&
        typeof data.episodeNumber === 'number' &&
        typeof data.title === 'string' &&
        typeof data.briefSummary === 'string' &&
        Array.isArray(data.keyEvents) &&
        typeof data.hooks === 'string' &&
        typeof data.stageArtifactId === 'string' &&
        typeof data.episodeGenerationSessionId === 'string';

    if (!isValid) return false;

    // Validate optional emotionDevelopments field
    if (data.emotionDevelopments !== undefined) {
        if (!Array.isArray(data.emotionDevelopments)) return false;
        for (const dev of data.emotionDevelopments) {
            if (typeof dev !== 'object' ||
                !Array.isArray(dev.characters) ||
                typeof dev.content !== 'string') {
                return false;
            }
        }
    }

    // Validate optional relationshipDevelopments field
    if (data.relationshipDevelopments !== undefined) {
        if (!Array.isArray(data.relationshipDevelopments)) return false;
        for (const dev of data.relationshipDevelopments) {
            if (typeof dev !== 'object' ||
                !Array.isArray(dev.characters) ||
                typeof dev.content !== 'string') {
                return false;
            }
        }
    }

    return true;
}

function isEpisodeGenerationParamsV1(data: any): data is EpisodeGenerationParamsV1 {
    return typeof data === 'object' &&
        typeof data.stageArtifactId === 'string' &&
        typeof data.numberOfEpisodes === 'number' &&
        typeof data.stageSynopsis === 'string' &&
        (data.customRequirements === undefined || typeof data.customRequirements === 'string');
}

function isScriptGenerationJobParamsV1(data: any): data is ScriptGenerationJobParamsV1 {
    return typeof data === 'object' &&
        typeof data.platform === 'string' &&
        Array.isArray(data.genre_paths) &&
        typeof data.requirements === 'string' &&
        typeof data.totalEpisodes === 'number' &&
        typeof data.episodeDuration === 'number' &&
        typeof data.episode_synopsis === 'string' &&
        typeof data.characters_info === 'string' &&
        typeof data.user_requirements === 'string' &&
        typeof data.episode_number === 'number';
}

function isEpisodeScriptV1(data: any): data is EpisodeScriptV1 {
    return typeof data === 'object' &&
        typeof data.episodeNumber === 'number' &&
        typeof data.stageArtifactId === 'string' &&
        typeof data.episodeGenerationSessionId === 'string' &&
        typeof data.scriptContent === 'string' &&
        Array.isArray(data.scenes) &&
        typeof data.wordCount === 'number' &&
        typeof data.estimatedDuration === 'number' &&
        typeof data.generatedAt === 'string' &&
        typeof data.episodeSynopsisArtifactId === 'string' &&
        (data.userRequirements === undefined || typeof data.userRequirements === 'string');
}

// Edit artifact validation functions
function isOutlineTitleEditV1(data: any): boolean {
    return typeof data === 'object' &&
        typeof data.title === 'string' &&
        typeof data.outline_session_id === 'string' &&
        typeof data.edited_at === 'string';
}

function isOutlineGenreEditV1(data: any): boolean {
    return typeof data === 'object' &&
        typeof data.genre === 'string' &&
        typeof data.outline_session_id === 'string' &&
        typeof data.edited_at === 'string';
}

function isOutlineSellingPointsEditV1(data: any): boolean {
    if (typeof data !== 'object' ||
        typeof data.outline_session_id !== 'string' ||
        typeof data.edited_at !== 'string') {
        return false;
    }

    // Accept both string and array for selling_points, as well as stringified JSON
    if (typeof data.selling_points === 'string' || Array.isArray(data.selling_points)) {
        return true;
    }

    return false;
}

function isOutlineSettingEditV1(data: any): boolean {
    if (typeof data !== 'object' ||
        typeof data.outline_session_id !== 'string' ||
        typeof data.edited_at !== 'string') {
        return false;
    }

    // Accept both string and object for setting, as well as stringified JSON
    if (typeof data.setting === 'string' ||
        (typeof data.setting === 'object' && data.setting !== null)) {
        return true;
    }

    return false;
}

function isOutlineSynopsisEditV1(data: any): boolean {
    return typeof data === 'object' &&
        typeof data.synopsis === 'string' &&
        typeof data.outline_session_id === 'string' &&
        typeof data.edited_at === 'string';
}

function isOutlineTargetAudienceEditV1(data: any): boolean {
    if (typeof data !== 'object' ||
        typeof data.outline_session_id !== 'string' ||
        typeof data.edited_at !== 'string') {
        return false;
    }

    // Accept both object and stringified JSON for target_audience
    if (typeof data.target_audience === 'object' && data.target_audience !== null) {
        return true;
    }

    if (typeof data.target_audience === 'string') {
        try {
            const parsed = JSON.parse(data.target_audience);
            return typeof parsed === 'object' && parsed !== null;
        } catch {
            // If it's not JSON, accept it as plain string as well for flexibility
            return true;
        }
    }

    return false;
}

function isOutlineSatisfactionPointsEditV1(data: any): boolean {
    if (typeof data !== 'object' ||
        typeof data.outline_session_id !== 'string' ||
        typeof data.edited_at !== 'string') {
        return false;
    }

    // Accept both array and stringified JSON for satisfaction_points
    if (Array.isArray(data.satisfaction_points)) {
        return true;
    }

    if (typeof data.satisfaction_points === 'string') {
        try {
            const parsed = JSON.parse(data.satisfaction_points);
            return Array.isArray(parsed);
        } catch {
            // If it's not JSON, accept it as plain string as well for flexibility
            return true;
        }
    }

    return false;
}

function isOutlineCharactersEditV1(data: any): boolean {
    if (typeof data !== 'object' ||
        typeof data.outline_session_id !== 'string' ||
        typeof data.edited_at !== 'string') {
        return false;
    }

    // Accept both array and stringified JSON for characters
    if (Array.isArray(data.characters)) {
        return true;
    }

    if (typeof data.characters === 'string') {
        try {
            const parsed = JSON.parse(data.characters);
            return Array.isArray(parsed);
        } catch {
            // If it's not JSON, accept it as plain string as well for flexibility
            return true;
        }
    }

    return false;
}

function isOutlineSynopsisStagesEditV1(data: any): boolean {
    if (typeof data !== 'object' ||
        typeof data.outline_session_id !== 'string' ||
        typeof data.edited_at !== 'string') {
        return false;
    }

    // Accept both array and stringified JSON for synopsis_stages
    if (Array.isArray(data.synopsis_stages)) {
        return true;
    }

    if (typeof data.synopsis_stages === 'string') {
        try {
            const parsed = JSON.parse(data.synopsis_stages);
            return Array.isArray(parsed);
        } catch {
            // If it's not JSON, accept it as plain string as well for flexibility
            return true;
        }
    }

    return false;
} 