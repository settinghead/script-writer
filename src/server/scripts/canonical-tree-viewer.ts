import { db } from '../database/connection';
import { buildLineageGraph } from '../../common/transform-jsondoc-framework/lineageResolution';
import { computeCanonicalJsondocsFromLineage } from '../../common/canonicalJsondocLogic';
import type { } from '../../common/transform-jsondoc-framework/lineageResolution';
import type { CanonicalJsondocContext } from '../../common/canonicalJsondocLogic';
import { ElectricJsondoc, ElectricTransform, ElectricHumanTransform, ElectricTransformInput, ElectricTransformOutput } from '@/common/transform-jsondoc-types';

/**
 * Core function that generates canonical jsondoc tree structure from lineage data
 * Optimized for both human readability and LLM token efficiency
 */
export function generateCanonicalTree(
    canonicalContext: CanonicalJsondocContext,
    projectId: string
): string {
    const lines: string[] = [];

    // Header
    lines.push(`CANONICAL JSONDOCS - Project: ${projectId}`);
    lines.push('='.repeat(50));
    lines.push('');

    // Helper function to extract field paths from Zod schema
    function extractFieldPaths(schemaType: string, data: any, basePath: string = '$'): string[] {
        const paths: string[] = [];

        if (!data || typeof data !== 'object') {
            return [basePath];
        }

        if (Array.isArray(data)) {
            paths.push(`${basePath}[*]`);
            // Sample first item for structure if available
            if (data.length > 0) {
                const subPaths = extractFieldPaths(schemaType, data[0], `${basePath}[*]`);
                paths.push(...subPaths.filter(p => p !== `${basePath}[*]`));
            }
        } else {
            for (const [key, value] of Object.entries(data)) {
                const currentPath = basePath === '$' ? `$.${key}` : `${basePath}.${key}`;

                if (value && typeof value === 'object') {
                    if (Array.isArray(value)) {
                        paths.push(`${currentPath}[*]`);
                        // Sample first item for nested structure
                        if (value.length > 0 && typeof value[0] === 'object') {
                            const subPaths = extractFieldPaths(schemaType, value[0], `${currentPath}[*]`);
                            paths.push(...subPaths.filter(p => p !== `${currentPath}[*]`));
                        }
                    } else {
                        const subPaths = extractFieldPaths(schemaType, value, currentPath);
                        paths.push(...subPaths);
                    }
                } else {
                    paths.push(currentPath);
                }
            }
        }

        return paths;
    }

    // Process each canonical jsondoc type
    const canonicalTypes = [
        { key: 'canonicalBrainstormInput', name: 'brainstorm_input_params', desc: '头脑风暴输入' },
        { key: 'canonicalBrainstormIdea', name: '灵感创意', desc: '选中创意' },
        { key: 'canonicalBrainstormCollection', name: 'brainstorm_collection', desc: '创意集合' },
        { key: 'canonicalOutlineSettings', name: '故事设定', desc: '故事框架' },
        { key: 'canonicalChronicles', name: 'chronicles', desc: '时间顺序大纲' },
        { key: 'canonicalEpisodePlanning', name: '分集结构', desc: '分集结构' }
    ];

    for (const type of canonicalTypes) {
        const jsondoc = canonicalContext[type.key as keyof CanonicalJsondocContext] as ElectricJsondoc | null;

        if (jsondoc) {
            lines.push(`jsondoc type:${type.name} (ID: ${jsondoc.id}):`);

            try {
                const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
                const paths = extractFieldPaths(type.name, data);

                // Sort paths for consistent output
                paths.sort((a, b) => {
                    // Sort by depth first (fewer dots = higher priority)
                    const aDepth = (a.match(/\./g) || []).length;
                    const bDepth = (b.match(/\./g) || []).length;
                    if (aDepth !== bDepth) return aDepth - bDepth;
                    return a.localeCompare(b);
                });

                for (const path of paths) {
                    lines.push(`  ${path}`);
                }
            } catch (error) {
                lines.push(`  [Error parsing data: ${error}]`);
            }

            lines.push('');
        }
    }

    // Handle episode synopsis list separately
    if (canonicalContext.canonicalEpisodeSynopsisList.length > 0) {
        lines.push('单集大纲 (multiple):');
        canonicalContext.canonicalEpisodeSynopsisList.forEach((synopsis, index) => {
            try {
                const data = typeof synopsis.data === 'string' ? JSON.parse(synopsis.data) : synopsis.data;
                const episodeRange = data.episodes ?
                    `${data.episodes[0]?.episodeNumber || 'unknown'}-${data.episodes[data.episodes.length - 1]?.episodeNumber || 'unknown'}` :
                    'unknown';
                lines.push(`  [${index}] ${synopsis.id} (episodes ${episodeRange}):`);

                const paths = extractFieldPaths('单集大纲', data);
                paths.sort();
                for (const path of paths) {
                    lines.push(`    ${path}`);
                }
            } catch (error) {
                lines.push(`    [Error parsing data: ${error}]`);
            }
        });
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Main function to extract and display canonical jsondoc tree for a project
 */
async function displayCanonicalTree(projectId: string): Promise<void> {
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

        // Generate and display tree
        const treeOutput = generateCanonicalTree(canonicalContext, projectId);
        console.log(treeOutput);

    } catch (error) {
        console.error('Error generating canonical tree:', error);
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
            .orderBy('created_at', 'desc')
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

    await displayCanonicalTree(projectId);
}

// Run the script
main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
}); 