import { JsondocSchemaRegistry } from './schemas/jsondocs';
import { TypedJsondoc } from './types';

// ========== SHARED TYPES FOR CLIENT AND SERVER ==========
// Base jsondoc interface

export interface Jsondoc {
    id: string;
    project_id: string;

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
    project_id: string;
    type: 'llm' | 'human' | 'ai_patch' | 'human_patch_approval';
    type_version: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    retry_count: number;
    max_retries: number;
    execution_context?: any;
    created_at: string;
    tool_call_id?: string | null;
}

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
// Helper type for creating strongly typed jsondocs
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



export interface JsondocWithData<
    SchemaType extends string, SchemaVersion extends string, Data> extends Omit<Jsondoc, 'schema_type' | 'schema_version' | 'data'> {
    schema_type: SchemaType;
    schema_version: SchemaVersion;
    data: Data;
}
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
    // Human-readable project title - now required and the primary display name
    title: string;
    // Whether the title has been manually overridden by user
    project_title_manual_override?: boolean;
    description?: string;
    project_type: string;
    status: string;
    created_at: string;
}

// Extended project interface for UI display with additional computed fields
export interface ProjectSummary {
    id: string;
    title: string;
    project_title_manual_override: boolean;
    description: string;
    currentPhase: 'brainstorming' | 'outline' | 'episodes' | 'scripts';
    status: 'active' | 'completed' | 'failed';
    platform?: string;
    genre?: string;
    createdAt: string;
    updatedAt: string;
    jsondocCounts: {
        ideations: number;
        outlines: number;
        episodes: number;
        scripts: number;
    };
}

export interface ProjectUser {
    id: number;
    project_id: string;
    user_id: string;
    role: 'owner' | 'collaborator' | 'viewer';
    joined_at: string;
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
