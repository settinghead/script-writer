import { tool, streamText } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { getLLMCredentials } from '../services/LLMConfig';
import { executeStreamingIdeationTransform } from '../transforms/ideation-stream';
import { IdeationInputSchema, IdeationOutputSchema } from '../../common/transform_schemas';

// Helper functions for deep merging partial stream results
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

function mergeDeep(target: any, source: any): any {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = mergeDeep(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

/**
 * A factory function that creates a 'brainstorm' tool for the Vercel AI SDK.
 * This tool has a "side-streaming" capability.
 */
export function createStreamingBrainstormTool(
  onStreamChunk: (chunk: any) => void
) {
  return tool({
    description: 'Generates creative story ideas based on a given set of parameters. Should be used to brainstorm for scripts.',
    parameters: IdeationInputSchema,
    execute: async (params: z.infer<typeof IdeationInputSchema>) => {
      console.log(`\n\n[Tool Execution] Agent called brainstorm tool with params:`, params);
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
        
        // Validate final result before returning
        const parsedResult = IdeationOutputSchema.safeParse(finalResult);
        if (!parsedResult.success) {
          console.error('\n[Tool Execution] Final tool output failed validation:', parsedResult.error);
          // Return a structured error to the agent
          return { error: 'Failed to generate valid story ideas.', details: parsedResult.error.issues };
        }

        console.log(`\n[Tool Execution] Brainstorm tool finished. Returning ${parsedResult.data.length} valid ideas to the agent.`);
        return parsedResult.data;
        
      } catch (error) {
        console.error('\n[Tool Execution] Error during streaming:', error);
        return { error: 'Streaming failed', details: error.message };
      }
    },
  });
}

async function main() {
  console.log('--- Starting Agent Flow Test ---');

  // This handler will be our "side-channel" view into the tool's streaming output.
  const sideStreamHandler = (chunk: any) => {
    // We don't do anything here except prove we're getting the chunks.
    // The '⚡️' printed in the tool's execute method serves as the visual confirmation.
  };
  
  const brainstormTool = createStreamingBrainstormTool(sideStreamHandler);

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
2. The tool requires the following parameters, which you must extract from this prompt:
   - platform: "${requestParams.platform}"
   - genre: "${requestParams.genre}"
   - main_story_points: "${requestParams.main_story_points}"
   - plot_keywords: "${requestParams.plot_keywords}"
   - style_modifiers: "${requestParams.style_modifiers}"
3. After the tool returns a result, you MUST inspect it. If you have exactly 3 ideas, your job is complete. Present these 3 ideas to the user in a clear, formatted list, and then on a new line, write "TASK_COMPLETE".
4. If you have fewer than 3 ideas, call the tool again.
5. If the tool returns an error, acknowledge it and stop.

Do not write any other text. Call the tool immediately.`;

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
    console.log(JSON.stringify(toolCalls, null, 2));

    const toolResults = await result.toolResults;
    console.log(`\nTool Results Received by Agent: ${toolResults.length}`);
    console.log(JSON.stringify(toolResults, null, 2));
    console.log('---------------------------------');

  } catch (error) {
    console.error("\n--- Agent Flow Failed ---");
    console.error(error);
  }
}

main().catch(console.error); 