export interface LLMTemplate {
    id: string;
    name: string;
    promptTemplate: string;
    outputFormat: 'json' | 'json_array' | 'text';
    responseWrapper?: string;           // e.g., '```json'
    variables: string[];               // Required template variables
}

export interface TemplateContext {
    artifacts: Record<string, any>;    // Artifact data by role/key
    params: Record<string, any>;       // Additional parameters
} 