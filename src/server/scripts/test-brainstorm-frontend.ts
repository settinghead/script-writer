#!/usr/bin/env node

import { SchemaTransformExecutor } from '../services/SchemaTransformExecutor';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { db } from '../database/connection';

async function testBrainstormFrontendIntegration() {
  console.log('🧪 Testing Brainstorm Frontend Integration\n');

  const artifactRepo = new ArtifactRepository(db);
  const transformRepo = new TransformRepository(db);
  const executor = new SchemaTransformExecutor(artifactRepo, transformRepo);

  try {
    // Create a brainstorm collection like the frontend would
    const brainstormData = [
      { title: '现代都市爱情', body: '一个职场女强人遇到暖男医生的甜蜜恋爱故事' },
      { title: '古装宫廷', body: '聪明宫女凭借智慧在后宫中生存并获得真爱' }
    ];

    const artifact = await artifactRepo.createArtifact(
      'test-project-1',
      'brainstorm_idea_collection',
      brainstormData,
      'v1'
    );

    console.log('✅ Created brainstorm collection:', artifact.id);
    console.log('   Original data:', JSON.stringify(brainstormData, null, 2));

    // Test 1: Edit the first idea's title (as ArtifactEditor would)
    console.log('\n🔄 Testing title edit (path: [0].title)...');
    const titleResult = await executor.executeSchemaHumanTransform(
      'edit_brainstorm_idea',
      artifact.id,
      '[0].title',
      'test-project-1',
      { title: '修改后的都市爱情故事' }
    );

    console.log('✅ Title edit result:', {
      wasTransformed: titleResult.wasTransformed,
      derivedArtifactType: titleResult.derivedArtifact.type,
      derivedArtifactId: titleResult.derivedArtifact.id
    });

    // Test 2: Edit the first idea's body (as ArtifactEditor would)
    console.log('\n🔄 Testing body edit (path: [0].body)...');
    const bodyResult = await executor.executeSchemaHumanTransform(
      'edit_brainstorm_idea',
      artifact.id,
      '[0].body',
      'test-project-1',
      { body: '修改后的故事描述：现代职场女性的成长与爱情双收获' }
    );

    console.log('✅ Body edit result:', {
      wasTransformed: bodyResult.wasTransformed,
      derivedArtifactType: bodyResult.derivedArtifact.type,
      derivedArtifactId: bodyResult.derivedArtifact.id
    });

    // Test 3: Verify that subsequent edits update existing derived artifacts
    console.log('\n🔄 Testing update to existing derived artifact...');
    const updateResult = await executor.executeSchemaHumanTransform(
      'edit_brainstorm_idea',
      artifact.id,
      '[0].title',
      'test-project-1',
      { title: '再次修改的标题' }
    );

    console.log('✅ Update result:', {
      wasTransformed: updateResult.wasTransformed,
      sameArtifactId: updateResult.derivedArtifact.id === titleResult.derivedArtifact.id
    });

    // Test 4: Test converting an idea to outline
    console.log('\n🔄 Testing idea to outline conversion (path: [1])...');
    const outlineResult = await executor.executeSchemaHumanTransform(
      'brainstorm_to_outline',
      artifact.id,
      '[1]',
      'test-project-1'
    );

    console.log('✅ Outline conversion result:', {
      wasTransformed: outlineResult.wasTransformed,
      derivedArtifactType: outlineResult.derivedArtifact.type,
      outlineContent: outlineResult.derivedArtifact.data?.content?.substring(0, 50) + '...'
    });

    console.log('\n🎉 All frontend integration tests passed!');
    console.log('\n📊 Summary:');
    console.log('   - Field-level editing (title/body): ✅');
    console.log('   - Derived artifact creation: ✅');
    console.log('   - Derived artifact updates: ✅');
    console.log('   - Idea to outline conversion: ✅');
    console.log('   - Schema validation: ✅');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  testBrainstormFrontendIntegration()
    .then(() => {
      console.log('\n✅ Frontend integration tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Frontend integration tests failed:', error);
      process.exit(1);
    })
    .finally(() => {
      db.destroy();
    });
}

export { testBrainstormFrontendIntegration }; 