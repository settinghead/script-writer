/**
 * Debug script to investigate agent context preparation
 * Run with: ./run-ts src/server/scripts/debug-agent-context.ts
 */

import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { AgentService } from '../services/AgentService';
import { BrainstormService } from '../services/BrainstormService';
import { db } from '../database/connection';
import {
    buildLineageGraph,
    findLatestArtifact,
    extractBrainstormLineages
} from '../../common/utils/lineageResolution';

async function debugAgentContext() {
    console.log('🔍 Debugging Agent Context and Lineage Resolution...\n');

    try {
        // 1. Find the most recent brainstorm collection with agent edits
        console.log('1. Finding recent brainstorm collections...');
        const brainstormArtifacts = await db
            .selectFrom('artifacts')
            .selectAll()
            .where('type', '=', 'brainstorm_idea_collection')
            .orderBy('created_at', 'desc')
            .limit(5)
            .execute();

        if (brainstormArtifacts.length === 0) {
            console.log('❌ No brainstorm collections found. Create some with the agent first.');
            return;
        }

        console.log(`📦 Found ${brainstormArtifacts.length} brainstorm collections:`);
        brainstormArtifacts.forEach((artifact, i) => {
            console.log(`  [${i}] ${artifact.id} (${artifact.created_at})`);
        });

        // Use the most recent one
        const targetArtifact = brainstormArtifacts[0];
        const projectId = targetArtifact.project_id;
        console.log(`\n🎯 Analyzing project: ${projectId}`);
        console.log(`🎯 Target collection: ${targetArtifact.id}`);

        // 2. Get all artifacts in this project
        console.log('\n2. Getting all project artifacts...');
        const allArtifacts = await db
            .selectFrom('artifacts')
            .selectAll()
            .where('project_id', '=', projectId)
            .orderBy('created_at', 'asc')
            .execute();

        console.log(`📦 Total artifacts: ${allArtifacts.length}`);
        allArtifacts.forEach((artifact, i) => {
            console.log(`  [${i}] ${artifact.type}:${artifact.id} (${artifact.created_at})`);
        });

        // 3. Get all transforms in this project
        console.log('\n3. Getting all project transforms...');
        const allTransforms = await db
            .selectFrom('transforms')
            .selectAll()
            .where('project_id', '=', projectId)
            .orderBy('created_at', 'asc')
            .execute();

        console.log(`🔄 Total transforms: ${allTransforms.length}`);
        allTransforms.forEach((transform, i) => {
            console.log(`  [${i}] ${transform.type}:${transform.id} (${transform.status}) (${transform.created_at})`);
        });

        // 4. Get transform relationships
        console.log('\n4. Getting transform relationships...');
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

        // 5. Analyze transform flow
        console.log('\n5. Analyzing transform flow...');
        console.log('Transform Input → Output mapping:');

        for (const transform of allTransforms) {
            const inputs = allTransformInputs.filter(i => i.transform_id === transform.id);
            const outputs = allTransformOutputs.filter(o => o.transform_id === transform.id);

            console.log(`\n  Transform ${transform.id} (${transform.type}):`);
            console.log(`    Inputs: ${inputs.map(i => i.artifact_id).join(', ')}`);
            console.log(`    Outputs: ${outputs.map(o => o.artifact_id).join(', ')}`);

            // Check if this transform uses the target collection
            const usesTargetCollection = inputs.some(i => i.artifact_id === targetArtifact.id);
            if (usesTargetCollection) {
                console.log(`    ⭐ This transform uses target collection!`);

                // Check what it produced
                outputs.forEach(output => {
                    const producedArtifact = allArtifacts.find(a => a.id === output.artifact_id);
                    if (producedArtifact) {
                        console.log(`      → Produced: ${producedArtifact.type}:${producedArtifact.id}`);

                        if (producedArtifact.type === 'brainstorm_idea') {
                            let data: any;
                            try {
                                data = JSON.parse(producedArtifact.data);
                                console.log(`        Title: ${data.title}`);
                                console.log(`        Body: ${data.body?.substring(0, 100)}...`);
                            } catch (e) {
                                console.log(`        Data parse error:`, e.message);
                            }
                        }
                    }
                });
            }
        }

        // 6. Build lineage graph
        console.log('\n6. Building lineage graph...');
        const lineageGraph = buildLineageGraph(
            allArtifacts as any,
            allTransforms as any,
            allHumanTransforms as any,
            allTransformInputs as any,
            allTransformOutputs as any
        );

        console.log(`🔗 Lineage graph: ${lineageGraph.nodes.size} nodes, ${lineageGraph.edges.size} edges`);
        console.log(`🔗 Root nodes: ${lineageGraph.rootNodes.size}`);

        // 7. Test lineage resolution for each idea in the collection
        console.log('\n7. Testing lineage resolution...');

        let collectionData: any;
        try {
            collectionData = JSON.parse(targetArtifact.data);
        } catch (e) {
            console.log(`❌ Failed to parse collection data:`, e.message);
            return;
        }

        if (!Array.isArray(collectionData)) {
            console.log(`❌ Collection data is not an array:`, typeof collectionData);
            return;
        }

        console.log(`📝 Collection has ${collectionData.length} ideas:`);
        collectionData.forEach((idea: any, i: number) => {
            console.log(`  [${i}] ${idea.title}: ${idea.body}`);
        });

        console.log('\n🔍 Lineage resolution results:');
        for (let i = 0; i < collectionData.length; i++) {
            const path = `[${i}]`;
            const resolution = findLatestArtifact(targetArtifact.id, path, lineageGraph);

            console.log(`\n  [${i}] Path "${path}":`);
            console.log(`    Latest artifact: ${resolution.artifactId}`);
            console.log(`    Depth: ${resolution.depth}`);
            console.log(`    Lineage path: ${resolution.lineagePath.map(n => n.artifactId).join(' → ')}`);

            if (resolution.artifactId && resolution.artifactId !== targetArtifact.id) {
                const resolvedArtifact = allArtifacts.find(a => a.id === resolution.artifactId);
                if (resolvedArtifact) {
                    console.log(`    Resolved type: ${resolvedArtifact.type}`);
                    try {
                        const resolvedData = JSON.parse(resolvedArtifact.data);
                        if (resolvedData.title && resolvedData.body) {
                            console.log(`    Resolved title: ${resolvedData.title}`);
                            console.log(`    Resolved body: ${resolvedData.body.substring(0, 100)}...`);
                        }
                    } catch (e) {
                        console.log(`    Data parse error:`, e.message);
                    }
                }
            } else {
                console.log(`    ❌ No lineage found - still pointing to original collection`);
            }
        }

        // 8. Debug lineage graph structure
        console.log('\n8. Lineage graph debug info:');
        console.log('Nodes:');
        for (const [nodeId, node] of lineageGraph.nodes) {
            console.log(`  ${nodeId}: depth=${node.depth}, isLeaf=${node.isLeaf}, path=${node.path}, type=${node.artifactType}`);
        }

        console.log('\nEdges:');
        for (const [sourceId, targets] of lineageGraph.edges) {
            console.log(`  ${sourceId} → [${targets.join(', ')}]`);
        }

        console.log('\nPath mappings:');
        for (const [pathKey, nodes] of lineageGraph.paths) {
            console.log(`  ${pathKey}: [${nodes.map(n => n.artifactId).join(', ')}]`);
        }

    } catch (error) {
        console.error('\n❌ Debug failed:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack trace:', error.stack);
        }
    }
}

// Run the debug
debugAgentContext().catch(console.error); 