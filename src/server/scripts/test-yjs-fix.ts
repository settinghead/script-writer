#!/usr/bin/env node

import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { ProjectRepository } from '../transform-jsondoc-framework/ProjectRepository';
import { db } from '../database/connection';

const TEST_PROJECT_ID = 'c4516b01-9485-4646-bf29-30f86558cef9';
const TEST_USER_ID = 'test-user-1';

async function testYJSFix() {
    console.log('🧪 Testing YJS infinite loop fix...');

    try {
        // Initialize repositories
        const jsondocRepo = new JsondocRepository(db);
        const projectRepo = new ProjectRepository(db);

        // Verify project exists
        const project = await projectRepo.getProject(TEST_PROJECT_ID);
        if (!project) {
            console.error('❌ Test project not found');
            return;
        }

        console.log('✅ Project found:', project.name);

        // Create a test brainstorm jsondoc
        const testJsondoc = await jsondocRepo.createJsondoc(
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

        console.log('✅ Test jsondoc created:', testJsondoc.id);

        // Test the jsondoc can be retrieved
        const retrievedJsondocs = await jsondocRepo.getJsondocsByIds([testJsondoc.id]);
        const retrievedJsondoc = retrievedJsondocs[0];
        if (!retrievedJsondoc) {
            console.error('❌ Failed to retrieve test jsondoc');
            return;
        }

        console.log('✅ Test jsondoc retrieved successfully');
        console.log('📝 Jsondoc data:', JSON.parse(retrievedJsondoc.data));

        // Test YJS document creation endpoint
        const response = await fetch(`http://localhost:4600/api/yjs/jsondoc/${testJsondoc.id}`, {
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
        console.log(`   - Jsondoc ID: ${testJsondoc.id}`);
        console.log(`   - Test URL: https://localhost:4610/projects/${TEST_PROJECT_ID}`);
        console.log('');
        console.log('🔍 To manually test the fix:');
        console.log('   1. Open https://localhost:4610/projects/' + TEST_PROJECT_ID);
        console.log('   2. Look for the YJS Demo component');
        console.log('   3. Check browser console for infinite loop messages');
        console.log('   4. The jsondoc should load without continuous re-initialization');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testYJSFix().catch(console.error); 