import { ConversationId } from './ConversationManager.js';
import { streamError } from './SSEStreamingHelpers.js';

// Retry configuration types
export interface RetryConfig {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffStrategy: 'exponential' | 'linear' | 'fixed';
    backoffMultiplier: number;
    jitter: boolean;
    retryableErrors: string[];
    onRetry?: (error: Error, attempt: number, nextDelayMs: number) => void;
    onMaxRetriesReached?: (error: Error, totalAttempts: number) => void;
}

// Default retry configurations
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffStrategy: 'exponential',
    backoffMultiplier: 2,
    jitter: true,
    retryableErrors: [
        'rate limit',
        'timeout',
        'network',
        'connection',
        'service unavailable',
        'internal server error',
        'temporary failure'
    ]
};

export const LLM_RETRY_CONFIG: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    maxRetries: 4,
    initialDelayMs: 500,
    maxDelayMs: 15000,
    retryableErrors: [
        'rate limit',
        'timeout',
        'model overloaded',
        'service unavailable',
        'temporary failure',
        'stream interrupted'
    ]
};

export const DATABASE_RETRY_CONFIG: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    maxRetries: 5,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    backoffStrategy: 'exponential',
    retryableErrors: [
        'connection',
        'timeout',
        'deadlock',
        'lock timeout',
        'temporary failure'
    ]
};

// Retry result types
export interface RetrySuccess<T> {
    success: true;
    result: T;
    attempts: number;
    totalDelayMs: number;
    lastError?: never;
}

export interface RetryFailure {
    success: false;
    result?: never;
    attempts: number;
    totalDelayMs: number;
    lastError: Error;
    allErrors: Error[];
}

export type RetryResult<T> = RetrySuccess<T> | RetryFailure;

// Error classification
export function isRetryableError(error: Error, retryableErrors: string[]): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    return retryableErrors.some(pattern =>
        errorMessage.includes(pattern.toLowerCase()) ||
        errorName.includes(pattern.toLowerCase())
    );
}

// Delay calculation functions
export function calculateDelay(
    attempt: number,
    config: RetryConfig
): number {
    let delay: number;

    switch (config.backoffStrategy) {
        case 'exponential':
            delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
            break;
        case 'linear':
            delay = config.initialDelayMs + (config.backoffMultiplier * (attempt - 1) * config.initialDelayMs);
            break;
        case 'fixed':
        default:
            delay = config.initialDelayMs;
            break;
    }

    // Apply maximum delay limit
    delay = Math.min(delay, config.maxDelayMs);

    // Apply jitter to prevent thundering herd
    if (config.jitter) {
        const jitterRange = delay * 0.1; // 10% jitter
        const jitter = (Math.random() - 0.5) * 2 * jitterRange;
        delay = Math.max(0, delay + jitter);
    }

    return Math.round(delay);
}

// Async delay utility
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Core retry function
export async function withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = DEFAULT_RETRY_CONFIG,
    context?: {
        conversationId?: ConversationId;
        operationName?: string;
    }
): Promise<RetryResult<T>> {
    const allErrors: Error[] = [];
    let totalDelayMs = 0;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
        try {
            const result = await operation();

            // Success
            return {
                success: true,
                result,
                attempts: attempt,
                totalDelayMs
            };

        } catch (error) {
            const currentError = error as Error;
            allErrors.push(currentError);

            console.log(`[Retry] Attempt ${attempt} failed:`, {
                operation: context?.operationName || 'unknown',
                conversationId: context?.conversationId,
                error: currentError.message,
                isRetryable: isRetryableError(currentError, config.retryableErrors)
            });

            // Check if we should retry
            const isLastAttempt = attempt === config.maxRetries + 1;
            const shouldRetry = !isLastAttempt && isRetryableError(currentError, config.retryableErrors);

            if (!shouldRetry) {
                // Don't retry - either not retryable or max attempts reached
                if (isLastAttempt && config.onMaxRetriesReached) {
                    config.onMaxRetriesReached(currentError, attempt);
                }

                // Stream error if conversation context available
                if (context?.conversationId) {
                    streamError(
                        context.conversationId,
                        `Operation failed after ${attempt} attempts: ${currentError.message}`,
                        'retry_exhausted'
                    );
                }

                return {
                    success: false,
                    attempts: attempt,
                    totalDelayMs,
                    lastError: currentError,
                    allErrors
                };
            }

            // Calculate delay for next retry
            const nextDelayMs = calculateDelay(attempt, config);
            totalDelayMs += nextDelayMs;

            // Call retry callback
            if (config.onRetry) {
                config.onRetry(currentError, attempt, nextDelayMs);
            }

            console.log(`[Retry] Retrying in ${nextDelayMs}ms (attempt ${attempt + 1}/${config.maxRetries + 1})`);

            // Wait before retry
            await delay(nextDelayMs);
        }
    }

    // This should never be reached due to the loop logic above
    const lastError = allErrors[allErrors.length - 1] || new Error('Unknown retry error');
    return {
        success: false,
        attempts: config.maxRetries + 1,
        totalDelayMs,
        lastError,
        allErrors
    };
}

// Specialized retry functions for common operations

/**
 * Retry LLM operations with appropriate configuration
 */
export async function withLLMRetry<T>(
    operation: () => Promise<T>,
    conversationId?: ConversationId,
    operationName: string = 'LLM call'
): Promise<RetryResult<T>> {
    const config: RetryConfig = {
        ...LLM_RETRY_CONFIG,
        onRetry: (error, attempt, nextDelayMs) => {
            console.log(`[LLM Retry] ${operationName} failed (attempt ${attempt}):`, error.message);
            console.log(`[LLM Retry] Next attempt in ${nextDelayMs}ms`);

            if (conversationId) {
                streamError(
                    conversationId,
                    `${operationName} failed, retrying in ${Math.round(nextDelayMs / 1000)}s...`,
                    'llm_retry'
                );
            }
        },
        onMaxRetriesReached: (error, totalAttempts) => {
            console.error(`[LLM Retry] ${operationName} failed permanently after ${totalAttempts} attempts:`, error);
        }
    };

    return withRetry(operation, config, {
        conversationId,
        operationName
    });
}

/**
 * Retry database operations with appropriate configuration
 */
export async function withDatabaseRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'Database operation'
): Promise<RetryResult<T>> {
    const config: RetryConfig = {
        ...DATABASE_RETRY_CONFIG,
        onRetry: (error, attempt, nextDelayMs) => {
            console.log(`[DB Retry] ${operationName} failed (attempt ${attempt}):`, error.message);
            console.log(`[DB Retry] Next attempt in ${nextDelayMs}ms`);
        },
        onMaxRetriesReached: (error, totalAttempts) => {
            console.error(`[DB Retry] ${operationName} failed permanently after ${totalAttempts} attempts:`, error);
        }
    };

    return withRetry(operation, config, {
        operationName
    });
}

/**
 * Retry network operations with appropriate configuration
 */
export async function withNetworkRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'Network operation'
): Promise<RetryResult<T>> {
    const networkConfig: RetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        maxRetries: 3,
        initialDelayMs: 2000,
        maxDelayMs: 10000,
        retryableErrors: [
            'timeout',
            'network',
            'connection',
            'ECONNRESET',
            'ENOTFOUND',
            'ECONNREFUSED',
            'fetch failed'
        ],
        onRetry: (error, attempt, nextDelayMs) => {
            console.log(`[Network Retry] ${operationName} failed (attempt ${attempt}):`, error.message);
        }
    };

    return withRetry(operation, networkConfig, {
        operationName
    });
}

// Circuit breaker pattern for enhanced reliability
interface CircuitBreakerState {
    failures: number;
    lastFailureTime: number;
    state: 'closed' | 'open' | 'half-open';
}

export class CircuitBreaker {
    private states = new Map<string, CircuitBreakerState>();

    constructor(
        private failureThreshold: number = 5,
        private recoveryTimeMs: number = 60000,
        private successThreshold: number = 2
    ) { }

    async execute<T>(
        operationId: string,
        operation: () => Promise<T>
    ): Promise<T> {
        const state = this.getState(operationId);

        // Check if circuit is open
        if (state.state === 'open') {
            const timeSinceLastFailure = Date.now() - state.lastFailureTime;
            if (timeSinceLastFailure < this.recoveryTimeMs) {
                throw new Error(`Circuit breaker is OPEN for ${operationId}. Try again later.`);
            } else {
                // Transition to half-open
                state.state = 'half-open';
                console.log(`[Circuit Breaker] ${operationId} transitioning to HALF-OPEN`);
            }
        }

        try {
            const result = await operation();

            // Success - handle state transitions
            if (state.state === 'half-open') {
                state.failures = 0;
                state.state = 'closed';
                console.log(`[Circuit Breaker] ${operationId} transitioning to CLOSED`);
            } else if (state.state === 'closed') {
                state.failures = Math.max(0, state.failures - 1);
            }

            return result;

        } catch (error) {
            state.failures++;
            state.lastFailureTime = Date.now();

            if (state.failures >= this.failureThreshold) {
                state.state = 'open';
                console.log(`[Circuit Breaker] ${operationId} transitioning to OPEN after ${state.failures} failures`);
            }

            throw error;
        }
    }

    private getState(operationId: string): CircuitBreakerState {
        if (!this.states.has(operationId)) {
            this.states.set(operationId, {
                failures: 0,
                lastFailureTime: 0,
                state: 'closed'
            });
        }

        return this.states.get(operationId)!;
    }

    getStatus(operationId: string): CircuitBreakerState {
        return { ...this.getState(operationId) };
    }

    reset(operationId: string): void {
        this.states.set(operationId, {
            failures: 0,
            lastFailureTime: 0,
            state: 'closed'
        });
        console.log(`[Circuit Breaker] Reset ${operationId} to CLOSED`);
    }
}

// Global circuit breaker instance
export const globalCircuitBreaker = new CircuitBreaker();

/**
 * Combine retry mechanism with circuit breaker
 */
export async function withRetryAndCircuitBreaker<T>(
    operationId: string,
    operation: () => Promise<T>,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
    circuitBreaker: CircuitBreaker = globalCircuitBreaker
): Promise<RetryResult<T>> {
    const wrappedOperation = () => circuitBreaker.execute(operationId, operation);

    return withRetry(wrappedOperation, retryConfig, {
        operationName: operationId
    });
}

// Utility functions for error analysis
export function analyzeRetryResult<T>(result: RetryResult<T>): {
    succeeded: boolean;
    efficiency: number; // 0-1, how quickly it succeeded
    errorTypes: string[];
    recommendations: string[];
} {
    const analysis = {
        succeeded: result.success,
        efficiency: result.success ? 1 / result.attempts : 0,
        errorTypes: [] as string[],
        recommendations: [] as string[]
    };

    if (!result.success) {
        // Analyze error types
        const errors = result.allErrors.map(e => e.message.toLowerCase());
        const uniqueErrorTypes = [...new Set(errors)];
        analysis.errorTypes = uniqueErrorTypes;

        // Generate recommendations
        if (uniqueErrorTypes.some(e => e.includes('rate limit'))) {
            analysis.recommendations.push('Consider implementing request queuing or reducing request frequency');
        }

        if (uniqueErrorTypes.some(e => e.includes('timeout'))) {
            analysis.recommendations.push('Consider increasing timeout values or optimizing operation performance');
        }

        if (uniqueErrorTypes.some(e => e.includes('network'))) {
            analysis.recommendations.push('Check network connectivity and consider using redundant endpoints');
        }

        if (result.attempts > 3) {
            analysis.recommendations.push('Consider using circuit breaker pattern to prevent cascade failures');
        }
    }

    return analysis;
}

/**
 * Create a retry-aware wrapper for any async function
 */
export function createRetryWrapper<TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    config: RetryConfig = DEFAULT_RETRY_CONFIG,
    operationName?: string
): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
        const operation = () => fn(...args);
        const result = await withRetry(operation, config, {
            operationName: operationName || fn.name
        });

        if (result.success) {
            return result.result;
        } else {
            throw result.lastError;
        }
    };
} 