import React from 'react';
import {
    LineageGraph,
    extractEffectiveBrainstormIdeas,
    findMainWorkflowPath,
    type EffectiveBrainstormIdea,
    type WorkflowNode
} from '../../common/transform-jsondoc-framework/lineageResolution';
import type {
    ElectricJsondoc,
    ElectricTransform,
    ElectricHumanTransform,
    ElectricTransformInput,
    ElectricTransformOutput
} from '../../common/types';

// Import action components
import BrainstormCreationActions from '../components/actions/BrainstormCreationActions';
import BrainstormInputForm from '../components/actions/BrainstormInputForm';
import BrainstormIdeaSelection from '../components/actions/BrainstormIdeaSelection';
import OutlineGenerationForm from '../components/actions/OutlineGenerationForm';
import ChroniclesGenerationAction from '../components/actions/ChroniclesGenerationAction';
import EpisodeGenerationAction from '../components/actions/EpisodeGenerationAction';

// Action item definition
export interface ActionItem {
    id: string;
    type: 'form' | 'button' | 'selection';
    title: string;
    description?: string;
    component: React.ComponentType<any>;
    props: Record<string, any>;
    enabled: boolean;
    priority: number; // For ordering (lower = higher priority)
}

// New props interface for action components
export interface ActionComponentProps {
    projectId: string;
    onSuccess?: (result?: any) => void;
    onError?: (error: Error) => void;

    // Resolved jsondocs (no more parsing needed)
    jsondocs: {
        brainstormIdeas?: EffectiveBrainstormIdea[];
        chosenIdea?: EffectiveBrainstormIdea;
        outlineSettings?: ElectricJsondoc;
        chronicles?: ElectricJsondoc;
        brainstormInput?: ElectricJsondoc;
    };

    // Workflow context
    workflowContext: {
        hasActiveTransforms: boolean;
        workflowNodes: WorkflowNode[];
    };

    // Additional context if needed
    metadata?: Record<string, any>;
}

// Lineage-based action context
export interface LineageBasedActionContext {
    // Resolved jsondocs from lineage traversal
    effectiveBrainstormIdeas: EffectiveBrainstormIdea[];
    chosenBrainstormIdea: EffectiveBrainstormIdea | null;
    latestOutlineSettings: ElectricJsondoc | null;
    latestChronicles: ElectricJsondoc | null;
    brainstormInput: ElectricJsondoc | null;

    // Workflow state without stage
    workflowNodes: WorkflowNode[];

    // Transform state
    hasActiveTransforms: boolean;
    activeTransforms: ElectricTransform[];

    // Lineage metadata
    lineageGraph: LineageGraph;
    rootNodes: string[];
    leafNodes: string[];
}

// Result of action computation
export interface ComputedActions {
    actionContext: LineageBasedActionContext;
    actions: ActionItem[];
}

/**
 * Main function to compute available actions from lineage graph
 */
export function computeActionsFromLineage(
    lineageGraph: LineageGraph,
    jsondocs: ElectricJsondoc[],
    transforms: ElectricTransform[],
    humanTransforms: ElectricHumanTransform[],
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[]
): ComputedActions {


    // 1. Build workflow context from lineage traversal
    const actionContext = buildActionContextFromLineage(
        lineageGraph,
        jsondocs,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    // 2. Generate actions based on context
    const actions = generateActionsFromContext(actionContext);

    return {
        actionContext: actionContext,
        actions,
    };
}

/**
 * Build action context from lineage graph traversal
 */
function buildActionContextFromLineage(
    lineageGraph: LineageGraph,
    jsondocs: ElectricJsondoc[],
    transforms: ElectricTransform[],
    humanTransforms: ElectricHumanTransform[],
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[]
): Omit<LineageBasedActionContext, 'currentStage'> {
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
 * Generate actions for a specific workflow stage
 */
function generateActionsFromContext(context: LineageBasedActionContext): ActionItem[] {
    if (context.hasActiveTransforms) {
        return [];
    }

    const actions: ActionItem[] = [];

    // Add brainstorm creation actions only if no input and no existing ideas
    if (!context.brainstormInput && context.effectiveBrainstormIdeas.length === 0) {
        actions.push({
            id: 'brainstorm_creation',
            type: 'button',
            title: '创建头脑风暴',
            description: '使用AI辅助生成创意想法',
            component: BrainstormCreationActions,
            props: {
                jsondocs: {
                    brainstormIdeas: context.effectiveBrainstormIdeas,
                    chosenIdea: context.chosenBrainstormIdea,
                    outlineSettings: context.latestOutlineSettings,
                    chronicles: context.latestChronicles,
                    brainstormInput: context.brainstormInput
                },
                workflowContext: {
                    hasActiveTransforms: context.hasActiveTransforms,
                    workflowNodes: context.workflowNodes
                }
            },
            enabled: true,
            priority: 1
        });
    }

    // Add brainstorm idea selection if we have multiple ideas but no chosen one
    if (context.effectiveBrainstormIdeas.length > 1 && !context.chosenBrainstormIdea) {
        actions.push({
            id: 'brainstorm_idea_selection',
            type: 'selection',
            title: '选择创意',
            description: '从生成的创意中选择一个继续开发',
            component: BrainstormIdeaSelection,
            props: {
                jsondocs: {
                    brainstormIdeas: context.effectiveBrainstormIdeas,
                    chosenIdea: context.chosenBrainstormIdea,
                    outlineSettings: context.latestOutlineSettings,
                    chronicles: context.latestChronicles,
                    brainstormInput: context.brainstormInput
                },
                workflowContext: {
                    hasActiveTransforms: context.hasActiveTransforms,
                    workflowNodes: context.workflowNodes
                }
            },
            enabled: true,
            priority: 1
        });
    }

    // Add outline generation if we have a chosen idea but no outline
    if (context.chosenBrainstormIdea && !context.latestOutlineSettings) {
        actions.push({
            id: 'outline_generation',
            type: 'form',
            title: '生成大纲',
            description: '基于选中的创意生成详细大纲',
            component: OutlineGenerationForm,
            props: {
                jsondocs: {
                    brainstormIdeas: context.effectiveBrainstormIdeas,
                    chosenIdea: context.chosenBrainstormIdea,
                    outlineSettings: context.latestOutlineSettings,
                    chronicles: context.latestChronicles,
                    brainstormInput: context.brainstormInput
                },
                workflowContext: {
                    hasActiveTransforms: context.hasActiveTransforms,
                    workflowNodes: context.workflowNodes
                }
            },
            enabled: true,
            priority: 1
        });
    }

    // Add chronicles generation if we have outline but no chronicles
    if (context.latestOutlineSettings && !context.latestChronicles) {
        actions.push({
            id: 'chronicles_generation',
            type: 'button',
            title: '生成分集概要',
            description: '基于大纲生成分集概要',
            component: ChroniclesGenerationAction,
            props: {
                jsondocs: {
                    brainstormIdeas: context.effectiveBrainstormIdeas,
                    chosenIdea: context.chosenBrainstormIdea,
                    outlineSettings: context.latestOutlineSettings,
                    chronicles: context.latestChronicles,
                    brainstormInput: context.brainstormInput
                },
                workflowContext: {
                    hasActiveTransforms: context.hasActiveTransforms,
                    workflowNodes: context.workflowNodes
                }
            },
            enabled: true,
            priority: 1
        });
    }

    // If chronicles but no episode, add EpisodeGenerationAction
    const shouldShowEpisodeGeneration = context.latestChronicles && !context.latestChronicles.schema_type.includes('episode_synopsis');
    if (shouldShowEpisodeGeneration) {
        actions.push({
            id: 'episode_synopsis_generation',
            type: 'button',
            title: '生成剧本',
            description: '基于分集概要生成具体剧本',
            component: EpisodeGenerationAction,
            props: {
                jsondocs: {
                    brainstormIdeas: context.effectiveBrainstormIdeas,
                    chosenIdea: context.chosenBrainstormIdea,
                    outlineSettings: context.latestOutlineSettings,
                    chronicles: context.latestChronicles,
                    brainstormInput: context.brainstormInput
                },
                workflowContext: {
                    hasActiveTransforms: context.hasActiveTransforms,
                    workflowNodes: context.workflowNodes
                }
            },
            enabled: true,
            priority: 1
        });
    }

    return actions;
}

// ============================================================================
// Utility Functions
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