import { ConversationId, ConversationMessage } from './ConversationManager.js';
import {
    streamError,
    streamToolCall,
    streamCacheHit,
    type SSEConnection
} from './SSEStreamingHelpers.js';

// Core middleware types
export type MiddlewareNext = () => Promise<void> | void;

export interface ConversationContext {
    conversationId: ConversationId;
    projectId: string;
    userId: string;
    messages: ConversationMessage[];
    metadata: Record<string, any>;
    sseConnection?: SSEConnection;

    // Request/response data
    request: {
        userMessage: string;
        systemPrompt?: string;
        temperature?: number;
        maxTokens?: number;
        tools?: Record<string, any>;
    };

    response: {
        content: string;
        toolCalls: Array<{
            name: string;
            id: string;
            parameters: any;
            result?: any;
        }>;
        cacheHit: boolean;
        cachedTokens: number;
    };

    // Execution state
    startTime: Date;
    endTime?: Date;
    error?: Error;
    retryCount: number;
    isDryRun: boolean;
}

export type ConversationMiddleware = (
    context: ConversationContext,
    next: MiddlewareNext
) => Promise<void> | void;

// Middleware execution pipeline
export class MiddlewarePipeline {
    private middleware: ConversationMiddleware[] = [];

    constructor(middleware: ConversationMiddleware[] = []) {
        this.middleware = [...middleware];
    }

    /**
     * Add middleware to the pipeline
     */
    use(middleware: ConversationMiddleware): MiddlewarePipeline {
        this.middleware.push(middleware);
        return this;
    }

    /**
     * Execute the middleware pipeline
     */
    async execute(context: ConversationContext): Promise<void> {
        let index = 0;

        const dispatch = async (): Promise<void> => {
            if (index >= this.middleware.length) {
                return;
            }

            const middleware = this.middleware[index++];

            const next = async (): Promise<void> => {
                await dispatch();
            };

            await middleware(context, next);
        };

        await dispatch();
    }

    /**
     * Create a new pipeline with additional middleware
     */
    compose(...additionalMiddleware: ConversationMiddleware[]): MiddlewarePipeline {
        return new MiddlewarePipeline([...this.middleware, ...additionalMiddleware]);
    }
}

// Built-in middleware functions

/**
 * Logging middleware - logs conversation events
 */
export const loggingMiddleware: ConversationMiddleware = async (context, next) => {
    const { conversationId, userId, request } = context;

    console.log(`[Conversation] Started: ${conversationId} for user ${userId}`);
    console.log(`[Conversation] User message: ${request.userMessage.substring(0, 100)}...`);

    try {
        await next();

        const duration = context.endTime
            ? context.endTime.getTime() - context.startTime.getTime()
            : 0;

        console.log(`[Conversation] Completed: ${conversationId} in ${duration}ms`);

        if (context.response.cacheHit) {
            console.log(`[Conversation] Cache hit: ${context.response.cachedTokens} tokens cached`);
        }

    } catch (error) {
        console.error(`[Conversation] Error in ${conversationId}:`, error);
        throw error;
    }
};

/**
 * Authentication middleware - validates user access
 */
export const authenticationMiddleware: ConversationMiddleware = async (context, next) => {
    const { userId, projectId } = context;

    if (!userId) {
        throw new Error('User authentication required');
    }

    if (!projectId) {
        throw new Error('Project ID required');
    }

    // Here you would typically validate user access to the project
    // For now, we'll just log the validation
    console.log(`[Auth] Validated access: user ${userId} to project ${projectId}`);

    await next();
};

/**
 * Rate limiting middleware - prevents abuse
 */
export function createRateLimitingMiddleware(
    maxRequestsPerMinute: number = 60,
    windowMs: number = 60000
): ConversationMiddleware {
    const requestCounts = new Map<string, { count: number; resetTime: number }>();

    return async (context, next) => {
        const { userId } = context;
        const now = Date.now();

        // Clean up expired entries
        for (const [key, data] of requestCounts.entries()) {
            if (now > data.resetTime) {
                requestCounts.delete(key);
            }
        }

        // Check rate limit
        const userLimit = requestCounts.get(userId);
        if (userLimit) {
            if (userLimit.count >= maxRequestsPerMinute) {
                throw new Error(`Rate limit exceeded: ${maxRequestsPerMinute} requests per minute`);
            }
            userLimit.count++;
        } else {
            requestCounts.set(userId, {
                count: 1,
                resetTime: now + windowMs
            });
        }

        await next();
    };
}

/**
 * User context injection middleware - adds user context to system prompt
 */
export const userContextMiddleware: ConversationMiddleware = async (context, next) => {
    const { userId, projectId, request } = context;

    // Inject user context into system prompt
    const userContextPrompt = `\n\n[User Context: User ID ${userId}, Project ID ${projectId}, Timestamp: ${new Date().toISOString()}]`;

    if (request.systemPrompt) {
        request.systemPrompt += userContextPrompt;
    } else {
        request.systemPrompt = `You are a helpful assistant.${userContextPrompt}`;
    }

    await next();
};

/**
 * Content filtering middleware - filters inappropriate content
 */
export const contentFilteringMiddleware: ConversationMiddleware = async (context, next) => {
    const { request } = context;

    // Basic content filtering (replace with actual filtering service)
    const inappropriatePatterns = [
        /\b(explicit_content|harmful_content)\b/gi
    ];

    for (const pattern of inappropriatePatterns) {
        if (pattern.test(request.userMessage)) {
            throw new Error('Content filtered: Inappropriate content detected');
        }
    }

    await next();

    // Also filter response content
    for (const pattern of inappropriatePatterns) {
        if (pattern.test(context.response.content)) {
            context.response.content = '[Content filtered by safety policies]';
            break;
        }
    }
};

/**
 * Performance monitoring middleware - tracks execution metrics
 */
export const performanceMiddleware: ConversationMiddleware = async (context, next) => {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    context.startTime = new Date();

    try {
        await next();

        context.endTime = new Date();

        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();

        const executionTimeMs = Number(endTime - startTime) / 1_000_000;
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

        console.log(`[Performance] Conversation ${context.conversationId}:`);
        console.log(`  - Execution time: ${executionTimeMs.toFixed(2)}ms`);
        console.log(`  - Memory delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  - Retry count: ${context.retryCount}`);

        // Store metrics in context for potential streaming
        context.metadata.performance = {
            executionTimeMs,
            memoryDeltaMB: memoryDelta / 1024 / 1024,
            retryCount: context.retryCount
        };

    } catch (error) {
        context.endTime = new Date();
        context.error = error as Error;
        throw error;
    }
};

/**
 * SSE streaming middleware - streams events to connected clients
 */
export const sseStreamingMiddleware: ConversationMiddleware = async (context, next) => {
    const { conversationId, sseConnection } = context;

    if (!sseConnection) {
        await next();
        return;
    }

    try {
        await next();

        // Stream tool calls
        for (const toolCall of context.response.toolCalls) {
            streamToolCall(
                conversationId,
                toolCall.name,
                toolCall.id,
                toolCall.parameters,
                toolCall.result
            );
        }

        // Stream cache hits
        if (context.response.cacheHit) {
            streamCacheHit(
                conversationId,
                'cache_hash_placeholder',
                context.response.cachedTokens
            );
        }

    } catch (error) {
        // Stream error to client
        streamError(
            conversationId,
            (error as Error).message,
            (error as Error).name
        );
        throw error;
    }
};

/**
 * Dry run middleware - prevents actual execution in dry run mode
 */
export const dryRunMiddleware: ConversationMiddleware = async (context, next) => {
    if (context.isDryRun) {
        console.log(`[DryRun] Simulating conversation execution for ${context.conversationId}`);

        // Simulate response
        context.response.content = '[DRY RUN] This is a simulated response.';
        context.response.toolCalls = [];
        context.response.cacheHit = false;
        context.response.cachedTokens = 0;

        context.endTime = new Date();
        return;
    }

    await next();
};

/**
 * Error handling middleware - handles and formats errors
 */
export const errorHandlingMiddleware: ConversationMiddleware = async (context, next) => {
    try {
        await next();
    } catch (error) {
        console.error(`[Error] Conversation ${context.conversationId} failed:`, error);

        // Classify error types
        const errorMessage = (error as Error).message;
        let errorType = 'unknown';

        if (errorMessage.includes('rate limit')) {
            errorType = 'rate_limit';
        } else if (errorMessage.includes('authentication')) {
            errorType = 'authentication';
        } else if (errorMessage.includes('Content filtered')) {
            errorType = 'content_filter';
        } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
            errorType = 'network';
        }

        // Attach error details to context
        context.error = error as Error;
        context.metadata.errorType = errorType;
        context.endTime = new Date();

        // Re-throw for upstream handling
        throw error;
    }
};

// Predefined middleware pipelines

/**
 * Standard conversation pipeline with common middleware
 */
export function createStandardPipeline(): MiddlewarePipeline {
    return new MiddlewarePipeline([
        errorHandlingMiddleware,
        performanceMiddleware,
        loggingMiddleware,
        authenticationMiddleware,
        createRateLimitingMiddleware(60, 60000),
        contentFilteringMiddleware,
        userContextMiddleware,
        dryRunMiddleware,
        sseStreamingMiddleware
    ]);
}

/**
 * Development pipeline with additional debugging
 */
export function createDevelopmentPipeline(): MiddlewarePipeline {
    const debugMiddleware: ConversationMiddleware = async (context, next) => {
        console.log('[Debug] Context:', {
            conversationId: context.conversationId,
            projectId: context.projectId,
            userId: context.userId,
            messageCount: context.messages.length,
            isDryRun: context.isDryRun
        });

        await next();

        console.log('[Debug] Response:', {
            contentLength: context.response.content.length,
            toolCallCount: context.response.toolCalls.length,
            cacheHit: context.response.cacheHit
        });
    };

    return createStandardPipeline().use(debugMiddleware);
}

/**
 * Production pipeline with enhanced security and monitoring
 */
export function createProductionPipeline(): MiddlewarePipeline {
    const securityMiddleware: ConversationMiddleware = async (context, next) => {
        // Additional security checks for production
        const { request } = context;

        // Input sanitization
        request.userMessage = request.userMessage.trim();

        if (request.userMessage.length > 10000) {
            throw new Error('Message too long: Maximum 10,000 characters allowed');
        }

        await next();
    };

    return new MiddlewarePipeline([
        errorHandlingMiddleware,
        performanceMiddleware,
        securityMiddleware,
        authenticationMiddleware,
        createRateLimitingMiddleware(30, 60000), // Stricter rate limiting
        contentFilteringMiddleware,
        userContextMiddleware,
        sseStreamingMiddleware
    ]);
}

/**
 * Helper function to create context for conversation
 */
export function createConversationContext(
    conversationId: ConversationId,
    projectId: string,
    userId: string,
    userMessage: string,
    options: {
        messages?: ConversationMessage[];
        systemPrompt?: string;
        temperature?: number;
        maxTokens?: number;
        tools?: Record<string, any>;
        sseConnection?: SSEConnection;
        isDryRun?: boolean;
    } = {}
): ConversationContext {
    return {
        conversationId,
        projectId,
        userId,
        messages: options.messages || [],
        metadata: {},
        sseConnection: options.sseConnection,

        request: {
            userMessage,
            systemPrompt: options.systemPrompt,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            tools: options.tools
        },

        response: {
            content: '',
            toolCalls: [],
            cacheHit: false,
            cachedTokens: 0
        },

        startTime: new Date(),
        retryCount: 0,
        isDryRun: options.isDryRun || false
    };
} 