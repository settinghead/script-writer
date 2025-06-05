#!/usr/bin/env node

/**
 * Test script to verify StreamObjectService migration
 * Tests the new AI SDK streamObject implementation
 */

import { StreamObjectService } from './src/server/services/streaming/StreamObjectService.js';
import { ArtifactRepository } from './src/server/repositories/ArtifactRepository.js';
import { TransformRepository } from './src/server/repositories/TransformRepository.js';
import { TemplateService } from './src/server/services/templates/TemplateService.js';
import { db, initializeDatabase } from './src/server/database/connection.js';
import { Writable } from 'stream';

async function testStreamObjectMigration() {
    console.log('🧪 Testing StreamObjectService Migration');
    console.log('=====================================\n');

    try {
        // Initialize database
        await initializeDatabase();
        console.log('✅ Database initialized\n');

        // Create repositories and services
        const artifactRepo = new ArtifactRepository(db);
        const transformRepo = new TransformRepository(db);
        const templateService = new TemplateService();

        // Create test user ID
        const testUserId = 'test-user-streamobject';

        // Create the new StreamObjectService
        const streamService = new StreamObjectService(
            artifactRepo,
            transformRepo,
            templateService
        );
        console.log('✅ StreamObjectService created\n');

        // Test brainstorming parameters
        const params = {
            platform: '测试平台',
            genrePaths: [['喜剧', '恋爱剧']],
            genreProportions: [100],
            requirements: '测试要求：简单有趣的短剧'
        };

        console.log('📝 Testing brainstorming with params:', JSON.stringify(params, null, 2));

        // Create a mock response object
        const mockResponse = new Writable({
            write(chunk) {
                console.log('📡 Stream chunk:', chunk.toString());
                return true;
            }
        });

        // Add required methods for Response interface
        mockResponse.setHeader = (name, value) => {
            console.log(`🔧 Setting header: ${name} = ${value}`);
        };
        mockResponse.end = () => {
            console.log('🏁 Stream ended\n');
        };
        mockResponse.destroyed = false;
        mockResponse.writable = true;
        mockResponse.headersSent = false;

        // Test the streamBrainstorming method
        console.log('🚀 Starting brainstorming stream...\n');
        await streamService.streamBrainstorming(testUserId, params, mockResponse);

        console.log('✅ Brainstorming stream completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        // Close database connection
        await db.destroy();
        console.log('🔐 Database connection closed');
    }
}

// Run the test
testStreamObjectMigration(); 