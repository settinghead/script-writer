import React from 'react';
import {
    LineageGraph,
    extractEffectiveBrainstormIdeas,
    findMainWorkflowPath,
    type EffectiveBrainstormIdea,
    type WorkflowNode
} from '../../common/transform-artifact-framework/lineageResolution';
import type {
    ElectricArtifact,
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

    // Resolved artifacts (no more parsing needed)
    artifacts: {
        brainstormIdeas?: EffectiveBrainstormIdea[];
        chosenIdea?: EffectiveBrainstormIdea;
        outlineSettings?: ElectricArtifact;
        chronicles?: ElectricArtifact;
        brainstormInput?: ElectricArtifact;
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
    // Resolved artifacts from lineage traversal
    effectiveBrainstormIdeas: EffectiveBrainstormIdea[];
    chosenBrainstormIdea: EffectiveBrainstormIdea | null;
    latestOutlineSettings: ElectricArtifact | null;
    latestChronicles: ElectricArtifact | null;
    brainstormInput: ElectricArtifact | null;

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
    artifacts: ElectricArtifact[],
    transforms: ElectricTransform[],
    humanTransforms: ElectricHumanTransform[],
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[]
): ComputedActions {
    console.log('[computeActionsFromLineage] Starting with:', {
        lineageGraphType: typeof lineageGraph,
        lineageGraphKeys: typeof lineageGraph === 'object' ? Object.keys(lineageGraph) : 'N/A',
        artifactsCount: artifacts.length,
        transformsCount: transforms.length
    });

    // 1. Build workflow context from lineage traversal
    const actionContext = buildActionContextFromLineage(
        lineageGraph,
        artifacts,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    // 2. Determine current stage from workflow nodes
    const currentStage = detectStageFromWorkflowNodes(actionContext.workflowNodes);
    console.log('[computeActionsFromLineage] Detected stage:', currentStage);

    // 3. Complete the action context with current stage
    const completeActionContext: LineageBasedActionContext = {
        ...actionContext,
        currentStage
    };

    // 4. Generate actions based on lineage state
    const actions = generateActionsForStage(currentStage, completeActionContext);
    console.log('[computeActionsFromLineage] Generated actions:', actions.length);

    // 4. Get stage description
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
    artifacts: ElectricArtifact[],
    transforms: ElectricTransform[],
    humanTransforms: ElectricHumanTransform[],
    transformInputs: ElectricTransformInput[],
    transformOutputs: ElectricTransformOutput[]
): Omit<LineageBasedActionContext, 'currentStage'> {
    // Use existing functions from lineageResolution.ts
    const effectiveBrainstormIdeas = extractEffectiveBrainstormIdeas(
        artifacts,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    const workflowNodes = findMainWorkflowPath(artifacts, lineageGraph);
    console.log('[buildActionContextFromLineage] Found workflow nodes:', {
        count: workflowNodes.length,
        nodes: workflowNodes.map(n => ({ type: n.type, artifactId: n.artifactId }))
    });

    // Find chosen idea (leaf brainstorm idea that's ready for next stage)
    let chosenBrainstormIdea = findChosenIdeaFromLineage(effectiveBrainstormIdeas, lineageGraph);

    // For single ideas in idea_editing stage, automatically treat the single idea as chosen
    if (!chosenBrainstormIdea && effectiveBrainstormIdeas.length === 1) {
        chosenBrainstormIdea = effectiveBrainstormIdeas[0];
    }

    console.log('[buildActionContextFromLineage] Chosen brainstorm idea:', {
        hasChosenIdea: !!chosenBrainstormIdea,
        chosenIdeaId: chosenBrainstormIdea?.artifactId?.substring(0, 8),
        effectiveIdeasCount: effectiveBrainstormIdeas.length
    });

    // Find latest artifacts using lineage resolution
    const latestOutlineSettings = findLatestArtifactByType(
        lineageGraph,
        artifacts,
        'outline_settings_schema'
    );

    const latestChronicles = findLatestArtifactByType(
        lineageGraph,
        artifacts,
        'chronicles_schema'
    );

    // Find brainstorm input artifact
    const brainstormInput = findLatestArtifactByType(
        lineageGraph,
        artifacts,
        'brainstorm_tool_input_schema'
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
function detectStageFromWorkflowNodes(workflowNodes: WorkflowNode[]): WorkflowStage {
    console.log('[detectStageFromWorkflowNodes] Input:', {
        workflowNodesCount: workflowNodes.length,
        workflowNodes: workflowNodes.map(n => ({ type: n.type, artifactId: n.artifactId }))
    });

    // If no workflow nodes, we're at initial stage
    if (workflowNodes.length === 0) {
        console.log('[detectStageFromWorkflowNodes] No workflow nodes, returning initial');
        return 'initial';
    }

    // Find the last (most recent) node in the workflow
    const lastNode = workflowNodes[workflowNodes.length - 1];
    console.log('[detectStageFromWorkflowNodes] Last node:', { type: lastNode.type, artifactId: lastNode.artifactId });

    // Map workflow node types to action stages
    const stageMap: Record<string, WorkflowStage> = {
        'brainstorm_input': 'brainstorm_input',
        'brainstorm_collection': 'brainstorm_selection',
        'brainstorm_idea': 'idea_editing',
        'outline': 'outline_generation',
        'chronicles': 'chronicles_generation',
        'episode_synopsis': 'episode_synopsis_generation'
    };

    const detectedStage = stageMap[lastNode.type] || 'initial';
    console.log('[detectStageFromWorkflowNodes] Detected stage:', detectedStage);

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

    // Build common artifacts and context for ActionComponentProps
    const commonArtifacts = {
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
                    artifacts: commonArtifacts,
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
                        brainstormArtifact: context.brainstormInput, // For backward compatibility
                        artifacts: commonArtifacts,
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
                    artifacts: commonArtifacts,
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
                    artifacts: commonArtifacts,
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
                    artifacts: commonArtifacts,
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
                    artifacts: commonArtifacts,
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
 * Find the latest artifact of a specific type using lineage depth
 */
function findLatestArtifactByType(
    lineageGraph: LineageGraph,
    artifacts: ElectricArtifact[],
    schemaType: string
): ElectricArtifact | null {
    // Find all artifacts of this type
    const candidateArtifacts = artifacts.filter(a =>
        a.schema_type === schemaType || a.type === schemaType
    );

    if (candidateArtifacts.length === 0) return null;

    // Find the deepest (most recent) one using lineage
    let latestArtifact = candidateArtifacts[0];
    let maxDepth = 0;

    for (const artifact of candidateArtifacts) {
        const node = lineageGraph.nodes.get(artifact.id);
        if (node && node.depth > maxDepth) {
            maxDepth = node.depth;
            latestArtifact = artifact;
        }
    }

    return latestArtifact;
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
        const node = lineageGraph.nodes.get(idea.artifactId);
        if (node && node.isLeaf) {
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

    for (const [artifactId, node] of lineageGraph.nodes) {
        if (node.isLeaf) {
            leafNodes.push(artifactId);
        }
    }

    return leafNodes;
} 