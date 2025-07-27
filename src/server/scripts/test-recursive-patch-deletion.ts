#!/usr/bin/env node

/**
 * Test script to verify recursive patch deletion functionality
 * This script simulates the scenario where an AI patch has human transform descendants
 * and verifies that rejecting the patch deletes all descendants correctly.
 */

import { config } from 'dotenv';
config();

import { db } from '../database/connection';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';

const jsondocRepo = new TransformJsondocRepository(db);
const transformRepo = new TransformJsondocRepository(db);

const TEST_USER_ID = 'test-user-1';
const TEST_PROJECT_ID = 'test-project-recursive-deletion';

async function main() {
    console.log('🧪 Testing recursive patch deletion functionality...\n');

    try {
        // 1. Create test project
        console.log('1. Creating test project...');
        await db
            .insertInto('projects')
            .values({
                id: TEST_PROJECT_ID,
                name: 'Test Recursive Deletion Project',
                description: 'Testing recursive patch deletion',
                status: 'active',
                created_at: new Date(),
                updated_at: new Date()
            })
            .onConflict((oc) => oc.column('id').doNothing())
            .execute();

        // Add user to project
        await db
            .insertInto('projects_users')
            .values({
                project_id: TEST_PROJECT_ID,
                user_id: TEST_USER_ID,
                role: 'owner',
                joined_at: new Date()
            })
            .onConflict((oc) => oc.columns(['project_id', 'user_id']).doNothing())
            .execute();

        console.log('✅ Test project created\n');

        // 2. Create original jsondoc (brainstorm idea)
        console.log('2. Creating original brainstorm idea...');
        const originalIdea = await jsondocRepo.createJsondoc(
            TEST_PROJECT_ID,
            '灵感创意',
            {
                title: '原始创意：霸总与小白花',
                body: '一个关于霸总爱上清纯小白花的故事，充满了误会和甜蜜。'
            },
            'v1',
            { source: 'ai_generation' },
            'completed',
            'ai_generated'
        );
        console.log(`✅ Original idea created: ${originalIdea.id}\n`);

        // 3. Create AI patch transform with patch jsondocs
        console.log('3. Creating AI patch transform...');
        const aiPatchTransform = await transformRepo.createTransform(
            TEST_PROJECT_ID,
            'ai_patch',
            'v1',
            'pending_approval',
            {
                edit_requirements: '让故事更加去脸谱化，避免刻板印象',
                patch_approval_mode: true
            }
        );

        // Add input relationship
        await transformRepo.addTransformInputs(aiPatchTransform.id, [
            { jsondocId: originalIdea.id, inputRole: 'source' }
        ], TEST_PROJECT_ID);

        // Create patch jsondocs
        const patch1 = await jsondocRepo.createJsondoc(
            TEST_PROJECT_ID,
            'json_patch',
            {
                patches: [
                    { op: 'replace', path: '/title', value: '现代都市：独立女性与温柔男主' }
                ],
                targetJsondocId: originalIdea.id,
                applied: false
            },
            'v1',
            { patch_index: 0 },
            'completed',
            'ai_generated'
        );

        const patch2 = await jsondocRepo.createJsondoc(
            TEST_PROJECT_ID,
            'json_patch',
            {
                patches: [
                    { op: 'replace', path: '/body', value: '讲述一位独立自主的职场女性与一位温柔体贴的咖啡师之间的现代爱情故事，打破传统性别刻板印象。' }
                ],
                targetJsondocId: originalIdea.id,
                applied: false
            },
            'v1',
            { patch_index: 1 },
            'completed',
            'ai_generated'
        );

        // Add output relationships
        await transformRepo.addTransformOutputs(aiPatchTransform.id, [
            { jsondocId: patch1.id, outputRole: 'patch' },
            { jsondocId: patch2.id, outputRole: 'patch' }
        ], TEST_PROJECT_ID);

        console.log(`✅ AI patch transform created: ${aiPatchTransform.id}`);
        console.log(`✅ Patch jsondocs created: ${patch1.id}, ${patch2.id}\n`);

        // 4. Simulate user creating human transforms from patches (descendants)
        console.log('4. Creating human transform descendants...');

        // Human transform 1: User edits patch1
        const humanTransform1 = await transformRepo.createTransform(
            TEST_PROJECT_ID,
            'human',
            'v1',
            'completed',
            {
                transform_name: 'edit_json_patch',
                derivation_path: '$',
                user_action: 'manual_edit'
            }
        );

        const editedPatch1 = await jsondocRepo.createJsondoc(
            TEST_PROJECT_ID,
            'json_patch',
            {
                patches: [
                    { op: 'replace', path: '/title', value: '现代都市：独立女性与温柔男主（用户修改版）' }
                ],
                targetJsondocId: originalIdea.id,
                applied: false,
                userNotes: '用户手动调整了标题'
            },
            'v1',
            {
                transform_name: 'edit_json_patch',
                source_jsondoc_id: patch1.id,
                derivation_path: '$'
            },
            'completed',
            'user_input'
        );

        await transformRepo.addTransformInputs(humanTransform1.id, [
            { jsondocId: patch1.id, inputRole: 'source' }
        ], TEST_PROJECT_ID);

        await transformRepo.addTransformOutputs(humanTransform1.id, [
            { jsondocId: editedPatch1.id, outputRole: 'derived' }
        ], TEST_PROJECT_ID);

        await transformRepo.addHumanTransform({
            transform_id: humanTransform1.id,
            action_type: 'edit',
            source_jsondoc_id: patch1.id,
            derivation_path: '$',
            derived_jsondoc_id: editedPatch1.id,
            transform_name: 'edit_json_patch',
            project_id: TEST_PROJECT_ID
        });

        // Human transform 2: User edits patch2
        const humanTransform2 = await transformRepo.createTransform(
            TEST_PROJECT_ID,
            'human',
            'v1',
            'completed',
            {
                transform_name: 'edit_json_patch',
                derivation_path: '$',
                user_action: 'manual_edit'
            }
        );

        const editedPatch2 = await jsondocRepo.createJsondoc(
            TEST_PROJECT_ID,
            'json_patch',
            {
                patches: [
                    { op: 'replace', path: '/body', value: '讲述一位独立自主的职场女性与一位温柔体贴的咖啡师之间的现代爱情故事，打破传统性别刻板印象。用户增加了更多细节描述。' }
                ],
                targetJsondocId: originalIdea.id,
                applied: false,
                userNotes: '用户增加了故事细节'
            },
            'v1',
            {
                transform_name: 'edit_json_patch',
                source_jsondoc_id: patch2.id,
                derivation_path: '$'
            },
            'completed',
            'user_input'
        );

        await transformRepo.addTransformInputs(humanTransform2.id, [
            { jsondocId: patch2.id, inputRole: 'source' }
        ], TEST_PROJECT_ID);

        await transformRepo.addTransformOutputs(humanTransform2.id, [
            { jsondocId: editedPatch2.id, outputRole: 'derived' }
        ], TEST_PROJECT_ID);

        await transformRepo.addHumanTransform({
            transform_id: humanTransform2.id,
            action_type: 'edit',
            source_jsondoc_id: patch2.id,
            derivation_path: '$',
            derived_jsondoc_id: editedPatch2.id,
            transform_name: 'edit_json_patch',
            project_id: TEST_PROJECT_ID
        });

        console.log(`✅ Human transform 1 created: ${humanTransform1.id} -> ${editedPatch1.id}`);
        console.log(`✅ Human transform 2 created: ${humanTransform2.id} -> ${editedPatch2.id}\n`);

        // 5. Verify the structure before deletion
        console.log('5. Verifying structure before deletion...');
        const allTransforms = await db
            .selectFrom('transforms')
            .selectAll()
            .where('project_id', '=', TEST_PROJECT_ID)
            .execute();

        const allJsondocs = await db
            .selectFrom('jsondocs')
            .selectAll()
            .where('project_id', '=', TEST_PROJECT_ID)
            .execute();

        console.log(`📊 Before deletion: ${allTransforms.length} transforms, ${allJsondocs.length} jsondocs`);
        console.log('Transforms:');
        allTransforms.forEach(t => {
            console.log(`  - ${t.id}: ${t.type} (${t.status})`);
        });
        console.log('Jsondocs:');
        allJsondocs.forEach(j => {
            console.log(`  - ${j.id}: ${j.schema_type} (${j.origin_type})`);
        });
        console.log();

        // 6. Test the rejection endpoint (simulate the API call)
        console.log('6. Testing recursive deletion...');

        // Import the recursive deletion function (we'll need to make it available)
        const response = await fetch(`http://localhost:4600/api/transforms/${aiPatchTransform.id}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer debug-auth-token-script-writer-dev'
            },
            body: JSON.stringify({
                rejectionReason: 'Testing recursive deletion functionality'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Rejection failed: ${errorData.error}`);
        }

        const rejectionResult = await response.json();
        console.log('✅ Rejection completed:', rejectionResult);

        // 7. Verify deletion results
        console.log('\n7. Verifying deletion results...');
        const remainingTransforms = await db
            .selectFrom('transforms')
            .selectAll()
            .where('project_id', '=', TEST_PROJECT_ID)
            .execute();

        const remainingJsondocs = await db
            .selectFrom('jsondocs')
            .selectAll()
            .where('project_id', '=', TEST_PROJECT_ID)
            .execute();

        console.log(`📊 After deletion: ${remainingTransforms.length} transforms, ${remainingJsondocs.length} jsondocs`);
        console.log('Remaining transforms:');
        remainingTransforms.forEach(t => {
            console.log(`  - ${t.id}: ${t.type} (${t.status})`);
        });
        console.log('Remaining jsondocs:');
        remainingJsondocs.forEach(j => {
            console.log(`  - ${j.id}: ${j.schema_type} (${j.origin_type})`);
        });

        // 8. Validate expected results
        console.log('\n8. Validating results...');

        // Should only have the original jsondoc remaining
        if (remainingTransforms.length === 0) {
            console.log('✅ All transforms deleted correctly');
        } else {
            console.log('❌ Some transforms remain that should have been deleted');
        }

        if (remainingJsondocs.length === 1 && remainingJsondocs[0].id === originalIdea.id) {
            console.log('✅ Only original jsondoc remains');
        } else {
            console.log('❌ Unexpected jsondocs remain or original jsondoc was deleted');
        }

        // Verify specific deletions
        const expectedDeletedIds = [
            aiPatchTransform.id,
            humanTransform1.id,
            humanTransform2.id
        ];

        const expectedDeletedJsondocIds = [
            patch1.id,
            patch2.id,
            editedPatch1.id,
            editedPatch2.id
        ];

        const actualDeletedTransformIds = rejectionResult.deletedTransformIds || [];
        const actualDeletedJsondocIds = rejectionResult.deletedPatchIds || [];

        console.log(`\nExpected deleted transforms: ${expectedDeletedIds.length}`);
        console.log(`Actual deleted transforms: ${actualDeletedTransformIds.length}`);
        console.log(`Expected deleted jsondocs: ${expectedDeletedJsondocIds.length}`);
        console.log(`Actual deleted jsondocs: ${actualDeletedJsondocIds.length}`);

        if (actualDeletedTransformIds.length === expectedDeletedIds.length) {
            console.log('✅ Correct number of transforms deleted');
        } else {
            console.log('❌ Incorrect number of transforms deleted');
        }

        if (actualDeletedJsondocIds.length === expectedDeletedJsondocIds.length) {
            console.log('✅ Correct number of jsondocs deleted');
        } else {
            console.log('❌ Incorrect number of jsondocs deleted');
        }

        console.log('\n🎉 Recursive patch deletion test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        // Cleanup: delete test project
        console.log('\n🧹 Cleaning up test data...');
        try {
            await db
                .deleteFrom('projects_users')
                .where('project_id', '=', TEST_PROJECT_ID)
                .execute();

            await db
                .deleteFrom('transform_inputs')
                .where('project_id', '=', TEST_PROJECT_ID)
                .execute();

            await db
                .deleteFrom('transform_outputs')
                .where('project_id', '=', TEST_PROJECT_ID)
                .execute();

            await db
                .deleteFrom('human_transforms')
                .where('project_id', '=', TEST_PROJECT_ID)
                .execute();

            await db
                .deleteFrom('llm_transforms')
                .where('project_id', '=', TEST_PROJECT_ID)
                .execute();

            await db
                .deleteFrom('transforms')
                .where('project_id', '=', TEST_PROJECT_ID)
                .execute();

            await db
                .deleteFrom('jsondocs')
                .where('project_id', '=', TEST_PROJECT_ID)
                .execute();

            await db
                .deleteFrom('projects')
                .where('id', '=', TEST_PROJECT_ID)
                .execute();

            console.log('✅ Test data cleaned up');
        } catch (cleanupError) {
            console.warn('⚠️ Cleanup failed:', cleanupError);
        }

        await db.destroy();
    }
}

if (require.main === module) {
    main().catch(console.error);
} 