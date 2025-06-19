import { tool, streamText } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { getLLMCredentials } from '../services/LLMConfig';

async function main() {
  console.log('--- Testing Simple Tool Call ---');

  // Initialize model exactly like the docs
  const { apiKey, baseUrl, modelName } = getLLMCredentials();
  const openai = createOpenAI({
    apiKey,
    baseURL: baseUrl,
  });
  const model = openai(modelName);

  // Create a very simple tool with no parameters
  const simpleTool = tool({
    description: 'Returns a simple greeting message',
    parameters: z.object({}), // No parameters
    execute: async () => {
      console.log('\n[TOOL EXECUTED] Simple tool was called!');
      return 'Hello from the tool!';
    },
  });

  const prompt = 'Please use the available tool to get a greeting message.';

  try {
    const result = await streamText({
      model: model,
      tools: {
        greeting: simpleTool,
      },
      maxSteps: 2,
      prompt: prompt,
    });

    console.log('\n--- Agent Output ---');
    for await (const delta of result.fullStream) {
        switch (delta.type) {
            case 'text-delta':
                process.stdout.write(delta.textDelta);
                break;
            case 'tool-call':
                console.log(`\n[AGENT] Calling tool '${delta.toolName}' with ID '${delta.toolCallId}'`);
                break;
            case 'tool-result':
                console.log(`\n[AGENT] Received result for tool '${delta.toolCallId}'`);
                break;
        }
    }
    console.log('\n--- End Output ---');

    const toolCalls = await result.toolCalls;
    console.log(`\nTool calls made: ${toolCalls.length}`);
    if (toolCalls.length > 0) {
      console.log(JSON.stringify(toolCalls, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error); 