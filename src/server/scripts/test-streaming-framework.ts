import { db } from '../database/connection';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { createBrainstormToolDefinition, createBrainstormEditToolDefinition } from '../tools/BrainstormTool';
import { createOutlineToolDefinition } from '../tools/OutlineTool';

const artifactRepo = new ArtifactRepository(db);
const transformRepo = new TransformRepository(db);

const TEST_PROJECT_ID = 'test-streaming-framework';
const TEST_USER_ID = 'test-user-1';

async function createTestProject() {
    // Create a test project if it doesn't exist
    try {
        const existing = await db
            .selectFrom('projects')
            .selectAll()
            .where('id', '=', TEST_PROJECT_ID)
            .executeTakeFirst();

        if (!existing) {
            await db
                .insertInto('projects')
                .values({
                    id: TEST_PROJECT_ID,
                    name: 'Streaming Framework Test Project',
                    description: 'Test project for validating the new streaming framework',
                    project_type: 'script',
                    status: 'active'
                })
                .execute();
            console.log('✅ Created test project');
        } else {
            console.log('✅ Test project already exists');
        }

        // Ensure user has access to the project
        const membership = await db
            .selectFrom('projects_users')
            .selectAll()
            .where('project_id', '=', TEST_PROJECT_ID)
            .where('user_id', '=', TEST_USER_ID)
            .executeTakeFirst();

        if (!membership) {
            await db
                .insertInto('projects_users')
                .values({
                    project_id: TEST_PROJECT_ID,
                    user_id: TEST_USER_ID,
                    role: 'owner'
                })
                .execute();
            console.log('✅ Added user to test project');
        }

    } catch (error) {
        console.error('❌ Failed to create test project:', error);
        throw error;
    }
}

async function testBrainstormTool() {
    console.log('\n🧪 Testing BrainstormTool with streaming framework...');

    try {
        const brainstormTool = createBrainstormToolDefinition(
            transformRepo,
            artifactRepo,
            TEST_PROJECT_ID,
            TEST_USER_ID
        );

        const testInput = {
            platform: '抖音',
            genre: '现代甜宠',
            other_requirements: '快节奏，高颜值主角'
        };

        console.log('📤 Executing brainstorm tool...');
        const result = await brainstormTool.execute(testInput, { toolCallId: 'test-brainstorm' });

        console.log('✅ BrainstormTool completed successfully');
        console.log(`   Output artifact ID: ${result.outputArtifactId}`);
        console.log(`   Finish reason: ${result.finishReason}`);

        // Verify the artifact was created
        const artifact = await artifactRepo.getArtifact(result.outputArtifactId);
        if (!artifact) {
            throw new Error('Output artifact not found');
        }

        console.log(`   Artifact type: ${artifact.type}`);

        if (artifact.data && typeof artifact.data === 'object' && 'ideas' in artifact.data) {
            console.log(`   Number of ideas generated: ${(artifact.data as any).ideas?.length || 0}`);
        }

        return result.outputArtifactId;

    } catch (error) {
        console.error('❌ BrainstormTool test failed:', error);
        throw error;
    }
}

async function testBrainstormEditTool(sourceArtifactId: string) {
    console.log('\n🧪 Testing BrainstormEditTool with streaming framework...');

    try {
        const editTool = createBrainstormEditToolDefinition(
            transformRepo,
            artifactRepo,
            TEST_PROJECT_ID,
            TEST_USER_ID
        );

        const testInput = {
            sourceArtifactId: sourceArtifactId,
            editRequirements: '让故事更加现代化，增加科技元素',
            ideaIndex: 0,
            agentInstructions: '保持原有的情感核心，但加入现代科技背景'
        };

        console.log('📤 Executing brainstorm edit tool...');
        const result = await editTool.execute(testInput, { toolCallId: 'test-edit' });

        console.log('✅ BrainstormEditTool completed successfully');
        console.log(`   Output artifact ID: ${result.outputArtifactId}`);
        console.log(`   Finish reason: ${result.finishReason}`);

        // Verify the artifact was created
        const artifact = await artifactRepo.getArtifact(result.outputArtifactId);
        if (!artifact) {
            throw new Error('Output artifact not found');
        }

        console.log(`   Artifact type: ${artifact.type}`);

        return result.outputArtifactId;

    } catch (error) {
        console.error('❌ BrainstormEditTool test failed:', error);
        throw error;
    }
}

async function testOutlineTool(sourceArtifactId: string) {
    console.log('\n🧪 Testing OutlineTool with streaming framework...');

    try {
        const outlineTool = createOutlineToolDefinition(
            transformRepo,
            artifactRepo,
            TEST_PROJECT_ID,
            TEST_USER_ID
        );

        const testInput = {
            sourceArtifactId: sourceArtifactId,
            totalEpisodes: 12,
            episodeDuration: 3,
            selectedPlatform: '抖音',
            selectedGenrePaths: [['现代', '甜宠', '都市']],
            requirements: '高颜值演员，快节奏剧情'
        };

        console.log('📤 Executing outline tool...');
        const result = await outlineTool.execute(testInput, { toolCallId: 'test-outline' });

        console.log('✅ OutlineTool completed successfully');
        console.log(`   Output artifact ID: ${result.outputArtifactId}`);
        console.log(`   Finish reason: ${result.finishReason}`);

        // Verify the artifact was created
        const artifact = await artifactRepo.getArtifact(result.outputArtifactId);
        if (!artifact) {
            throw new Error('Output artifact not found');
        }

        console.log(`   Artifact type: ${artifact.type}`);

        if (artifact.data && typeof artifact.data === 'object') {
            const data = artifact.data as any;
            console.log(`   Outline title: ${data.title || 'No title'}`);
            console.log(`   Number of characters: ${data.characters?.length || 0}`);
            console.log(`   Number of stages: ${data.stages?.length || 0}`);
        }

        return result.outputArtifactId;

    } catch (error) {
        console.error('❌ OutlineTool test failed:', error);
        throw error;
    }
}

async function main() {
    console.log('🚀 Starting Streaming Framework Integration Test');
    console.log('===============================================');

    try {
        // Setup
        await createTestProject();

        // Test 1: Generate brainstorm ideas
        const brainstormArtifactId = await testBrainstormTool();

        // Test 2: Edit one of the brainstorm ideas
        const editedIdeaArtifactId = await testBrainstormEditTool(brainstormArtifactId);

        // Test 3: Generate outline from edited idea
        const outlineArtifactId = await testOutlineTool(editedIdeaArtifactId);

        console.log('\n🎉 All streaming framework tests completed successfully!');
        console.log('===============================================');
        console.log(`Brainstorm Collection: ${brainstormArtifactId}`);
        console.log(`Edited Idea: ${editedIdeaArtifactId}`);
        console.log(`Generated Outline: ${outlineArtifactId}`);

    } catch (error) {
        console.error('\n💥 Streaming framework test failed:', error);
        process.exit(1);
    }

    finally {
        await db.destroy();
        console.log('🔌 Database connection closed');
        process.exit(0);
    }
}

// Run the test
main().catch(console.error); 