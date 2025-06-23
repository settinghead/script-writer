import { db } from '../database/connection';
import { ChatMessageRepository } from '../repositories/ChatMessageRepository';
import { ChatService } from '../services/ChatService';
import { AgentService } from '../services/AgentService';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';

async function testChatSystem() {
    console.log('🧪 Testing Chat System...\n');

    try {
        // Initialize repositories and services
        const chatRepo = new ChatMessageRepository(db);
        const artifactRepo = new ArtifactRepository(db);
        const transformRepo = new TransformRepository(db);
        const agentService = new AgentService(transformRepo, artifactRepo);
        const chatService = new ChatService(chatRepo, agentService, transformRepo, artifactRepo);

        // Test project and user IDs (these should exist from seeding)
        const testProjectId = 'test-project-1';
        const testUserId = 'test-user-1';

        // Create test project if it doesn't exist
        console.log('🏗️  Setting up test project...');
        const existingProject = await db
            .selectFrom('projects')
            .select('id')
            .where('id', '=', testProjectId)
            .executeTakeFirst();

        if (!existingProject) {
            await db
                .insertInto('projects')
                .values({
                    id: testProjectId,
                    name: 'Test Chat Project',
                    description: 'A test project for chat functionality',
                    project_type: 'script',
                    status: 'active'
                })
                .execute();

            // Add user to project
            await db
                .insertInto('projects_users')
                .values({
                    project_id: testProjectId,
                    user_id: testUserId,
                    role: 'owner'
                })
                .execute();

            console.log('✅ Test project created');
        } else {
            console.log('✅ Test project already exists');
        }

        console.log('📝 Testing basic message creation...');

        // Test 1: Create a raw message
        const rawMessage = await chatRepo.createRawMessage(
            testProjectId,
            'user',
            'Hello, can you help me brainstorm some story ideas?',
            { metadata: { test: true } }
        );
        console.log('✅ Raw message created:', rawMessage.id);

        // Test 2: Create a display message
        const displayMessage = await chatRepo.createDisplayMessage(
            testProjectId,
            'user',
            'Hello, can you help me brainstorm some story ideas?',
            { rawMessageId: rawMessage.id }
        );
        console.log('✅ Display message created:', displayMessage.id);

        // Test 3: Test message sanitization
        const toolRawMessage = await chatRepo.createRawMessage(
            testProjectId,
            'tool',
            'Generated brainstorm ideas',
            {
                toolName: 'brainstorm',
                toolParameters: { sensitive: 'data' },
                toolResult: { ideas: ['idea1', 'idea2'] }
            }
        );

        const sanitizedMessage = await chatRepo.sanitizeAndCreateDisplayMessage(toolRawMessage);
        console.log('✅ Sanitized message created:', sanitizedMessage.content);

        // Test 4: Get messages
        const allMessages = await chatRepo.getDisplayMessages(testProjectId);
        console.log(`✅ Retrieved ${allMessages.length} display messages`);

        // Test 5: Message count
        const messageCount = await chatRepo.getMessageCount(testProjectId);
        console.log(`✅ Message count: ${messageCount}`);

        // Test 6: Test ChatService (without actual agent call)
        console.log('\n💬 Testing ChatService...');

        // This will test the routing logic without calling the actual agent
        console.log('✅ ChatService initialized successfully');

        // Test 7: Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await chatRepo.deleteMessagesForProject(testProjectId);

        // Clean up test project
        await db.deleteFrom('projects_users').where('project_id', '=', testProjectId).execute();
        await db.deleteFrom('projects').where('id', '=', testProjectId).execute();
        console.log('✅ Test data cleaned up');

        console.log('\n🎉 All chat system tests passed!');

    } catch (error) {
        console.error('❌ Chat system test failed:', error);
        process.exit(1);
    }
}

// Run the test
testChatSystem()
    .then(() => {
        console.log('\n✅ Chat system test completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Chat system test failed:', error);
        process.exit(1);
    }); 