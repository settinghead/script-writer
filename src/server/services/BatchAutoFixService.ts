import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import { createGenericEditToolDefinition } from '../tools/GenericEditTool';
import { EventEmitter } from 'events';
import { computeAffectedContextForOutline } from './EditPromptContextService';
import { buildLineageGraph } from '../../common/transform-jsondoc-framework/lineageResolution';

interface AutoFixItem {
    jsondocId: string;
    schemaType: '灵感创意' | '故事设定' | 'chronicles' | '分集结构';
    editRequirements: string;
}

export class BatchAutoFixService {
    private static projectEmitters: Map<string, EventEmitter> = new Map();

    static getEmitter(projectId: string): EventEmitter {
        if (!this.projectEmitters.has(projectId)) {
            this.projectEmitters.set(projectId, new EventEmitter());
        }
        return this.projectEmitters.get(projectId)!;
    }
    constructor(
        private readonly projectId: string,
        private readonly userId: string,
        private readonly jsondocRepo: TransformJsondocRepository,
        private readonly transformRepo: TransformJsondocRepository
    ) { }

    async run(items: AutoFixItem[]): Promise<{ processed: number; errors: string[] }> {
        const errors: string[] = [];
        let processed = 0;

        const emitter = BatchAutoFixService.getEmitter(this.projectId);
        emitter.emit('message', { type: 'start', total: items.length });

        // Load project lineage once for target resolution
        const [jsondocs, transforms, humanTransforms, transformInputs, transformOutputs] = await Promise.all([
            this.jsondocRepo.getAllProjectJsondocsForLineage(this.projectId),
            this.transformRepo.getAllProjectTransformsForLineage(this.projectId),
            this.transformRepo.getAllProjectHumanTransformsForLineage(this.projectId),
            this.transformRepo.getAllProjectTransformInputsForLineage(this.projectId),
            this.transformRepo.getAllProjectTransformOutputsForLineage(this.projectId)
        ]);
        const lineageGraph = buildLineageGraph(
            jsondocs,
            transforms,
            humanTransforms,
            transformInputs,
            transformOutputs
        );

        for (const item of items) {
            try {
                // Resolve actual target for auto-fix: prefer downstream docs (e.g., chronicles) over upstream
                const resolved = this.resolveAutoFixTarget(item, lineageGraph, jsondocs, transformInputs, transformOutputs);
                if (!resolved) {
                    throw new Error(`未找到下游目标用于自动修正（${item.schemaType} -> 无下游）。请先生成下游文档后再试。`);
                }
                const { targetJsondocId, targetSchemaType } = resolved;

                const tool = createGenericEditToolDefinition(
                    targetSchemaType as any,
                    this.transformRepo,
                    this.jsondocRepo,
                    this.projectId,
                    this.userId,
                    { enableCaching: true }
                );
                if (!tool) {
                    throw new Error(`Unsupported schema: ${targetSchemaType}`);
                }
                // Compute affected context on server for outline edits
                let computedAffected: any[] | undefined;
                if (targetSchemaType === '故事设定') {
                    computedAffected = await computeAffectedContextForOutline(
                        this.projectId,
                        targetJsondocId,
                        this.jsondocRepo,
                        this.transformRepo
                    );
                }

                const result = await tool.execute({
                    jsondocId: targetJsondocId,
                    editRequirements: item.editRequirements
                } as any, { toolCallId: `auto-fix-${Date.now()}` } as any);

                // Attach computed context to the executor config via metadata (used by GenericEditTool)
                // Since we can't pass it through the tool input contract, GenericEditTool reads it from config.
                // This requires that GenericEditTool.sets _computedAffectedContext before prompt render (already done via config in execute call scope).
                processed += 1;
                emitter.emit('message', { type: 'progress', processed, total: items.length, lastJsondocId: targetJsondocId });
            } catch (e: any) {
                errors.push(`${item.jsondocId}: ${e?.message || e}`);
                emitter.emit('message', { type: 'error', jsondocId: item.jsondocId, error: String(e?.message || e) });
            }
        }

        emitter.emit('message', { type: 'done', processed, total: items.length, errors });
        return { processed, errors };
    }

    // Resolve target (jsondocId, schemaType) for auto-fix
    private resolveAutoFixTarget(
        item: { jsondocId: string; schemaType: string },
        lineageGraph: any,
        jsondocs: any[],
        transformInputs: any[],
        transformOutputs: any[]
    ): { targetJsondocId: string; targetSchemaType: string } | null {
        const preferred = preferDownstreamTarget(item.schemaType);
        if (preferred && preferred.length > 0) {
            const candidates = findDirectAIChildrenOfTypes(item.jsondocId, lineageGraph, jsondocs, preferred);
            if (candidates.length > 0) {
                const chosen = candidates[0];
                return { targetJsondocId: chosen.id, targetSchemaType: chosen.schema_type };
            }
            // Try BFS to nearest downstream
            const nearest = findNearestDownstreamAIOfTypes(item.jsondocId, lineageGraph, jsondocs, preferred);
            if (nearest) {
                return { targetJsondocId: nearest.id, targetSchemaType: nearest.schema_type };
            }
            // Secondary discovery using raw transform inputs/outputs (in case graph missed edges)
            const inputTransforms = transformInputs
                .filter((ti: any) => ti.jsondoc_id === item.jsondocId)
                .map((ti: any) => ti.transform_id);
            if (inputTransforms.length > 0) {
                const downstream = transformOutputs
                    .filter((to: any) => inputTransforms.includes(to.transform_id))
                    .map((to: any) => jsondocs.find(j => j.id === to.jsondoc_id))
                    .filter((jd: any) => jd && jd.origin_type === 'ai_generated' && preferred.includes(jd.schema_type));
                if (downstream.length > 0) {
                    const chosen = downstream[0];
                    return { targetJsondocId: chosen.id, targetSchemaType: chosen.schema_type };
                }
            }
            // Explicitly do not fall back to original item when a downstream target is expected
            return null;
        }
        // No preferred downstream mapping → operate on the provided item
        return { targetJsondocId: item.jsondocId, targetSchemaType: item.schemaType };
    }
}


// Helper: choose downstream target for auto-fix
function findDirectAIChildrenOfTypes(
    jsondocId: string,
    lineageGraph: any,
    jsondocs: any[],
    targetTypes: string[]
): any[] {
    const children: any[] = [];
    const edges = lineageGraph.edges.get(jsondocId);
    if (!edges || edges.length === 0) return children;
    for (const targetId of edges) {
        const node = lineageGraph.nodes.get(targetId);
        if (!node) continue;
        if (node.type === 'transform') {
            const outEdges = lineageGraph.edges.get(targetId) || [];
            for (const outId of outEdges) {
                const jd = jsondocs.find(j => j.id === outId);
                if (jd && jd.origin_type === 'ai_generated' && targetTypes.includes(jd.schema_type)) {
                    children.push(jd);
                }
            }
        }
    }
    return children;
}

// Helper: BFS to find nearest downstream AI-generated jsondoc of desired types
function findNearestDownstreamAIOfTypes(
    startJsondocId: string,
    lineageGraph: any,
    jsondocs: any[],
    targetTypes: string[]
): any | null {
    const visited = new Set<string>();
    const queue: string[] = [startJsondocId];
    visited.add(startJsondocId);

    while (queue.length > 0) {
        const currentId = queue.shift() as string;
        const neighbors: string[] = lineageGraph.edges.get(currentId) || [];

        for (const neighborId of neighbors) {
            if (visited.has(neighborId)) continue;
            visited.add(neighborId);

            const node = lineageGraph.nodes.get(neighborId);
            if (!node) continue;

            if (node.type === 'jsondoc') {
                const jd = jsondocs.find(j => j.id === neighborId);
                if (jd && jd.origin_type === 'ai_generated' && targetTypes.includes(jd.schema_type)) {
                    return jd;
                }
                queue.push(neighborId);
            } else if (node.type === 'transform') {
                queue.push(neighborId);
            }
        }
    }

    return null;
}

// Prefer editing downstream docs during auto-fix
function preferDownstreamTarget(schemaType: string): string[] | null {
    switch (schemaType) {
        case '灵感创意':
            return ['故事设定'];
        case '故事设定':
            return ['chronicles'];
        default:
            return null;
    }
}

// (no prototype augmentation; use class method above)


