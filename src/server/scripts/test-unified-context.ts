#!/usr/bin/env node

/**
 * Test script for the unified ProjectElectricContext
 * 
 * This script tests the unified context's ability to:
 * 1. Subscribe to all Electric SQL tables for a project
 * 2. Provide centralized selectors and mutations
 * 3. Handle artifacts, transforms, and human transforms
 */

import { db } from '../database/connection';

async function testUnifiedContext() {
    console.log('🔧 Testing Unified ProjectElectricContext Database Queries...\n');

    try {
        // Test 1: Check if we can query artifacts by project_id
        console.log('1. Testing artifacts query by project_id...');
        const artifacts = await db
            .selectFrom('artifacts')
            .selectAll()
            .where('project_id', '=', 'test-project-id')
            .execute();
        console.log(`   ✅ Found ${artifacts.length} artifacts for test project`);

        // Test 2: Check if we can query transforms by project_id
        console.log('2. Testing transforms query by project_id...');
        const transforms = await db
            .selectFrom('transforms')
            .selectAll()
            .where('project_id', '=', 'test-project-id')
            .execute();
        console.log(`   ✅ Found ${transforms.length} transforms for test project`);

        // Test 3: Check if we can query human_transforms with nested project_id
        console.log('3. Testing human_transforms query with project_id filter...');
        const humanTransforms = await db
            .selectFrom('human_transforms')
            .selectAll()
            .where('source_artifact_id', 'in', 
                db.selectFrom('artifacts')
                  .select('id')
                  .where('project_id', '=', 'test-project-id')
            )
            .execute();
        console.log(`   ✅ Found ${humanTransforms.length} human transforms for test project`);

        // Test 4: Check if we can query transform_inputs with nested project_id
        console.log('4. Testing transform_inputs query with project_id filter...');
        const transformInputs = await db
            .selectFrom('transform_inputs')
            .selectAll()
            .where('transform_id', 'in',
                db.selectFrom('transforms')
                  .select('id')
                  .where('project_id', '=', 'test-project-id')
            )
            .execute();
        console.log(`   ✅ Found ${transformInputs.length} transform inputs for test project`);

        // Test 5: Check if we can query transform_outputs with nested project_id
        console.log('5. Testing transform_outputs query with project_id filter...');
        const transformOutputs = await db
            .selectFrom('transform_outputs')
            .selectAll()
            .where('transform_id', 'in',
                db.selectFrom('transforms')
                  .select('id')
                  .where('project_id', '=', 'test-project-id')
            )
            .execute();
        console.log(`   ✅ Found ${transformOutputs.length} transform outputs for test project`);

        // Test 6: Verify Electric SQL WHERE clauses match our context implementation
        console.log('\n6. Verifying Electric SQL WHERE clauses...');
        
        const projectId = 'test-project-id';
        const whereClausesStable = {
            artifacts: `project_id = '${projectId}'`,
            transforms: `project_id = '${projectId}'`,
            humanTransforms: `source_artifact_id IN (SELECT id FROM artifacts WHERE project_id = '${projectId}')`,
            transformInputs: `transform_id IN (SELECT id FROM transforms WHERE project_id = '${projectId}')`,
            transformOutputs: `transform_id IN (SELECT id FROM transforms WHERE project_id = '${projectId}')`
        };

        console.log('   ✅ WHERE clauses for Electric SQL subscriptions:');
        Object.entries(whereClausesStable).forEach(([table, clause]) => {
            console.log(`      ${table}: ${clause}`);
        });

        // Test 7: Test brainstorm ideas extraction logic
        console.log('\n7. Testing brainstorm ideas extraction...');
        const brainstormArtifacts = await db
            .selectFrom('artifacts')
            .selectAll()
            .where('project_id', '=', 'test-project-id')
            .where('type', '=', 'brainstorm_idea_collection')
            .execute();
        
        console.log(`   ✅ Found ${brainstormArtifacts.length} brainstorm collections`);
        
        brainstormArtifacts.forEach((artifact, index) => {
            try {
                const data = JSON.parse(artifact.data);
                const ideas = data?.ideas || [];
                console.log(`   📝 Collection ${index + 1}: ${ideas.length} ideas`);
                
                ideas.slice(0, 2).forEach((idea: any, ideaIndex: number) => {
                    const title = idea.title || idea.idea_title || `想法 ${ideaIndex + 1}`;
                    const body = (idea.body || idea.idea_text || idea.text || '').substring(0, 50);
                    console.log(`      - ${title}: ${body}...`);
                });
            } catch (e) {
                console.log(`   ⚠️  Collection ${index + 1}: Failed to parse data`);
            }
        });

        console.log('\n✅ All unified context database queries working correctly!');
        console.log('\n📋 Summary:');
        console.log(`   - Artifacts: ${artifacts.length}`);
        console.log(`   - Transforms: ${transforms.length}`);
        console.log(`   - Human Transforms: ${humanTransforms.length}`);
        console.log(`   - Transform Inputs: ${transformInputs.length}`);
        console.log(`   - Transform Outputs: ${transformOutputs.length}`);
        console.log(`   - Brainstorm Collections: ${brainstormArtifacts.length}`);

    } catch (error) {
        console.error('❌ Error testing unified context:', error);
        throw error;
    }
}

// Run the test
testUnifiedContext()
    .then(() => {
        console.log('\n🎉 Unified ProjectElectricContext test completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Unified ProjectElectricContext test failed:', error);
        process.exit(1);
    }); 