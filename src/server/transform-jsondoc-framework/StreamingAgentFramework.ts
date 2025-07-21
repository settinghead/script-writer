import { tool } from 'ai';
import { z } from 'zod';

/**
 * Enhanced tool execution options with user context
 */
export interface EnhancedToolExecutionOptions {
  toolCallId: string;
  messages?: any[]; // Contains conversation context and user context from middleware
  userContext?: {
    originalUserRequest: string;
    projectId: string;
    userId: string;
    timestamp: string;
    agentPrompt?: string;
  };
}

/**
 * Interface that encapsulates all information needed to define a streaming tool
 */
export interface StreamingToolDefinition<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>; // This is now for documentation/validation, not direct streaming output
  execute: (input: TInput, options: EnhancedToolExecutionOptions) => Promise<TOutput>;
}

/**
 * Generic factory function that creates a tool for the `ai` SDK.
 * The actual streaming, DB interaction, and result storage is handled within the tool's `execute` method.
 * Enhanced to extract and pass user context from middleware.
 */
export function createAgentTool<TInput, TOutput>(
  toolDef: StreamingToolDefinition<TInput, TOutput>
) {
  return tool({
    description: toolDef.description,
    parameters: toolDef.inputSchema as any,
    execute: async (params: TInput, { toolCallId, messages }) => {
      console.log(`[createAgentTool] Executing tool '${toolDef.name}' with toolCallId: ${toolCallId}`);
      console.log(`[createAgentTool] Tool parameters:`, JSON.stringify(params, null, 2));

      // Extract user context from messages (injected by middleware)
      let userContext: any = null;
      try {
        // Look for user context in the messages
        if (messages && Array.isArray(messages)) {
          // Check the most recent messages for user context
          for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i] as any; // Use any type since providerMetadata might not be in CoreMessage type
            if (message?.providerMetadata?.userContext) {
              userContext = message.providerMetadata.userContext;
              break;
            }
          }
        }

        if (userContext) {
          console.log(`[createAgentTool] Found user context for tool '${toolDef.name}':`, {
            originalRequestLength: userContext.originalUserRequest?.length || 0,
            projectId: userContext.projectId,
            userId: userContext.userId,
            timestamp: userContext.timestamp
          });
        } else {
          console.log(`[createAgentTool] No user context found for tool '${toolDef.name}'`);
        }
      } catch (error) {
        console.warn(`[createAgentTool] Failed to extract user context for tool '${toolDef.name}':`, error);
      }

      try {
        const enhancedOptions: EnhancedToolExecutionOptions = {
          toolCallId,
          messages,
          userContext
        };

        const result = await toolDef.execute(params, enhancedOptions);
        console.log(`[createAgentTool] Tool '${toolDef.name}' completed successfully`);
        return result;
      } catch (error) {
        console.error(`[createAgentTool] Tool '${toolDef.name}' failed:`, error);
        console.error(`[createAgentTool] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        throw error;
      }
    },
  });
}

// Removed createGenericAgentPrompt - prompts are now created in AgentService

