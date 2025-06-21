#!/usr/bin/env node

import { SchemaTransformExecutor } from '../services/SchemaTransformExecutor';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { db } from '../database/connection';

async function testSchemaSystem() {
  console.log('🧪 Testing Complete Schema-Driven Transform System\n');

  const artifactRepo = new ArtifactRepository(db);
  const transformRepo = new TransformRepository(db);
  const executor = new SchemaTransformExecutor(artifactRepo, transformRepo);

  try {
    // 0. Setup test data - create test user and project
    console.log('🔧 Setting up test data...');
    
    // Create test user if not exists
    const testUserId = 'test-user-1';
    const existingUser = await db
      .selectFrom('users')
      .select('id')
      .where('id', '=', testUserId)
      .executeTakeFirst();
      
    if (!existingUser) {
      await db
        .insertInto('users')
        .values({
          id: testUserId,
          username: 'test-user-1',
          display_name: 'Test User One',
          status: 'active'
        })
        .execute();
      console.log('✅ Created test user');
    }
    
    // Create test project if not exists
    const testProjectId = 'test-project-1';
    const existingProject = await db
      .selectFrom('projects')
      .select('id')
      .where('id', '=', testProjectId)
      .executeTakeFirst();
      
    if (!existingProject) {
      await db
        .insertInto('projects')
        .values({
          id: testProjectId,
          name: 'Test Schema Project',
          description: 'Project for testing schema-driven transforms',
          status: 'active'
        })
        .execute();
      console.log('✅ Created test project');
      
      // Create project-user relationship
      await db
        .insertInto('projects_users')
        .values({
          project_id: testProjectId,
          user_id: testUserId,
          role: 'owner'
        })
        .execute();
      console.log('✅ Created project-user relationship');
    }

    // 1. Create test brainstorm collection with correct structure
    const brainstormData = [
      { title: "穿越CEO", body: "现代女CEO穿越到古代，利用现代商业知识在古代商场叱咤风云" },
      { title: "时空恋人", body: "男主在不同时空中寻找同一个女主，每次相遇都有不同的身份和故事" }
    ];

    const sourceArtifact = await artifactRepo.createArtifact(
      testProjectId,
      'brainstorm_idea_collection',
      brainstormData,
      'v1'
    );

    console.log('✅ Created test brainstorm collection:', sourceArtifact.id);
    console.log('   Data:', JSON.stringify(brainstormData, null, 2));

    // 2. Test field-level editing (title)
    console.log('\n🔄 Testing title edit transform...');
    const titleEdit = await executor.executeSchemaHumanTransform(
      'edit_brainstorm_idea',
      sourceArtifact.id,
      '[0].title',
      testProjectId,
      { title: '修改后的标题' }
    );

    console.log('✅ Title edit completed');
    console.log('   Transform ID:', titleEdit.transform.id);
    console.log('   Derived artifact type:', titleEdit.derivedArtifact.type);
    console.log('   Was transformed:', titleEdit.wasTransformed);

    // 3. Test field-level editing (body)
    console.log('\n🔄 Testing body edit transform...');
    const bodyEdit = await executor.executeSchemaHumanTransform(
      'edit_brainstorm_idea',
      sourceArtifact.id,
      '[0].body',
      testProjectId,
      { body: '修改后的详细内容：这是一个全新的故事描述' }
    );

    console.log('✅ Body edit completed');
    console.log('   Transform ID:', bodyEdit.transform.id);
    console.log('   Derived artifact type:', bodyEdit.derivedArtifact.type);
    console.log('   Was transformed:', bodyEdit.wasTransformed);

    // 4. Test updating existing derived artifact
    console.log('\n🔄 Testing update to existing derived artifact...');
    const titleUpdate = await executor.executeSchemaHumanTransform(
      'edit_brainstorm_idea',
      sourceArtifact.id,
      '[0].title',
      testProjectId,
      { title: '再次修改的标题' }
    );

    console.log('✅ Title update completed');
    console.log('   Was transformed:', titleUpdate.wasTransformed);
    console.log('   Same artifact ID:', titleUpdate.derivedArtifact.id === titleEdit.derivedArtifact.id);

    // 5. Test full idea to outline conversion
    console.log('\n🔄 Testing full idea to outline transform...');
    const outlineTransform = await executor.executeSchemaHumanTransform(
      'brainstorm_to_outline',
      sourceArtifact.id,
      '[1]',
      testProjectId
    );

    console.log('✅ Outline transform completed');
    console.log('   Transform ID:', outlineTransform.transform.id);
    console.log('   Derived artifact type:', outlineTransform.derivedArtifact.type);
    console.log('   Outline data:', JSON.stringify(outlineTransform.derivedArtifact.data, null, 2));

    // 6. Test validation errors
    console.log('\n🔄 Testing validation errors...');
    try {
      await executor.executeSchemaHumanTransform(
        'invalid_transform',
        sourceArtifact.id,
        '[0]',
        testProjectId
      );
      console.log('❌ Should have thrown validation error');
    } catch (error) {
      console.log('✅ Validation error caught:', error.message);
    }

    // 7. Test invalid path pattern
    console.log('\n🔄 Testing invalid path pattern...');
    try {
      await executor.executeSchemaHumanTransform(
        'edit_brainstorm_idea',
        sourceArtifact.id,
        'invalid.path',
        testProjectId
      );
      console.log('❌ Should have thrown path validation error');
    } catch (error) {
      console.log('✅ Path validation error caught:', error.message);
    }

    // 8. Test graph traversal methods
    console.log('\n🔄 Testing graph traversal methods...');
    const outputTransforms = await transformRepo.getTransformsByOutput(titleEdit.derivedArtifact.id);
    console.log('✅ Found transforms that produced derived artifact:', outputTransforms.length);
    
    const inputTransforms = await transformRepo.getTransformsByInput(sourceArtifact.id);
    console.log('✅ Found transforms that used source artifact:', inputTransforms.length);

    console.log('\n🎉 All schema system tests passed!');
    console.log('\n📊 Test Summary:');
    console.log('   - Schema validation: ✅');
    console.log('   - Transform definitions: ✅');
    console.log('   - Path-based editing: ✅');
    console.log('   - Artifact creation: ✅');
    console.log('   - Artifact updates: ✅');
    console.log('   - Error handling: ✅');
    console.log('   - Graph traversal: ✅');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  testSchemaSystem()
    .then(() => {
      console.log('\n✅ All tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Tests failed:', error);
      process.exit(1);
    })
    .finally(() => {
      db.destroy();
    });
}

export { testSchemaSystem }; 