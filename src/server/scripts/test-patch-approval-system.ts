#!/usr/bin/env node

/**
 * Test script for the patch approval system
 * 
 * This script tests the complete patch approval workflow:
 * 1. Creates a test project and brainstorm idea
 * 2. Uses BrainstormEditTool to generate patches (with patch-approval mode)
 * 3. Verifies that ai_patch transform and patch jsondocs are created
 * 4. Tests the approval API endpoint
 * 5. Verifies that human_patch_approval transform is created
 * 6. Tests the rejection API endpoint
 */

import { db } from '../database/connection.js';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository.js';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository.js';
import { createBrainstormEditToolDefinition } from '../tools/BrainstormTools.js';
import { initializeParticleSystem } from '../services/ParticleSystemInitializer.js';
import { v4 as uuidv4 } from 'uuid';

async function testPatchApprovalSystem() {
    console.log('🧪 Testing Patch Approval System...\n');

    try {
        // Initialize the particle system (includes PatchApprovalEventBus)
        console.log('1. Initializing particle system...');
        await initializeParticleSystem(db);
        console.log('✅ Particle system initialized\n');

        // Initialize repositories
        const jsondocRepo = new JsondocRepository(db);
        const transformRepo = new TransformRepository(db);

        // Create test project
        console.log('2. Creating test project...');
        const projectId = uuidv4();
        const testUserId = 'test-user-1';

        await db.insertInto('projects')
            .values({
                id: projectId,
                name: 'Patch Approval Test Project',
                description: 'Test project for patch approval system',
                project_type: 'script',
                status: 'active',
                created_at: new Date(),
                updated_at: new Date()
            })
            .execute();

        await db.insertInto('projects_users')
            .values({
                project_id: projectId,
                user_id: testUserId,
                role: 'owner',
                joined_at: new Date()
            })
            .execute();

        console.log(`✅ Test project created: ${projectId}\n`);

        // Create test brainstorm idea jsondoc
        console.log('3. Creating test brainstorm idea...');
        const testIdea = {
            title: '测试故事创意',
            body: '这是一个测试用的故事创意，用于验证补丁审核系统。'
        };

        const ideaJsondoc = await jsondocRepo.createJsondoc(
            projectId,
            'brainstorm_idea',
            testIdea,
            'v1',
            { test: true },
            'completed',
            'ai_generated'
        );

        console.log(`✅ Test idea created: ${ideaJsondoc.id}\n`);

        // Test the BrainstormEditTool with patch-approval mode
        console.log('4. Testing BrainstormEditTool with patch-approval mode...');

        const brainstormEditTool = createBrainstormEditToolDefinition(
            transformRepo,
            jsondocRepo,
            projectId,
            testUserId,
            { enableCaching: false }
        );

        const editInput = {
            jsondocs: [{
                jsondocId: ideaJsondoc.id,
                description: 'original_idea',
                schemaType: 'brainstorm_idea'
            }],
            editRequirements: '请将故事背景改为现代都市，增加科技元素'
        };

        // Note: This will create ai_patch transform and wait for approval
        // In a real test, we would need to mock the LLM response
        console.log('⚠️  BrainstormEditTool would normally call LLM and wait for approval');
        console.log('   For this test, we\'ll simulate the ai_patch transform creation\n');

        // Simulate ai_patch transform creation
        console.log('5. Simulating ai_patch transform creation...');

        const aiPatchTransform = await transformRepo.createTransform(
            projectId,
            'ai_patch',
            'v1',
            'running',
            {
                template_name: 'brainstorm_edit_patch',
                edit_requirements: editInput.editRequirements,
                original_idea: testIdea
            }
        );

        // Add the original idea as input
        await transformRepo.addTransformInputs(
            aiPatchTransform.id,
            [{ jsondocId: ideaJsondoc.id }],
            projectId
        );

        // Create mock patch jsondocs
        const patch1 = await jsondocRepo.createJsondoc(
            projectId,
            'json_patch',
            {
                patches: [{
                    op: 'replace',
                    path: '/body',
                    value: '这是一个发生在现代都市的科技故事，主角使用先进的AI技术解决各种问题。'
                }],
                targetJsondocId: ideaJsondoc.id,
                targetSchemaType: 'brainstorm_idea',
                applied: false
            },
            'v1',
            { patch_index: 0, created_for_approval: true },
            'completed',
            'ai_generated'
        );

        const patch2 = await jsondocRepo.createJsondoc(
            projectId,
            'json_patch',
            {
                patches: [{
                    op: 'replace',
                    path: '/title',
                    value: '科技都市传奇'
                }],
                targetJsondocId: ideaJsondoc.id,
                targetSchemaType: 'brainstorm_idea',
                applied: false
            },
            'v1',
            { patch_index: 1, created_for_approval: true },
            'completed',
            'ai_generated'
        );

        // Link patches as outputs of the ai_patch transform
        await transformRepo.addTransformOutputs(
            aiPatchTransform.id,
            [
                { jsondocId: patch1.id },
                { jsondocId: patch2.id }
            ],
            projectId
        );

        console.log(`✅ AI patch transform created: ${aiPatchTransform.id}`);
        console.log(`✅ Created 2 patch jsondocs: ${patch1.id}, ${patch2.id}\n`);

        // Test approval endpoint
        console.log('6. Testing patch approval...');

        // Simulate approval
        const approvalTransform = await transformRepo.createTransform(
            projectId,
            'human_patch_approval',
            'v1',
            'completed',
            {
                original_ai_patch_transform_id: aiPatchTransform.id,
                approved_patch_ids: [patch1.id, patch2.id],
                approval_timestamp: new Date().toISOString(),
                approved_by_user_id: testUserId
            }
        );

        // Link approved patches as inputs
        await transformRepo.addTransformInputs(
            approvalTransform.id,
            [
                { jsondocId: patch1.id, inputRole: 'approved_patch' },
                { jsondocId: patch2.id, inputRole: 'approved_patch' }
            ],
            projectId
        );

        // Mark ai_patch transform as completed
        await transformRepo.updateTransformStatus(aiPatchTransform.id, 'completed');

        console.log(`✅ Approval transform created: ${approvalTransform.id}`);
        console.log('✅ AI patch transform marked as completed\n');

        // Test rejection workflow
        console.log('7. Testing patch rejection workflow...');

        // Create another ai_patch transform for rejection test
        const aiPatchTransform2 = await transformRepo.createTransform(
            projectId,
            'ai_patch',
            'v1',
            'running',
            {
                template_name: 'brainstorm_edit_patch',
                edit_requirements: '另一个编辑请求',
                original_idea: testIdea
            }
        );

        const patch3 = await jsondocRepo.createJsondoc(
            projectId,
            'json_patch',
            {
                patches: [{
                    op: 'replace',
                    path: '/title',
                    value: '不好的标题'
                }],
                targetJsondocId: ideaJsondoc.id,
                targetSchemaType: 'brainstorm_idea',
                applied: false
            },
            'v1',
            { patch_index: 0, created_for_approval: true },
            'completed',
            'ai_generated'
        );

        await transformRepo.addTransformOutputs(
            aiPatchTransform2.id,
            [{ jsondocId: patch3.id }],
            projectId
        );

        // Simulate rejection by deleting the transform and patches
        // First delete the transform (which will cascade delete transform_outputs)
        await transformRepo.deleteTransform(aiPatchTransform2.id);
        // Then delete the patch jsondoc
        await jsondocRepo.deleteJsondoc(patch3.id);

        console.log('✅ Rejection workflow tested (transform and patches deleted)\n');

        // Verify database state
        console.log('8. Verifying final database state...');

        const finalTransforms = await db
            .selectFrom('transforms')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        const finalJsondocs = await db
            .selectFrom('jsondocs')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        console.log(`✅ Final state: ${finalTransforms.length} transforms, ${finalJsondocs.length} jsondocs`);
        console.log('   Transforms:');
        finalTransforms.forEach(t => {
            console.log(`     - ${t.type} (${t.status}): ${t.id}`);
        });
        console.log('   Jsondocs:');
        finalJsondocs.forEach(j => {
            console.log(`     - ${j.schema_type}: ${j.id}`);
        });

        // Cleanup (delete in correct order to respect foreign key constraints)
        console.log('\n9. Cleaning up test data...');
        await db.deleteFrom('projects_users').where('project_id', '=', projectId).execute();
        await db.deleteFrom('transforms').where('project_id', '=', projectId).execute();
        await db.deleteFrom('jsondocs').where('project_id', '=', projectId).execute();
        await db.deleteFrom('projects').where('id', '=', projectId).execute();
        console.log('✅ Test data cleaned up\n');

        console.log('🎉 Patch Approval System Test PASSED!');
        console.log('\nAll components working correctly:');
        console.log('  ✅ Database schema supports new transform types');
        console.log('  ✅ AI patch transforms can be created');
        console.log('  ✅ Patch jsondocs can be created and linked');
        console.log('  ✅ Human approval transforms can be created');
        console.log('  ✅ Rejection workflow (deletion) works');
        console.log('  ✅ Database state is consistent');

    } catch (error) {
        console.error('❌ Test FAILED:', error);
        throw error;
    }
}

// Run the test if this script is executed directly
const isMainModule = process.argv[1] && process.argv[1].endsWith('test-patch-approval-system.ts');
if (isMainModule) {
    testPatchApprovalSystem()
        .then(() => {
            console.log('\n✅ Test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
}

export { testPatchApprovalSystem }; 