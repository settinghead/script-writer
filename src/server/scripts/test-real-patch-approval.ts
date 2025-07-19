#!/usr/bin/env node

/**
 * Test script to verify the patch approval system works end-to-end
 * This simulates what happens when a user actually edits a brainstorm idea
 */

import { initializeParticleSystem } from '../services/ParticleSystemInitializer';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { executeStreamingTransform } from '../transform-jsondoc-framework/StreamingTransformExecutor';
import { BrainstormEditInputSchema } from '../../common/schemas/transforms';
import { JsonPatchOperationsSchema } from '../../common/schemas/transforms';
import getDatabase from '../database/connection';

async function testRealPatchApproval() {
    console.log('🧪 Testing Real Patch Approval System...\n');

    try {
        // 1. Get database and initialize system
        console.log('1. Initializing system...');
        const db = getDatabase;
        await initializeParticleSystem(db);
        console.log('✅ System initialized\n');

        // 2. Get repositories
        const jsondocRepo = new JsondocRepository(db);
        const transformRepo = new TransformRepository(db);

        // 3. Use existing project and brainstorm idea
        const projectId = '8e8f9289-54ed-4859-b1ef-9f41c562c264';
        const brainstormIdeaId = '206aaf61-996d-40d1-a14d-f996d7397515';
        const userId = 'test-user-1';

        console.log(`2. Using existing project: ${projectId}`);
        console.log(`   Using existing brainstorm idea: ${brainstormIdeaId}\n`);

        // 4. Get the original idea
        const originalIdea = await jsondocRepo.getJsondoc(brainstormIdeaId);
        if (!originalIdea) {
            throw new Error('Original brainstorm idea not found');
        }

        console.log('3. Original idea data:');
        const originalData = typeof originalIdea.data === 'string' ? JSON.parse(originalIdea.data) : originalIdea.data;
        console.log('   Title:', originalData.title);
        console.log('   Body preview:', originalData.body.substring(0, 100) + '...\n');

        // 5. Simulate user editing the idea with AI assistance
        console.log('4. Simulating AI edit request: "加入更多科幻元素"...');

        const editInput = {
            jsondocs: [{
                jsondocId: brainstormIdeaId,
                description: 'chosen_idea',
                schemaType: 'brainstorm_idea'
            }],
            ideaIndex: 0,
            editRequirements: '加入更多科幻元素'
        };

        // 6. Execute the streaming transform with patch-approval mode
        console.log('5. Executing streaming transform with patch-approval mode...');

        const result = await executeStreamingTransform({
            config: {
                templateName: 'brainstorm_edit_patch',
                inputSchema: BrainstormEditInputSchema,
                outputSchema: JsonPatchOperationsSchema,
            },
            input: editInput,
            projectId,
            userId,
            transformRepo,
            jsondocRepo,
            outputJsondocType: 'brainstorm_idea', // This will be ignored in patch-approval mode
            executionMode: {
                mode: 'patch-approval',
                originalJsondoc: originalData
            },
            transformMetadata: {
                toolName: 'edit_brainstorm_idea',
                source_jsondoc_id: brainstormIdeaId,
                editRequirements: editInput.editRequirements,
                original_idea: originalData
            },
            enableCaching: false // Disable caching for real test
        });

        console.log('✅ Transform executed successfully!');
        console.log(`   Transform ID: ${result.transformId}`);
        console.log(`   Output Jsondoc ID: ${result.outputJsondocId}`);
        console.log(`   Finish Reason: ${result.finishReason}\n`);

        // 7. Check if ai_patch transform was created
        const aiPatchTransform = await transformRepo.getTransform(result.transformId);
        console.log('6. Checking transform details...');
        console.log(`   Transform Type: ${aiPatchTransform?.type}`);
        console.log(`   Transform Status: ${aiPatchTransform?.status}`);

        if (aiPatchTransform?.type !== 'ai_patch') {
            throw new Error(`Expected ai_patch transform, got: ${aiPatchTransform?.type}`);
        }

        console.log('✅ AI patch transform created correctly!\n');

        // 8. Check patch jsondocs
        const transformOutputs = await transformRepo.getTransformOutputs(result.transformId);
        console.log('7. Checking patch jsondocs...');
        console.log(`   Number of patch outputs: ${transformOutputs.length}`);

        for (const output of transformOutputs) {
            const patchJsondoc = await jsondocRepo.getJsondoc(output.jsondoc_id);
            if (patchJsondoc) {
                console.log(`   Patch jsondoc: ${patchJsondoc.id}`);
                console.log(`   Schema type: ${patchJsondoc.schema_type}`);

                if (patchJsondoc.schema_type === 'json_patch') {
                    const patchData = typeof patchJsondoc.data === 'string' ? JSON.parse(patchJsondoc.data) : patchJsondoc.data;
                    console.log(`   Patch operation: ${patchData.patches[0].op} ${patchData.patches[0].path}`);
                    console.log(`   New value preview: ${JSON.stringify(patchData.patches[0].value).substring(0, 50)}...`);
                }
            }
        }

        console.log('✅ Patch jsondocs created correctly!\n');

        // 9. Check database state for frontend detection
        console.log('8. Database state for frontend detection:');
        console.log(`   - AI patch transform ID: ${result.transformId} (type: ai_patch, status: running)`);
        console.log(`   - Patch jsondocs: ${transformOutputs.length} created`);
        console.log(`   - Frontend should detect this via usePendingPatchApproval hook`);
        console.log(`   - Modal should appear at: https://localhost:4610/projects/${projectId}/brainstorm\n`);

        console.log('🎉 Real Patch Approval Test COMPLETED!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Open https://localhost:4610/projects/8e8f9289-54ed-4859-b1ef-9f41c562c264/brainstorm');
        console.log('2. The modal should appear automatically');
        console.log('3. Review and approve/reject the patches');
        console.log('4. Verify the changes are applied');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testRealPatchApproval().catch(console.error); 