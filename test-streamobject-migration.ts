#!/usr/bin/env tsx

/**
 * Test script to verify StreamObjectService migration
 * Tests the new AI SDK streamObject implementation
 */

import { StreamObjectService } from './src/server/services/streaming/StreamObjectService';
import { ArtifactRepository } from './src/server/repositories/ArtifactRepository';
import { TransformRepository } from './src/server/repositories/TransformRepository';
import { TemplateService } from './src/server/services/templates/TemplateService';
import { db, initializeDatabase } from './src/server/database/connection';
import { Response } from 'express';

// Mock Response object for testing
class MockResponse {
  public headersSent = false;
  public destroyed = false;
  public writable = true;
  private chunks: string[] = [];

  setHeader(name: string, value: string) {
    console.log(`🔧 Setting header: ${name} = ${value}`);
  }

  write(chunk: string) {
    console.log('📡 Stream chunk:', chunk);
    this.chunks.push(chunk);
    return true;
  }

  end() {
    console.log('🏁 Stream ended');
    console.log(`📊 Total chunks received: ${this.chunks.length}\n`);
  }

  status(code: number) {
    console.log(`📝 Status: ${code}`);
    return this;
  }

  json(data: any) {
    console.log('📄 JSON response:', JSON.stringify(data, null, 2));
  }
}

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
    
    // Ensure test user exists in database
    await db('users').insert({
      id: testUserId,
      username: 'test-streamobject',
      display_name: 'StreamObject Test User',
      status: 'active'
    }).onConflict('id').ignore();
    
    console.log('✅ Test user created/verified\n');

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

    // Create mock response
    const mockResponse = new MockResponse() as unknown as Response;

    // Test the streamBrainstorming method
    console.log('🚀 Starting brainstorming stream...\n');
    await streamService.streamBrainstorming(testUserId, params, mockResponse);

    console.log('✅ Brainstorming stream completed successfully!');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    // Close database connection
    await db.destroy();
    console.log('🔐 Database connection closed');
  }
}

// Run the test
testStreamObjectMigration(); 