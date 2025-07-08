import React from 'react';
import { ProjectDataContextType } from '../../common/types';
import { SelectedBrainstormIdea } from '../stores/actionItemsStore';
import {
    computeActionsFromLineage,
    type ComputedActions as LineageComputedActions,
    type ActionItem,
    type WorkflowStage
} from './lineageBasedActionComputation';
import {
    UnifiedWorkflowState,
    WorkflowStep,
    DisplayComponent,
    ComponentId,
    ComponentMode,
    WorkflowParameters,
    WORKFLOW_STEPS
} from './workflowTypes';
import { getComponentById } from './componentRegistry';

// Import action components
import BrainstormCreationActions from '../components/actions/BrainstormCreationActions';
import BrainstormInputForm from '../components/actions/BrainstormInputForm';
import BrainstormIdeaSelection from '../components/actions/BrainstormIdeaSelection';
import OutlineGenerationForm from '../components/actions/OutlineGenerationForm';
import ChroniclesGenerationAction from '../components/actions/ChroniclesGenerationAction';
import EpisodeGenerationAction from '../components/actions/EpisodeGenerationAction';

// Re-export types from lineageBasedActionComputation for backward compatibility
export type { WorkflowStage, ActionItem } from './lineageBasedActionComputation';

// Result of action computation
export interface ComputedActions {
    actions: ActionItem[];
    currentStage: WorkflowStage;
    hasActiveTransforms: boolean;
    stageDescription: string;
}

// Legacy helper functions - kept for backward compatibility with other parts of the app
// TODO: Eventually migrate all usage to lineage-based functions

// Helper function to check if an artifact is a leaf node (no descendants)
export const isLeafNode = (artifactId: string, transformInputs: any[]): boolean => {
    if (!Array.isArray(transformInputs)) return true;
    return !transformInputs.some(input => input.artifact_id === artifactId);
};

// Helper function to check if an artifact can become editable
export const canBecomeEditable = (artifact: any, transformInputs: any[]): boolean => {
    return isLeafNode(artifact.id, transformInputs) && artifact.origin_type === 'ai_generated';
};

/**
 * Lineage-based action computation (main method)
 * Uses lineage graph traversal for robust state detection
 */
export const computeParamsAndActionsFromLineage = (
    projectData: ProjectDataContextType
): ComputedActions => {

    // Check if any data is still loading
    if (projectData.artifacts === "pending" ||
        projectData.transforms === "pending" ||
        projectData.humanTransforms === "pending" ||
        projectData.transformInputs === "pending" ||
        projectData.transformOutputs === "pending") {
        return {
            actions: [],
            currentStage: 'initial',
            hasActiveTransforms: false,
            stageDescription: '加载中...'
        };
    }

    // If lineage graph is pending but artifacts are loaded, use simple fallback
    if (projectData.lineageGraph === "pending") {
        // Simple fallback: check if we have any artifacts
        if (projectData.artifacts === "error" || !Array.isArray(projectData.artifacts) || projectData.artifacts.length === 0) {
            return {
                actions: [],
                currentStage: 'initial',
                hasActiveTransforms: false,
                stageDescription: '准备开始...'
            };
        }

        // Basic stage detection without lineage
        const brainstormIdeas = projectData.artifacts.filter(a =>
            a.schema_type === 'brainstorm_item_schema' || a.type === 'brainstorm_item_schema'
        );

        if (brainstormIdeas.length > 0) {
            return {
                actions: [],
                currentStage: 'idea_editing',
                hasActiveTransforms: false,
                stageDescription: '编辑创意中...'
            };
        }

        return {
            actions: [],
            currentStage: 'initial',
            hasActiveTransforms: false,
            stageDescription: '准备开始...'
        };
    }

    if (projectData.lineageGraph === "error" ||
        projectData.artifacts === "error" ||
        projectData.transforms === "error" ||
        projectData.humanTransforms === "error" ||
        projectData.transformInputs === "error" ||
        projectData.transformOutputs === "error") {
        return {
            actions: [],
            currentStage: 'initial',
            hasActiveTransforms: false,
            stageDescription: '加载失败'
        };
    }

    // Use the lineage-based computation
    const lineageResult = computeActionsFromLineage(
        projectData.lineageGraph,
        projectData.artifacts,
        projectData.transforms,
        projectData.humanTransforms,
        projectData.transformInputs,
        projectData.transformOutputs
    );

    // Convert to the expected format
    return {
        actions: lineageResult.actions,
        currentStage: lineageResult.actionContext.currentStage,
        hasActiveTransforms: lineageResult.actionContext.hasActiveTransforms,
        stageDescription: lineageResult.stageDescription
    };
};



// ==============================================================================
// NEW UNIFIED COMPUTATION SYSTEM
// ==============================================================================

/**
 * Compute workflow steps based on current state
 */
export const computeWorkflowSteps = (
    currentStage: WorkflowStage,
    hasActiveTransforms: boolean,
    projectData: ProjectDataContextType
): WorkflowStep[] => {


    // Return empty array if currentStage is initial - no workflow steps to show
    if (currentStage === 'initial') {
        return [];
    }

    // Detect workflow path based on project data
    const isManualPath = detectIsManualPath(projectData);

    // Define steps for each path
    const manualPathSteps: WorkflowStep[] = [
        {
            id: WORKFLOW_STEPS.IDEA_EDITING,
            title: '创意编辑',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.OUTLINE_GENERATION,
            title: '剧本框架',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.CHRONICLES_GENERATION,
            title: '时间顺序大纲',
            status: 'wait'
        },
        {
            id: 'episode_outline',
            title: '每集大纲',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.EPISODE_GENERATION,
            title: '分集剧本',
            status: 'wait'
        }
    ];

    const aiPathSteps: WorkflowStep[] = [
        {
            id: WORKFLOW_STEPS.BRAINSTORM_INPUT,
            title: '创意输入',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.BRAINSTORM_GENERATION,
            title: '头脑风暴',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.IDEA_EDITING,
            title: '创意编辑',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.OUTLINE_GENERATION,
            title: '剧本框架',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.CHRONICLES_GENERATION,
            title: '时间顺序大纲',
            status: 'wait'
        },
        {
            id: 'episode_outline',
            title: '每集大纲',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.EPISODE_GENERATION,
            title: '分集剧本',
            status: 'wait'
        }
    ];

    // Choose steps based on path
    const steps = isManualPath ? manualPathSteps : aiPathSteps;

    // Map workflow stages to step indices based on path
    const manualStageToStepMap: Record<WorkflowStage, number> = {
        'initial': -1,
        'brainstorm_input': -1, // Not used in manual path
        'brainstorm_selection': -1, // Not used in manual path
        'idea_editing': 0,
        'outline_generation': 1,
        'chronicles_generation': 2,
        'episode_synopsis_generation': 4 // Skip "每集大纲" for now, map to final step
    };

    const aiStageToStepMap: Record<WorkflowStage, number> = {
        'initial': -1,
        'brainstorm_input': 0,
        'brainstorm_selection': 1,
        'idea_editing': 2,
        'outline_generation': 3,
        'chronicles_generation': 4,
        'episode_synopsis_generation': 6 // Skip "每集大纲" for now, map to final step
    };

    const stageToStepMap = isManualPath ? manualStageToStepMap : aiStageToStepMap;
    const currentStepIndex = stageToStepMap[currentStage];

    // Update step statuses
    steps.forEach((step, index) => {
        if (index < currentStepIndex) {
            step.status = 'finish';
        } else if (index === currentStepIndex) {
            if (hasActiveTransforms) {
                step.status = 'process'; // Show loading spinner
            } else {
                step.status = 'finish'; // Current step is completed
            }
        } else {
            step.status = 'wait';
        }
    });



    return steps;
};

/**
 * Detect if this is a manual path (user directly entered an idea) vs AI path (brainstorm generation)
 */
const detectIsManualPath = (projectData: ProjectDataContextType): boolean => {
    if (projectData.artifacts === "pending" || projectData.artifacts === "error") {
        return false;
    }

    // Simple heuristic: if we have brainstorm_tool_input_schema artifacts, it's AI path
    // Otherwise, it's manual path
    const hasBrainstormInput = projectData.artifacts.some(a =>
        a.schema_type === 'brainstorm_tool_input_schema' || a.type === 'brainstorm_tool_input_schema'
    );

    return !hasBrainstormInput;
};

/**
 * Compute display components based on current state
 */
export const computeDisplayComponents = (
    currentStage: WorkflowStage,
    hasActiveTransforms: boolean,
    projectData: ProjectDataContextType
): DisplayComponent[] => {
    const components: DisplayComponent[] = [];

    if (projectData.artifacts === "pending" || projectData.artifacts === "error") {
        return components;
    }

    // Use simple artifact filtering instead of legacy functions
    const brainstormInput = projectData.artifacts.find(a =>
        a.schema_type === 'brainstorm_tool_input_schema' || a.type === 'brainstorm_tool_input_schema'
    );

    const brainstormIdeas = projectData.artifacts.filter(a =>
        a.schema_type === 'brainstorm_item_schema' || a.type === 'brainstorm_item_schema' ||
        a.schema_type === 'brainstorm_idea' || a.type === 'brainstorm_idea' ||
        a.schema_type === 'brainstorm_collection_schema' || a.type === 'brainstorm_collection_schema'
    );

    // Find chosen idea (leaf node without descendants)
    const transformInputs = projectData.transformInputs === "pending" || projectData.transformInputs === "error"
        ? [] : projectData.transformInputs;
    const chosenIdea = brainstormIdeas.find(idea => {
        const hasDescendants = transformInputs.some(input => input.artifact_id === idea.id);
        return !hasDescendants;
    });

    const outlineSettings = projectData.artifacts.find(a =>
        a.schema_type === 'outline_settings_schema' || a.type === 'outline_settings'
    );

    const chronicles = projectData.artifacts.find(a =>
        a.schema_type === 'chronicles_schema'
    );



    switch (currentStage) {
        case 'initial':
            // Show project creation form
            components.push({
                id: 'project-creation-form',
                component: getComponentById('project-creation-form'),
                mode: 'editable',
                props: {},
                priority: 1
            });
            break;

        case 'brainstorm_input':
            // Show brainstorm input editor
            if (brainstormInput) {
                components.push({
                    id: 'brainstorm-input-editor',
                    component: getComponentById('brainstorm-input-editor'),
                    mode: hasActiveTransforms ? 'readonly' : 'editable',
                    props: {
                        artifact: brainstormInput,
                        isEditable: !hasActiveTransforms
                    },
                    priority: 1
                });
            }
            break;

        case 'brainstorm_selection':
            // Show brainstorm input in readonly mode
            if (brainstormInput) {
                components.push({
                    id: 'brainstorm-input-editor',
                    component: getComponentById('brainstorm-input-editor'),
                    mode: 'readonly',
                    props: {
                        artifact: brainstormInput,
                        isEditable: false
                    },
                    priority: 1
                });
            }

            // Show brainstorm ideas for selection
            if (brainstormIdeas.length > 0) {
                components.push({
                    id: 'project-brainstorm-page',
                    component: getComponentById('project-brainstorm-page'),
                    mode: hasActiveTransforms ? 'readonly' : 'editable',
                    props: {
                        ideas: brainstormIdeas,
                        selectionMode: true,
                        isLoading: hasActiveTransforms
                    },
                    priority: 2
                });
            }
            break;

        case 'idea_editing':
            // Show brainstorm input in readonly mode
            if (brainstormInput) {
                components.push({
                    id: 'brainstorm-input-editor',
                    component: getComponentById('brainstorm-input-editor'),
                    mode: 'readonly',
                    props: {
                        artifact: brainstormInput,
                        isEditable: false
                    },
                    priority: 1
                });
            }

            // Show chosen idea editor (if we have one)
            if (chosenIdea) {
                components.push({
                    id: 'single-brainstorm-idea-editor',
                    component: getComponentById('single-brainstorm-idea-editor'),
                    mode: hasActiveTransforms ? 'readonly' : 'editable',
                    props: {
                        idea: chosenIdea,
                        isEditable: !hasActiveTransforms,
                        currentStage: currentStage
                    },
                    priority: 2
                });
            } else {
                // No chosen idea yet - show brainstorm collection for selection
                // This should only happen if detectCurrentStage logic is incorrect
                console.warn('[computeDisplayComponents] idea_editing stage but no chosenIdea found - adding project-brainstorm-page');
                if (brainstormIdeas.length > 0) {
                    components.push({
                        id: 'project-brainstorm-page',
                        component: getComponentById('project-brainstorm-page'),
                        mode: hasActiveTransforms ? 'readonly' : 'editable',
                        props: {
                            ideas: brainstormIdeas,
                            selectionMode: true,
                            isLoading: hasActiveTransforms
                        },
                        priority: 2
                    });
                }
            }
            break;

        case 'outline_generation':
            // Show previous components in readonly/collapsed mode
            if (brainstormInput) {
                components.push({
                    id: 'brainstorm-input-editor',
                    component: getComponentById('brainstorm-input-editor'),
                    mode: 'readonly',
                    props: {
                        artifact: brainstormInput,
                        isEditable: false
                    },
                    priority: 1
                });
            }

            // Only show chosen idea editor (not the collection)
            if (chosenIdea) {
                components.push({
                    id: 'single-brainstorm-idea-editor',
                    component: getComponentById('single-brainstorm-idea-editor'),
                    mode: 'readonly',
                    props: {
                        idea: chosenIdea,
                        isEditable: false,
                        currentStage: currentStage
                    },
                    priority: 2
                });
            }

            // Show outline settings
            if (outlineSettings) {
                components.push({
                    id: 'outline-settings-display',
                    component: getComponentById('outline-settings-display'),
                    mode: hasActiveTransforms ? 'readonly' : 'editable',
                    props: {
                        outlineSettings,
                        isEditable: !hasActiveTransforms
                    },
                    priority: 4
                });
            }
            break;

        case 'chronicles_generation':
            // Show previous components in readonly/collapsed mode
            if (brainstormInput) {
                components.push({
                    id: 'brainstorm-input-editor',
                    component: getComponentById('brainstorm-input-editor'),
                    mode: 'readonly',
                    props: {
                        artifact: brainstormInput,
                        isEditable: false
                    },
                    priority: 1
                });
            }

            // Only show chosen idea editor (not the collection)
            if (chosenIdea) {
                components.push({
                    id: 'single-brainstorm-idea-editor',
                    component: getComponentById('single-brainstorm-idea-editor'),
                    mode: 'readonly',
                    props: {
                        idea: chosenIdea,
                        isEditable: false,
                        currentStage: currentStage
                    },
                    priority: 2
                });
            }

            if (outlineSettings) {
                components.push({
                    id: 'outline-settings-display',
                    component: getComponentById('outline-settings-display'),
                    mode: 'readonly',
                    props: {
                        outlineSettings,
                        isEditable: false
                    },
                    priority: 4
                });
            }

            // Show chronicles
            if (chronicles) {
                components.push({
                    id: 'chronicles-display',
                    component: getComponentById('chronicles-display'),
                    mode: hasActiveTransforms ? 'readonly' : 'editable',
                    props: {
                        chronicles,
                        isEditable: !hasActiveTransforms
                    },
                    priority: 5
                });
            }
            break;

        case 'episode_synopsis_generation':
            // Show all previous components in readonly/collapsed mode
            if (brainstormInput) {
                components.push({
                    id: 'brainstorm-input-editor',
                    component: getComponentById('brainstorm-input-editor'),
                    mode: 'readonly',
                    props: {
                        artifact: brainstormInput,
                        isEditable: false
                    },
                    priority: 1
                });
            }

            // Only show chosen idea editor (not the collection)
            if (chosenIdea) {
                components.push({
                    id: 'single-brainstorm-idea-editor',
                    component: getComponentById('single-brainstorm-idea-editor'),
                    mode: 'readonly',
                    props: {
                        idea: chosenIdea,
                        isEditable: false
                    },
                    priority: 2
                });
            }

            if (outlineSettings) {
                components.push({
                    id: 'outline-settings-display',
                    component: getComponentById('outline-settings-display'),
                    mode: 'readonly',
                    props: {
                        outlineSettings,
                        isEditable: false
                    },
                    priority: 4
                });
            }

            if (chronicles) {
                components.push({
                    id: 'chronicles-display',
                    component: getComponentById('chronicles-display'),
                    mode: 'readonly',
                    props: {
                        chronicles,
                        isEditable: false
                    },
                    priority: 5
                });
            }
            break;
    }

    // Sort by priority
    const sortedComponents = components.sort((a, b) => a.priority - b.priority);



    return sortedComponents;
};

/**
 * Compute workflow parameters for components and actions
 */
export const computeWorkflowParameters = (
    projectData: ProjectDataContextType,
    projectId: string
): WorkflowParameters => {
    if (projectData.artifacts === "pending" || projectData.artifacts === "error") {
        return {
            projectId,
            currentStage: 'initial',
            hasActiveTransforms: false,
            effectiveBrainstormIdeas: [],
            chosenBrainstormIdea: null,
            latestOutlineSettings: null,
            latestChronicles: null,
            brainstormInput: null
        };
    }

    // Use the lineage-based computation for current stage and active transforms
    const actionResult = computeParamsAndActionsFromLineage(projectData);

    // Simple artifact filtering
    const brainstormIdeas = projectData.artifacts.filter(a =>
        a.schema_type === 'brainstorm_item_schema' || a.type === 'brainstorm_item_schema' ||
        a.schema_type === 'brainstorm_idea' || a.type === 'brainstorm_idea' ||
        a.schema_type === 'brainstorm_collection_schema' || a.type === 'brainstorm_collection_schema'
    );

    const transformInputs = projectData.transformInputs === "pending" || projectData.transformInputs === "error"
        ? [] : projectData.transformInputs;
    const chosenIdea = brainstormIdeas.find(idea => {
        const hasDescendants = transformInputs.some(input => input.artifact_id === idea.id);
        return !hasDescendants;
    });

    return {
        projectId,
        currentStage: actionResult.currentStage,
        hasActiveTransforms: actionResult.hasActiveTransforms,
        effectiveBrainstormIdeas: brainstormIdeas,
        chosenBrainstormIdea: chosenIdea,
        latestOutlineSettings: projectData.artifacts.find(a =>
            a.schema_type === 'outline_settings_schema' || a.type === 'outline_settings'
        ) || null,
        latestChronicles: projectData.artifacts.find(a =>
            a.schema_type === 'chronicles_schema'
        ) || null,
        brainstormInput: projectData.artifacts.find(a =>
            a.schema_type === 'brainstorm_tool_input_schema' || a.type === 'brainstorm_tool_input_schema'
        ) || null
    };
};

/**
 * MAIN UNIFIED COMPUTATION FUNCTION
 * Computes steps, display components, actions, and parameters
 */
export const computeUnifiedWorkflowState = (
    projectData: ProjectDataContextType,
    projectId: string,
    selectedBrainstormIdea?: SelectedBrainstormIdea | null
): UnifiedWorkflowState => {

    // First compute actions using existing logic
    const actionResult = computeParamsAndActionsFromLineage(projectData);

    // Compute workflow parameters
    const parameters = computeWorkflowParameters(projectData, projectId);

    // Compute workflow steps
    const steps = computeWorkflowSteps(
        actionResult.currentStage,
        actionResult.hasActiveTransforms,
        projectData
    );

    // Compute display components
    const displayComponents = computeDisplayComponents(
        actionResult.currentStage,
        actionResult.hasActiveTransforms,
        projectData
    );

    const result: UnifiedWorkflowState = {
        steps,
        displayComponents,
        actions: actionResult.actions,
        parameters
    };



    return result;
}; 