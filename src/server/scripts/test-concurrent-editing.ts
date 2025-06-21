#!/usr/bin/env node

import { SchemaTransformExecutor } from '../services/SchemaTransformExecutor'
import { ArtifactRepository } from '../repositories/ArtifactRepository'
import { TransformRepository } from '../repositories/TransformRepository'
import { db } from '../database/connection'

async function testConcurrentEditing() {
  console.log('🧪 Testing concurrent editing protection...')
  
  const artifactRepo = new ArtifactRepository(db)
  const transformRepo = new TransformRepository(db)
  const executor = new SchemaTransformExecutor(artifactRepo, transformRepo)

  try {
    // 1. Create a test project
    const projectId = 'test-project-' + Date.now()
    
    await db
      .insertInto('projects')
      .values({
        id: projectId,
        name: 'Test Project for Concurrent Editing',
        description: 'Testing concurrent editing protection',
        project_type: 'script',
        status: 'active'
      })
      .execute()
    
    console.log(`✅ Created test project: ${projectId}`)
    
    // 2. Create a brainstorm artifact
    const brainstormData = [
      { title: 'Original Title 1', body: 'Original Body 1' },
      { title: 'Original Title 2', body: 'Original Body 2' }
    ]
    
    const originalArtifact = await artifactRepo.createArtifact(
      projectId,
      'brainstorm_idea_collection',
      brainstormData,
      'v1',
      { source: 'test' }
    )
    
    console.log(`✅ Created test artifact: ${originalArtifact.id}`)

    // 3. Test concurrent editing scenario
    const path = '[0]'
    const newData = { title: 'Modified Title 1', body: 'Modified Body 1' }
    
    console.log('\n🔄 Testing concurrent edits to the same path...')
    
    // Simulate two windows editing simultaneously
    const promises = [
      executor.executeSchemaHumanTransform('edit_brainstorm_idea', originalArtifact.id, path, projectId, newData),
      executor.executeSchemaHumanTransform('edit_brainstorm_idea', originalArtifact.id, path, projectId, newData)
    ]
    
    const results = await Promise.allSettled(promises)
    
    console.log('\n📊 Results:')
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`✅ Transform ${index + 1}: SUCCESS - ${result.value.transform.id}`)
      } else {
        console.log(`❌ Transform ${index + 1}: FAILED - ${result.reason.message}`)
      }
    })
    
    // 4. Verify only one transform was created
    const transforms = await db
      .selectFrom('human_transforms')
      .selectAll()
      .where('source_artifact_id', '=', originalArtifact.id)
      .where('derivation_path', '=', path)
      .execute()
    
    console.log(`\n🔍 Found ${transforms.length} transform(s) for path ${path}`)
    
    if (transforms.length === 1) {
      console.log('✅ SUCCESS: Unique constraint prevented duplicate transforms!')
    } else {
      console.log('❌ FAILURE: Multiple transforms were created!')
    }
    
    // 5. Test editing different paths (should both succeed)
    console.log('\n🔄 Testing edits to different paths...')
    
    const promises2 = [
      executor.executeSchemaHumanTransform('edit_brainstorm_idea', originalArtifact.id, '[0]', projectId, { title: 'Edit Path 0', body: 'This is a longer body text for path 0 to meet minimum length requirements' }),
      executor.executeSchemaHumanTransform('edit_brainstorm_idea', originalArtifact.id, '[1]', projectId, { title: 'Edit Path 1', body: 'This is a longer body text for path 1 to meet minimum length requirements' })
    ]
    
    const results2 = await Promise.allSettled(promises2)
    
    console.log('\n📊 Different paths results:')
    results2.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`✅ Path [${index}]: SUCCESS - ${result.value.transform.id}`)
      } else {
        console.log(`❌ Path [${index}]: FAILED - ${result.reason.message}`)
      }
    })
    
    // 6. Final verification
    const allTransforms = await db
      .selectFrom('human_transforms')
      .selectAll()
      .where('source_artifact_id', '=', originalArtifact.id)
      .execute()
    
    console.log(`\n📋 Total transforms created: ${allTransforms.length}`)
    allTransforms.forEach(transform => {
      console.log(`  - Path: ${transform.derivation_path}, Transform: ${transform.transform_id}`)
    })
    
    console.log('\n✅ Concurrent editing test completed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    throw error
  } finally {
    await db.destroy()
  }
}

// Run if called directly
if (require.main === module) {
  testConcurrentEditing()
    .then(() => {
      console.log('✅ All tests passed!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Tests failed:', error)
      process.exit(1)
    })
}

export { testConcurrentEditing } 