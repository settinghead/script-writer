import { runStreamingAgent } from '../services/StreamingAgentFramework';
import { createBrainstormToolDefinition } from '../tools/BrainstormTool';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { db } from '../database/connection';
import logUpdate from 'log-update';

async function main() {
  console.log('--- Testing Brainstorm Agent ---');

  // Initialize repositories
  const transformRepo = new TransformRepository(db);
  const artifactRepo = new ArtifactRepository(db);
  
  // Test project and user IDs
  const projectId = 'test-project-' + Date.now();
  const userId = 'test-user-1';

  // Create brainstorm tool definition with required dependencies
  const brainstormToolDef = createBrainstormToolDefinition(
    transformRepo,
    artifactRepo,
    projectId,
    userId
  );

  // Define the user request
  const userRequest = "I need to create story ideas for TikTok videos. The genre should be time travel and power fantasy (穿越, 爽文). The main story is about a modern CEO who accidentally travels back to ancient times, becomes a fallen noble family's young master, uses modern knowledge for business and court intrigue, eventually becomes incredibly wealthy and wins the heart of a beautiful woman. Keywords should include business warfare, political schemes, and face-slapping moments. The style should be fast-paced with many plot twists.";

  try {
    // Run the streaming agent with brainstorm tool
    const result = await runStreamingAgent({
      userRequest,
      toolDefinitions: [brainstormToolDef],
      maxSteps: 3
    });
    
    console.log('\n--- Test Completed Successfully ---');
    console.log(`Finish Reason: ${result.finishReason}`);
    console.log(`Tool Calls Made: ${result.toolCalls.length}`);
    console.log(`Tool Results Received: ${result.toolResults.length}`);
    
    // Display tool results
    if (result.toolResults.length > 0) {
      console.log('\n--- Tool Results ---');
      result.toolResults.forEach((toolResult, index) => {
        console.log(`Tool Result ${index + 1}:`, JSON.stringify(toolResult, null, 2));
      });
    }

  } catch (error) {
    console.error('--- Test Failed ---');
    console.error(error);
  } finally {
    // Clean up database connection
    await db.destroy();
  }
}

main().catch(console.error); 