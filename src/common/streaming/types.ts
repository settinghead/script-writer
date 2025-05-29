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