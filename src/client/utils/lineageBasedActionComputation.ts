import React from 'react';
import {
    LineageGraph,
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
import {
    CanonicalJsondocContext,
    computeCanonicalJsondocsFromLineage
} from '../../common/canonicalJsondocLogic';

// Import action components
import BrainstormCreationActions from '../components/actions/BrainstormCreationActions';
import BrainstormInputForm from '../components/actions/BrainstormInputForm';
import BrainstormIdeaSelection from '../components/actions/BrainstormIdeaSelection';
import OutlineGenerationForm from '../components/actions/OutlineGenerationForm';
import ChroniclesGenerationAction from '../components/actions/ChroniclesGenerationAction';
import EpisodePlanningAction from '../components/actions/EpisodePlanningAction';
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

// Lineage-based action context (extends the shared canonical context)
export interface LineageBasedActionContext extends CanonicalJsondocContext {
    // Additional frontend-specific context can be added here if needed
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
    // 1. Use shared canonical jsondoc logic
    const canonicalContext = computeCanonicalJsondocsFromLineage(
        lineageGraph,
        jsondocs,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    // 2. Extend with frontend-specific context if needed
    const actionContext: LineageBasedActionContext = {
        ...canonicalContext
        // Add frontend-specific extensions here if needed
    };

    // 3. Generate actions based on context
    const actions = generateActionsFromContext(actionContext);

    return {
        actionContext,
        actions,
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

    // Add episode planning generation if we have chronicles but no episode planning
    if (context.latestChronicles && !context.latestEpisodePlanning) {
        actions.push({
            id: 'episode_planning_generation',
            type: 'form',
            title: '生成分集规划',
            description: '基于时间顺序大纲生成分集规划',
            component: EpisodePlanningAction,
            props: {
                jsondocs: {
                    brainstormIdeas: context.effectiveBrainstormIdeas,
                    chosenIdea: context.chosenBrainstormIdea,
                    outlineSettings: context.latestOutlineSettings,
                    chronicles: context.latestChronicles,
                    episodePlanning: context.latestEpisodePlanning,
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

    // If episode planning but no episode synopsis, add EpisodeGenerationAction
    const shouldShowEpisodeGeneration = context.latestEpisodePlanning && !context.latestChronicles?.schema_type.includes('episode_synopsis');
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
                    episodePlanning: context.latestEpisodePlanning,
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