#!/usr/bin/env node

import db from '../database/connection';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { createBrainstormEditToolDefinition } from '../tools/BrainstormEditTool';

async function testBrainstormEditTool() {
    console.log('🧪 Testing Brainstorm Edit Tool...\n');

    // Use the imported db instance
    const artifactRepo = new ArtifactRepository(db);
    const transformRepo = new TransformRepository(db);
    const projectRepo = new ProjectRepository(db);

    // Test data
    const userId = 'test-user-1';
    const projectName = 'Test Brainstorm Edit Project';

    try {
        // 0. Create a test project first
        console.log('0. Creating test project...');
        const project = await projectRepo.createProject(projectName, userId, 'Test project for brainstorm editing');
        const projectId = project.id;
        console.log(`✅ Created test project: ${projectId}\n`);

        // 1. Create a test brainstorm idea collection
        console.log('1. Creating test brainstorm idea collection...');
        const testIdeas = [
            {
                title: '霸总的甜心',
                body: '一个普通女孩意外成为霸道总裁的秘书，两人在工作中产生感情，但面临家族阻挠和商业竞争的挑战。'
            },
            {
                title: '时光倒流',
                body: '女主角意外回到十年前，决定改变自己的人生轨迹，但发现改变过去会带来意想不到的后果。'
            }
        ];

        const brainstormArtifact = await artifactRepo.createArtifact(
            projectId,
            'brainstorm_idea_collection',
            testIdeas,
            'v1',
            {
                platform: '抖音',
                genre: '都市言情',
                status: 'completed'
            }
        );

        console.log(`✅ Created brainstorm artifact: ${brainstormArtifact.id}\n`);

        // 2. Create the brainstorm edit tool
        console.log('2. Creating brainstorm edit tool...');
        const editTool = createBrainstormEditToolDefinition(
            transformRepo,
            artifactRepo,
            projectId,
            userId
        );

        console.log(`✅ Created edit tool: ${editTool.name}\n`);

        // 3. Test editing the first idea
        console.log('3. Testing idea editing...');
        const editRequest = {
            sourceArtifactId: brainstormArtifact.id,
            ideaIndex: 0,
            editRequirements: '让故事更加具有现代感，加入科技元素，女主角应该是一个独立自强的程序员',
            agentInstructions: '保持原有的浪漫元素，但要让角色更加立体和现代化'
        };

        console.log('Edit request:', editRequest);

        const result = await editTool.execute(editRequest);
        console.log('\n✅ Edit tool execution completed!');
        console.log('Result:', JSON.stringify(result, null, 2));

        // 4. Verify the result
        if (result.outputArtifactId) {
            console.log('\n4. Verifying edited artifact...');
            const editedArtifact = await artifactRepo.getArtifact(result.outputArtifactId);

            if (editedArtifact) {
                console.log('✅ Edited artifact found:');
                console.log('Original idea:', result.originalIdea);
                console.log('Edited idea:', result.editedIdea);
                console.log('Full artifact data:', editedArtifact.data);
            } else {
                console.error('❌ Edited artifact not found');
            }
        }

        // 5. Test editing a user_input artifact (second round editing)
        if (result.outputArtifactId) {
            console.log('\n5. Testing second round editing (editing the edited idea)...');
            const secondEditRequest = {
                sourceArtifactId: result.outputArtifactId,
                ideaIndex: 0, // Not used for single brainstorm_idea artifacts
                editRequirements: '让故事更加悬疑，加入一些神秘元素和反转情节',
                agentInstructions: '保持科技和现代感，但增加悬疑色彩'
            };

            console.log('Second edit request:', secondEditRequest);

            const secondResult = await editTool.execute(secondEditRequest);
            console.log('\n✅ Second edit completed!');
            console.log('Second result:', JSON.stringify(secondResult, null, 2));

            if (secondResult.outputArtifactId) {
                const finalArtifact = await artifactRepo.getArtifact(secondResult.outputArtifactId);
                if (finalArtifact) {
                    console.log('✅ Final edited artifact:');
                    console.log('Final idea:', finalArtifact.data);
                }
            }
        }

        console.log('\n🎉 Brainstorm Edit Tool test completed successfully!');

        // Cleanup (optional)
        console.log('\n6. Cleaning up test data...');
        await projectRepo.deleteProject(projectId);
        console.log('✅ Test project deleted');

    } catch (error) {
        console.error('\n❌ Test failed:', error);

        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack trace:', error.stack);
        }
    }
}

// Run the test
testBrainstormEditTool().catch(console.error); 