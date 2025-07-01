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
    isThinking?: boolean;
    metadata?: {
        tokensProcessed?: number;
        startTime?: number;
        endTime?: number;
    };
}

// Reasoning event types
export interface ReasoningEvent {
    type: 'reasoning_start' | 'reasoning_end';
    phase: 'brainstorming' | 'outline' | 'synopsis' | 'script';
    timestamp: number;
    modelName?: string;
}


export interface OutlineGenerateResponse {
    sessionId: string;
    transformId: string;
}

// Brainstorming generation types
export interface BrainstormingGenerateRequest {
    platform: string;
    genrePaths: string[];
    requirements?: string;
}

export interface BrainstormingGenerateResponse {
    ideationRunId: string;
    transformId: string;
}

// Script generation types
export interface ScriptGenerateRequest {
    episodeId: string;
    stageId: string;
    userRequirements?: string;
}

export interface ScriptGenerateResponse {
    sessionId: string;
    transformId: string;
}

export interface DialogueLineV1 {
    character: string;
    line: string;
    direction?: string; // action/emotional direction
}

export interface SceneV1 {
    sceneNumber: number;
    location: string;
    timeOfDay: string;
    characters: string[];
    action: string;
    dialogue: DialogueLineV1[];
}

export interface EpisodeScriptV1 {
    episodeNumber: number;
    stageArtifactId: string;
    episodeGenerationSessionId: string;

    // Script content
    scriptContent: string;
    scenes: SceneV1[];

    // Metadata
    wordCount: number;
    estimatedDuration: number; // in minutes
    generatedAt: string;

    // Source references
    episodeSynopsisArtifactId: string;
    userRequirements?: string;
} 