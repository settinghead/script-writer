#!/usr/bin/env node

import { db } from '../database/connection';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { createBrainstormEditToolDefinition } from '../tools/BrainstormTools';

async function testPatchApprovalWorkflow() {
    const jsondocRepo = new JsondocRepository(db);
    const transformRepo = new TransformRepository(db);

    const projectId = '839d9d37-7af4-4678-b0c0-1be07acb26eb';
    const userId = 'test-user-1';
    const brainstormIdeaId = 'a1ea2d83-c65d-4de1-8a9a-f2ca1833fc73';

    console.log('🚀 Starting patch approval workflow test...');

    // Create the brainstorm edit tool
    const brainstormEditTool = createBrainstormEditToolDefinition(
        transformRepo,
        jsondocRepo,
        projectId,
        userId,
        { enableCaching: false }
    );

    // Prepare input for brainstorm edit
    const editInput = {
        jsondocs: [{
            jsondocId: brainstormIdeaId,
            description: '当前的故事创意',
            schemaType: 'brainstorm_idea' as const
        }],
        editRequirements: '增加更多悬疑元素和心理描写，让角色的内心世界更加丰富',
        agentInstructions: '保持原有的幽默风格，但增加深度',
        ideaIndex: 0
    };

    try {
        console.log('📝 Triggering brainstorm edit tool...');
        console.log('Input:', JSON.stringify(editInput, null, 2));

        // This will create an ai_patch transform and wait for approval
        const result = await brainstormEditTool.execute(editInput, { toolCallId: 'test-approval-workflow' });

        console.log('✅ Brainstorm edit completed successfully!');
        console.log('Result:', JSON.stringify(result, null, 2));

    } catch (error) {
        if (error instanceof Error && error.message.includes('Patches were rejected')) {
            console.log('⏳ Patches are waiting for approval...');
            console.log('You can now test the approval endpoint!');
        } else if (error instanceof Error && error.message.includes('waitForPatchApproval')) {
            console.log('⏳ Tool is waiting for patch approval...');
            console.log('Check the database for the new ai_patch transform and test approval!');
        } else {
            console.error('❌ Error during brainstorm edit:', error);
        }
    }

    // Show current transforms waiting for approval
    console.log('\n📋 Checking for transforms waiting for approval...');
    const transforms = await db
        .selectFrom('transforms')
        .where('project_id', '=', projectId)
        .where('type', '=', 'ai_patch')
        .where('status', '=', 'running')
        .selectAll()
        .execute();

    if (transforms.length > 0) {
        console.log(`Found ${transforms.length} ai_patch transform(s) waiting for approval:`);
        transforms.forEach((t: any) => {
            console.log(`  - Transform ID: ${t.id}`);
            console.log(`    Created: ${t.created_at}`);
            console.log(`    Status: ${t.status}`);
            console.log(`    You can approve with: curl -k "https://localhost:4610/api/transforms/${t.id}/approve" -X POST -H "Authorization: Bearer debug-auth-token-script-writer-dev" -d '{}'`);
        });
    } else {
        console.log('No ai_patch transforms waiting for approval found.');
    }
}

if (require.main === module) {
    testPatchApprovalWorkflow()
        .then(() => {
            console.log('\n🏁 Test completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Test failed:', error);
            process.exit(1);
        });
} 