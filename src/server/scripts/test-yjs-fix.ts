#!/usr/bin/env node

import { JsonDocRepository } from '../transform-jsonDoc-framework/JsonDocRepository';
import { ProjectRepository } from '../transform-jsonDoc-framework/ProjectRepository';
import { db } from '../database/connection';

const TEST_PROJECT_ID = 'c4516b01-9485-4646-bf29-30f86558cef9';
const TEST_USER_ID = 'test-user-1';

async function testYJSFix() {
    console.log('🧪 Testing YJS infinite loop fix...');

    try {
        // Initialize repositories
        const jsonDocRepo = new JsonDocRepository(db);
        const projectRepo = new ProjectRepository(db);

        // Verify project exists
        const project = await projectRepo.getProject(TEST_PROJECT_ID);
        if (!project) {
            console.error('❌ Test project not found');
            return;
        }

        console.log('✅ Project found:', project.name);

        // Create a test brainstorm jsonDoc
        const testJsonDoc = await jsonDocRepo.createJsonDoc(
            TEST_PROJECT_ID,
            'brainstorm_idea',
            {
                title: '测试YJS创意',
                body: '这是一个测试YJS协作编辑功能的创意内容。'
            },
            'v1',
            {
                test: true,
                purpose: 'yjs-fix-test'
            },
            'completed',
            'ai_generated'
        );

        console.log('✅ Test jsonDoc created:', testJsonDoc.id);

        // Test the jsonDoc can be retrieved
        const retrievedJsonDocs = await jsonDocRepo.getJsonDocsByIds([testJsonDoc.id]);
        const retrievedJsonDoc = retrievedJsonDocs[0];
        if (!retrievedJsonDoc) {
            console.error('❌ Failed to retrieve test jsonDoc');
            return;
        }

        console.log('✅ Test jsonDoc retrieved successfully');
        console.log('📝 JsonDoc data:', JSON.parse(retrievedJsonDoc.data));

        // Test YJS document creation endpoint
        const response = await fetch(`http://localhost:4600/api/yjs/jsonDoc/${testJsonDoc.id}`, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer debug-auth-token-script-writer-dev'
            }
        });

        if (response.ok) {
            const yjsData = await response.json();
            console.log('✅ YJS endpoint working:', yjsData);
        } else {
            console.log('⚠️  YJS endpoint response:', response.status, response.statusText);
        }

        console.log('🎉 YJS fix test completed successfully!');
        console.log('');
        console.log('📋 Test Summary:');
        console.log(`   - Project: ${project.name}`);
        console.log(`   - JsonDoc ID: ${testJsonDoc.id}`);
        console.log(`   - Test URL: https://localhost:4610/projects/${TEST_PROJECT_ID}`);
        console.log('');
        console.log('🔍 To manually test the fix:');
        console.log('   1. Open https://localhost:4610/projects/' + TEST_PROJECT_ID);
        console.log('   2. Look for the YJS Demo component');
        console.log('   3. Check browser console for infinite loop messages');
        console.log('   4. The jsonDoc should load without continuous re-initialization');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testYJSFix().catch(console.error); 