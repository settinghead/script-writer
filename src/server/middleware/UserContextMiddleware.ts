import type { LanguageModelV1Middleware } from 'ai';

export interface UserContextOptions {
    originalUserRequest: string;
    projectId: string;
    userId: string;
    timestamp: string;
}

/**
 * Middleware that injects user context into all LLM calls
 * This ensures tools have access to the original user request, not just the agent's interpretation
 */
export function createUserContextMiddleware(
    contextOptions: UserContextOptions
): LanguageModelV1Middleware {
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

        wrapStream: async ({ doStream, params }) => {
            console.log('[UserContextMiddleware] Processing streaming LLM call with user context');

            // Log context injection for debugging
            const userContext = params.providerMetadata?.userContext;
            if (userContext) {
                console.log('[UserContextMiddleware] User context available:', {
                    originalRequestLength: typeof userContext.originalUserRequest === 'string' ? userContext.originalUserRequest.length : 0,
                    projectId: userContext.projectId,
                    userId: userContext.userId,
                    timestamp: userContext.timestamp
                });
            }

            return await doStream();
        },

        wrapGenerate: async ({ doGenerate, params }) => {
            console.log('[UserContextMiddleware] Processing generate LLM call with user context');

            // Log context injection for debugging  
            const userContext = params.providerMetadata?.userContext;
            if (userContext) {
                console.log('[UserContextMiddleware] User context available:', {
                    originalRequestLength: typeof userContext.originalUserRequest === 'string' ? userContext.originalUserRequest.length : 0,
                    projectId: userContext.projectId,
                    userId: userContext.userId
                });
            }

            return await doGenerate();
        }
    };
}

/**
 * Helper function to extract user context from tool execution options
 * This is used by tools to access the original user request
 */
export function extractUserContext(messages?: any[]): UserContextOptions | null {
    try {
        // The user context should be in the provider metadata
        // We need to look through the messages to find it
        if (!messages || !Array.isArray(messages)) {
            return null;
        }

        // Look for user context in the most recent messages
        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            if (message?.providerMetadata?.userContext) {
                return message.providerMetadata.userContext;
            }
        }

        return null;
    } catch (error) {
        console.warn('[UserContextMiddleware] Failed to extract user context:', error);
        return null;
    }
} 