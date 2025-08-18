import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import { buildLineageGraph } from '../../common/transform-jsondoc-framework/lineageResolution';
import { computeCanonicalJsondocsFromLineage } from '../../common/canonicalJsondocLogic';
import { findParentJsondocsBySchemaType } from '../../common/transform-jsondoc-framework/lineageResolution';

export type DiffItem = {
    path: string;
    before?: any;
    after?: any;
    fieldType?: string;
};

export type AffectedItem = {
    jsondocId: string;
    schemaType: string;
    reason: string;
    diffs?: DiffItem[];
};

/**
 * Compute affected context (incl. upstream diffs) for outline settings edits.
 * Unifies debug and runtime behavior so both inject the same context into prompts.
 */
export async function computeAffectedContextForOutline(
    projectId: string,
    outlineJsondocId: string,
    jsondocRepo: TransformJsondocRepository,
    transformRepo: TransformJsondocRepository
): Promise<AffectedItem[]> {
    try {
        // Load complete project data in Electric format
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

        const jsondocMap = new Map(jsondocs.map(j => [j.id, j]));
        const outlineJsondoc = jsondocMap.get(outlineJsondocId);
        if (!outlineJsondoc) return [];

        // Find parent idea from lineage
        const parents = findParentJsondocsBySchemaType(outlineJsondocId, '灵感创意', lineageGraph, jsondocs);
        const parentIdea = parents && parents.length > 0 ? parents[0] : undefined;

        // Find canonical idea (latest user choice)
        const canonicalIdea = canonical.canonicalBrainstormIdea
            ? jsondocMap.get(canonical.canonicalBrainstormIdea.id)
            : undefined;

        if (!parentIdea || !canonicalIdea || parentIdea.id === canonicalIdea.id) {
            return [];
        }

        // Compute lightweight diffs for important fields
        const parentData = typeof parentIdea.data === 'string' ? JSON.parse(parentIdea.data) : parentIdea.data;
        const latestData = typeof canonicalIdea.data === 'string' ? JSON.parse(canonicalIdea.data) : canonicalIdea.data;

        const diffs: DiffItem[] = [];
        if (parentData?.title !== latestData?.title) {
            diffs.push({ path: '$.title', before: parentData?.title, after: latestData?.title, fieldType: 'string' });
        }
        if (parentData?.body !== latestData?.body) {
            diffs.push({ path: '$.body', before: parentData?.body, after: latestData?.body, fieldType: 'string' });
        }

        if (diffs.length === 0) return [];

        return [{
            jsondocId: canonicalIdea.id,
            schemaType: '灵感创意',
            reason: '上游创意已更新',
            diffs
        }];
    } catch (error) {
        console.warn('[computeAffectedContextForOutline] failed:', error);
        return [];
    }
}


