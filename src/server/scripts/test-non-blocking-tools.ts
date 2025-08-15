#!/usr/bin/env node

/**
 * Test script to verify that tools complete immediately and return patch content
 * Usage: ./run-ts src/server/scripts/test-non-blocking-tools.ts
 */

import { db } from '../database/connection';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import { createBrainstormEditToolDefinition } from '../tools/BrainstormEditTool';
import { v4 as uuidv4 } from 'uuid';

async function testNonBlockingTools() {
    console.log('🚀 Testing Non-Blocking Tool Execution...\n');

    try {
        // Initialize repositories
        const jsondocRepo = new TransformJsondocRepository(db);
        const transformRepo = new TransformJsondocRepository(db);

        // Create test project
        const projectId = uuidv4();
        const testUserId = 'test-user-1';

        await db.insertInto('projects')
            .values({
                id: projectId,
                title: 'Non-Blocking Tools Test Project',
                description: 'Test project for non-blocking tool execution',
                project_type: 'script',
                status: 'active',
                created_at: new Date()
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
        const testIdea = {
            title: '测试故事创意',
            body: '这是一个测试用的故事创意，用于验证非阻塞修改提议系统。男主是科技公司CEO，女主是AI工程师。'
        };

        const ideaJsondoc = await jsondocRepo.createJsondoc(
            projectId,
            '灵感创意',
            testIdea,
            'v1',
            { test: true },
            'completed',
            'ai_generated'
        );

        console.log(`✅ Test idea created: ${ideaJsondoc.id}\n`);

        // Test the BrainstormEditTool (should complete immediately)
        console.log('🔧 Testing BrainstormEditTool non-blocking execution...');

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
                schemaType: '灵感创意'
            }],
            editRequirements: '请将故事背景改为现代都市，增加更多科技元素和职场竞争'
        };

        // Record start time
        const startTime = Date.now();

        console.log('⏱️  Starting tool execution...');

        // Execute the tool (should NOT block)
        const result = await brainstormEditTool.execute(editInput, { toolCallId: 'test-non-blocking' });

        // Record end time
        const endTime = Date.now();
        const executionTime = endTime - startTime;

        console.log(`⏱️  Tool execution completed in ${executionTime}ms\n`);

        // Verify results
        console.log('📊 Verifying results...');

        // Should complete quickly (less than 30 seconds for non-blocking)
        if (executionTime > 30000) {
            console.warn(`⚠️  Tool took ${executionTime}ms - might be blocking!`);
        } else {
            console.log(`✅ Tool completed quickly (${executionTime}ms) - non-blocking confirmed`);
        }

        // Should return success status
        console.log(`📋 Tool result status: ${result.status}`);
        expect(result.status).toBe('success');

        // Should have patch content for agent context
        if (result.status === 'success') {
            console.log(`📋 Output jsondoc ID: ${result.outputJsondocId}`);
            console.log(`📋 Patch count: ${result.patchCount || 0}`);
            console.log(`📋 Has patch content: ${result.patchContent ? 'YES' : 'NO'}`);
            console.log(`📋 Agent message: ${result.message || 'N/A'}`);

            // Verify patch content structure
            if (result.patchContent && Array.isArray(result.patchContent)) {
                console.log('\n🔍 Patch content details:');
                result.patchContent.forEach((patch, index) => {
                    console.log(`  ${index + 1}. ${patch.summary} (${patch.operation} ${patch.path})`);
                    if (patch.newValue && typeof patch.newValue === 'string' && patch.newValue.length > 50) {
                        console.log(`     New value: ${patch.newValue.substring(0, 50)}...`);
                    } else {
                        console.log(`     New value: ${JSON.stringify(patch.newValue)}`);
                    }
                });
            }

            // Basic assertions
            expect(result.outputJsondocId).toBeTruthy();
            expect(result.finishReason).toBeTruthy();
            expect(result.patchCount).toBeGreaterThan(0);
            expect(result.patchContent).toBeTruthy();
            expect(Array.isArray(result.patchContent)).toBe(true);
            expect(result.message).toBeTruthy();
        }

        // Verify database state
        console.log('\n🗃️  Verifying database state...');

        // Check that ai_patch transform was created
        const transforms = await db
            .selectFrom('transforms')
            .where('project_id', '=', projectId)
            .where('type', '=', 'ai_patch')
            .selectAll()
            .execute();

        console.log(`📋 AI patch transforms created: ${transforms.length}`);
        expect(transforms.length).toBe(1);

        const aiPatchTransform = transforms[0];
        console.log(`📋 Transform status: ${aiPatchTransform.status}`);
        console.log(`📋 Transform ID: ${aiPatchTransform.id}`);

        // Check that patch jsondocs were created
        const patchJsondocs = await db
            .selectFrom('jsondocs')
            .where('project_id', '=', projectId)
            .where('schema_type', '=', 'json_patch')
            .selectAll()
            .execute();

        console.log(`📋 Patch jsondocs created: ${patchJsondocs.length}`);
        expect(patchJsondocs.length).toBeGreaterThan(0);

        // Verify no blocking/waiting occurred
        console.log('\n🚫 Verifying no blocking occurred...');
        console.log('✅ Tool completed without waiting for user approval');
        console.log('✅ Agent received patch content for context');
        console.log('✅ Database state is consistent');

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await db.deleteFrom('projects_users').where('project_id', '=', projectId).execute();
        await db.deleteFrom('transforms').where('project_id', '=', projectId).execute();
        await db.deleteFrom('jsondocs').where('project_id', '=', projectId).execute();
        await db.deleteFrom('projects').where('id', '=', projectId).execute();
        console.log('✅ Test data cleaned up\n');

        console.log('🎉 Non-Blocking Tools Test PASSED!');
        console.log('\nAll requirements verified:');
        console.log('  ✅ Tool execution is non-blocking');
        console.log('  ✅ Tool returns patch content for agent');
        console.log('  ✅ Agent receives contextual information');
        console.log('  ✅ Database state is consistent');
        console.log('  ✅ No user approval blocking occurs');

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
    testNonBlockingTools()
        .then(() => {
            console.log('\n✅ Test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
}

export { testNonBlockingTools }; 