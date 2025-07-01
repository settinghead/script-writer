import { tool, streamText } from 'ai';
import { z } from 'zod';
import { getLLMModel } from './LLMConfig';
import type { ChatMessageRepository } from '../repositories/ChatMessageRepository';

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
      return await toolDef.execute(params, { toolCallId });
    },
  });
}

// Removed createGenericAgentPrompt - prompts are now created in AgentService

/**
 * Configuration for running a streaming agent
 */
export interface StreamingAgentConfig {
  prompt: string; // Complete prompt ready for execution
  toolDefinitions: StreamingToolDefinition<any, any>[];
  maxSteps?: number;
  projectId?: string;
  chatMessageRepo?: ChatMessageRepository;
  // Caching options
  enableCaching?: boolean;  // Enable LLM response caching (default: false)
  seed?: number;  // Seed for deterministic outputs
  temperature?: number;  // LLM temperature
  topP?: number;  // LLM top-p sampling
  maxTokens?: number;  // LLM max tokens
}

/**
 * Runs a streaming agent with the provided configuration
 */
export async function runStreamingAgent(config: StreamingAgentConfig): Promise<{
  finishReason: any;
  toolCalls: any[];
  toolResults: any[];
}> {
  console.log('--- Starting Streaming Agent ---');

  // Create agent tools
  const tools: Record<string, any> = {};
  for (const toolDef of config.toolDefinitions) {
    tools[toolDef.name] = createAgentTool(toolDef);
  }

  // Use the complete prompt provided by the caller
  const prompt = config.prompt;

  // Extract caching options
  const {
    enableCaching = false,
    seed,
    temperature,
    topP,
    maxTokens
  } = config;

  try {
    // Note: For now, streamText caching in agent framework is not implemented
    // because AI SDK's streamText with tools has complex structure that's hard to cache
    const model = await getLLMModel();
    const result = await streamText({
      model: model,
      tools: tools,
      maxSteps: config.maxSteps || 5,
      prompt: prompt,
      // Pass AI SDK options directly
      ...(seed && { seed }),
      ...(temperature && { temperature }),
      ...(topP && { topP }),
      ...(maxTokens && { maxTokens })
    });

    console.log('\n\n--- Agent Stream & Final Output ---');
    let finalResponse = '';
    let currentToolCall: any = null;

    for await (const delta of result.fullStream) {

      switch (delta.type) {
        case 'text-delta':
          process.stdout.write(delta.textDelta);
          finalResponse += delta.textDelta;
          break;
        case 'tool-call':
          console.log(`\n[Agent Action] Starting tool call to '${delta.toolName}' with ID '${delta.toolCallId}'`);
          currentToolCall = delta;

          // Save tool call as raw message
          if (config.chatMessageRepo && config.projectId) {
            await config.chatMessageRepo.createRawMessage(
              config.projectId,
              'tool',
              `Tool call: ${delta.toolName}`,
              {
                toolName: delta.toolName,
                toolParameters: delta.args,
                metadata: {
                  toolCallId: delta.toolCallId,
                  source: 'streaming_agent'
                }
              }
            );
          }
          break;
        case 'tool-result':
          console.log(`\n[Agent Action] Received result for tool call '${delta.toolCallId}'`);

          // Save tool result as raw message
          if (config.chatMessageRepo && config.projectId && currentToolCall) {
            await config.chatMessageRepo.createRawMessage(
              config.projectId,
              'tool',
              `Tool result: ${currentToolCall.toolName}`,
              {
                toolName: currentToolCall.toolName,
                toolParameters: currentToolCall.args,
                toolResult: delta.result,
                metadata: {
                  toolCallId: delta.toolCallId,
                  source: 'streaming_agent'
                }
              }
            );
          }
          break;
      }
    }
    console.log('\n-----------------------------------');

    // Save final assistant response as raw message
    if (config.chatMessageRepo && config.projectId && finalResponse.trim()) {
      await config.chatMessageRepo.createRawMessage(
        config.projectId,
        'assistant',
        finalResponse.trim(),
        { metadata: { source: 'streaming_agent' } }
      );
    }

    const finishReason = await result.finishReason;
    const toolCalls = await result.toolCalls;
    const toolCallsMade = toolCalls.length;
    const toolResults = await result.toolResults;
    const toolResultsReceived = toolResults.length;

    // Log summary without repeating the data
    console.log(`\n--- Agent Execution Summary ---`);
    console.log(`Finish Reason: ${finishReason}`);
    console.log(`\nTool Calls Made: ${toolCallsMade}`);
    console.log(`\nTool Results Received by Agent: ${toolResultsReceived}`);
    console.log(JSON.stringify(toolResults, null, 2));

    return {
      finishReason,
      toolCalls,
      toolResults
    };

  } catch (error) {
    console.error("\n--- Agent Flow Failed ---");
    console.error(error);

    // Save error as raw message
    if (config.chatMessageRepo && config.projectId) {
      await config.chatMessageRepo.createRawMessage(
        config.projectId,
        'assistant',
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        { metadata: { source: 'streaming_agent', error: true } }
      );
    }

    throw error;
  }
} 