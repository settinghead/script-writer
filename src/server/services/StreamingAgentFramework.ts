import { tool, streamText } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { getLLMCredentials } from './LLMConfig';

// Global in-memory storage for results
const RESULTS_STORE = new Map<string, any>();

// Utility function to generate simple 5-character alphanumeric ID
function generateResultId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Interface that encapsulates all information needed to define a streaming tool
 */
export interface StreamingToolDefinition<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  executeFunction: (input: TInput) => Promise<AsyncIterable<Partial<TOutput>>>;
}

/**
 * Generic factory function that creates a streaming tool with result ID management.
 * This tool has a "side-streaming" capability and stores results in global memory.
 */
export function createStreamingToolWithResultId<TInput, TOutput>(
  toolDef: StreamingToolDefinition<TInput, TOutput>,
  onStreamChunk: (chunk: any) => void,
  onResultId: (resultId: string) => void
) {
  return tool({
    description: toolDef.description,
    parameters: toolDef.inputSchema,
    execute: async (params: TInput) => {
      // Generate result ID immediately when tool execution starts
      const resultId = generateResultId();
      console.log(`\n\n[Tool Execution] Agent called '${toolDef.name}' tool with result ID: ${resultId}`);
      console.log(`[Tool Execution] Params:`, params);
      
      // Notify the caller about the result ID
      onResultId(resultId);
      
      process.stdout.write(`[Tool Side-Stream ${toolDef.name.toUpperCase()}] -> `);

      try {
        const stream = await toolDef.executeFunction(params);
        
        let finalResult: any[] = [];
        let chunkCount = 0;
        
        for await (const partial of stream) {
          chunkCount++;
          
          // Progressive JSON display - simpler approach without line clearing
          // Just show the current state with a timestamp or counter
          if (chunkCount === 1) {
            console.log(`\n[Progressive Streaming] Starting...`);
          }
          
          // Display the current partial object state with chunk number
          const displayText = Array.isArray(partial) && partial.length > 0 
            ? JSON.stringify(partial, null, 2)
            : JSON.stringify(partial, null, 2);
          
          // For better readability, only show every 10th chunk or significant changes
          if (chunkCount % 10 === 0 || chunkCount <= 5) {
            console.log(`\n--- Chunk ${chunkCount} ---`);
            console.log(displayText);
          } else {
            process.stdout.write('.');
          }
          
          onStreamChunk(partial); // This is the side-streaming callback
          
          // Since the chunks are arrays, we should use the latest array as our result
          if (Array.isArray(partial) && partial.length > 0) {
            finalResult = partial;
          }
        }
        
        console.log(`\n[Tool Execution] Completed streaming with ${chunkCount} chunks`);
        
        // Store the final result in global memory
        const resultId = this.storeResult(finalResult);
        console.log(`\n[Tool Execution] Stored ${Array.isArray(finalResult) ? finalResult.length : 1} brainstorm results in global memory with ID: ${resultId}`);
        
        return {
          resultId,
          finishReason: 'stop' // Proper string value instead of Promise
        };
        
      } catch (error) {
        console.error('\n[Tool Execution] Error:', error);
        throw error;
      }
    },
  });
}

// Utility function to retrieve results from global storage
export function getResultById(resultId: string): any {
  return RESULTS_STORE.get(resultId);
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
5. Once you receive a result ID, return it in JSON format like {"resultId": "ABC12"}
6. Write "TASK_COMPLETE" on a new line when done

Important: Do NOT return or display the actual results - only return the result ID. The tool will handle storing the results separately.

Begin by analyzing the request and calling the most appropriate tool.`;
}

/**
 * Configuration for running a streaming agent
 */
export interface StreamingAgentConfig {
  userRequest: string;
  toolDefinitions: StreamingToolDefinition<any, any>[];
  maxSteps?: number;
  onStreamChunk?: (chunk: any) => void;
  onResultId?: (resultId: string) => void;
}

/**
 * Runs a streaming agent with the provided configuration
 */
export async function runStreamingAgent(config: StreamingAgentConfig): Promise<{
  resultIds: string[];
  finishReason: any;
  toolCalls: any[];
  toolResults: any[];
}> {
  console.log('--- Starting Streaming Agent ---');

  // Track result IDs as they're generated
  const resultIds: string[] = [];

  // Default handlers
  const sideStreamHandler = config.onStreamChunk || ((chunk: any) => {
    // Default: do nothing, just let the ⚡️ symbols show progress
  });
  
  const resultIdHandler = config.onResultId || ((resultId: string) => {
    console.log(`\n[Agent] Received result ID: ${resultId}`);
    resultIds.push(resultId);
  });
  
  // If custom handler is provided, wrap it to ensure resultIds tracking
  const wrappedResultIdHandler = (resultId: string) => {
    resultIds.push(resultId); // Always track result IDs
    if (config.onResultId) {
      config.onResultId(resultId); // Call custom handler if provided
    } else {
      console.log(`\n[Agent] Received result ID: ${resultId}`); // Default logging
    }
  };

  // Create streaming tools with result ID management
  const tools: Record<string, any> = {};
  for (const toolDef of config.toolDefinitions) {
    tools[toolDef.name] = createStreamingToolWithResultId(toolDef, sideStreamHandler, wrappedResultIdHandler);
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

    console.log('\n\n--- Agent Execution Summary ---');
    const finishReason = result.finishReason;
    console.log('Finish Reason:', finishReason);
    
    const toolCalls = await result.toolCalls;
    const toolCallsMade = toolCalls.length;
    console.log(`\nTool Calls Made: ${toolCallsMade}`);

    const toolResults = await result.toolResults;
    const toolResultsReceived = toolResults.length;
    console.log(`\nTool Results Received by Agent: ${toolResultsReceived}`);
    
    // Display the actual results stored in global memory
    console.log('\n--- Stored Results in Global Memory ---');
    for (const resultId of resultIds) {
      const storedResult = getResultById(resultId);
      console.log(`\nResult ID: ${resultId}`);
      console.log('Stored Data:', JSON.stringify(storedResult, null, 2));
    }
    console.log('---------------------------------');

    // Log summary without repeating the data
    console.log(`\n--- Agent Execution Summary ---`);
    console.log(`Finish Reason: ${finishReason}`);
    console.log(`\nTool Calls Made: ${toolCallsMade}`);
    console.log(`\nTool Results Received by Agent: ${toolResultsReceived}`);
    
    // Show only the result IDs stored, not the full data
    console.log(`\n--- Stored Results in Global Memory ---`);
    resultIds.forEach(id => {
      const result = RESULTS_STORE.get(id);
      if (result) {
        const count = Array.isArray(result) ? result.length : 1;
        console.log(`\nResult ID: ${id}`);
        console.log(`Stored ${count} items`);
      }
    });
    console.log(`---------------------------------`);
    
    console.log(`\n--- Test Completed Successfully ---`);
    console.log(`Generated ${resultIds.length} result(s): ${resultIds.join(', ')}`);
    
    return {
      resultIds,
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