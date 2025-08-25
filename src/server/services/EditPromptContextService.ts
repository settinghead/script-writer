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

/**
 * Compute affected context for chronicles edits based on upstream 故事设定 changes.
 * Compares the outline settings that originally produced this chronicles vs the canonical outline settings.
 */
export async function computeAffectedContextForChronicles(
    projectId: string,
    chroniclesJsondocId: string,
    jsondocRepo: TransformJsondocRepository,
    transformRepo: TransformJsondocRepository
): Promise<AffectedItem[]> {
    try {
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
        const chronicles = jsondocMap.get(chroniclesJsondocId);
        if (!chronicles) return [];

        // Upstream parent outline settings used to create this chronicles
        const parents = findParentJsondocsBySchemaType(chroniclesJsondocId, '故事设定', lineageGraph, jsondocs);
        const parentOutline = parents && parents.length > 0 ? parents[0] : undefined;
        const canonicalOutline = canonical.canonicalOutlineSettings
            ? jsondocMap.get(canonical.canonicalOutlineSettings.id)
            : undefined;

        if (!parentOutline || !canonicalOutline || parentOutline.id === canonicalOutline.id) {
            return [];
        }

        const parentData = typeof parentOutline.data === 'string' ? JSON.parse(parentOutline.data) : parentOutline.data;
        const latestData = typeof canonicalOutline.data === 'string' ? JSON.parse(canonicalOutline.data) : canonicalOutline.data;

        const diffs: DiffItem[] = [];
        // Synopsis changes impact chronicles
        if (parentData?.synopsis !== latestData?.synopsis) {
            diffs.push({ path: '$.synopsis', before: parentData?.synopsis, after: latestData?.synopsis, fieldType: 'string' });
        }
        // Character list changes can impact chronicles structure
        if (JSON.stringify(parentData?.characters || null) !== JSON.stringify(latestData?.characters || null)) {
            diffs.push({ path: '$.characters', before: parentData?.characters, after: latestData?.characters, fieldType: 'array' });
        }

        if (diffs.length === 0) return [];

        return [{
            jsondocId: canonicalOutline.id,
            schemaType: '故事设定',
            reason: '上游故事设定已更新',
            diffs
        }];
    } catch (error) {
        console.warn('[computeAffectedContextForChronicles] failed:', error);
        return [];
    }
}

/**
 * Compute affected context for 分集结构 edits based on upstream chronicles changes.
 */
export async function computeAffectedContextForEpisodePlanning(
    projectId: string,
    episodePlanningJsondocId: string,
    jsondocRepo: TransformJsondocRepository,
    transformRepo: TransformJsondocRepository
): Promise<AffectedItem[]> {
    try {
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
        const episodePlanning = jsondocMap.get(episodePlanningJsondocId);
        if (!episodePlanning) return [];

        const parents = findParentJsondocsBySchemaType(episodePlanningJsondocId, 'chronicles', lineageGraph, jsondocs);
        const parentChronicles = parents && parents.length > 0 ? parents[0] : undefined;
        const canonicalChronicles = canonical.canonicalChronicles
            ? jsondocMap.get(canonical.canonicalChronicles.id)
            : undefined;

        if (!parentChronicles || !canonicalChronicles || parentChronicles.id === canonicalChronicles.id) {
            return [];
        }

        const parentData = typeof parentChronicles.data === 'string' ? JSON.parse(parentChronicles.data) : parentChronicles.data;
        const latestData = typeof canonicalChronicles.data === 'string' ? JSON.parse(canonicalChronicles.data) : canonicalChronicles.data;

        const diffs: DiffItem[] = [];
        if (JSON.stringify(parentData?.stages || null) !== JSON.stringify(latestData?.stages || null)) {
            diffs.push({ path: '$.stages', before: parentData?.stages, after: latestData?.stages, fieldType: 'array' });
        }

        if (diffs.length === 0) return [];

        return [{
            jsondocId: canonicalChronicles.id,
            schemaType: 'chronicles',
            reason: '上游时间顺序大纲已更新',
            diffs
        }];
    } catch (error) {
        console.warn('[computeAffectedContextForEpisodePlanning] failed:', error);
        return [];
    }
}

/**
 * Dispatcher: compute affected context by edited schema type.
 */
export async function computeAffectedContextForEdit(
    projectId: string,
    schemaType: string,
    jsondocId: string,
    jsondocRepo: TransformJsondocRepository,
    transformRepo: TransformJsondocRepository
): Promise<AffectedItem[]> {
    return computeAffectedContextForEditGeneric(projectId, schemaType, jsondocId, jsondocRepo, transformRepo);
}


// =============================
// Generic implementation (no relation config)
// =============================

function isObjectLike(value: any): boolean {
    return value !== null && typeof value === 'object';
}

function buildTopLevelDiffs(beforeData: any, afterData: any): DiffItem[] {
    const diffs: DiffItem[] = [];
    const before = isObjectLike(beforeData) ? beforeData : {};
    const after = isObjectLike(afterData) ? afterData : {};
    const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);

    for (const key of keys) {
        const prevVal = before[key];
        const nextVal = after[key];
        const prevIsArray = Array.isArray(prevVal);
        const nextIsArray = Array.isArray(nextVal);
        const fieldType: 'string' | 'array' | 'object' = typeof nextVal === 'string' || typeof prevVal === 'string'
            ? 'string'
            : (prevIsArray || nextIsArray) ? 'array' : 'object';

        const equal = fieldType === 'string'
            ? prevVal === nextVal
            : JSON.stringify(prevVal ?? null) === JSON.stringify(nextVal ?? null);

        if (!equal) {
            diffs.push({ path: `$.${key}`, before: prevVal, after: nextVal, fieldType });
        }
    }
    return diffs;
}

function canonicalToMap(canonical: any, jsondocMap: Map<string, any>): Map<string, any> {
    const map = new Map<string, any>();
    const pairs: Array<[string, any | null]> = [
        ['brainstorm_input_params', canonical.canonicalBrainstormInput || null],
        ['灵感创意', canonical.canonicalBrainstormIdea || null],
        ['brainstorm_collection', canonical.canonicalBrainstormCollection || null],
        ['故事设定', canonical.canonicalOutlineSettings || null],
        ['chronicles', canonical.canonicalChronicles || null],
        ['分集结构', canonical.canonicalEpisodePlanning || null]
    ];
    for (const [schemaType, entry] of pairs) {
        if (entry && entry.id) {
            const jd = jsondocMap.get(entry.id);
            if (jd) map.set(schemaType, jd);
        }
    }
    return map;
}

function collectDirectInputAncestorsBySchemaType(targetJsondocId: string, lineageGraph: any): Map<string, any> {
    const result = new Map<string, any>();
    const node = lineageGraph.nodes.get(targetJsondocId);
    if (!node || node.type !== 'jsondoc') return result;
    const st = node.sourceTransform && node.sourceTransform !== 'none' ? node.sourceTransform : null;
    if (!st) return result;
    const sources = st.sourceJsondocs || [];
    for (const src of sources) {
        const srcNode = lineageGraph.nodes.get(src.jsondocId);
        if (srcNode && srcNode.type === 'jsondoc' && srcNode.jsondoc) {
            const schemaType = srcNode.jsondoc.schema_type;
            if (schemaType && !result.has(schemaType)) {
                result.set(schemaType, srcNode.jsondoc);
            }
        }
    }
    return result;
}

function isAncestorOf(ancestorJsondocId: string, descendantJsondocId: string, lineageGraph: any): boolean {
    const visited = new Set<string>();
    const queue: string[] = [descendantJsondocId];
    visited.add(descendantJsondocId);

    while (queue.length > 0) {
        const currentId = queue.shift() as string;
        if (currentId === ancestorJsondocId) return true;
        const node = lineageGraph.nodes.get(currentId);
        if (!node) continue;

        if (node.type === 'jsondoc') {
            const st = node.sourceTransform && node.sourceTransform !== 'none' ? node.sourceTransform : null;
            if (st && !visited.has(st.transformId)) {
                visited.add(st.transformId);
                queue.push(st.transformId);
            }
        } else if (node.type === 'transform') {
            const sources = node.sourceJsondocs || [];
            for (const src of sources) {
                if (!visited.has(src.jsondocId)) {
                    visited.add(src.jsondocId);
                    queue.push(src.jsondocId);
                }
            }
        }
    }
    return false;
}

async function computeAffectedContextForEditGeneric(
    projectId: string,
    targetType: string,
    targetJsondocId: string,
    jsondocRepo: TransformJsondocRepository,
    transformRepo: TransformJsondocRepository
): Promise<AffectedItem[]> {
    try {
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
        const target = jsondocMap.get(targetJsondocId);
        if (!target) return [];

        const results: AffectedItem[] = [];

        // 1) Collect direct input ancestors (one hop) by schema type used to produce the target
        const nearestAncestors = collectDirectInputAncestorsBySchemaType(targetJsondocId, lineageGraph);

        // 2) Build canonical map by schema type
        const canonicalMap = canonicalToMap(canonical, jsondocMap);

        // 3) For each ancestor type, compare with canonical of same type (only if canonical is a descendant of the ancestor)
        for (const [schemaTypeKey, ancestor] of nearestAncestors.entries()) {
            const canonicalUpstream = canonicalMap.get(schemaTypeKey);
            if (!canonicalUpstream) continue;
            if (canonicalUpstream.id === ancestor.id) continue;
            // Only include if canonical is on the same branch (descendant of ancestor)
            if (!isAncestorOf(ancestor.id, canonicalUpstream.id, lineageGraph)) continue;

            const parentData = typeof ancestor.data === 'string' ? JSON.parse(ancestor.data) : ancestor.data;
            const latestData = typeof canonicalUpstream.data === 'string' ? JSON.parse(canonicalUpstream.data) : canonicalUpstream.data;

            const diffs = buildTopLevelDiffs(parentData, latestData);
            if (diffs.length === 0) continue;

            results.push({
                jsondocId: canonicalUpstream.id,
                schemaType: schemaTypeKey,
                reason: `上游${schemaTypeKey}已更新`,
                diffs
            });
        }

        return results;
    } catch (error) {
        console.warn('[computeAffectedContextForEditGeneric] failed:', error);
        return [];
    }
}

/**
 * Find the nearest ancestor jsondoc (walking through human/llm transforms) that matches a schema type.
 * Uses lineageGraph.nodes which contain jsondoc nodes with sourceTransform and transform nodes with sourceJsondocs.
 */
async function findNearestAncestorBySchemaType(
    startJsondocId: string,
    desiredSchemaType: string,
    lineageGraph: any,
    jsondocs: any[],
    transforms: any[],
    transformInputs: any[],
    transformOutputs: any[]
) {
    try {
        const visited = new Set<string>();
        const queue: string[] = [startJsondocId];
        visited.add(startJsondocId);

        while (queue.length > 0) {
            const currentId = queue.shift() as string;
            const node = lineageGraph.nodes.get(currentId);
            if (!node) continue;

            // Move to the transform that produced this jsondoc (if any)
            if (node.type === 'jsondoc') {
                // If this jsondoc itself is the desired type (and not the starting one), return it
                if (currentId !== startJsondocId && node.jsondoc?.schema_type === desiredSchemaType) {
                    return node.jsondoc;
                }
                const sourceTransform = node.sourceTransform && node.sourceTransform !== 'none' ? node.sourceTransform : null;
                if (sourceTransform && !visited.has(sourceTransform.transformId)) {
                    visited.add(sourceTransform.transformId);
                    queue.push(sourceTransform.transformId);
                }
            } else if (node.type === 'transform') {
                // Enqueue all source jsondocs of this transform
                const sources = node.sourceJsondocs || [];
                for (const src of sources) {
                    if (!visited.has(src.jsondocId)) {
                        visited.add(src.jsondocId);
                        queue.push(src.jsondocId);
                    }
                }
            }
        }
    } catch {
        // best-effort only
    }
    return undefined;
}


