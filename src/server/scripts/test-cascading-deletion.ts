#!/usr/bin/env node

/**
 * Test script to verify cascading deletion logic for patch rejection
 * Usage: ./run-ts src/server/scripts/test-cascading-deletion.ts
 */

import { db } from '../database/connection';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { v4 as uuidv4 } from 'uuid';

async function testCascadingDeletion() {
    console.log('🚀 Testing Cascading Deletion Logic...\n');

    try {
        // Initialize repositories
        const jsondocRepo = new JsondocRepository(db);
        const transformRepo = new TransformRepository(db);

        // Create test project
        const projectId = uuidv4();
        const testUserId = 'test-user-1';

        await db.insertInto('projects')
            .values({
                id: projectId,
                name: 'Cascading Deletion Test Project',
                description: 'Test project for cascading deletion',
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

        // Test Case 1: Simple patch rejection (no human edits)
        console.log('📝 Test Case 1: Simple patch rejection...');

        // Create original jsondoc
        const originalJsondoc = await jsondocRepo.createJsondoc(
            projectId,
            'brainstorm_idea',
            { title: 'Original Title', body: 'Original content' },
            'v1',
            {},
            'completed',
            'ai_generated'
        );

        // Create ai_patch transform
        const aiPatchTransform1 = await transformRepo.createTransform(
            projectId,
            'ai_patch',
            'v1',
            'running',
            { test_case: 'simple_rejection' }
        );

        // Link original as input
        await transformRepo.addTransformInputs(aiPatchTransform1.id, [
            { jsondocId: originalJsondoc.id, inputRole: 'source' }
        ], projectId);

        // Create patch jsondocs
        const patch1 = await jsondocRepo.createJsondoc(
            projectId,
            'json_patch',
            {
                patches: [{ op: 'replace', path: '/title', value: 'New Title' }],
                targetJsondocId: originalJsondoc.id,
                applied: false
            },
            'v1',
            {},
            'completed',
            'ai_generated'
        );

        const patch2 = await jsondocRepo.createJsondoc(
            projectId,
            'json_patch',
            {
                patches: [{ op: 'replace', path: '/body', value: 'New content' }],
                targetJsondocId: originalJsondoc.id,
                applied: false
            },
            'v1',
            {},
            'completed',
            'ai_generated'
        );

        // Link patches as outputs
        await transformRepo.addTransformOutputs(aiPatchTransform1.id, [
            { jsondocId: patch1.id, outputRole: 'patch' },
            { jsondocId: patch2.id, outputRole: 'patch' }
        ], projectId);

        console.log(`✅ Created ai_patch transform with 2 patches`);

        // Test rejecting one patch (should not delete transform - still has other patch)
        console.log('🗑️  Rejecting patch 1...');

        // Import the rejection functions directly
        const { rejectPatch } = await import('../routes/patchRoutes.js');

        // Use direct function call instead of HTTP
        const result1 = await rejectPatch(patch1.id, transformRepo, jsondocRepo, projectId);
        console.log(`📋 Deleted ${result1.deletedJsondocIds.length} patches, ${result1.deletedTransformIds.length} transforms`);

        // Verify patch1 is deleted but transform and patch2 remain
        const remainingPatches1 = await db
            .selectFrom('jsondocs')
            .where('project_id', '=', projectId)
            .where('schema_type', '=', 'json_patch')
            .selectAll()
            .execute();

        const remainingTransforms1 = await db
            .selectFrom('transforms')
            .where('project_id', '=', projectId)
            .where('type', '=', 'ai_patch')
            .selectAll()
            .execute();

        expect(remainingPatches1.length).toBe(1);
        expect(remainingTransforms1.length).toBe(1);
        console.log('✅ Partial rejection works - transform preserved with remaining patch');

        // Test rejecting the last patch (should delete transform)
        console.log('🗑️  Rejecting patch 2 (last patch)...');

        const result2 = await rejectPatch(patch2.id, transformRepo, jsondocRepo, projectId);
        console.log(`📋 Deleted ${result2.deletedJsondocIds.length} patches, ${result2.deletedTransformIds.length} transforms`);

        // Verify both patch and transform are deleted
        const remainingPatches2 = await db
            .selectFrom('jsondocs')
            .where('project_id', '=', projectId)
            .where('schema_type', '=', 'json_patch')
            .selectAll()
            .execute();

        const remainingTransforms2 = await db
            .selectFrom('transforms')
            .where('project_id', '=', projectId)
            .where('type', '=', 'ai_patch')
            .selectAll()
            .execute();

        expect(remainingPatches2.length).toBe(0);
        expect(remainingTransforms2.length).toBe(0);
        console.log('✅ Complete rejection works - orphaned transform deleted');

        // Test Case 2: Complex patch rejection with human edits
        console.log('\n📝 Test Case 2: Complex patch rejection with human edits...');

        // Create another ai_patch transform with patches
        const aiPatchTransform2 = await transformRepo.createTransform(
            projectId,
            'ai_patch',
            'v1',
            'running',
            { test_case: 'complex_rejection' }
        );

        await transformRepo.addTransformInputs(aiPatchTransform2.id, [
            { jsondocId: originalJsondoc.id, inputRole: 'source' }
        ], projectId);

        const patch3 = await jsondocRepo.createJsondoc(
            projectId,
            'json_patch',
            {
                patches: [{ op: 'replace', path: '/title', value: 'AI Edited Title' }],
                targetJsondocId: originalJsondoc.id,
                applied: false
            },
            'v1',
            {},
            'completed',
            'ai_generated'
        );

        await transformRepo.addTransformOutputs(aiPatchTransform2.id, [
            { jsondocId: patch3.id, outputRole: 'patch' }
        ], projectId);

        // Create human transform that edits the patch
        const humanTransform = await transformRepo.createTransform(
            projectId,
            'human',
            'v1',
            'completed',
            { test_case: 'human_edit_of_patch' }
        );

        await transformRepo.addTransformInputs(humanTransform.id, [
            { jsondocId: patch3.id, inputRole: 'source' }
        ], projectId);

        // Create human-edited patch jsondoc
        const humanEditedPatch = await jsondocRepo.createJsondoc(
            projectId,
            'json_patch',
            {
                patches: [{ op: 'replace', path: '/title', value: 'Human Edited Title' }],
                targetJsondocId: originalJsondoc.id,
                applied: false
            },
            'v1',
            {},
            'completed',
            'user_input'
        );

        await transformRepo.addTransformOutputs(humanTransform.id, [
            { jsondocId: humanEditedPatch.id, outputRole: 'edited_patch' }
        ], projectId);

        // Create another level - human transform that uses the human-edited patch
        const humanTransform2 = await transformRepo.createTransform(
            projectId,
            'human',
            'v1',
            'completed',
            { test_case: 'second_level_human_edit' }
        );

        await transformRepo.addTransformInputs(humanTransform2.id, [
            { jsondocId: humanEditedPatch.id, inputRole: 'source' }
        ], projectId);

        const finalEditedPatch = await jsondocRepo.createJsondoc(
            projectId,
            'json_patch',
            {
                patches: [{ op: 'replace', path: '/title', value: 'Final Edited Title' }],
                targetJsondocId: originalJsondoc.id,
                applied: false
            },
            'v1',
            {},
            'completed',
            'user_input'
        );

        await transformRepo.addTransformOutputs(humanTransform2.id, [
            { jsondocId: finalEditedPatch.id, outputRole: 'final_patch' }
        ], projectId);

        console.log('✅ Created complex hierarchy: ai_patch -> human_edit -> human_edit2');

        // Count before deletion
        const beforePatches = await db
            .selectFrom('jsondocs')
            .where('project_id', '=', projectId)
            .where('schema_type', '=', 'json_patch')
            .selectAll()
            .execute();

        const beforeTransforms = await db
            .selectFrom('transforms')
            .where('project_id', '=', projectId)
            .selectAll()
            .execute();

        console.log(`📊 Before deletion: ${beforePatches.length} patches, ${beforeTransforms.length} transforms`);

        // Test rejecting the original AI patch (should cascade delete everything)
        console.log('🗑️  Rejecting original AI patch (should cascade delete human edits)...');

        const { rejectPatchWithHumanEdits } = await import('../routes/patchRoutes.js');
        const result3 = await rejectPatchWithHumanEdits(patch3.id, transformRepo, jsondocRepo, projectId);
        console.log(`📋 Deleted ${result3.deletedJsondocIds.length} patches, ${result3.deletedTransformIds.length} transforms`);

        // Verify cascading deletion worked
        const afterPatches = await db
            .selectFrom('jsondocs')
            .where('project_id', '=', projectId)
            .where('schema_type', '=', 'json_patch')
            .selectAll()
            .execute();

        const afterTransforms = await db
            .selectFrom('transforms')
            .where('project_id', '=', projectId)
            .where('type', 'in', ['ai_patch', 'human'])
            .selectAll()
            .execute();

        console.log(`📊 After deletion: ${afterPatches.length} patches, ${afterTransforms.length} transforms`);

        expect(afterPatches.length).toBe(0);
        expect(afterTransforms.length).toBe(0);
        console.log('✅ Cascading deletion works - entire human edit tree deleted');

        // Verify original jsondoc is preserved
        const originalStillExists = await jsondocRepo.getJsondoc(originalJsondoc.id);
        expect(originalStillExists).toBeTruthy();
        console.log('✅ Original jsondoc preserved - no accidental deletion');

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await db.deleteFrom('projects_users').where('project_id', '=', projectId).execute();
        await db.deleteFrom('transforms').where('project_id', '=', projectId).execute();
        await db.deleteFrom('jsondocs').where('project_id', '=', projectId).execute();
        await db.deleteFrom('projects').where('id', '=', projectId).execute();
        console.log('✅ Test data cleaned up\n');

        console.log('🎉 Cascading Deletion Test PASSED!');
        console.log('\nAll requirements verified:');
        console.log('  ✅ Simple patch rejection works');
        console.log('  ✅ Orphaned transform cleanup works');
        console.log('  ✅ Complex cascading deletion works');
        console.log('  ✅ Human edit trees are properly deleted');
        console.log('  ✅ Original jsondocs are preserved');

    } catch (error) {
        console.error('❌ Test FAILED:', error);
        throw error;
    }
}

// Simple assertion helper
function expect(actual: any) {
    return {
        toBe: (expected: any) => {
            if (actual !== expected) {
                throw new Error(`Expected ${actual} to be ${expected}`);
            }
        },
        toBeTruthy: () => {
            if (!actual) {
                throw new Error(`Expected ${actual} to be truthy`);
            }
        },
        toBeGreaterThan: (expected: number) => {
            if (actual <= expected) {
                throw new Error(`Expected ${actual} to be greater than ${expected}`);
            }
        }
    };
}

// Run the test if this script is executed directly
if (require.main === module) {
    testCascadingDeletion()
        .then(() => {
            console.log('\n✅ Test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
}

export { testCascadingDeletion }; 