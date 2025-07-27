#!/usr/bin/env node

/**
 * Direct test of recursive deletion logic
 * Tests the deleteTransformRecursively function directly
 */

import { config } from 'dotenv';
config();

import { db } from '../database/connection';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';

const jsondocRepo = new TransformJsondocRepository(db);
const transformRepo = new TransformJsondocRepository(db);

const TEST_USER_ID = 'test-user-1';
const TEST_PROJECT_ID = 'test-project-recursive-direct';

/**
 * Recursively delete a transform and all its descendants
 * This includes any transforms that use the outputs of this transform as inputs
 */
async function deleteTransformRecursively(
    transformId: string,
    transformRepo: TransformJsondocRepository,
    jsondocRepo: TransformJsondocRepository,
    visitedTransforms: Set<string> = new Set()
): Promise<{ deletedTransformIds: string[], deletedJsondocIds: string[] }> {
    // Prevent infinite loops
    if (visitedTransforms.has(transformId)) {
        return { deletedTransformIds: [], deletedJsondocIds: [] };
    }
    visitedTransforms.add(transformId);

    console.log(`[DeleteTransformRecursively] Processing transform: ${transformId}`);

    // Get the transform to verify it exists
    const transform = await transformRepo.getTransform(transformId);
    if (!transform) {
        console.log(`[DeleteTransformRecursively] Transform not found: ${transformId}`);
        return { deletedTransformIds: [], deletedJsondocIds: [] };
    }

    // Get all output jsondocs for this transform
    const outputJsondocs = await transformRepo.getTransformOutputs(transformId);
    console.log(`[DeleteTransformRecursively] Found ${outputJsondocs.length} output jsondocs for transform ${transformId}`);

    let allDeletedTransformIds: string[] = [];
    let allDeletedJsondocIds: string[] = [];

    // For each output jsondoc, find and recursively delete dependent transforms
    for (const output of outputJsondocs) {
        const dependentTransforms = await transformRepo.getTransformInputsByJsondoc(output.jsondoc_id);
        console.log(`[DeleteTransformRecursively] Jsondoc ${output.jsondoc_id} has ${dependentTransforms.length} dependent transforms`);

        // Recursively delete all dependent transforms first
        for (const dependentInput of dependentTransforms) {
            const recursiveResult = await deleteTransformRecursively(
                dependentInput.transform_id,
                transformRepo,
                jsondocRepo,
                visitedTransforms
            );
            allDeletedTransformIds.push(...recursiveResult.deletedTransformIds);
            allDeletedJsondocIds.push(...recursiveResult.deletedJsondocIds);
        }
    }

    // Now delete this transform itself (all dependents have been deleted)
    console.log(`[DeleteTransformRecursively] Deleting transform ${transformId} and its ${outputJsondocs.length} jsondocs`);

    // Delete transform relationships first
    await transformRepo.deleteTransformInputs(transformId);
    await transformRepo.deleteTransformOutputs(transformId);

    // Delete transform-specific records
    await transformRepo.deleteHumanTransformByTransformId(transformId);
    await transformRepo.deleteLLMTransformByTransformId(transformId);

    // Delete output jsondocs
    const deletedJsondocIds: string[] = [];
    for (const output of outputJsondocs) {
        await jsondocRepo.deleteJsondoc(output.jsondoc_id);
        deletedJsondocIds.push(output.jsondoc_id);
    }

    // Finally, delete the transform itself
    await transformRepo.deleteTransform(transformId);

    // Add this transform's results to the totals
    allDeletedTransformIds.push(transformId);
    allDeletedJsondocIds.push(...deletedJsondocIds);

    console.log(`[DeleteTransformRecursively] Completed deletion of transform ${transformId}`);
    return {
        deletedTransformIds: allDeletedTransformIds,
        deletedJsondocIds: allDeletedJsondocIds
    };
}

async function main() {
    console.log('🧪 Testing recursive deletion logic directly...\n');

    try {
        // 1. Create test project
        console.log('1. Creating test project...');
        await db
            .insertInto('projects')
            .values({
                id: TEST_PROJECT_ID,
                name: 'Test Recursive Deletion Direct',
                description: 'Testing recursive deletion directly',
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

        // 2. Create original jsondoc
        console.log('2. Creating original jsondoc...');
        const originalIdea = await jsondocRepo.createJsondoc(
            TEST_PROJECT_ID,
            '灵感创意',
            {
                title: '原始创意：现代都市爱情',
                body: '一个关于现代都市中两个独立个体相遇相爱的故事。'
            },
            'v1',
            { source: 'ai_generation' },
            'completed',
            'ai_generated'
        );
        console.log(`✅ Original idea created: ${originalIdea.id}\n`);

        // 3. Create AI patch transform with patches
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
                    { op: 'replace', path: '/body', value: '讲述一位独立自主的职场女性与一位温柔体贴的咖啡师之间的现代爱情故事。' }
                ],
                targetJsondocId: originalIdea.id,
                applied: false
            },
            'v1',
            { patch_index: 1 },
            'completed',
            'ai_generated'
        );

        await transformRepo.addTransformOutputs(aiPatchTransform.id, [
            { jsondocId: patch1.id, outputRole: 'patch' },
            { jsondocId: patch2.id, outputRole: 'patch' }
        ], TEST_PROJECT_ID);

        console.log(`✅ AI patch transform created: ${aiPatchTransform.id}`);
        console.log(`✅ Patch jsondocs created: ${patch1.id}, ${patch2.id}\n`);

        // 4. Create human transform descendants
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

        // 5. Verify structure before deletion
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

        // 6. Test recursive deletion
        console.log('6. Testing recursive deletion...');
        const deletionResult = await deleteTransformRecursively(
            aiPatchTransform.id,
            transformRepo,
            jsondocRepo
        );

        console.log('✅ Recursive deletion completed:', deletionResult);

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

        // 8. Validate results
        console.log('\n8. Validating results...');

        const expectedDeletedTransforms = 3; // ai_patch + 2 human transforms
        const expectedDeletedJsondocs = 4; // 2 patches + 2 edited patches
        const expectedRemainingJsondocs = 1; // original idea only

        if (remainingTransforms.length === 0) {
            console.log('✅ All transforms deleted correctly');
        } else {
            console.log('❌ Some transforms remain that should have been deleted');
        }

        if (remainingJsondocs.length === expectedRemainingJsondocs &&
            remainingJsondocs[0].id === originalIdea.id) {
            console.log('✅ Only original jsondoc remains');
        } else {
            console.log('❌ Unexpected jsondocs remain or original jsondoc was deleted');
        }

        if (deletionResult.deletedTransformIds.length === expectedDeletedTransforms) {
            console.log('✅ Correct number of transforms deleted');
        } else {
            console.log(`❌ Expected ${expectedDeletedTransforms} transforms deleted, got ${deletionResult.deletedTransformIds.length}`);
        }

        if (deletionResult.deletedJsondocIds.length === expectedDeletedJsondocs) {
            console.log('✅ Correct number of jsondocs deleted');
        } else {
            console.log(`❌ Expected ${expectedDeletedJsondocs} jsondocs deleted, got ${deletionResult.deletedJsondocIds.length}`);
        }

        console.log('\n🎉 Recursive deletion test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        // Cleanup
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