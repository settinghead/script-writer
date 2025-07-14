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

// Workflow stages
export type WorkflowStage =
    | 'initial'
    | 'brainstorm_input'
    | 'brainstorm_selection'
    | 'idea_editing'
    | 'outline_generation'
    | 'chronicles_generation'
    | 'episode_synopsis_generation';

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
        currentStage: WorkflowStage;
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

    // Workflow state
    currentStage: WorkflowStage;
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
    stageDescription: string;
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

    // 2. Determine current stage from workflow nodes
    let currentStage = detectStageFromWorkflowNodes(actionContext.workflowNodes);

    // 3. Override stage detection if we have a chosen idea or leaf brainstorm ideas
    if (currentStage === 'brainstorm_selection') {
        // First check: if we have a chosen idea, move to idea_editing stage
        if (actionContext.chosenBrainstormIdea) {
            console.log('[computeActionsFromLineage] Found chosen idea, overriding stage to idea_editing:', actionContext.chosenBrainstormIdea.jsondocId);
            currentStage = 'idea_editing';
        } else {
            // Second check: if we have leaf brainstorm ideas that indicate the user has moved to idea_editing stage
            const leafBrainstormIdeas = actionContext.leafNodes.filter(nodeId => {
                const node = lineageGraph.nodes.get(nodeId);
                if (node?.type !== 'jsondoc') return false;

                const jsondoc = jsondocs.find(a => a.id === nodeId);
                return jsondoc && (
                    jsondoc.schema_type === 'brainstorm_idea'
                );
            });

            if (leafBrainstormIdeas.length > 0) {

                // User has created/edited brainstorm ideas, move to idea_editing stage
                currentStage = 'idea_editing';
            }
        }
    }

    // 4. Fallback logic: if no workflow nodes but we have brainstorm input jsondoc, set to brainstorm_input stage
    if (currentStage === 'initial' && actionContext.brainstormInput) {
        currentStage = 'brainstorm_input';
    }

    // 4. Complete the action context with current stage
    const completeActionContext: LineageBasedActionContext = {
        ...actionContext,
        currentStage
    };

    // 5. Generate actions based on lineage state
    const actions = generateActionsForStage(currentStage, completeActionContext);

    // 6. Get stage description
    const stageDescription = getStageDescription(currentStage);

    return {
        actionContext: completeActionContext,
        actions,
        stageDescription
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

    const workflowNodes = findMainWorkflowPath(jsondocs, lineageGraph);

    // Find chosen idea (leaf brainstorm idea that's ready for next stage)
    let chosenBrainstormIdea = findChosenIdeaFromLineage(effectiveBrainstormIdeas, lineageGraph);

    // For single ideas in idea_editing stage, automatically treat the single idea as chosen
    if (!chosenBrainstormIdea && effectiveBrainstormIdeas.length === 1) {
        chosenBrainstormIdea = effectiveBrainstormIdeas[0];
    }



    // Find latest jsondocs using lineage resolution
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
        workflowNodes,
        hasActiveTransforms: transforms.some(t => t.status === 'running' || t.status === 'pending'),
        activeTransforms: transforms.filter(t => t.status === 'running' || t.status === 'pending'),
        lineageGraph,
        rootNodes: Array.from(lineageGraph.rootNodes),
        leafNodes: findAllLeafNodes(lineageGraph)
    };
}

/**
 * Detect current workflow stage from workflow nodes
 */
export function detectStageFromWorkflowNodes(workflowNodes: WorkflowNode[]): WorkflowStage {
    // If no workflow nodes, we're at initial stage
    if (workflowNodes.length === 0) {
        return 'initial';
    }

    // Find the last (most recent) node in the workflow
    const lastNode = workflowNodes[workflowNodes.length - 1];

    // Map workflow node types to action stages
    // For brainstorm_collection, we should be in brainstorm_selection stage
    if (lastNode.schemaType === 'brainstorm_collection') {
        // When we have a brainstorm collection, the user needs to select one idea
        return 'brainstorm_selection';
    }

    const stageMap: Record<string, WorkflowStage> = {
        'brainstorm_input_params': 'brainstorm_input',
        'brainstorm_idea': 'idea_editing',
        'outline_settings': 'outline_generation',
        'chronicles': 'chronicles_generation',
        'episode_synopsis': 'episode_synopsis_generation'
    };

    const detectedStage = stageMap[lastNode.schemaType] || 'initial';

    return detectedStage;
}

/**
 * Generate actions for a specific workflow stage
 */
function generateActionsForStage(
    stage: WorkflowStage,
    context: LineageBasedActionContext
): ActionItem[] {
    // If there are active transforms, return empty actions
    if (context.hasActiveTransforms) {
        return [];
    }

    const actions: ActionItem[] = [];

    // Build common jsondocs and context for ActionComponentProps
    const commonJsondocs = {
        brainstormIdeas: context.effectiveBrainstormIdeas,
        chosenIdea: context.chosenBrainstormIdea,
        outlineSettings: context.latestOutlineSettings,
        chronicles: context.latestChronicles,
        brainstormInput: context.brainstormInput
    };

    const commonWorkflowContext = {
        currentStage: context.currentStage,
        hasActiveTransforms: context.hasActiveTransforms,
        workflowNodes: context.workflowNodes
    };

    switch (stage) {
        case 'initial':
            actions.push({
                id: 'brainstorm_creation',
                type: 'button',
                title: '创建头脑风暴',
                description: '使用AI辅助生成创意想法',
                component: BrainstormCreationActions,
                props: {
                    jsondocs: commonJsondocs,
                    workflowContext: commonWorkflowContext
                },
                enabled: true,
                priority: 1
            });
            break;

        case 'brainstorm_input':
            if (context.brainstormInput) {
                actions.push({
                    id: 'brainstorm_start_button',
                    type: 'button',
                    title: '开始头脑风暴',
                    description: '基于上方填写的参数开始生成创意',
                    component: BrainstormInputForm,
                    props: {
                        brainstormJsondoc: context.brainstormInput, // For backward compatibility
                        jsondocs: commonJsondocs,
                        workflowContext: commonWorkflowContext
                    },
                    enabled: true,
                    priority: 1
                });
            }
            break;

        case 'brainstorm_selection':
            actions.push({
                id: 'brainstorm_idea_selection',
                type: 'selection',
                title: '选择创意',
                description: '从生成的创意中选择一个继续开发',
                component: BrainstormIdeaSelection,
                props: {
                    jsondocs: commonJsondocs,
                    workflowContext: commonWorkflowContext
                },
                enabled: true,
                priority: 1
            });
            break;

        case 'idea_editing':
            actions.push({
                id: 'outline_generation',
                type: 'form',
                title: '生成大纲',
                description: '基于选中的创意生成详细大纲',
                component: OutlineGenerationForm,
                props: {
                    jsondocs: commonJsondocs,
                    workflowContext: commonWorkflowContext
                },
                enabled: true,
                priority: 1
            });
            break;

        case 'outline_generation':
            actions.push({
                id: 'chronicles_generation',
                type: 'button',
                title: '生成分集概要',
                description: '基于大纲生成分集概要',
                component: ChroniclesGenerationAction,
                props: {
                    jsondocs: commonJsondocs,
                    workflowContext: commonWorkflowContext
                },
                enabled: true,
                priority: 1
            });
            break;

        case 'chronicles_generation':
            actions.push({
                id: 'episode_synopsis_generation',
                type: 'button',
                title: '生成剧本',
                description: '基于分集概要生成具体剧本',
                component: EpisodeGenerationAction,
                props: {
                    jsondocs: commonJsondocs,
                    workflowContext: commonWorkflowContext
                },
                enabled: true,
                priority: 1
            });
            break;

        case 'episode_synopsis_generation':
            // No more actions at this stage
            break;
    }

    return actions;
}

/**
 * Get human-readable description for a workflow stage
 */
function getStageDescription(stage: WorkflowStage): string {
    const descriptions: Record<WorkflowStage, string> = {
        'initial': '开始创建项目',
        'brainstorm_input': '填写参数并开始头脑风暴',
        'brainstorm_selection': '选择一个创意继续开发',
        'idea_editing': '编辑创意并生成大纲',
        'outline_generation': '生成时间顺序大纲',
        'chronicles_generation': '生成分集概要',
        'episode_synopsis_generation': '生成剧本内容'
    };

    return descriptions[stage] || '未知阶段';
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
 * Find chosen brainstorm idea from lineage (leaf node that's ready for next stage)
 */
function findChosenIdeaFromLineage(
    effectiveBrainstormIdeas: EffectiveBrainstormIdea[],
    lineageGraph: LineageGraph
): EffectiveBrainstormIdea | null {
    // Find the idea that's a leaf node (ready for next stage)
    for (const idea of effectiveBrainstormIdeas) {
        const node = lineageGraph.nodes.get(idea.jsondocId);
        if (node && node.isLeaf) {
            // CRITICAL FIX: Only consider standalone ideas as "chosen"
            // Ideas from collections (jsondocPath !== '$') should not be auto-chosen
            // even if the collection is a leaf node - user needs to explicitly select one
            if (idea.jsondocPath === '$') {
                // This is a standalone brainstorm idea jsondoc, can be chosen
                return idea;
            }
            // Ideas from collections (jsondocPath like '$.ideas[0]') are not auto-chosen
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