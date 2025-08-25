import type { LineageGraph } from './transform-jsondoc-framework/lineageResolution';
import type {
    ElectricJsondoc,
    ElectricTransform
} from './transform-jsondoc-types';

// Import canonical detection logic for fallback when lineage fails
function findCanonicalJsondocByType(
    lineageGraph: LineageGraph,
    jsondocs: ElectricJsondoc[],
    schemaType: string
): ElectricJsondoc | null {
    // Find all jsondocs of this type
    const candidateJsondocs = jsondocs.filter(a => a.schema_type === schemaType);

    if (candidateJsondocs.length === 0) return null;

    // Special handling for episode docs: always include all jsondocs regardless of lineage graph status
    if (schemaType === '单集大纲' || schemaType === '单集剧本') {
        return findBestJsondocByPriority(candidateJsondocs, lineageGraph);
    }

    // Filter to only include jsondocs that are in the lineage graph (canonical jsondocs)
    const canonicalJsondocs = candidateJsondocs.filter(jsondoc => {
        const node = lineageGraph.nodes.get(jsondoc.id);
        return node != null;
    });

    if (canonicalJsondocs.length === 0) {
        // If no jsondocs are in lineage graph, fall back to all candidates
        // This handles cases where jsondocs exist but aren't connected to transforms yet
        return findBestJsondocByPriority(candidateJsondocs, lineageGraph);
    }

    return findBestJsondocByPriority(canonicalJsondocs, lineageGraph);
}

function findBestJsondocByPriority(
    candidates: ElectricJsondoc[],
    lineageGraph: LineageGraph
): ElectricJsondoc | null {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // Prioritization logic:
    // 1. User input jsondocs over AI generated ones
    // 2. Leaf nodes (no descendants) over non-leaf nodes  
    // 3. More recent jsondocs over older ones

    return candidates.sort((a, b) => {
        // Priority 1: User input over AI generated
        if (a.origin_type === 'user_input' && b.origin_type === 'ai_generated') return -1;
        if (a.origin_type === 'ai_generated' && b.origin_type === 'user_input') return 1;

        // Priority 2: Leaf nodes over non-leaf nodes
        const aIsLeaf = !lineageGraph.edges.get(a.id) || lineageGraph.edges.get(a.id)!.length === 0;
        const bIsLeaf = !lineageGraph.edges.get(b.id) || lineageGraph.edges.get(b.id)!.length === 0;

        if (aIsLeaf && !bIsLeaf) return -1;
        if (!aIsLeaf && bIsLeaf) return 1;

        // Priority 3: More recent (created_at) over older
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })[0];
}

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
    severity: 'high' | 'medium' | 'low';
    sourceChanges: DiffChange[];
    suggestedAction?: string;
    // NEW: unique upstream sources that made this child stale
    sources?: Array<{ id: string; schemaType: string }>;
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
            // FIXED: Include user_input documents - they can also become stale
            // User-edited documents should be marked as stale when their upstream changes

            const impact = analyzeImpact(
                sourceJsondoc.schema_type,
                diff.path,
                child.schema_type
            );

            const existing = affectedMap.get(child.id);
            if (existing) {
                existing.sourceChanges.push(diff);
                existing.affectedPaths = mergeAffectedPaths(existing.affectedPaths, impact.affectedPaths);
                if (
                    impact.severity === 'high' ||
                    (impact.severity === 'medium' && existing.severity === 'low')
                ) {
                    existing.severity = impact.severity as 'high' | 'medium' | 'low';
                }
                // Track unique upstream sources
                const srcId = sourceJsondoc.id;
                const srcType = sourceJsondoc.schema_type as string;
                const hasSource = (existing.sources || []).some(s => s.id === srcId);
                if (!hasSource) {
                    existing.sources = [...(existing.sources || []), { id: srcId, schemaType: srcType }];
                }
            } else {
                affectedMap.set(child.id, {
                    jsondocId: child.id,
                    schemaType: child.schema_type,
                    reason: generateReason(sourceJsondoc.schema_type, diff, child.schema_type),
                    affectedPaths: impact.affectedPaths,
                    severity: impact.severity as 'high' | 'medium' | 'low',
                    sourceChanges: [diff],
                    suggestedAction: generateSuggestedAction(child.schema_type),
                    sources: [{ id: sourceJsondoc.id, schemaType: sourceJsondoc.schema_type as string }]
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

    // First, try direct lineage (original algorithm)
    const edges = lineageGraph.edges.get(jsondocId);
    if (edges && edges.length > 0) {
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
    }

    // If we found children via direct lineage, return them
    if (children.length > 0) {
        return children;
    }

    // HYBRID APPROACH: If no direct children found, use canonical detection fallback
    const sourceJsondoc = jsondocs.find(j => j.id === jsondocId);
    if (!sourceJsondoc) return children;

    // Check if this schema type has known downstream impacts
    const schemaImpacts = SCHEMA_IMPACT_MAP[sourceJsondoc.schema_type];
    if (!schemaImpacts) return children;

    // Find canonical documents for each impacted schema type
    const impactedSchemaTypes = new Set<string>();
    Object.values(schemaImpacts).forEach(impact => {
        impact.impactedSchemas.forEach(schema => impactedSchemaTypes.add(schema));
    });

    // Find canonical documents for each impacted schema type  
    for (const schemaType of impactedSchemaTypes) {
        const canonical = findCanonicalJsondocByType(lineageGraph, jsondocs, schemaType);
        if (canonical && canonical.id !== jsondocId) {
            children.push(canonical);
        }
    }

    return children;
}

const SCHEMA_IMPACT_MAP: Record<string, Record<string, { impactedSchemas: string[]; severity: 'high' | 'medium' }>> = {
    '灵感创意': {
        '$.title': { impactedSchemas: ['故事设定'], severity: 'high' },
        '$.genre': { impactedSchemas: ['故事设定'], severity: 'high' },
        '$.body': { impactedSchemas: ['故事设定', 'chronicles'], severity: 'medium' }
    },
    '故事设定': {
        '$.characters': { impactedSchemas: ['chronicles', '分集结构'], severity: 'high' },
        '$.synopsis': { impactedSchemas: ['chronicles'], severity: 'medium' }
    },
    'chronicles': {
        '$.stages': { impactedSchemas: ['分集结构'], severity: 'high' }
    }
};

function analyzeImpact(sourceSchema: string, changePath: string, targetSchema: string): { severity: 'high' | 'medium' | 'low'; affectedPaths?: string[] } {
    const sourceImpacts = SCHEMA_IMPACT_MAP[sourceSchema];
    if (!sourceImpacts) return { severity: 'medium' };

    for (const [pathPattern, impact] of Object.entries(sourceImpacts)) {
        if (changePath.startsWith(pathPattern) && impact.impactedSchemas.includes(targetSchema)) {
            return { severity: impact.severity, affectedPaths: [changePath] };
        }
    }
    return { severity: 'low' };
}

function generateReason(sourceSchema: string, diff: DiffChange, targetSchema: string): string {
    const fieldName = diff.path.split('.').pop() || '内容';
    return `上游${sourceSchema}的${fieldName}已更改，${targetSchema}可能需要相应调整`;
}

function generateSuggestedAction(schemaType: string): string {
    const actions: Record<string, string> = {
        '故事设定': '根据新的故事创意更新故事设定',
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


