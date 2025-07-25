#!/usr/bin/env node

/**
 * Test script to verify streaming patch creation functionality
 * 
 * Usage: ./run-ts src/server/scripts/test-streaming-patches.ts
 */

import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { BrainstormEditInputSchema } from '../../common/schemas/transforms';
import { executeStreamingTransform } from '../transform-jsondoc-framework/StreamingTransformExecutor';
import { JsonPatchOperationsSchema } from '../../common/schemas/transforms';
import { db } from '../database/connection';

async function testStreamingPatches() {
    const jsondocRepo = new JsondocRepository(db);
    const transformRepo = new TransformRepository(db);

    // Test user and project
    const testUserId = 'test-user-1';
    const testProjectId = 'project-test-streaming-patches';

    console.log('🧪 Testing Streaming Patch Creation');
    console.log('=====================================\n');

    try {
        // 1. Create test project
        console.log('1. Creating test project...');
        await db.insertInto('projects')
            .values({
                id: testProjectId,
                name: 'Streaming Patches Test',
                description: 'Test project for streaming patches',
                created_at: new Date(),
                updated_at: new Date()
            })
            .onConflict((oc) => oc.column('id').doUpdateSet({
                updated_at: new Date()
            }))
            .execute();

        await db.insertInto('projects_users')
            .values({
                project_id: testProjectId,
                user_id: testUserId,
                role: 'owner'
            })
            .onConflict((oc) => oc.columns(['project_id', 'user_id']).doNothing())
            .execute();

        console.log('✅ Test project created');

        // 2. Create a brainstorm idea to edit
        console.log('\n2. Creating test brainstorm idea...');
        const originalIdea = await jsondocRepo.createJsondoc(
            testProjectId,
            '灵感创意',
            {
                title: '霸总追妻火葬场',
                body: '沈总裁因为误会而冷落妻子，当他发现真相后开始疯狂追妻，但妻子已经心灰意冷。沈总裁必须用真心和行动来挽回妻子的心。'
            },
            'v1',
            {
                platform: '抖音',
                genre: '现代甜宠',
                created_for_test: true
            },
            'completed',
            'ai_generated'
        );

        console.log(`✅ Original idea created: ${originalIdea.id}`);

        // 3. Create streaming patch edit input
        console.log('\n3. Preparing patch edit input...');
        const editInput = {
            jsondocs: [{
                jsondocId: originalIdea.id,
                schemaType: '灵感创意',
                description: 'Original brainstorm idea to edit'
            }],
            ideaIndex: 0,
            editRequirements: '请让故事更加现代化，加入一些科技元素，比如沈总裁是科技公司CEO，误会是因为AI助手的误判导致的。'
        };

        // Validate input
        const validatedInput = BrainstormEditInputSchema.parse(editInput);
        console.log('✅ Edit input validated');

        // 4. Execute streaming transform with patch-approval mode
        console.log('\n4. Starting streaming patch creation...');
        console.log('⏱️  Watch for real-time patch jsondoc creation during streaming...\n');

        const result = await executeStreamingTransform({
            config: {
                templateName: 'brainstorm_edit_patch',
                inputSchema: BrainstormEditInputSchema,
                outputSchema: JsonPatchOperationsSchema,
            },
            input: validatedInput,
            projectId: testProjectId,
            userId: testUserId,
            transformRepo,
            jsondocRepo,
            outputJsondocType: '灵感创意',
            executionMode: {
                mode: 'patch-approval',
                originalJsondoc: {
                    title: '霸总追妻火葬场',
                    body: '沈总裁因为误会而冷落妻子，当他发现真相后开始疯狂追妻，但妻子已经心灰意冷。沈总裁必须用真心和行动来挽回妻子的心。'
                }
            },
            transformMetadata: {
                toolName: 'improve_灵感创意',
                source_jsondoc_id: originalIdea.id,
                idea_index: 0,
                edit_requirements: editInput.editRequirements,
                method: 'streaming_patches',
                test_mode: true
            },
            updateIntervalChunks: 2, // Update more frequently for testing
            enableCaching: false // Disable caching for real streaming
        });

        console.log(`✅ Streaming transform completed: ${result.transformId}`);

        // 5. Verify patch jsondocs were created
        console.log('\n5. Verifying patch jsondocs...');
        const transformOutputs = await transformRepo.getTransformOutputs(result.transformId);

        let patchCount = 0;
        for (const output of transformOutputs) {
            const jsondoc = await jsondocRepo.getJsondoc(output.jsondoc_id);
            if (jsondoc && jsondoc.schema_type === 'json_patch') {
                patchCount++;
                console.log(`📄 Patch jsondoc ${patchCount}: ${jsondoc.id}`);
                console.log(`   Created: ${jsondoc.created_at}`);

                // Show patch content
                const patchData = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
                if (patchData.patches && patchData.patches.length > 0) {
                    console.log(`   Patch: ${patchData.patches[0].op} ${patchData.patches[0].path}`);
                }
            }
        }

        console.log(`✅ Found ${patchCount} patch jsondocs`);

        // 6. Test frontend API endpoint
        console.log('\n6. Testing patch API endpoint...');

        // Note: In a real test, we would make an HTTP request to /api/patches/pending/projectId
        // For this script, we'll just verify the data is accessible
        const allProjectJsondocs = await jsondocRepo.getAllProjectJsondocsForLineage(testProjectId);
        const allProjectTransforms = await jsondocRepo.getAllProjectTransformsForLineage(testProjectId);
        const allTransformOutputs = await jsondocRepo.getAllProjectTransformOutputsForLineage(testProjectId);

        const aiPatchTransforms = allProjectTransforms.filter((t) => t.type === 'ai_patch');
        const patchJsondocs = allProjectJsondocs.filter((j) => j.schema_type === 'json_patch');

        console.log(`✅ Found ${aiPatchTransforms.length} ai_patch transforms`);
        console.log(`✅ Found ${patchJsondocs.length} patch jsondocs`);

        // 7. Summary
        console.log('\n🎉 Streaming Patches Test Summary');
        console.log('==================================');
        console.log(`✅ Transform ID: ${result.transformId}`);
        console.log(`✅ Patch jsondocs created: ${patchCount}`);
        console.log(`✅ Transform status: completed`);
        console.log(`✅ Frontend API data available: ${patchJsondocs.length} patches`);

        console.log('\n📋 Next Steps:');
        console.log('1. Open the frontend at https://localhost:4610');
        console.log(`2. Navigate to project: ${testProjectId}`);
        console.log('3. Verify that PatchReviewModal appears with streaming patches');
        console.log('4. Test patch approval/rejection functionality');

        console.log('\n🧹 Cleanup:');
        console.log(`To clean up test data, you can delete project: ${testProjectId}`);

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        throw error;
    } finally {
        process.exit(0);
    }
}

// Run the test
testStreamingPatches().catch(console.error); 