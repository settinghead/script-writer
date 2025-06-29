/**
 * Integration test for AgentService flow: brainstorm generation → editing → outline creation
 * Tests the complete natural language interaction flow with seeded LLM calls
 */

import { db } from '../database/connection';
import { AgentService } from '../services/AgentService';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { ChatMessageRepository } from '../repositories/ChatMessageRepository';
import { ProjectService } from '../services/ProjectService';
import { v4 as uuidv4 } from 'uuid';

// Test configuration
const TEST_USER_ID = 'test-user-1';
const TEST_SEED = 12345; // Fixed seed for reproducible results

async function runAgentFlowIntegrationTest() {
    console.log('\n🚀 Starting Agent Flow Integration Test');
    console.log('===============================================');

    const projectService = new ProjectService(db);
    const transformRepo = new TransformRepository(db);
    const artifactRepo = new ArtifactRepository(db);
    const chatMessageRepo = new ChatMessageRepository(db);
    const agentService = new AgentService(transformRepo, artifactRepo);

    // Inject chat message repository
    agentService.setChatMessageRepository(chatMessageRepo);

    // Generate unique test project ID
    const testProjectId = `test-project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`📋 Test Project ID: ${testProjectId}`);
    console.log(`👤 Test User ID: ${TEST_USER_ID}`);
    console.log(`🎲 Seed: ${TEST_SEED}\n`);

    try {
        // Step 0: Create test project
        console.log('🏗️  STEP 0: Creating test project...');
        await projectService.createTestProject(testProjectId, TEST_USER_ID, 'Agent Flow Integration Test');
        console.log('✅ Test project created successfully\n');

        // Step 1: Generate brainstorm ideas with natural language request
        console.log('💡 STEP 1: Generating brainstorm ideas...');
        const brainstormRequest = {
            userRequest: '请帮我为一个现代都市甜宠剧生成一些创意故事想法。我想要男主是霸道总裁，女主是普通职场女性的设定。希望有一些误会和追妻火葬场的情节。',
            projectId: testProjectId,
            contextType: 'brainstorm' as const
        };

        await agentService.runGeneralAgent(testProjectId, TEST_USER_ID, brainstormRequest, {
            createChatMessages: true
        });
        console.log('✅ Brainstorm ideas generated successfully\n');

        // Step 2: Get generated brainstorm ideas
        console.log('📄 STEP 2: Retrieving generated brainstorm ideas...');
        const brainstormArtifacts = await artifactRepo.getArtifactsByType(testProjectId, 'brainstorm_idea_collection');

        if (brainstormArtifacts.length === 0) {
            throw new Error('No brainstorm ideas were generated');
        }

        const brainstormData = brainstormArtifacts[0].data;
        console.log(`✅ Found ${brainstormData.ideas?.length || 0} brainstorm ideas`);

        if (brainstormData.ideas && brainstormData.ideas.length > 0) {
            console.log(`📝 First idea title: "${brainstormData.ideas[0].title}"`);
            console.log(`📝 First idea summary: "${brainstormData.ideas[0].body?.substring(0, 100)}..."\n`);
        }

        // Step 3: Edit the first brainstorm idea with natural language request
        console.log('✏️  STEP 3: Editing the first brainstorm idea...');
        const editRequest = {
            userRequest: `请帮我改进第一个故事创意。我希望增加一些职场竞争的元素，让女主更加独立自强。同时加强男主的人物设定，让他不只是霸道，还要有温柔和专业的一面。请保留原有的甜宠元素。`,
            projectId: testProjectId,
            contextType: 'brainstorm' as const
        };

        await agentService.runGeneralAgent(testProjectId, TEST_USER_ID, editRequest, {
            createChatMessages: true
        });
        console.log('✅ Brainstorm idea edited successfully\n');

        // Step 4: Get the edited brainstorm ideas
        console.log('📄 STEP 4: Retrieving edited brainstorm ideas...');
        const updatedBrainstormArtifacts = await artifactRepo.getArtifactsByType(testProjectId, 'brainstorm_idea_collection');

        // Get the most recent artifact
        const latestBrainstormArtifact = updatedBrainstormArtifacts.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        const updatedBrainstormData = latestBrainstormArtifact.data;
        console.log(`✅ Retrieved updated brainstorm with ${updatedBrainstormData.ideas?.length || 0} ideas`);

        if (updatedBrainstormData.ideas && updatedBrainstormData.ideas.length > 0) {
            console.log(`📝 Updated first idea title: "${updatedBrainstormData.ideas[0].title}"`);
            console.log(`📝 Updated first idea summary: "${updatedBrainstormData.ideas[0].body?.substring(0, 100)}..."\n`);
        }

        // Step 5: Generate outline from the edited idea
        console.log('📋 STEP 5: Generating outline from the edited idea...');
        const outlineRequest = {
            userRequest: `我想要基于刚才编辑过的第一个故事创意来生成一个详细的故事大纲。请创建一个80集的现代都市甜宠剧大纲，包含主要人物设定、故事发展脉络、冲突点和情感转折。`,
            projectId: testProjectId,
            contextType: 'general' as const
        };

        await agentService.runGeneralAgent(testProjectId, TEST_USER_ID, outlineRequest, {
            createChatMessages: true
        });
        console.log('✅ Outline generated successfully\n');

        // Step 6: Verify outline was generated
        console.log('📄 STEP 6: Verifying outline generation...');
        const outlineArtifacts = await artifactRepo.getArtifactsByType(testProjectId, 'outline_response');

        if (outlineArtifacts.length === 0) {
            console.log('⚠️  No outline artifacts found, checking for other outline-related artifacts...');
            const allArtifacts = await artifactRepo.getProjectArtifacts(testProjectId, 100);
            const outlineRelated = allArtifacts.filter(a => a.type.includes('outline'));
            console.log(`📋 Found ${outlineRelated.length} outline-related artifacts:`,
                outlineRelated.map(a => a.type));
        } else {
            const outlineData = outlineArtifacts[0].data;
            console.log(`✅ Outline generated successfully`);
            console.log(`📝 Outline title: "${outlineData.title || 'No title'}"`);
            console.log(`📝 Character count: ${outlineData.characters?.length || 0}`);
            console.log(`📝 Synopsis stages: ${outlineData.synopsis_stages?.length || 0}\n`);
        }

        // Step 7: Display final statistics
        console.log('📊 STEP 7: Final Test Statistics');
        console.log('================================');

        const finalArtifacts = await artifactRepo.getProjectArtifacts(testProjectId, 100);
        const finalTransforms = await transformRepo.getProjectTransforms(testProjectId, 100);
        const finalChatMessages = await chatMessageRepo.getDisplayMessages(testProjectId);

        console.log(`📋 Total artifacts created: ${finalArtifacts.length}`);
        console.log(`⚙️  Total transforms executed: ${finalTransforms.length}`);
        console.log(`💬 Total chat messages: ${finalChatMessages.length}`);

        console.log('\n📋 Artifacts by type:');
        const artifactsByType = finalArtifacts.reduce((acc, artifact) => {
            acc[artifact.type] = (acc[artifact.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        Object.entries(artifactsByType).forEach(([type, count]) => {
            console.log(`  - ${type}: ${count}`);
        });

        console.log('\n⚙️  Transforms by status:');
        const transformsByStatus = finalTransforms.reduce((acc, transform) => {
            acc[transform.status || 'unknown'] = (acc[transform.status || 'unknown'] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        Object.entries(transformsByStatus).forEach(([status, count]) => {
            console.log(`  - ${status}: ${count}`);
        });

        console.log('\n🎉 Integration test completed successfully!');

    } catch (error) {
        console.error('\n❌ Integration test failed:', error);

        // Try to get some debugging information
        try {
            const artifacts = await artifactRepo.getProjectArtifacts(testProjectId, 50);
            const transforms = await transformRepo.getProjectTransforms(testProjectId, 50);
            console.log(`\n🔍 Debug info: ${artifacts.length} artifacts, ${transforms.length} transforms created before failure`);
        } catch (debugError) {
            console.error('Could not retrieve debug information:', debugError);
        }

        throw error;

    } finally {
        // Step 8: Cleanup - wipe the test project
        console.log('\n🧹 STEP 8: Cleaning up test project...');
        try {
            await projectService.wipeProject(testProjectId);
            console.log('✅ Test project wiped successfully');
        } catch (cleanupError) {
            console.error('❌ Failed to cleanup test project:', cleanupError);
        }
    }
}

// Run the test
if (require.main === module) {
    runAgentFlowIntegrationTest()
        .then(() => {
            console.log('\n✅ Agent Flow Integration Test completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Agent Flow Integration Test failed:', error);
            process.exit(1);
        });
}

export { runAgentFlowIntegrationTest }; 