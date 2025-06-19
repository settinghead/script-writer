import { tool, streamText } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { getLLMCredentials } from '../services/LLMConfig';
import { executeStreamingIdeationTransform } from '../transforms/ideation-stream';
import { IdeationInputSchema, IdeationOutputSchema, IdeationInput, IdeationOutput } from '../../common/transform_schemas';

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
interface StreamingToolDefinition<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  executeFunction: (input: TInput) => Promise<AsyncIterable<Partial<TOutput>>>;
}

/**
 * Factory function that creates a brainstorm tool definition
 */
function createBrainstormToolDefinition(): StreamingToolDefinition<IdeationInput, IdeationOutput> {
  return {
    name: 'brainstorm',
    description: 'Generates creative story ideas based on platform, genre, story points, keywords, and style preferences. Use this tool when users want to brainstorm, generate, or create story concepts for short-form video content.',
    inputSchema: IdeationInputSchema,
    outputSchema: IdeationOutputSchema,
    executeFunction: executeStreamingIdeationTransform,
  };
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
          process.stdout.write('⚡️');
          
          // Debug: Log the first few chunks to see their structure
          if (chunkCount <= 3) {
            console.log(`\n[Debug] Chunk ${chunkCount}:`, JSON.stringify(partial, null, 2));
          }
          
          onStreamChunk(partial); // This is the side-streaming callback
          
          // Since the chunks are arrays, we should use the latest array as our result
          if (Array.isArray(partial) && partial.length > 0) {
            finalResult = partial;
          }
        }
        
        console.log(`\n[Tool Execution] Received ${chunkCount} chunks from stream`);
        
        console.log(`\n[Tool Execution] Final result before validation:`, JSON.stringify(finalResult, null, 2));
        
        // Validate final result before storing
        const parsedResult = toolDef.outputSchema.safeParse(finalResult);
        if (!parsedResult.success) {
          console.error('\n[Tool Execution] Final tool output failed validation:', parsedResult.error);
          // Store error in global memory
          RESULTS_STORE.set(resultId, { error: `Failed to generate valid ${toolDef.name} results.`, details: parsedResult.error.issues });
          return { resultId };
        }

        // Store the validated results in global memory
        RESULTS_STORE.set(resultId, parsedResult.data);
        console.log(`\n[Tool Execution] Stored ${Array.isArray(parsedResult.data) ? parsedResult.data.length : 1} ${toolDef.name} results in global memory with ID: ${resultId}`);
        
        // Return only the result ID to the agent
        return { resultId };
        
      } catch (error) {
        console.error('\n[Tool Execution] Error during streaming:', error);
        // Store error in global memory
        RESULTS_STORE.set(resultId, { error: 'Streaming failed', details: error.message });
        return { resultId };
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
function createGenericAgentPrompt(userRequest: string, toolDefinitions: StreamingToolDefinition<any, any>[]): string {
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

async function main() {
  console.log('--- Starting Generic Agent Flow Test ---');

  // Track result IDs as they're generated
  const resultIds: string[] = [];

  // This handler will be our "side-channel" view into the tool's streaming output.
  const sideStreamHandler = (chunk: any) => {
    // We don't do anything here except prove we're getting the chunks.
    // The '⚡️' printed in the tool's execute method serves as the visual confirmation.
  };
  
  // This handler will be called when a result ID is generated
  const resultIdHandler = (resultId: string) => {
    console.log(`\n[Main] Received result ID: ${resultId}`);
    resultIds.push(resultId);
  };
  
  // Create tool definitions
  const brainstormToolDef = createBrainstormToolDefinition();
  
  // Create streaming tools with result ID management
  const brainstormTool = createStreamingToolWithResultId(brainstormToolDef, sideStreamHandler, resultIdHandler);

  // Initialize model directly following the docs pattern
  const { apiKey, baseUrl, modelName } = getLLMCredentials();
  const openai = createOpenAI({
    apiKey,
    baseURL: baseUrl,
  });
  const model = openai(modelName);

  // Generic user request (instead of hardcoded parameters)
  const userRequest = "I need to create story ideas for TikTok videos. The genre should be time travel and power fantasy (穿越, 爽文). The main story is about a modern CEO who accidentally travels back to ancient times, becomes a fallen noble family's young master, uses modern knowledge for business and court intrigue, eventually becomes incredibly wealthy and wins the heart of a beautiful woman. Keywords should include business warfare, political schemes, and face-slapping moments. The style should be fast-paced with many plot twists.";

  // Create generic prompt
  const prompt = createGenericAgentPrompt(userRequest, [brainstormToolDef]);

  try {
    const result = await streamText({
      model: model,
      tools: {
        brainstorm: brainstormTool,
      },
      maxSteps: 3, // Allow up to 3 steps
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
    console.log('Finish Reason:', result.finishReason);
    
    const toolCalls = await result.toolCalls;
    console.log(`\nTool Calls Made: ${toolCalls.length}`);

    const toolResults = await result.toolResults;
    console.log(`\nTool Results Received by Agent: ${toolResults.length}`);
    
    // Display the actual results stored in global memory
    console.log('\n--- Stored Results in Global Memory ---');
    for (const resultId of resultIds) {
      const storedResult = getResultById(resultId);
      console.log(`\nResult ID: ${resultId}`);
      console.log('Stored Data:', JSON.stringify(storedResult, null, 2));
    }
    console.log('---------------------------------');

  } catch (error) {
    console.error("\n--- Agent Flow Failed ---");
    console.error(error);
  }
}

main().catch(console.error); 