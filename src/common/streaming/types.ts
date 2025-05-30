export interface StreamingRequest<TParams = any> {
    artifactIds: string[];              // Input artifact IDs
    templateId: string;                 // Template to use
    templateParams?: TParams;           // Additional params for template
    modelName?: string;                 // LLM model to use
    streamConfig?: StreamConfig;
}

export interface StreamConfig {
    debounceMs?: number;               // Debounce for parsing (default: 50)
    completionTimeoutMs?: number;      // Stability timeout (default: 2000)
    maxRetries?: number;               // Max retry attempts
}

export interface StreamingResponse<T> {
    status: 'idle' | 'streaming' | 'completed' | 'error';
    items: T[];
    rawContent?: string;
    error?: Error;
    metadata?: {
        tokensProcessed?: number;
        startTime?: number;
        endTime?: number;
    };
}

// Outline generation types
export interface OutlineGenerateRequest {
    sourceArtifactId: string;
    totalEpisodes?: number;
    episodeDuration?: number;
}

export interface OutlineGenerateResponse {
    sessionId: string;
    transformId: string;
}

// Brainstorming generation types
export interface BrainstormingGenerateRequest {
    platform: string;
    genrePaths: string[];
    genreProportions: number[];
    requirements?: string;
}

export interface BrainstormingGenerateResponse {
    ideationRunId: string;
    transformId: string;
} 