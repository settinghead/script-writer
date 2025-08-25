import { buildLineageGraph } from './src/common/transform-jsondoc-framework/lineageResolution';
import { computeStaleJsondocs, type DiffChange } from './src/common/staleDetection';
import db from './src/server/database/connection';

const projectId = '4ba8da82-c243-4a2b-a674-e7b2bf861c04';
const outlineId = '5c440a3b-1a7d-44d5-b8e4-c94f94771743'; // Current 故事设定
const chroniclesId = 'a715554d-5bc3-4494-a1d6-87fd8e1ed0cf'; // Current chronicles

async function debugStaleDetection() {

    try {
        // Load all project data
        const [jsondocs, transforms, humanTransforms, transformInputs, transformOutputs] = await Promise.all([
            db.selectFrom('jsondocs')
                .selectAll()
                .where('project_id', '=', projectId)
                .execute(),
            db.selectFrom('transforms')
                .selectAll()
                .where('project_id', '=', projectId)
                .execute(),
            db.selectFrom('human_transforms')
                .selectAll()
                .where('project_id', '=', projectId)
                .execute(),
            db.selectFrom('transform_inputs')
                .selectAll()
                .where('project_id', '=', projectId)
                .execute(),
            db.selectFrom('transform_outputs')
                .selectAll()
                .where('project_id', '=', projectId)
                .execute()
        ]);

        console.log('=== Data loaded ===');
        console.log(`Jsondocs: ${jsondocs.length}`);
        console.log(`Transforms: ${transforms.length}`);

        // Build lineage graph
        const lineageGraph = buildLineageGraph(
            jsondocs as any,
            transforms as any,
            humanTransforms as any,
            transformInputs as any,
            transformOutputs as any
        );

        console.log('\n=== Checking direct edges from 故事设定 ===');
        const outlineEdges = lineageGraph.edges.get(outlineId);
        console.log(`Direct edges from ${outlineId}: ${outlineEdges?.length || 0}`);
        if (outlineEdges) {
            for (const edge of outlineEdges) {
                const node = lineageGraph.nodes.get(edge);
                console.log(`  → ${edge} (${node?.type})`);

                // If it's a transform, check its outputs
                if (node?.type === 'transform') {
                    const transformOutputs = lineageGraph.edges.get(edge);
                    if (transformOutputs) {
                        for (const output of transformOutputs) {
                            const outputNode = lineageGraph.nodes.get(output);
                            const jsondoc = jsondocs.find(j => j.id === output);
                            console.log(`    → ${output} (${outputNode?.type}, schema: ${jsondoc?.schema_type})`);
                        }
                    }
                }
            }
        }

        console.log('\n=== Checking what transforms produce chronicles ===');
        // Find transforms that output the chronicles
        const chroniclesProducers = transformOutputs.filter(to => to.jsondoc_id === chroniclesId);
        console.log(`Transforms producing chronicles ${chroniclesId}: ${chroniclesProducers.length}`);
        for (const producer of chroniclesProducers) {
            console.log(`  Transform: ${producer.transform_id}`);
            // Check inputs of this transform
            const inputs = transformInputs.filter(ti => ti.transform_id === producer.transform_id);
            for (const input of inputs) {
                const inputDoc = jsondocs.find(j => j.id === input.jsondoc_id);
                console.log(`    ← Input: ${input.jsondoc_id} (${inputDoc?.schema_type})`);
            }
        }

        console.log('\n=== Simulating stale detection ===');
        // Simulate a diff for the outline
        const diffs: DiffChange[] = [{
            jsondocId: outlineId,
            path: '$',
            before: null,
            after: { test: 'modified' }
        }];

        const affected = await computeStaleJsondocs(
            diffs,
            lineageGraph,
            jsondocs as any,
            transforms as any
        );

        console.log(`\nAffected jsondocs when editing 故事设定: ${affected.length}`);
        for (const a of affected) {
            console.log(`  - ${a.jsondocId} (${a.schemaType}): ${a.reason}`);
        }

        // Check if chronicles is in the affected list
        const chroniclesAffected = affected.find(a => a.jsondocId === chroniclesId);
        if (chroniclesAffected) {
            console.log(`\n✅ Chronicles IS marked as affected`);
        } else {
            console.log(`\n❌ Chronicles is NOT marked as affected`);
        }

    } finally {
        process.exit(0);
    }
}

debugStaleDetection().catch(console.error);
