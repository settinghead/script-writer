import {
    buildLineageGraph,
    LineageGraph,
    LineageNode,
    LineageNodeJsondoc,
    LineageNodeTransform
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

function computeAgentContextFromData(projectData: ProjectDataForContext): Record<string, any> {
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

    // Find brainstorm input (latest leaf)
    const brainstormInputs = Array.from(lineageGraph.nodes.values())
        .filter(node => node.type === 'jsondoc' && (node as LineageNodeJsondoc).jsondoc.schema_type === 'brainstorm_input_params' && node.isLeaf)
        .map(node => (node as LineageNodeJsondoc).jsondoc);
    if (brainstormInputs.length > 1) throw new Error('Multiple brainstorm inputs found');
    if (brainstormInputs.length === 1) {
        const jsondoc = brainstormInputs[0];
        agentContext.brainstorm_input = { id: jsondoc.id, data: getFullData(jsondoc) };
    }

    // Find chosen idea: leaf user_input brainstorm_idea with possible descendants
    const chosenIdeas = Array.from(lineageGraph.nodes.values())
        .filter(node => node.type === 'jsondoc' && (node as LineageNodeJsondoc).jsondoc.schema_type === 'brainstorm_idea' && (node as LineageNodeJsondoc).jsondoc.origin_type === 'user_input' && node.isLeaf)
        .map(node => (node as LineageNodeJsondoc).jsondoc);
    if (chosenIdeas.length > 1) throw new Error('Multiple chosen ideas found');
    const hasChosenIdea = chosenIdeas.length === 1;
    if (hasChosenIdea) {
        const jsondoc = chosenIdeas[0];
        agentContext.chosen_idea = { id: jsondoc.id, data: getFullData(jsondoc) };
    }

    // Brainstorm collection: only if no chosen idea, take latest leaf collection
    if (!hasChosenIdea) {
        const collections = Array.from(lineageGraph.nodes.values())
            .filter(node => node.type === 'jsondoc' && (node as LineageNodeJsondoc).jsondoc.schema_type === 'brainstorm_collection' && node.isLeaf)
            .map(node => (node as LineageNodeJsondoc).jsondoc);
        if (collections.length > 1) throw new Error('Multiple brainstorm collections found');
        if (collections.length === 1) {
            const jsondoc = collections[0];
            agentContext.brainstorm_collection = { id: jsondoc.id, data: getFullData(jsondoc) };
        }
    }

    // Outline settings: latest leaf
    const outlineSettings = Array.from(lineageGraph.nodes.values())
        .filter(node => node.type === 'jsondoc' && (node as LineageNodeJsondoc).jsondoc.schema_type === 'outline_settings' && node.isLeaf)
        .map(node => (node as LineageNodeJsondoc).jsondoc);
    if (outlineSettings.length > 1) throw new Error('Multiple outline settings found');
    if (outlineSettings.length === 1) {
        const jsondoc = outlineSettings[0];
        agentContext.outline_settings = { id: jsondoc.id, data: getFullData(jsondoc) };
    }

    // Chronicles: latest leaf
    const chronicles = Array.from(lineageGraph.nodes.values())
        .filter(node => node.type === 'jsondoc' && (node as LineageNodeJsondoc).jsondoc.schema_type === 'chronicles' && node.isLeaf)
        .map(node => (node as LineageNodeJsondoc).jsondoc);
    if (chronicles.length > 1) throw new Error('Multiple chronicles found');
    if (chronicles.length === 1) {
        const jsondoc = chronicles[0];
        agentContext.chronicles = { id: jsondoc.id, data: getFullData(jsondoc) };
    }

    return agentContext;
}

export async function prepareAgentPromptContext(
    projectData: ProjectDataForContext,
    projectId: string
): Promise<string> {
    try {
        const agentContext = computeAgentContextFromData(projectData);
        return dump(agentContext, { indent: 2 });
    } catch (error) {
        console.error('Error computing agent context:', error);
        return dump({ error: 'Failed to compute context' });
    }
} 