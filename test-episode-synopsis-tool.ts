import { TransformRepository } from './src/server/transform-jsondoc-framework/TransformRepository.js';
import { JsondocRepository } from './src/server/transform-jsondoc-framework/JsondocRepository.js';
import { createEpisodeSynopsisToolDefinition } from './src/server/tools/EpisodeSynopsisTool.js';
import { db } from './src/server/database/connection.js';

async function testEpisodeSynopsisTool() {
    const transformRepo = new TransformRepository(db);
    const jsondocRepo = new JsondocRepository(db);

    const projectId = '6b43f133-14ed-405a-9f29-89a2e26b59f0';
    const userId = 'test-user-1';

    console.log('Creating episode synopsis tool definition...');

    const toolDef = createEpisodeSynopsisToolDefinition(
        transformRepo,
        jsondocRepo,
        projectId,
        userId,
        { enableCaching: false }
    );

    console.log('Tool definition created:', toolDef.name);
    console.log('Tool description:', toolDef.description);

    // Test with the same parameters from the logs
    const testParams = {
        episodeRange: "7-12",
        episodes: [7, 8, 9, 10, 11, 12],
        groupTitle: "外星特使的复杂使命",
        jsondocs: [
            {
                description: "chosen_idea",
                jsondocId: "7643bb01-be08-4cd8-adca-1a300b5b0d6b",
                schemaType: "brainstorm_idea"
            },
            {
                description: "outline_settings",
                jsondocId: "9b6e650b-d208-49e7-9e96-58c141bbf4bf",
                schemaType: "outline_settings"
            },
            {
                description: "chronicles",
                jsondocId: "07d2ee60-6813-4638-ad10-431135238459",
                schemaType: "chronicles"
            },
            {
                description: "episode_planning",
                jsondocId: "d2b54d21-b5a0-4520-9ddd-1c0f7d4447be",
                schemaType: "episode_planning"
            }
        ]
    };

    console.log('Testing tool with parameters:', JSON.stringify(testParams, null, 2));

    try {
        const result = await toolDef.execute(testParams, {
            toolCallId: 'test-call-id',
            messages: [],
            userContext: {
                originalUserRequest: '生成第7-12集每集大纲：外星特使的复杂使命',
                projectId,
                userId,
                timestamp: new Date().toISOString()
            }
        });

        console.log('Tool execution successful!');
        console.log('Result:', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('Tool execution failed:', error);
        if (error instanceof Error) {
            console.error('Error stack:', error.stack);
        }
    }
}

testEpisodeSynopsisTool().catch(console.error).finally(() => process.exit(0)); 