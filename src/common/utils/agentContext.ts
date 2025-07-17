import {
    buildLineageGraph,
    LineageNodeJsondoc
} from '../transform-jsondoc-framework/lineageResolution';
import type {
    ElectricJsondoc,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput
} from '../types';
import { dump } from 'js-yaml';

export interface ProjectDataForContext {
    jsondocs: ElectricJsondoc[];
    transforms: ElectricTransform[];
    humanTransforms: ElectricHumanTransform[];
    transformInputs: ElectricTransformInput[];
    transformOutputs: ElectricTransformOutput[];
}

/**
 * Find the latest jsondoc using the same priority logic as actionComputation.ts
 */
function findLatestJsondocByType(
    lineageGraph: any,
    jsondocs: ElectricJsondoc[],
    schemaType: string
): ElectricJsondoc | null {
    // Get all jsondocs of this type from the lineage graph
    const candidateJsondocs = jsondocs.filter(jsondoc => jsondoc.schema_type === schemaType);

    // Filter to only include jsondocs that are in the lineage graph (canonical jsondocs)
    const canonicalJsondocs = candidateJsondocs.filter(jsondoc => {
        const node = lineageGraph.nodes.get(jsondoc.id);
        return node != null;
    });

    if (canonicalJsondocs.length === 0) {
        return null;
    }

    console.log(`[agentContext] Found ${canonicalJsondocs.length} canonical ${schemaType} jsondocs:`,
        canonicalJsondocs.map(j => ({ id: j.id, origin_type: j.origin_type, created_at: j.created_at })));

    // Find leaf nodes from canonical set
    const leafJsondocs = canonicalJsondocs.filter((jsondoc) => {
        const lineageNode = lineageGraph.nodes.get(jsondoc.id);
        const isLeaf = lineageNode && lineageNode.isLeaf;
        console.log(`[agentContext] ${schemaType} ${jsondoc.id}: isLeaf=${isLeaf}, lineageNode exists=${!!lineageNode}`);
        return isLeaf;
    });

    console.log(`[agentContext] Leaf ${schemaType}:`, {
        leafCount: leafJsondocs.length,
        leafNodes: leafJsondocs.map(j => ({ id: j.id, origin_type: j.origin_type }))
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

        const selected = leafJsondocs[0];
        console.log(`[agentContext] Selected ${schemaType}:`, {
            id: selected.id,
            origin_type: selected.origin_type,
            created_at: selected.created_at
        });
        return selected;
    } else {
        // Fallback to most recent from canonical set if no leaf nodes found
        canonicalJsondocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const selected = canonicalJsondocs[0];
        console.log(`[agentContext] Selected ${schemaType} (fallback):`, {
            id: selected.id,
            origin_type: selected.origin_type,
            created_at: selected.created_at
        });
        return selected;
    }
}

function computeAgentContextFromData(projectData: ProjectDataForContext, projectId: string): Record<string, any> {
    // Build lineage graph - this is the single source of truth
    const lineageGraph = buildLineageGraph(
        projectData.jsondocs,
        projectData.transforms,
        projectData.humanTransforms,
        projectData.transformInputs,
        projectData.transformOutputs
    );

    const agentContext: Record<string, any> = {};

    // Helper to get full parsed data
    const getFullData = (jsondoc: ElectricJsondoc | null | undefined) => {
        if (!jsondoc) return undefined;
        try {
            return JSON.parse(jsondoc.data);
        } catch (error) {
            throw new Error(`Failed to parse jsondoc data for ${jsondoc.schema_type}: ${(error as Error).message}`);
        }
    };

    // Find brainstorm input using lineage graph
    const brainstormInput = findLatestJsondocByType(lineageGraph, projectData.jsondocs, 'brainstorm_input_params');
    if (brainstormInput) {
        agentContext.brainstorm_input = { id: brainstormInput.id, data: getFullData(brainstormInput) };
    }

    // Find chosen idea: leaf user_input brainstorm_idea
    const chosenIdeas = Array.from(lineageGraph.nodes.values())
        .filter(node => node.type === 'jsondoc' && (node as LineageNodeJsondoc).jsondoc.schema_type === 'brainstorm_idea' && (node as LineageNodeJsondoc).jsondoc.origin_type === 'user_input' && node.isLeaf)
        .map(node => (node as LineageNodeJsondoc).jsondoc);

    const hasChosenIdea = chosenIdeas.length === 1;
    if (hasChosenIdea) {
        const jsondoc = chosenIdeas[0];
        agentContext.chosen_idea = { id: jsondoc.id, data: getFullData(jsondoc) };
    }

    // Brainstorm collection: only if no chosen idea
    if (!hasChosenIdea) {
        const brainstormCollection = findLatestJsondocByType(lineageGraph, projectData.jsondocs, 'brainstorm_collection');
        if (brainstormCollection) {
            agentContext.brainstorm_collection = { id: brainstormCollection.id, data: getFullData(brainstormCollection) };
        }
    }

    // Outline settings using the same priority logic as actionComputation.ts
    const outlineSettings = findLatestJsondocByType(lineageGraph, projectData.jsondocs, 'outline_settings');
    if (outlineSettings) {
        agentContext.outline_settings = { id: outlineSettings.id, data: getFullData(outlineSettings) };
    }

    // Chronicles using the same priority logic as actionComputation.ts
    const chronicles = findLatestJsondocByType(lineageGraph, projectData.jsondocs, 'chronicles');
    if (chronicles) {
        agentContext.chronicles = { id: chronicles.id, data: getFullData(chronicles) };
    }

    // Episode planning using the same priority logic as actionComputation.ts
    const episodePlanning = findLatestJsondocByType(lineageGraph, projectData.jsondocs, 'episode_planning');
    if (episodePlanning) {
        agentContext.episode_planning = { id: episodePlanning.id, data: getFullData(episodePlanning) };
    }

    return agentContext;
}

export async function prepareAgentPromptContext(
    projectData: ProjectDataForContext,
    projectId: string
): Promise<string> {
    try {
        const agentContext = computeAgentContextFromData(projectData, projectId);
        return dump(agentContext, { indent: 2 });
    } catch (error) {
        console.error('Error computing agent context:', error);
        return dump({ error: 'Failed to compute context' });
    }
} 