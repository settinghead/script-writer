#!/usr/bin/env node

import { db } from '../database/connection';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';
import { YJSService } from '../services/YJSService';
import { ProjectService } from '../services/ProjectService';

async function testYJSIntegration() {
    console.log('🧪 Testing YJS Integration...\n');

    const testProjectId = 'test-project-yjs';
    const testUserId = 'test-user-1';

    try {
        // Initialize services
        const artifactRepo = new ArtifactRepository(db);
        const yjsService = new YJSService(db, artifactRepo);
        const projectService = new ProjectService(db);

        console.log('✅ Services initialized successfully');

        // Test 0: Create test project and user (if needed)
        console.log('\n🏗️ Test 0: Setting up test project...');
        try {
            await projectService.createTestProject(testProjectId, testUserId, 'YJS Integration Test');
            console.log('✅ Test project created successfully');
        } catch (error) {
            // Project might already exist, that's fine
            console.log('⏭️  Test project already exists or creation failed:', error instanceof Error ? error.message : 'Unknown error');
        }

        // Test 1: Create a test artifact
        console.log('\n📝 Test 1: Creating test artifact...');
        const testArtifact = await artifactRepo.createArtifact(
            testProjectId,
            'brainstorm_idea',
            {
                title: 'Test Brainstorm Idea',
                body: 'This is a test idea for YJS integration',
                themes: ['test', 'yjs', 'collaboration']
            },
            'v1',
            { test: true },
            'completed',
            'user_input'
        );

        console.log('✅ Test artifact created:', testArtifact.id);

        // Test 2: Initialize YJS document
        console.log('\n📄 Test 2: Initializing YJS document...');
        const doc = await yjsService.getOrCreateDocument(testArtifact.id, testProjectId);
        console.log('✅ YJS document initialized successfully');

        // Test 3: Read initial content
        console.log('\n📖 Test 3: Reading initial YJS content...');
        const yMap = doc.getMap('content');
        const initialContent = yjsService.convertYJSToObject(yMap);
        console.log('✅ Initial content:', JSON.stringify(initialContent, null, 2));

        // Test 4: Modify YJS document
        console.log('\n✏️ Test 4: Modifying YJS document...');
        const titleText = yMap.get('title');
        if (titleText && titleText.toString) {
            titleText.delete(0, titleText.length);
            titleText.insert(0, 'Updated Test Brainstorm Idea');
        }

        // Add a new field
        yMap.set('status', 'updated');

        const modifiedContent = yjsService.convertYJSToObject(yMap);
        console.log('✅ Modified content:', JSON.stringify(modifiedContent, null, 2));

        // Test 5: Test document persistence
        console.log('\n💾 Test 5: Testing document persistence...');

        // Wait a moment for debounced persistence
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Create a new document instance to test loading from database
        const doc2 = await yjsService.getOrCreateDocument(testArtifact.id, testProjectId);
        const yMap2 = doc2.getMap('content');
        const persistedContent = yjsService.convertYJSToObject(yMap2);

        console.log('✅ Persisted content:', JSON.stringify(persistedContent, null, 2));

        // Test 6: Test awareness updates
        console.log('\n👥 Test 6: Testing awareness updates...');
        const testUpdate = Buffer.from('test-awareness-update');
        await yjsService.saveAwarenessUpdate(
            'test-client-1',
            `artifact-${testArtifact.id}`,
            testProjectId,
            testArtifact.id,
            testUpdate
        );

        const awarenessUpdates = await yjsService.getAwarenessUpdates(`artifact-${testArtifact.id}`);
        console.log('✅ Awareness updates saved and retrieved:', awarenessUpdates.length);

        // Test 7: Cleanup
        console.log('\n🧹 Test 7: Cleaning up...');
        yjsService.cleanupDocument(testArtifact.id);

        // Clean up YJS data from database first
        await db.deleteFrom('artifact_yjs_documents')
            .where('artifact_id', '=', testArtifact.id)
            .execute();

        await db.deleteFrom('artifact_yjs_awareness')
            .where('room_id', '=', `artifact-${testArtifact.id}`)
            .execute();

        // Clean up test data
        await artifactRepo.deleteArtifact(testArtifact.id, testProjectId);

        console.log('✅ Cleanup completed');

        console.log('\n🎉 All YJS integration tests passed!');

    } catch (error) {
        console.error('❌ YJS integration test failed:', error);
        process.exit(1);
    } finally {
        // Close database connection
        await db.destroy();
    }
}

// Run the test
testYJSIntegration().catch(console.error); 