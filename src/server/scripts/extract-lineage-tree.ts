// Import necessary modules
import { db } from '../database/connection';
import { buildLineageGraph, findMainWorkflowPath } from '../../common/transform-jsondoc-framework/lineageResolution';
import type { LineageGraph } from '../../common/transform-jsondoc-framework/lineageResolution';
import { ElectricJsondoc, ElectricTransform, ElectricHumanTransform, ElectricTransformInput, ElectricTransformOutput } from '@/common/transform-jsondoc-types';

// Function to print the tree recursively
function printTree(nodeId: string, graph: LineageGraph, visited: Set<string> = new Set(), depth: number = 0) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = graph.nodes.get(nodeId);
    if (!node) return;

    const indent = '  '.repeat(depth);

    if (node.type === 'jsondoc') {
        console.log(`${indent}Jsondoc: ${node.jsondocId} (${node.jsondoc.schema_type})`);
    } else {
        console.log(`${indent}Transform: ${node.transformId} (${node.transformType})`);
    }

    const children = graph.edges.get(nodeId) || [];
    for (const childId of children) {
        printTree(childId, graph, new Set(visited), depth + 1);
    }
}

// Main function
async function extractLineageTree(projectId: string) {
    try {
        // Query all data
        const jsondocsRows = await db.selectFrom('jsondocs').selectAll().where('project_id', '=', projectId).execute();
        const jsondocs = jsondocsRows
            .filter(row => row.origin_type === 'ai_generated' || row.origin_type === 'user_input')
            .map(row => ({
                ...row,
                created_at: row.created_at?.toISOString() ?? '',
                updated_at: row.updated_at?.toISOString() ?? ''
            })) as ElectricJsondoc[];

        const rawTransforms = await db.selectFrom('transforms').selectAll().where('project_id', '=', projectId).execute();
        const transforms = rawTransforms
            .map(row => ({
                ...row,
                created_at: row.created_at?.toISOString() ?? '',
                updated_at: row.updated_at?.toISOString() ?? '',
                progress_percentage: row.progress_percentage ? Number(row.progress_percentage) : undefined
            })) as ElectricTransform[];

        const rawHumanTransforms = await db.selectFrom('human_transforms').selectAll().where('project_id', '=', projectId).execute();
        const humanTransforms = rawHumanTransforms as ElectricHumanTransform[];

        const transformIds = await db.selectFrom('transforms').select('id').where('project_id', '=', projectId).execute();
        const transformIdList = transformIds.map(t => t.id);

        const transformInputs = transformIdList.length > 0
            ? await db.selectFrom('transform_inputs').selectAll().where('transform_id', 'in', transformIdList).execute() as ElectricTransformInput[]
            : [] as ElectricTransformInput[];

        const transformOutputs = transformIdList.length > 0
            ? await db.selectFrom('transform_outputs').selectAll().where('transform_id', 'in', transformIdList).execute() as ElectricTransformOutput[]
            : [] as ElectricTransformOutput[];

        // Build graph
        const graph = buildLineageGraph(jsondocs, transforms, humanTransforms, transformInputs, transformOutputs);

        // Print tree from roots
        console.log('Lineage Tree:');
        graph.rootNodes.forEach(rootId => {
            printTree(rootId, graph);
        });

        // Print main workflow path
        const mainPath = findMainWorkflowPath(jsondocs, graph);
        console.log('\nMain Workflow Path:');
        mainPath.forEach((node, index) => {
            console.log(`${index + 1}. ${node.schemaType}: ${node.id}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await db.destroy();
    }
}

// Run
const projectId = process.argv[2];
if (!projectId) {
    console.error('Usage: ./run-ts src/server/scripts/extract-lineage-tree.ts <project-id>');
    process.exit(1);
}
extractLineageTree(projectId); 