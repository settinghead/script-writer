import { runStreamingAgent } from '../services/StreamingAgentFramework';
import { createBrainstormToolDefinition } from '../tools/BrainstormTool';
import logUpdate from 'log-update';

async function main() {
  console.log('--- Testing Brainstorm Agent ---');

  // Create brainstorm tool definition
  const brainstormToolDef = createBrainstormToolDefinition();

  // Define the user request
  const userRequest = "I need to create story ideas for TikTok videos. The genre should be time travel and power fantasy (穿越, 爽文). The main story is about a modern CEO who accidentally travels back to ancient times, becomes a fallen noble family's young master, uses modern knowledge for business and court intrigue, eventually becomes incredibly wealthy and wins the heart of a beautiful woman. Keywords should include business warfare, political schemes, and face-slapping moments. The style should be fast-paced with many plot twists.";

  try {
    // Run the streaming agent with brainstorm tool
    const result = await runStreamingAgent({
      userRequest,
      toolDefinitions: [brainstormToolDef],
      maxSteps: 3,
      onStreamChunk: ({ chunk, chunkCount }) => {
        const displayText = Array.isArray(chunk) && chunk.length > 0
          ? JSON.stringify(chunk, null, 2)
          : JSON.stringify(chunk, null, 2);

        logUpdate(`[Chunk ${chunkCount}]\n${displayText}`);
      },
      onResultId: (resultId) => {
        console.log(`\n[Brainstorm Test] Generated result ID: ${resultId}`);
      }
    });
    logUpdate.clear();
    console.log('\n--- Test Completed Successfully ---');
    console.log(`Generated ${result.resultIds.length} result(s): ${result.resultIds.join(', ')}`);

  } catch (error) {
    console.error('--- Test Failed ---');
    console.error(error);
  }
}

main().catch(console.error); 