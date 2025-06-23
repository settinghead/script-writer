import { db } from '../database/connection';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { ChatMessageRepository } from '../repositories/ChatMessageRepository';
import { BrainstormService } from '../services/BrainstormService';
import { AgentService } from '../services/AgentService';

async function testBrainstormChatFlow() {
    console.log('🧪 Testing Brainstorm Chat Flow...');

    try {
        // Initialize repositories and services
        const artifactRepo = new ArtifactRepository(db);
        const transformRepo = new TransformRepository(db);
        const chatMessageRepo = new ChatMessageRepository(db);
        const agentService = new AgentService(transformRepo, artifactRepo);
        const brainstormService = new BrainstormService(db, artifactRepo, transformRepo);

        // Inject dependencies
        agentService.setChatMessageRepository(chatMessageRepo);
        brainstormService.setAgentService(agentService);

        // Create a test project
        const projectId = 'test-project-chat-flow-' + Date.now();
        await db.insertInto('projects')
            .values({
                id: projectId,
                name: 'Test Chat Flow Project',
                description: 'Testing brainstorm chat integration',
                project_type: 'script',
                status: 'active'
            })
            .execute();

        // Add test user to project
        const userId = 'test-user-1';
        await db.insertInto('projects_users')
            .values({
                project_id: projectId,
                user_id: userId,
                role: 'owner'
            })
            .execute();

        console.log(`✅ Test project created: ${projectId}`);

        // Test brainstorm parameters
        const params = {
            genre: '穿越, 爽文',
            theme: 'modern knowledge advantage',
            character_setting: 'college student protagonist',
            plot_device: 'time travel to ancient times',
            ending_type: 'happy ending with success',
            length: 'short form video series',
            platform: '抖音',
            additional_requirements: 'Focus on business and technology innovations'
        };

        console.log('📝 Starting brainstorm with chat logging...');

        // Start brainstorm (this should create chat messages)
        const result = await brainstormService.startBrainstorm({
            projectId,
            params
        });

        console.log(`✅ Brainstorm started with transform: ${result.transformId}`);

        // Wait a moment for async processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check chat messages
        console.log('💬 Checking chat messages...');
        const chatMessages = await chatMessageRepo.getDisplayMessages(projectId);

        console.log(`✅ Found ${chatMessages.length} chat messages:`);
        for (const message of chatMessages) {
            console.log(`  - ${message.role}: ${message.content.substring(0, 100)}...`);
            console.log(`    Status: ${message.status}, Type: ${message.display_type}`);
        }

        // Check artifacts
        console.log('📦 Checking artifacts...');
        const artifacts = await db
            .selectFrom('artifacts')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();
        console.log(`✅ Found ${artifacts.length} artifacts:`);
        for (const artifact of artifacts) {
            console.log(`  - ${artifact.type} (${artifact.type_version}): ${artifact.id}`);
        }

        // Check transforms
        console.log('🔄 Checking transforms...');
        const transforms = await db
            .selectFrom('transforms')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        console.log(`✅ Found ${transforms.length} transforms:`);
        for (const transform of transforms) {
            console.log(`  - ${transform.type} (${transform.status}): ${transform.id}`);
        }

        // Cleanup
        console.log('🧹 Cleaning up test data...');
        await db.deleteFrom('chat_messages_display').where('project_id', '=', projectId).execute();
        await db.deleteFrom('chat_messages_raw').where('project_id', '=', projectId).execute();
        await db.deleteFrom('transform_outputs').where('project_id', '=', projectId).execute();
        await db.deleteFrom('transform_inputs').where('project_id', '=', projectId).execute();
        await db.deleteFrom('transforms').where('project_id', '=', projectId).execute();
        await db.deleteFrom('artifacts').where('project_id', '=', projectId).execute();
        await db.deleteFrom('projects_users').where('project_id', '=', projectId).execute();
        await db.deleteFrom('projects').where('id', '=', projectId).execute();

        console.log('✅ Test data cleaned up');
        console.log('🎉 Brainstorm chat flow test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

// Run the test
testBrainstormChatFlow()
    .then(() => {
        console.log('✅ Test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }); 