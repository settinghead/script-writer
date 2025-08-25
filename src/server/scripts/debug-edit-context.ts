import { db } from '../database/connection';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import { buildLineageGraph } from '../../common/transform-jsondoc-framework/lineageResolution';
import { computeCanonicalJsondocsFromLineage } from '../../common/canonicalJsondocLogic';
import { computeAffectedContextForEdit } from '../services/EditPromptContextService';
import { buildAffectedContextText } from '../tools/shared/contextFormatting';

/**
 * Debug tool: Print upstream-diff context for any edit_* tool target
 * Usage:
 *   ./run-ts src/server/scripts/debug-edit-context.ts <projectId> <schemaType> [jsondocId]
 * Example (chronicles edit target):
 *   ./run-ts src/server/scripts/debug-edit-context.ts 4ba8da82-c243-4a2b-a674-e7b2bf861c04 chronicles
 */
async function main() {
    const [projectId, schemaType, targetIdArg] = process.argv.slice(2);
    if (!projectId || !schemaType) {
        console.error('Usage: ./run-ts src/server/scripts/debug-edit-context.ts <projectId> <schemaType> [jsondocId]');
        process.exit(1);
    }

    const jsondocRepo = new TransformJsondocRepository(db as any);
    const transformRepo = new TransformJsondocRepository(db as any);

    try {
        // Load complete project data for lineage
        const [jsondocs, transforms, humanTransforms, transformInputs, transformOutputs] = await Promise.all([
            jsondocRepo.getAllProjectJsondocsForLineage(projectId),
            transformRepo.getAllProjectTransformsForLineage(projectId),
            transformRepo.getAllProjectHumanTransformsForLineage(projectId),
            transformRepo.getAllProjectTransformInputsForLineage(projectId),
            transformRepo.getAllProjectTransformOutputsForLineage(projectId)
        ]);

        const lineageGraph = buildLineageGraph(
            jsondocs,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs
        );

        const canonical = computeCanonicalJsondocsFromLineage(
            lineageGraph,
            jsondocs,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs
        );

        // Resolve target jsondoc ID
        let targetId = targetIdArg;
        if (!targetId) {
            if (schemaType === 'chronicles') targetId = canonical.canonicalChronicles?.id || '';
            else if (schemaType === '故事设定') targetId = canonical.canonicalOutlineSettings?.id || '';
            else if (schemaType === '分集结构') targetId = canonical.canonicalEpisodePlanning?.id || '';
        }

        if (!targetId) {
            console.error(`[debug-edit-context] No canonical jsondoc found for schemaType '${schemaType}' in project ${projectId}.`);
            listCandidates(jsondocs, schemaType);
            process.exit(2);
        }

        console.log(`Project: ${projectId}`);
        console.log(`Target schemaType: ${schemaType}`);
        console.log(`Target jsondocId: ${targetId}`);
        console.log('='.repeat(80));

        // Show brief lineage around target
        printLocalLineage(targetId, lineageGraph);

        // Compute affected context (the same function used by tools)
        const affected = await computeAffectedContextForEdit(projectId, schemaType, targetId, jsondocRepo, transformRepo);
        console.log('\nAffected items (raw):');
        console.log(JSON.stringify(affected, null, 2));

        const formatted = buildAffectedContextText(affected as any);
        console.log('\nFormatted prompt context:');
        console.log(formatted || '[EMPTY]');

    } catch (error) {
        console.error('[debug-edit-context] Error:', error);
        process.exit(1);
    } finally {
        try { await db.destroy(); } catch { }
        process.exit(0);
    }
}

function listCandidates(jsondocs: any[], schemaType: string) {
    const candidates = jsondocs.filter(j => j.schema_type === schemaType);
    console.log(`Candidates for '${schemaType}': ${candidates.length}`);
    candidates.slice(0, 10).forEach(j => console.log(` - ${j.id} (${j.created_at})`));
    if (candidates.length > 10) console.log('...');
}

function printLocalLineage(targetId: string, lineageGraph: any) {
    try {
        const targetNode = lineageGraph.nodes.get(targetId);
        console.log('Local lineage:');
        if (!targetNode) {
            console.log(` - Node not found for ${targetId}`);
            return;
        }
        // Upstream (source transform and its inputs)
        if (targetNode.type === 'jsondoc') {
            const st = targetNode.sourceTransform && targetNode.sourceTransform !== 'none' ? targetNode.sourceTransform : null;
            if (st) {
                console.log(` - Produced by transform: ${st.transformId} (${st.transform?.type})`);
                const inputs = st.sourceJsondocs || [];
                inputs.forEach((sj: any) => console.log(`   - input jsondoc: ${sj.jsondocId}`));
            } else {
                console.log(' - No source transform');
            }
        }
        // Downstream (edges from target)
        const edges = lineageGraph.edges.get(targetId) || [];
        if (edges.length > 0) {
            console.log(' - Downstream edges:');
            edges.forEach((id: string) => {
                const n = lineageGraph.nodes.get(id);
                console.log(`   - ${id} (${n?.type || 'unknown'})`);
            });
        }
    } catch {
        // ignore
    }
}

main();


