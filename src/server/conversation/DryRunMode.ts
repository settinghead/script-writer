import { ConversationId, ConversationMessage } from './ConversationManager.js';
import { streamMessageChunk, streamMessageComplete } from './SSEStreamingHelpers.js';

// Dry run configuration
export interface DryRunConfig {
    enabled: boolean;
    simulateLatency: boolean;
    minLatencyMs: number;
    maxLatencyMs: number;
    simulateErrors: boolean;
    errorRate: number; // 0-1, probability of simulated errors
    skipDatabase: boolean;
    skipLLMCalls: boolean;
    skipToolCalls: boolean;
    logOperations: boolean;
    responseTemplates: DryRunResponseTemplates;
}

export interface DryRunResponseTemplates {
    llmResponse: string | ((input: string) => string);
    toolResponse: Record<string, any> | ((toolName: string, parameters: any) => Record<string, any>);
    streamingChunks: string[] | ((input: string) => string[]);
}

// Default dry run configuration
export const DEFAULT_DRY_RUN_CONFIG: DryRunConfig = {
    enabled: false,
    simulateLatency: true,
    minLatencyMs: 100,
    maxLatencyMs: 2000,
    simulateErrors: false,
    errorRate: 0.1,
    skipDatabase: true,
    skipLLMCalls: true,
    skipToolCalls: true,
    logOperations: true,
    responseTemplates: {
        llmResponse: (input: string) => `[DRY RUN] Simulated response for: "${input.substring(0, 50)}..."`,
        toolResponse: (toolName: string, parameters: any) => ({
            success: true,
            message: `[DRY RUN] Simulated ${toolName} execution`,
            parameters,
            timestamp: new Date().toISOString()
        }),
        streamingChunks: (input: string) => [
            '[DRY RUN] ',
            'This is a ',
            'simulated streaming ',
            'response for: ',
            `"${input.substring(0, 30)}..."`
        ]
    }
};

// Global dry run state
let globalDryRunConfig: DryRunConfig = { ...DEFAULT_DRY_RUN_CONFIG };

/**
 * Enable dry run mode with optional configuration
 */
export function enableDryRun(config?: Partial<DryRunConfig>): void {
    globalDryRunConfig = {
        ...DEFAULT_DRY_RUN_CONFIG,
        ...config,
        enabled: true
    };

    console.log('[DryRun] Dry run mode ENABLED');
    console.log('[DryRun] Configuration:', {
        simulateLatency: globalDryRunConfig.simulateLatency,
        simulateErrors: globalDryRunConfig.simulateErrors,
        skipDatabase: globalDryRunConfig.skipDatabase,
        skipLLMCalls: globalDryRunConfig.skipLLMCalls,
        skipToolCalls: globalDryRunConfig.skipToolCalls
    });
}

/**
 * Disable dry run mode
 */
export function disableDryRun(): void {
    globalDryRunConfig.enabled = false;
    console.log('[DryRun] Dry run mode DISABLED');
}

/**
 * Check if dry run mode is enabled
 */
export function isDryRunEnabled(): boolean {
    return globalDryRunConfig.enabled;
}

/**
 * Get current dry run configuration
 */
export function getDryRunConfig(): DryRunConfig {
    return { ...globalDryRunConfig };
}

/**
 * Simulate latency based on configuration
 */
export async function simulateLatency(operationName?: string): Promise<void> {
    if (!globalDryRunConfig.enabled || !globalDryRunConfig.simulateLatency) {
        return;
    }

    const { minLatencyMs, maxLatencyMs } = globalDryRunConfig;
    const latency = Math.random() * (maxLatencyMs - minLatencyMs) + minLatencyMs;

    if (globalDryRunConfig.logOperations) {
        console.log(`[DryRun] Simulating ${Math.round(latency)}ms latency for ${operationName || 'operation'}`);
    }

    await new Promise(resolve => setTimeout(resolve, latency));
}

/**
 * Simulate errors based on configuration
 */
export function simulateError(operationName?: string): Error | null {
    if (!globalDryRunConfig.enabled || !globalDryRunConfig.simulateErrors) {
        return null;
    }

    if (Math.random() < globalDryRunConfig.errorRate) {
        const errorMessage = `[DRY RUN] Simulated error in ${operationName || 'operation'}`;

        if (globalDryRunConfig.logOperations) {
            console.log(`[DryRun] Simulating error: ${errorMessage}`);
        }

        return new Error(errorMessage);
    }

    return null;
}

/**
 * Dry run wrapper for LLM calls
 */
export async function dryRunLLMCall(
    prompt: string,
    conversationId?: ConversationId
): Promise<string> {
    if (!globalDryRunConfig.enabled || !globalDryRunConfig.skipLLMCalls) {
        throw new Error('dryRunLLMCall should only be called in dry run mode');
    }

    if (globalDryRunConfig.logOperations) {
        console.log(`[DryRun] Simulating LLM call for conversation ${conversationId}`);
        console.log(`[DryRun] Prompt: ${prompt.substring(0, 100)}...`);
    }

    // Simulate latency
    await simulateLatency('LLM call');

    // Check for simulated error
    const error = simulateError('LLM call');
    if (error) {
        throw error;
    }

    // Generate response
    const { llmResponse } = globalDryRunConfig.responseTemplates;
    const response = typeof llmResponse === 'function'
        ? llmResponse(prompt)
        : llmResponse;

    if (globalDryRunConfig.logOperations) {
        console.log(`[DryRun] LLM response: ${response}`);
    }

    return response;
}

/**
 * Dry run wrapper for streaming LLM calls
 */
export async function* dryRunLLMStream(
    prompt: string,
    conversationId?: ConversationId
): AsyncGenerator<string, void, unknown> {
    if (!globalDryRunConfig.enabled || !globalDryRunConfig.skipLLMCalls) {
        throw new Error('dryRunLLMStream should only be called in dry run mode');
    }

    if (globalDryRunConfig.logOperations) {
        console.log(`[DryRun] Simulating streaming LLM call for conversation ${conversationId}`);
    }

    // Check for simulated error
    const error = simulateError('LLM streaming');
    if (error) {
        throw error;
    }

    // Generate streaming chunks
    const { streamingChunks } = globalDryRunConfig.responseTemplates;
    const chunks = typeof streamingChunks === 'function'
        ? streamingChunks(prompt)
        : streamingChunks;

    // Stream chunks with simulated latency
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Simulate chunk latency
        if (globalDryRunConfig.simulateLatency) {
            const chunkLatency = Math.random() * 200 + 50; // 50-250ms per chunk
            await new Promise(resolve => setTimeout(resolve, chunkLatency));
        }

        if (globalDryRunConfig.logOperations) {
            console.log(`[DryRun] Streaming chunk ${i + 1}/${chunks.length}: "${chunk}"`);
        }

        // Stream to SSE if conversation ID provided
        if (conversationId) {
            streamMessageChunk(conversationId, `dry-run-msg-${Date.now()}`, chunk, i);
        }

        yield chunk;
    }

    // Send completion event
    if (conversationId) {
        const fullResponse = chunks.join('');
        streamMessageComplete(conversationId, `dry-run-msg-${Date.now()}`, fullResponse);
    }
}

/**
 * Dry run wrapper for tool calls
 */
export async function dryRunToolCall(
    toolName: string,
    parameters: any,
    conversationId?: ConversationId
): Promise<any> {
    if (!globalDryRunConfig.enabled || !globalDryRunConfig.skipToolCalls) {
        throw new Error('dryRunToolCall should only be called in dry run mode');
    }

    if (globalDryRunConfig.logOperations) {
        console.log(`[DryRun] Simulating tool call: ${toolName}`);
        console.log(`[DryRun] Parameters:`, parameters);
    }

    // Simulate latency
    await simulateLatency(`tool call: ${toolName}`);

    // Check for simulated error
    const error = simulateError(`tool call: ${toolName}`);
    if (error) {
        throw error;
    }

    // Generate tool response
    const { toolResponse } = globalDryRunConfig.responseTemplates;
    const response = typeof toolResponse === 'function'
        ? toolResponse(toolName, parameters)
        : toolResponse;

    if (globalDryRunConfig.logOperations) {
        console.log(`[DryRun] Tool response:`, response);
    }

    return response;
}

/**
 * Dry run wrapper for database operations
 */
export async function dryRunDatabaseOperation<T>(
    operationName: string,
    mockResult: T,
    operationId?: string
): Promise<T> {
    if (!globalDryRunConfig.enabled || !globalDryRunConfig.skipDatabase) {
        throw new Error('dryRunDatabaseOperation should only be called in dry run mode');
    }

    if (globalDryRunConfig.logOperations) {
        console.log(`[DryRun] Simulating database operation: ${operationName}`);
        if (operationId) {
            console.log(`[DryRun] Operation ID: ${operationId}`);
        }
    }

    // Simulate latency
    await simulateLatency(`DB: ${operationName}`);

    // Check for simulated error
    const error = simulateError(`DB: ${operationName}`);
    if (error) {
        throw error;
    }

    if (globalDryRunConfig.logOperations) {
        console.log(`[DryRun] Database result:`, mockResult);
    }

    return mockResult;
}

/**
 * Create dry run conversation message
 */
export function createDryRunMessage(
    conversationId: ConversationId,
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string
): ConversationMessage {
    return {
        id: `dry-run-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        conversation_id: conversationId,
        role,
        content,
        model_name: '[DRY RUN]',
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 1000,
        seed: null,
        content_hash: `dry-run-hash-${Date.now()}`,
        cache_hit: false,
        cached_tokens: 0,
        status: 'completed',
        error_message: null,
        metadata: { dryRun: true },
        created_at: new Date(),
        updated_at: new Date(),
        tool_name: role === 'tool' ? 'dry-run-tool' : null,
        tool_call_id: role === 'tool' ? `dry-run-call-${Date.now()}` : null,
        tool_parameters: role === 'tool' ? { simulated: true } : null,
        tool_result: role === 'tool' ? { success: true, simulated: true } : null
    };
}

/**
 * Dry run aware function wrapper
 */
export function createDryRunWrapper<TArgs extends any[], TReturn>(
    realFunction: (...args: TArgs) => Promise<TReturn>,
    dryRunFunction: (...args: TArgs) => Promise<TReturn>,
    operationName?: string
): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
        if (globalDryRunConfig.enabled && globalDryRunConfig.logOperations) {
            console.log(`[DryRun] Intercepting ${operationName || 'operation'}`);
        }

        if (globalDryRunConfig.enabled) {
            return dryRunFunction(...args);
        } else {
            return realFunction(...args);
        }
    };
}

/**
 * Conditional execution based on dry run mode
 */
export async function executeConditionally<T>(
    realOperation: () => Promise<T>,
    dryRunOperation: () => Promise<T>,
    operationName?: string
): Promise<T> {
    if (globalDryRunConfig.enabled) {
        if (globalDryRunConfig.logOperations) {
            console.log(`[DryRun] Executing dry run version of ${operationName || 'operation'}`);
        }
        return dryRunOperation();
    } else {
        return realOperation();
    }
}

/**
 * Create mock data for dry run testing
 */
export class DryRunDataMocker {
    private static conversationCounter = 1;
    private static messageCounter = 1;

    static createMockConversationId(): ConversationId {
        return `dry-run-conv-${this.conversationCounter++}-${Date.now()}`;
    }

    static createMockMessageId(): string {
        return `dry-run-msg-${this.messageCounter++}-${Date.now()}`;
    }

    static createMockConversation(projectId: string, userId: string): any {
        return {
            id: this.createMockConversationId(),
            project_id: projectId,
            type: 'agent',
            status: 'active',
            metadata: { dryRun: true, userId },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }

    static createMockMessages(conversationId: ConversationId, count: number = 3): ConversationMessage[] {
        const messages: ConversationMessage[] = [];

        // User message
        messages.push(createDryRunMessage(conversationId, 'user', '[DRY RUN] User message'));

        // Assistant messages
        for (let i = 1; i < count; i++) {
            messages.push(createDryRunMessage(conversationId, 'assistant', `[DRY RUN] Assistant response ${i}`));
        }

        return messages;
    }

    static createMockLLMResponse(prompt: string): string {
        return `[DRY RUN] Mock LLM response for prompt: "${prompt.substring(0, 50)}..."`;
    }

    static createMockToolResult(toolName: string, parameters: any): any {
        return {
            success: true,
            message: `[DRY RUN] Mock ${toolName} execution completed`,
            data: parameters,
            executionTime: Math.random() * 1000 + 100,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Environment-based dry run configuration
 */
export function configureDryRunFromEnvironment(): void {
    const isDryRunEnv = process.env.DRY_RUN === 'true' || process.env.NODE_ENV === 'test';

    if (isDryRunEnv) {
        const config: Partial<DryRunConfig> = {
            simulateLatency: process.env.DRY_RUN_SIMULATE_LATENCY !== 'false',
            simulateErrors: process.env.DRY_RUN_SIMULATE_ERRORS === 'true',
            errorRate: parseFloat(process.env.DRY_RUN_ERROR_RATE || '0.1'),
            minLatencyMs: parseInt(process.env.DRY_RUN_MIN_LATENCY || '100'),
            maxLatencyMs: parseInt(process.env.DRY_RUN_MAX_LATENCY || '1000'),
            logOperations: process.env.DRY_RUN_LOG !== 'false'
        };

        enableDryRun(config);
    }
}

/**
 * Dry run testing utilities
 */
export const DryRunTestUtils = {
    /**
     * Run a test scenario in dry run mode
     */
    async runTestScenario<T>(
        scenario: () => Promise<T>,
        config?: Partial<DryRunConfig>
    ): Promise<T> {
        const originalConfig = getDryRunConfig();

        try {
            enableDryRun(config);
            return await scenario();
        } finally {
            if (originalConfig.enabled) {
                enableDryRun(originalConfig);
            } else {
                disableDryRun();
            }
        }
    },

    /**
     * Assert that operations were simulated
     */
    assertDryRunExecuted(operationLog: string[]): void {
        const dryRunOperations = operationLog.filter(log => log.includes('[DryRun]'));
        if (dryRunOperations.length === 0) {
            throw new Error('Expected dry run operations but none were found');
        }
    },

    /**
     * Measure dry run performance
     */
    async measureDryRunPerformance<T>(
        operation: () => Promise<T>
    ): Promise<{ result: T; durationMs: number; operationCount: number }> {
        const startTime = Date.now();
        let operationCount = 0;

        // Intercept console.log to count operations
        const originalConsoleLog = console.log;
        console.log = (...args) => {
            if (args[0] && args[0].includes('[DryRun]')) {
                operationCount++;
            }
            originalConsoleLog(...args);
        };

        try {
            const result = await operation();
            const durationMs = Date.now() - startTime;

            return { result, durationMs, operationCount };
        } finally {
            console.log = originalConsoleLog;
        }
    }
}; 