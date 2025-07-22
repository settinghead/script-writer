/**
 * Canonical Content Viewer Script
 * 
 * Displays the field structure of canonical jsondocs in a project.
 * This shows what content is currently "active" in the UI and available for editing.
 * 
 * Usage:
 *   ./run-ts src/server/scripts/canonical-content-viewer.ts [project-id]
 * 
 * If no project-id is provided, uses the most recently updated project.
 * 
 * Output format optimized for both human readability and LLM consumption.
 */

import { db } from '../database/connection';
import { buildLineageGraph } from '../../common/transform-jsondoc-framework/lineageResolution';
import { computeCanonicalJsondocsFromLineage } from '../../common/canonicalJsondocLogic';
import { generateCanonicalContentStructure } from '../utils/canonicalContentStructure';
import type { ElectricJsondoc, ElectricTransform, ElectricHumanTransform, ElectricTransformInput, ElectricTransformOutput } from '../../common/types';

/**
 * Main function to extract and display canonical jsondoc content structure for a project
 */
async function displayCanonicalContentStructure(projectId: string): Promise<void> {
    try {
        // Query all lineage data
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

        // Build lineage graph
        const lineageGraph = buildLineageGraph(jsondocs, transforms, humanTransforms, transformInputs, transformOutputs);

        // Compute canonical context
        const canonicalContext = computeCanonicalJsondocsFromLineage(
            lineageGraph,
            jsondocs,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs
        );

        // Generate and display content structure
        const structureOutput = generateCanonicalContentStructure(canonicalContext, projectId);
        console.log(structureOutput);

    } catch (error) {
        console.error('Error generating canonical content structure:', error);
        process.exit(1);
    } finally {
        await db.destroy();
        process.exit(0);
    }
}

/**
 * Get the most recently updated project if no project ID is provided
 */
async function getMostRecentProject(): Promise<string | null> {
    try {
        const result = await db
            .selectFrom('projects')
            .select('id')
            .orderBy('updated_at', 'desc')
            .limit(1)
            .executeTakeFirst();

        return result?.id || null;
    } catch (error) {
        console.error('Error finding most recent project:', error);
        return null;
    }
}

// Main execution
async function main() {
    let projectId = process.argv[2];

    if (!projectId) {
        console.log('No project ID provided, finding most recently updated project...');
        const foundProjectId = await getMostRecentProject();
        if (!foundProjectId) {
            console.error('No projects found in database.');
            process.exit(1);
        }
        projectId = foundProjectId;
        console.log(`Using project: ${projectId}\n`);
    }

    await displayCanonicalContentStructure(projectId);
}

// Run the script
main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
}); 