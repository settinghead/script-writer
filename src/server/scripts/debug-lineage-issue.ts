#!/usr/bin/env node

import db from '../database/connection';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { AgentService } from '../services/AgentService';
import { ChatMessageRepository } from '../repositories/ChatMessageRepository';

async function debugLineageIssue() {
    console.log('🔍 Debugging Lineage Resolution Issue...\n');

    // Initialize repositories
    const artifactRepo = new ArtifactRepository(db);
    const transformRepo = new TransformRepository(db);
    const projectRepo = new ProjectRepository(db);
    const chatRepo = new ChatMessageRepository(db);
    const agentService = new AgentService(transformRepo, artifactRepo);
    agentService.setChatMessageRepository(chatRepo);

    const userId = 'test-user-1';
    const projectName = 'Lineage Debug Test Project';

    try {
        // 1. Create test project and initial ideas
        console.log('1. Creating test project...');
        const project = await projectRepo.createProject(projectName, userId, 'Debug lineage resolution');
        const projectId = project.id;
        console.log(`✅ Project: ${projectId}`);

        const initialIdeas = [
            { title: '短故事1', body: '这是一个短故事。' },
            { title: '短故事2', body: '这是另一个短故事。' }
        ];

        const brainstormArtifact = await artifactRepo.createArtifact(
            projectId,
            'brainstorm_idea_collection',
            initialIdeas,
            'v1',
            {
                platform: '抖音',
                genre: '都市言情',
                status: 'completed'
            }
        );
        console.log(`✅ Collection artifact: ${brainstormArtifact.id}`);

        // 2. Run agent to extend one idea
        console.log('\n2. Running agent to extend first idea...');
        const extendRequest = {
            userRequest: '把第一个故事写得更长一些',
            projectId: projectId,
            contextType: 'brainstorm' as const
        };

        await agentService.runGeneralAgent(projectId, userId, extendRequest);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 3. Examine all artifacts
        console.log('\n3. Examining created artifacts...');
        const allArtifacts = await artifactRepo.getProjectArtifacts(projectId);
        console.log(`📦 Total artifacts: ${allArtifacts.length}`);

        allArtifacts.forEach((artifact, index) => {
            console.log(`\n[${index}] Artifact ${artifact.id}`);
            console.log(`   Type: ${artifact.type}`);
            console.log(`   Created: ${artifact.created_at}`);

            let data: any;
            try {
                data = typeof artifact.data === 'string' ? JSON.parse(artifact.data) : artifact.data;
            } catch (e) {
                data = artifact.data;
            }

            if (artifact.type === 'brainstorm_idea_collection') {
                console.log(`   Ideas: ${Array.isArray(data) ? data.length : 'Not array'}`);
                if (Array.isArray(data)) {
                    data.forEach((idea: any, i: number) => {
                        console.log(`     [${i}] ${idea.title}: ${idea.body}`);
                    });
                }
            } else if (artifact.type === 'brainstorm_idea') {
                console.log(`   Title: ${data.title}`);
                console.log(`   Body: ${data.body}`);
            }
        });

        // 4. Examine all transforms
        console.log('\n4. Examining created transforms...');
        const allTransforms = await transformRepo.getProjectTransforms(projectId, 100);
        console.log(`🔄 Total transforms: ${allTransforms.length}`);

        for (const transform of allTransforms) {
            console.log(`\n[Transform] ${transform.id}`);
            console.log(`   Type: ${transform.type}`);
            console.log(`   Status: ${transform.status}`);
            console.log(`   Created: ${transform.created_at}`);

            // Get inputs
            const inputs = await transformRepo.getTransformInputs(transform.id);
            console.log(`   Inputs: ${inputs.length}`);
            inputs.forEach(input => {
                console.log(`     → ${input.artifact_id} (${input.input_role || 'no role'})`);
            });

            // Get outputs
            const outputs = await transformRepo.getTransformOutputs(transform.id);
            console.log(`   Outputs: ${outputs.length}`);
            outputs.forEach(output => {
                console.log(`     ← ${output.artifact_id} (${output.output_role || 'no role'})`);
            });

            // Get human transform data if applicable
            if (transform.type === 'human') {
                const humanData = await transformRepo.getHumanTransformData(transform.id);
                if (humanData) {
                    console.log(`   Human data:`);
                    console.log(`     Action: ${humanData.action_type}`);
                    console.log(`     Description: ${humanData.change_description}`);
                    // Note: derivation_path, source_artifact_id, derived_artifact_id are in the human_transforms table
                }
            }
        }

        // 5. Examine transform relationships
        console.log('\n5. Transform relationship analysis...');

        // Get all transform inputs/outputs for the project
        const allTransformInputs = await db
            .selectFrom('transform_inputs')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        const allTransformOutputs = await db
            .selectFrom('transform_outputs')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        const allHumanTransforms = await db
            .selectFrom('human_transforms')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        console.log(`📊 Transform inputs: ${allTransformInputs.length}`);
        console.log(`📊 Transform outputs: ${allTransformOutputs.length}`);
        console.log(`📊 Human transforms: ${allHumanTransforms.length}`);

        // 6. Manual lineage tracing
        console.log('\n6. Manual lineage tracing...');
        console.log('Original collection:', brainstormArtifact.id);

        // Find transforms that used the collection as input
        const transformsUsingCollection = allTransformInputs.filter(
            input => input.artifact_id === brainstormArtifact.id
        );

        console.log(`Transforms using collection: ${transformsUsingCollection.length}`);
        transformsUsingCollection.forEach(input => {
            console.log(`  Transform ${input.transform_id} uses collection`);

            // Find what this transform produced
            const outputs = allTransformOutputs.filter(
                output => output.transform_id === input.transform_id
            );

            outputs.forEach(output => {
                console.log(`    → Produced artifact ${output.artifact_id}`);

                // Find the artifact details
                const producedArtifact = allArtifacts.find(a => a.id === output.artifact_id);
                if (producedArtifact) {
                    console.log(`      Type: ${producedArtifact.type}`);
                    if (producedArtifact.type === 'brainstorm_idea') {
                        let data: any;
                        try {
                            data = typeof producedArtifact.data === 'string'
                                ? JSON.parse(producedArtifact.data)
                                : producedArtifact.data;
                        } catch (e) {
                            data = producedArtifact.data;
                        }
                        console.log(`      Title: ${data.title}`);
                        console.log(`      Body: ${data.body}`);
                    }
                }
            });
        });

        // 7. Expected vs actual lineage
        console.log('\n7. Expected vs Actual Lineage:');
        console.log('EXPECTED:');
        console.log(`  collection[0] → transform → brainstorm_idea_1`);
        console.log(`  collection[1] → transform → brainstorm_idea_2`);

        console.log('\nACTUAL:');
        if (transformsUsingCollection.length === 0) {
            console.log('  ❌ No transforms found using collection as input');
            console.log('  ❌ This suggests the edit tool is not properly linking transforms');
        } else {
            console.log(`  ✅ Found ${transformsUsingCollection.length} transforms using collection`);
        }

        // Cleanup
        console.log('\n🧹 Cleaning up...');
        await projectRepo.deleteProject(projectId);
        console.log('✅ Test project deleted');

    } catch (error) {
        console.error('\n❌ Debug failed:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack trace:', error.stack);
        }
    }
}

// Run the debug
debugLineageIssue().catch(console.error); 