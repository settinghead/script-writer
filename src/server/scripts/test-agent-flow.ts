import { tool, streamText } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { getLLMCredentials } from '../services/LLMConfig';
import { executeStreamingIdeationTransform } from '../transforms/ideation-stream';
import { IdeationInputSchema, IdeationOutputSchema } from '../../common/transform_schemas';

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
 * Enhanced factory function that creates a 'brainstorm' tool with result ID management.
 * This tool has a "side-streaming" capability and stores results in global memory.
 *
 * @param onStreamChunk A callback function that gets invoked with each partial data chunk from the stream.
 * @param onResultId A callback function that gets invoked with the result ID as soon as the tool starts executing.
 */
export function createStreamingBrainstormTool(
  onStreamChunk: (chunk: any) => void,
  onResultId: (resultId: string) => void
) {
  return tool({
    description: 'Generates creative story ideas based on a given set of parameters. Returns a result ID for accessing the generated ideas.',
    parameters: IdeationInputSchema,
    execute: async (params: z.infer<typeof IdeationInputSchema>) => {
      // Generate result ID immediately when tool execution starts
      const resultId = generateResultId();
      console.log(`\n\n[Tool Execution] Agent called brainstorm tool with result ID: ${resultId}`);
      console.log(`[Tool Execution] Params:`, params);
      
      // Notify the caller about the result ID
      onResultId(resultId);
      
      process.stdout.write('[Tool Side-Stream] -> ');

      try {
        const stream = await executeStreamingIdeationTransform(params);
        
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
        const parsedResult = IdeationOutputSchema.safeParse(finalResult);
        if (!parsedResult.success) {
          console.error('\n[Tool Execution] Final tool output failed validation:', parsedResult.error);
          // Store error in global memory
          RESULTS_STORE.set(resultId, { error: 'Failed to generate valid story ideas.', details: parsedResult.error.issues });
          return { resultId };
        }

        // Store the validated results in global memory
        RESULTS_STORE.set(resultId, parsedResult.data);
        console.log(`\n[Tool Execution] Stored ${parsedResult.data.length} ideas in global memory with ID: ${resultId}`);
        
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

async function main() {
  console.log('--- Starting Enhanced Agent Flow Test ---');

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
  
  const brainstormTool = createStreamingBrainstormTool(sideStreamHandler, resultIdHandler);

  // Initialize model directly following the docs pattern
  const { apiKey, baseUrl, modelName } = getLLMCredentials();
  const openai = createOpenAI({
    apiKey,
    baseURL: baseUrl,
  });
  const model = openai(modelName);

  const requestParams = {
    platform: "Tiktok",
    genre: "穿越, 爽文",
    main_story_points: "男主是现代霸总，意外穿越到古代，成为一个没落家族的少爷，利用现代知识经商、宫斗，最终富可敌国，并抱得美人归。",
    plot_keywords: "商战, 权谋, 打脸",
    style_modifiers: "节奏快, 反转多"
  };

  const prompt = `You are an expert script writing assistant. 
Your task is to generate exactly 3 high-quality story ideas for a short-form video series.
You must use the brainstorm tool provided to you to achieve this.

Here are the parameters for the brainstorm tool:
- platform: "${requestParams.platform}"
- genre: "${requestParams.genre}"
- main_story_points: "${requestParams.main_story_points}"
- plot_keywords: "${requestParams.plot_keywords}"
- style_modifiers: "${requestParams.style_modifiers}"

Your workflow is as follows:
1. You MUST call the 'brainstorm' tool to generate story ideas.
2. The tool will return a result ID in JSON format like {"resultId": "ABC12"}.
3. Once you receive the result ID, your job is complete. Simply return the result ID JSON and write "TASK_COMPLETE" on a new line.
4. Do NOT repeat or display the actual story ideas - just return the result ID.

Call the tool now.`;

  try {
    const result = await streamText({
      model: model,
      tools: {
        brainstorm: brainstormTool,
      },
      maxSteps: 3, // Allow up to 3 steps (e.g., initial call + 2 retries)
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