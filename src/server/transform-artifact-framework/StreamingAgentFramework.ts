import { tool } from 'ai';
import { z } from 'zod';

/**
 * Interface that encapsulates all information needed to define a streaming tool
 */
export interface StreamingToolDefinition<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>; // This is now for documentation/validation, not direct streaming output
  execute: (input: TInput, options: { toolCallId: string }) => Promise<any>;
}

/**
 * Generic factory function that creates a tool for the `ai` SDK.
 * The actual streaming, DB interaction, and result storage is handled within the tool's `execute` method.
 */
export function createAgentTool<TInput, TOutput>(
  toolDef: StreamingToolDefinition<TInput, TOutput>
) {
  return tool({
    description: toolDef.description,
    parameters: toolDef.inputSchema as any,
    execute: async (params: TInput, { toolCallId }) => {
      console.log(`[createAgentTool] Executing tool '${toolDef.name}' with toolCallId: ${toolCallId}`);
      console.log(`[createAgentTool] Tool parameters:`, JSON.stringify(params, null, 2));

      try {
        const result = await toolDef.execute(params, { toolCallId });
        console.log(`[createAgentTool] Tool '${toolDef.name}' completed successfully:`, result);
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

