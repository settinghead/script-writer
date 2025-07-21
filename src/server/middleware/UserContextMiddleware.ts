import type { LanguageModelV1Middleware } from 'ai';

export interface UserContextOptions {
    originalUserRequest: string;
    projectId: string;
    userId: string;
    timestamp: string;
}

/**
 * Global context storage for user context
 * This is needed because AI SDK doesn't pass providerMetadata to tool executions
 */
class UserContextStorage {
    private contexts = new Map<string, UserContextOptions>();

    store(key: string, context: UserContextOptions): void {
        this.contexts.set(key, context);
    }

    get(key: string): UserContextOptions | null {
        return this.contexts.get(key) || null;
    }

    clear(key: string): void {
        this.contexts.delete(key);
    }

    // Clean up old contexts (older than 1 hour)
    cleanup(): void {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [key, context] of this.contexts.entries()) {
            const contextTime = new Date(context.timestamp).getTime();
            if (contextTime < oneHourAgo) {
                this.contexts.delete(key);
            }
        }
    }
}

const globalUserContextStorage = new UserContextStorage();

// Cleanup old contexts every 10 minutes
setInterval(() => {
    globalUserContextStorage.cleanup();
}, 10 * 60 * 1000);

/**
 * Get user context for a specific project and user
 */
export function getUserContext(projectId: string, userId: string): UserContextOptions | null {
    const key = `${projectId}-${userId}`;
    return globalUserContextStorage.get(key);
}

/**
 * Middleware that injects user context into all LLM calls
 * This ensures tools have access to the original user request, not just the agent's interpretation
 */
export function createUserContextMiddleware(
    contextOptions: UserContextOptions
): LanguageModelV1Middleware {
    // Store context globally for tool access
    const contextKey = `${contextOptions.projectId}-${contextOptions.userId}`;
    globalUserContextStorage.store(contextKey, contextOptions);

    return {
        transformParams: async ({ params }) => {
            console.log('[UserContextMiddleware] Injecting user context into LLM call');

            // Inject user context into provider metadata
            // This will be accessible throughout the LLM call chain
            return {
                ...params,
                providerMetadata: {
                    ...params.providerMetadata,
                    userContext: {
                        originalUserRequest: contextOptions.originalUserRequest,
                        projectId: contextOptions.projectId,
                        userId: contextOptions.userId,
                        timestamp: contextOptions.timestamp,
                        // Also preserve the agent's interpretation for comparison
                        agentPrompt: typeof params.prompt === 'string'
                            ? (params.prompt as string).substring(0, 1000) + '...' // Truncate for logging
                            : '[Complex prompt structure]'
                    }
                }
            };
        },

        wrapStream: async ({ doStream }) => {
            console.log('[UserContextMiddleware] Processing streaming LLM call with user context');

            // Log context injection for debugging
            console.log('[UserContextMiddleware] User context available:', {
                originalRequestLength: contextOptions.originalUserRequest.length,
                projectId: contextOptions.projectId,
                userId: contextOptions.userId,
                timestamp: contextOptions.timestamp
            });

            return await doStream();
        },

        wrapGenerate: async ({ doGenerate }) => {
            // Log context injection for debugging  
            console.log('[UserContextMiddleware] User context available:', {
                originalRequestLength: contextOptions.originalUserRequest.length,
                projectId: contextOptions.projectId,
                userId: contextOptions.userId
            });

            return await doGenerate();
        }
    };
} 