import { tool, streamText } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { getLLMCredentials } from './LLMConfig';

/**
 * Interface that encapsulates all information needed to define a streaming tool
 */
export interface StreamingToolDefinition<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>; // This is now for documentation/validation, not direct streaming output
  execute: (input: TInput) => Promise<any>;
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
    parameters: toolDef.inputSchema,
    execute: toolDef.execute,
  });
}

/**
 * Creates a generic agent prompt that can work with multiple tools
 */
export function createGenericAgentPrompt(userRequest: string, toolDefinitions: StreamingToolDefinition<any, any>[]): string {
  const toolDescriptions = toolDefinitions.map(tool =>
    `- ${tool.name}: ${tool.description}`
  ).join('\n');

  return `You are an AI assistant with access to specialized tools to help users with their requests.

User Request: "${userRequest}"

Available Tools:
${toolDescriptions}

Your task is to:
1. Analyze the user request carefully
2. Determine which tool would best fulfill the user's needs
3. Extract the necessary parameters from the user request based on the tool's schema requirements
4. Call the appropriate tool with the extracted parameters
5. The tool will execute and store its results. Your job is to confirm that the task is complete.
6. Write "TASK_COMPLETE" on a new line when done

Important: The tool will handle storing and streaming the results. Do not attempt to display them.

Begin by analyzing the request and calling the most appropriate tool.`;
}

/**
 * Configuration for running a streaming agent
 */
export interface StreamingAgentConfig {
  userRequest: string;
  toolDefinitions: StreamingToolDefinition<any, any>[];
  maxSteps?: number;
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

  // Initialize model
  const { apiKey, baseUrl, modelName } = getLLMCredentials();
  const openai = createOpenAI({
    apiKey,
    baseURL: baseUrl,
  });
  const model = openai(modelName);

  // Create generic prompt
  const prompt = createGenericAgentPrompt(config.userRequest, config.toolDefinitions);

  try {
    const result = await streamText({
      model: model,
      tools: tools,
      maxSteps: config.maxSteps || 3,
      prompt: prompt,
    });

    console.log('\n\n--- Agent Stream & Final Output ---');
    let finalResponse = '';
    for await (const delta of result.fullStream) {
      switch (delta.type) {
        case 'text-delta':
          process.stdout.write(delta.textDelta);
          finalResponse += delta.textDelta;
          break;
        case 'tool-call':
          console.log(`\n[Agent Action] Starting tool call to '${delta.toolName}' with ID '${delta.toolCallId}'`);
          break;
        case 'tool-result':
          console.log(`\n[Agent Action] Received result for tool call '${delta.toolCallId}'`);
          break;
      }
    }
    console.log('\n-----------------------------------');

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
    throw error;
  }
} 