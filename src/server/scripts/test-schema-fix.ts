import { SchemaTransformExecutor } from '../services/SchemaTransformExecutor';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import db from '../database/connection';

async function testSchemaTransformFix() {
  console.log('🧪 Testing Schema Transform Fix...\n');

  // Use the database connection
  const artifactRepo = new ArtifactRepository(db);
  const transformRepo = new TransformRepository(db);
  const executor = new SchemaTransformExecutor(artifactRepo, transformRepo);

  try {
    // 1. Find an existing brainstorm_idea_collection artifact
    console.log('1. Looking for brainstorm_idea_collection artifacts...');
    const artifacts = await db
      .selectFrom('artifacts')
      .selectAll()
      .where('type', '=', 'brainstorm_idea_collection')
      .orderBy('created_at', 'desc')
      .limit(1)
      .execute();

    if (artifacts.length === 0) {
      console.log('❌ No brainstorm_idea_collection artifacts found');
      return;
    }

    const artifact = artifacts[0];
    console.log(`✅ Found artifact: ${artifact.id}`);
    console.log(`   Data preview: ${JSON.stringify(artifact.data).substring(0, 100)}...`);

    // 2. Test the schema transform with path [0]
    console.log('\n2. Testing schema transform with path [0]...');
    
    const result = await executor.executeSchemaHumanTransform(
      'edit_brainstorm_idea',
      artifact.id,
      '[0]',
      artifact.project_id,
      {
        title: '测试修改标题',
        body: '这是一个测试修改的内容，用来验证整个对象编辑功能是否正常工作。'
      }
    );

    console.log('✅ Schema transform successful!');
    console.log(`   Transform ID: ${result.transform.id}`);
    console.log(`   Derived Artifact ID: ${result.derivedArtifact.id}`);
    console.log(`   Was Transformed: ${result.wasTransformed}`);
    console.log(`   Derived Data: ${JSON.stringify(result.derivedArtifact.data, null, 2)}`);

    // 3. Test updating the derived artifact
    console.log('\n3. Testing update of derived artifact...');
    
    const updateResult = await executor.executeSchemaHumanTransform(
      'edit_brainstorm_idea',
      artifact.id,
      '[0]',
      artifact.project_id,
      {
        title: '再次修改的标题',
        body: '这是第二次修改的内容，用来测试更新现有派生制品的功能。'
      }
    );

    console.log('✅ Update successful!');
    console.log(`   Was Transformed: ${updateResult.wasTransformed}`);
    console.log(`   Updated Data: ${JSON.stringify(updateResult.derivedArtifact.data, null, 2)}`);

    console.log('\n🎉 All tests passed! Schema transform fix is working.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testSchemaTransformFix().catch(console.error); 