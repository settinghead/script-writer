import {
    LineageGraph,
    extractEffectiveBrainstormIdeas,
    findMainWorkflowPath,
    type EffectiveBrainstormIdea,
    type WorkflowNode
} from './transform-jsondoc-framework/lineageResolution';
import type {
    ElectricJsondoc,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput
} from './types';

// Core canonical jsondoc context (without React components)
export interface CanonicalJsondocContext {
    // Resolved jsondocs from lineage traversal
    effectiveBrainstormIdeas: EffectiveBrainstormIdea[];
    chosenBrainstormIdea: EffectiveBrainstormIdea | null;
    latestOutlineSettings: ElectricJsondoc | null;
    latestChronicles: ElectricJsondoc | null;
    latestEpisodePlanning: ElectricJsondoc | null;
    brainstormInput: ElectricJsondoc | null;

    // Workflow state
    workflowNodes: WorkflowNode[];

    // Transform state
    hasActiveTransforms: boolean;
    activeTransforms: ElectricTransform[];

    // Lineage metadata
    lineageGraph: LineageGraph;
    rootNodes: string[];
    leafNodes: string[];
}

/**
 * Core function to compute canonical jsondocs from lineage graph
 * This is the DRY logic that both frontend and backend can use
 */
export function computeCanonicalJsondocsFromLineage(
    lineageGraph: LineageGraph,
    jsondocs: ElectricJsondoc[],
    transforms: ElectricTransform[],
    humanTransforms: ElectricHumanTransform[],
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[]
): CanonicalJsondocContext {
    // Use existing functions from lineageResolution.ts
    const effectiveBrainstormIdeas = extractEffectiveBrainstormIdeas(
        jsondocs,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    const chosenBrainstormIdea = findChosenIdeaFromLineage(effectiveBrainstormIdeas, lineageGraph);

    const latestOutlineSettings = findLatestJsondocByType(
        lineageGraph,
        jsondocs,
        'outline_settings'
    );

    const latestChronicles = findLatestJsondocByType(
        lineageGraph,
        jsondocs,
        'chronicles'
    );

    const latestEpisodePlanning = findLatestJsondocByType(
        lineageGraph,
        jsondocs,
        'episode_planning'
    );

    // Find brainstorm input jsondoc
    const brainstormInput = findLatestJsondocByType(
        lineageGraph,
        jsondocs,
        'brainstorm_input_params'
    );

    return {
        effectiveBrainstormIdeas,
        chosenBrainstormIdea,
        latestOutlineSettings,
        latestChronicles,
        latestEpisodePlanning,
        brainstormInput,
        workflowNodes: findMainWorkflowPath(jsondocs, lineageGraph),
        hasActiveTransforms: transforms.some(t => t.status === 'running' || t.status === 'pending'),
        activeTransforms: transforms.filter(t => t.status === 'running' || t.status === 'pending'),
        lineageGraph,
        rootNodes: Array.from(lineageGraph.rootNodes),
        leafNodes: findAllLeafNodes(lineageGraph)
    };
}

/**
 * Extract all canonical jsondoc IDs from the context
 * These are the jsondocs that should be displayed in UI and have active particles
 */
export function extractCanonicalJsondocIds(context: CanonicalJsondocContext): Set<string> {
    const canonicalIds = new Set<string>();

    // Add effective brainstorm ideas
    context.effectiveBrainstormIdeas.forEach(idea => {
        canonicalIds.add(idea.jsondocId);
    });

    // Add chosen brainstorm idea (might be duplicate, but Set handles that)
    if (context.chosenBrainstormIdea) {
        canonicalIds.add(context.chosenBrainstormIdea.jsondocId);
    }

    // Add latest jsondocs of each type
    if (context.latestOutlineSettings) {
        canonicalIds.add(context.latestOutlineSettings.id);
    }

    if (context.latestChronicles) {
        canonicalIds.add(context.latestChronicles.id);
    }

    if (context.latestEpisodePlanning) {
        canonicalIds.add(context.latestEpisodePlanning.id);
    }

    if (context.brainstormInput) {
        canonicalIds.add(context.brainstormInput.id);
    }

    return canonicalIds;
}

// ============================================================================
// Utility Functions (moved from lineageBasedActionComputation.ts)
// ============================================================================

/**
 * Find the latest jsondoc of a specific type using lineage depth
 */
function findLatestJsondocByType(
    lineageGraph: LineageGraph,
    jsondocs: ElectricJsondoc[],
    schemaType: string
): ElectricJsondoc | null {
    // Find all jsondocs of this type
    const candidateJsondocs = jsondocs.filter(a =>
        a.schema_type === schemaType
    );

    if (candidateJsondocs.length === 0) return null;

    // Filter to only include jsondocs that are in the lineage graph (canonical jsondocs)
    const canonicalJsondocs = candidateJsondocs.filter(jsondoc => {
        const node = lineageGraph.nodes.get(jsondoc.id);
        return node != null;
    });

    if (canonicalJsondocs.length === 0) return null;

    // Find leaf nodes (jsondocs without descendants) from canonical set
    const leafJsondocs = canonicalJsondocs.filter(jsondoc => {
        const node = lineageGraph.nodes.get(jsondoc.id);
        return node && node.isLeaf;
    });

    if (leafJsondocs.length > 0) {
        // Prioritize user_input jsondocs, then by most recent
        leafJsondocs.sort((a, b) => {
            // First priority: user_input origin type
            if (a.origin_type === 'user_input' && b.origin_type !== 'user_input') return -1;
            if (b.origin_type === 'user_input' && a.origin_type !== 'user_input') return 1;
            // Second priority: most recent
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        return leafJsondocs[0];
    } else {
        // Fallback to most recent from canonical set if no leaf nodes found
        canonicalJsondocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return canonicalJsondocs[0];
    }
}

/**
 * Find chosen brainstorm idea from lineage (standalone idea that represents the chosen path)
 */
function findChosenIdeaFromLineage(
    effectiveBrainstormIdeas: EffectiveBrainstormIdea[],
    lineageGraph: LineageGraph
): EffectiveBrainstormIdea | null {
    // For standalone ideas (jsondocPath === '$'), consider them chosen regardless of leaf status
    // This is because individual ideas can have descendants (like outline settings) but are still the chosen idea
    for (const idea of effectiveBrainstormIdeas) {
        const node = lineageGraph.nodes.get(idea.jsondocId);
        if (node && idea.jsondocPath === '$') {
            // This is a standalone brainstorm idea jsondoc, can be chosen
            // We don't require it to be a leaf node because it might have outline settings as descendants
            return idea;
        }
    }

    // Fallback: if no standalone ideas, look for leaf nodes from collections
    for (const idea of effectiveBrainstormIdeas) {
        const node = lineageGraph.nodes.get(idea.jsondocId);
        if (node && node.isLeaf) {
            // Ideas from collections (jsondocPath like '$.ideas[0]') are only chosen if they're leaf nodes
            // This means user has explicitly selected them
            return idea;
        }
    }

    return null;
}

/**
 * Find all leaf nodes in the lineage graph
 */
function findAllLeafNodes(lineageGraph: LineageGraph): string[] {
    const leafNodes: string[] = [];

    for (const [jsondocId, node] of lineageGraph.nodes) {
        if (node.isLeaf) {
            leafNodes.push(jsondocId);
        }
    }

    return leafNodes;
} 