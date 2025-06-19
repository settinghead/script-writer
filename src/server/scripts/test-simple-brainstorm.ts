import { tool, streamText } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { getLLMCredentials } from '../services/LLMConfig';

async function main() {
  console.log('--- Testing Simple Brainstorm Tool ---');

  // Initialize model exactly like the docs
  const { apiKey, baseUrl, modelName } = getLLMCredentials();
  const openai = createOpenAI({
    apiKey,
    baseURL: baseUrl,
  });
  const model = openai(modelName);

  // Create a simplified brainstorm tool with minimal parameters
  const simpleBrainstormTool = tool({
    description: 'Generates story ideas based on platform and genre',
    parameters: z.object({
      platform: z.string().describe('The platform for the content'),
      genre: z.string().describe('The genre of the story'),
    }),
    execute: async ({ platform, genre }) => {
      console.log(`\n[TOOL EXECUTED] Brainstorm tool called with platform: ${platform}, genre: ${genre}`);
      
      // Return a simple hardcoded result instead of streaming
      return [
        { title: "Story Idea 1", body: `A ${genre} story for ${platform} about adventure` },
        { title: "Story Idea 2", body: `A ${genre} story for ${platform} about romance` },
        { title: "Story Idea 3", body: `A ${genre} story for ${platform} about mystery` }
      ];
    },
  });

  const prompt = `Please use the brainstorm tool to generate story ideas. 
  Use these parameters:
  - platform: "TikTok"
  - genre: "Romance"
  
  Call the tool now.`;

  try {
    const result = await streamText({
      model: model,
      tools: {
        brainstorm: simpleBrainstormTool,
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
                console.log(`[AGENT] Tool arguments:`, delta.args);
                break;
            case 'tool-result':
                console.log(`\n[AGENT] Received result for tool '${delta.toolCallId}'`);
                break;
        }
    }
    console.log('\n--- End Output ---');

    const toolCalls = await result.toolCalls;
    console.log(`\nTool calls made: ${toolCalls.length}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error); 