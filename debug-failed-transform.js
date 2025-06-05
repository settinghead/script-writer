#!/usr/bin/env node

const knex = require('knex');

const db = knex({
  client: 'sqlite3',
  connection: { filename: './ideations.db' },
  useNullAsDefault: true
});

async function checkTransform() {
  const transformId = '70cd455f-0047-4b9c-b7e8-f5a2ea47375d';
  
  console.log('🔍 Checking failed transform:', transformId);
  
  // Get transform details
  const transform = await db('transforms').where({ id: transformId }).first();
  console.log('\n📋 Transform details:');
  console.log(JSON.stringify(transform, null, 2));
  
  if (transform) {
    // Get input artifacts for this transform
    const inputs = await db('transform_inputs')
      .join('artifacts', 'transform_inputs.artifact_id', 'artifacts.id')
      .where({ 
        'transform_inputs.transform_id': transformId
      })
      .select('artifacts.*', 'transform_inputs.input_role');
    
    console.log('\n📝 Input artifacts:');
    inputs.forEach((artifact, index) => {
      console.log(`\n${index + 1}. Type: ${artifact.type}, Role: ${artifact.input_role}`);
      const data = JSON.parse(artifact.data);
      console.log('   Data:', JSON.stringify(data, null, 2));
      
      // Specifically check for cascaded params in episode params
      if (artifact.type === 'episode_generation_params') {
        console.log('\n   🔍 Cascaded Params Analysis:');
        console.log('   - Has cascadedParams?', !!data.cascadedParams);
        if (data.cascadedParams) {
          console.log('   - Platform:', data.cascadedParams.platform);
          console.log('   - Genre paths:', data.cascadedParams.genre_paths);
          console.log('   - Total episodes:', data.cascadedParams.totalEpisodes);
          console.log('   - Episode duration:', data.cascadedParams.episodeDuration);
        } else {
          console.log('   ❌ cascadedParams is missing!');
        }
      }
    });
  }
  
  await db.destroy();
}

checkTransform().catch(console.error); 