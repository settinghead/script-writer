import type { LineageGraph } from './transform-jsondoc-framework/lineageResolution';
import type {
    ElectricJsondoc,
    ElectricTransform
} from './transform-jsondoc-types';

export interface DiffChange {
    jsondocId: string;
    path: string;
    before: unknown;
    after: unknown;
    fieldType?: string;
}

export interface AffectedJsondoc {
    jsondocId: string;
    schemaType: string;
    reason: string;
    affectedPaths?: string[];
    sourceChanges: DiffChange[];
    suggestedAction?: string;
}

export async function computeStaleJsondocs(
    diffs: DiffChange[],
    lineageGraph: LineageGraph,
    jsondocs: ElectricJsondoc[],
    transforms?: ElectricTransform[]
): Promise<AffectedJsondoc[]> {
    const affectedMap = new Map<string, AffectedJsondoc>();

    for (const diff of diffs) {
        const sourceJsondoc = jsondocs.find(j => j.id === diff.jsondocId);
        if (!sourceJsondoc) continue;

        const directChildren = findDirectChildren(
            diff.jsondocId,
            lineageGraph,
            jsondocs,
            transforms
        );

        for (const child of directChildren) {
            if (child.origin_type === 'user_input') continue;

            const impact = analyzeImpact(
                sourceJsondoc.schema_type,
                diff.path,
                child.schema_type
            );

            const existing = affectedMap.get(child.id);
            if (existing) {
                existing.sourceChanges.push(diff);
                existing.affectedPaths = mergeAffectedPaths(existing.affectedPaths, impact.affectedPaths);
            } else {
                affectedMap.set(child.id, {
                    jsondocId: child.id,
                    schemaType: child.schema_type,
                    reason: generateReason(sourceJsondoc.schema_type, diff, child.schema_type),
                    affectedPaths: impact.affectedPaths,
                    sourceChanges: [diff],
                    suggestedAction: generateSuggestedAction(child.schema_type)
                });
            }
        }
    }

    return Array.from(affectedMap.values());
}

function findDirectChildren(
    jsondocId: string,
    lineageGraph: LineageGraph,
    jsondocs: ElectricJsondoc[],
    _transforms?: ElectricTransform[]
): ElectricJsondoc[] {
    const children: ElectricJsondoc[] = [];
    const edges = lineageGraph.edges.get(jsondocId);
    if (!edges || edges.length === 0) return children;

    for (const targetId of edges) {
        const targetNode = lineageGraph.nodes.get(targetId);
        if (!targetNode) continue;

        if (targetNode.type === 'transform') {
            const transformOutputEdges = lineageGraph.edges.get(targetId);
            if (transformOutputEdges) {
                for (const outputId of transformOutputEdges) {
                    const outputJsondoc = jsondocs.find(j => j.id === outputId);
                    if (outputJsondoc && outputJsondoc.origin_type === 'ai_generated') {
                        children.push(outputJsondoc);
                    }
                }
            }
        }
    }

    return children;
}

const SCHEMA_IMPACT_MAP: Record<string, Record<string, { impactedSchemas: string[] }>> = {
    '灵感创意': {
        '$.title': { impactedSchemas: ['剧本设定'] },
        '$.genre': { impactedSchemas: ['剧本设定'] },
        '$.body': { impactedSchemas: ['剧本设定', 'chronicles'] }
    },
    '剧本设定': {
        '$.characters': { impactedSchemas: ['chronicles', '分集结构'] },
        '$.synopsis': { impactedSchemas: ['chronicles'] }
    },
    'chronicles': {
        '$.stages': { impactedSchemas: ['分集结构'] }
    }
};

function analyzeImpact(sourceSchema: string, changePath: string, targetSchema: string): { affectedPaths?: string[] } {
    const sourceImpacts = SCHEMA_IMPACT_MAP[sourceSchema];
    if (!sourceImpacts) return {};

    for (const [pathPattern, impact] of Object.entries(sourceImpacts)) {
        if (changePath.startsWith(pathPattern) && impact.impactedSchemas.includes(targetSchema)) {
            return { affectedPaths: [changePath] };
        }
    }
    return {};
}

function generateReason(sourceSchema: string, diff: DiffChange, targetSchema: string): string {
    const fieldName = diff.path.split('.').pop() || '内容';
    return `上游${sourceSchema}的${fieldName}已更改，${targetSchema}可能需要相应调整`;
}

function generateSuggestedAction(schemaType: string): string {
    const actions: Record<string, string> = {
        '剧本设定': '根据新的故事创意更新剧本设定',
        'chronicles': '调整时间线以匹配新的剧情发展',
        '分集结构': '重新划分集数以适应新的故事节奏'
    };
    return actions[schemaType] || '更新内容以保持一致性';
}

function mergeAffectedPaths(existing?: string[], newPaths?: string[]): string[] | undefined {
    if (!existing && !newPaths) return undefined;
    if (!existing) return newPaths;
    if (!newPaths) return existing;
    return Array.from(new Set([...(existing || []), ...(newPaths || [])]));
}


