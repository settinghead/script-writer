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

    // Check if lineage graph is available
    if (projectData.lineageGraph === "pending" || projectData.lineageGraph === "error") {
        return components;
    }

    // Use lineage graph to find canonical artifacts
    const lineageGraph = projectData.lineageGraph;
    const transformInputs = projectData.transformInputs === "pending" || projectData.transformInputs === "error"
        ? [] : projectData.transformInputs;

    // Cast artifacts to proper type after checking it's not pending/error
    const artifacts = projectData.artifacts as any[];

    // Find canonical brainstorm artifacts using lineage graph
    const canonicalBrainstormArtifacts = Array.from(lineageGraph.nodes.values())
        .filter(node => {
            if (node.type !== 'artifact') return false;
            const lineageArtifactNode = node as any; // Cast to access artifactId
            const artifact = artifacts.find((a: any) => a.id === lineageArtifactNode.artifactId);
            return artifact && (
                artifact.schema_type === 'brainstorm_tool_input_schema' ||
                artifact.type === 'brainstorm_tool_input_schema' ||
                artifact.schema_type === 'brainstorm_item_schema' ||
                artifact.type === 'brainstorm_item_schema' ||
                artifact.schema_type === 'brainstorm_idea_schema' ||
                artifact.type === 'brainstorm_idea' ||
                artifact.schema_type === 'brainstorm_collection_schema' ||
                artifact.type === 'brainstorm_collection_schema'
            );
        })
        .map(node => {
            const lineageArtifactNode = node as any; // Cast to access artifactId
            return artifacts.find((a: any) => a.id === lineageArtifactNode.artifactId);
        })
        .filter(artifact => artifact != null);

    const brainstormInput = canonicalBrainstormArtifacts.find((a: any) =>
        a.schema_type === 'brainstorm_tool_input_schema' || a.type === 'brainstorm_tool_input_schema'
    );

    const brainstormIdeas = canonicalBrainstormArtifacts.filter((a: any) =>
        a.schema_type === 'brainstorm_item_schema' || a.type === 'brainstorm_item_schema' ||
        a.schema_type === 'brainstorm_idea_schema' || a.type === 'brainstorm_idea' ||
        a.schema_type === 'brainstorm_collection_schema' || a.type === 'brainstorm_collection_schema'
    );

    // Find chosen idea (leaf node without descendants) using lineage graph
    const chosenIdea = brainstormIdeas.find((idea: any) => {
        const lineageNode = lineageGraph.nodes.get(idea.id);
        return lineageNode && lineageNode.isLeaf;
    });

    // Find canonical outline settings using lineage graph - this is the key fix!
    const canonicalOutlineArtifacts = Array.from(lineageGraph.nodes.values())
        .filter(node => {
            if (node.type !== 'artifact') return false;
            const lineageArtifactNode = node as any; // Cast to access artifactId
            const artifact = artifacts.find((a: any) => a.id === lineageArtifactNode.artifactId);
            return artifact && (
                artifact.schema_type === 'outline_settings_schema' ||
                artifact.type === 'outline_settings'
            );
        })
        .map(node => {
            const lineageArtifactNode = node as any; // Cast to access artifactId
            return artifacts.find((a: any) => a.id === lineageArtifactNode.artifactId);
        })
        .filter(artifact => artifact != null);

    let outlineSettings = null;
    if (canonicalOutlineArtifacts.length > 0) {
        // Find leaf nodes (artifacts without descendants) from canonical set
        const leafOutlineSettings = canonicalOutlineArtifacts.filter((artifact: any) => {
            const lineageNode = lineageGraph.nodes.get(artifact.id);
            return lineageNode && lineageNode.isLeaf;
        });

        if (leafOutlineSettings.length > 0) {
            // Prioritize user_input artifacts, then by most recent
            leafOutlineSettings.sort((a: any, b: any) => {
                // First priority: user_input origin type
                if (a.origin_type === 'user_input' && b.origin_type !== 'user_input') return -1;
                if (b.origin_type === 'user_input' && a.origin_type !== 'user_input') return 1;
                // Second priority: most recent
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
            outlineSettings = leafOutlineSettings[0];
        } else {
            // Fallback to most recent from canonical set if no leaf nodes found
            canonicalOutlineArtifacts.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            outlineSettings = canonicalOutlineArtifacts[0];
        }
    }

    // Find canonical chronicles using lineage graph
    const canonicalChronicles = Array.from(lineageGraph.nodes.values())
        .filter(node => {
            if (node.type !== 'artifact') return false;
            const lineageArtifactNode = node as any; // Cast to access artifactId
            const artifact = artifacts.find((a: any) => a.id === lineageArtifactNode.artifactId);
            return artifact && artifact.schema_type === 'chronicles_schema';
        })
        .map(node => {
            const lineageArtifactNode = node as any; // Cast to access artifactId
            return artifacts.find((a: any) => a.id === lineageArtifactNode.artifactId);
        })
        .filter(artifact => artifact != null)[0]; // Take the first (should be only one)


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
                // Determine if the outline settings artifact is actually editable
                // Only user_input artifacts should be editable, not ai_generated ones
                const isOutlineLeafNode = isLeafNode(outlineSettings.id, transformInputs);
                const isOutlineEditable = !hasActiveTransforms &&
                    isOutlineLeafNode &&
                    outlineSettings.origin_type === 'user_input'; // Only user_input, not ai_generated

                components.push({
                    id: 'outline-settings-display',
                    component: getComponentById('outline-settings-display'),
                    mode: hasActiveTransforms ? 'readonly' : 'editable',
                    props: {
                        outlineSettings,
                        isEditable: isOutlineEditable
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
            if (canonicalChronicles) {
                components.push({
                    id: 'chronicles-display',
                    component: getComponentById('chronicles-display'),
                    mode: hasActiveTransforms ? 'readonly' : 'editable',
                    props: {
                        chronicles: canonicalChronicles,
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

            if (canonicalChronicles) {
                components.push({
                    id: 'chronicles-display',
                    component: getComponentById('chronicles-display'),
                    mode: 'readonly',
                    props: {
                        chronicles: canonicalChronicles,
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

    // Check if lineage graph is available
    if (projectData.lineageGraph === "pending" || projectData.lineageGraph === "error") {
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

    // Use lineage graph to find canonical artifacts
    const lineageGraph = projectData.lineageGraph;
    const artifacts = projectData.artifacts as any[];

    // Find canonical brainstorm artifacts using lineage graph
    const canonicalBrainstormArtifacts = Array.from(lineageGraph.nodes.values())
        .filter(node => {
            if (node.type !== 'artifact') return false;
            const lineageArtifactNode = node as any;
            const artifact = artifacts.find((a: any) => a.id === lineageArtifactNode.artifactId);
            return artifact && (
                artifact.schema_type === 'brainstorm_item_schema' ||
                artifact.type === 'brainstorm_item_schema' ||
                artifact.schema_type === 'brainstorm_idea_schema' ||
                artifact.type === 'brainstorm_idea' ||
                artifact.schema_type === 'brainstorm_collection_schema' ||
                artifact.type === 'brainstorm_collection_schema'
            );
        })
        .map(node => {
            const lineageArtifactNode = node as any;
            return artifacts.find((a: any) => a.id === lineageArtifactNode.artifactId);
        })
        .filter(artifact => artifact != null);

    const chosenIdea = canonicalBrainstormArtifacts.find((idea: any) => {
        const lineageNode = lineageGraph.nodes.get(idea.id);
        return lineageNode && lineageNode.isLeaf;
    });

    // Find canonical outline settings using lineage graph
    const canonicalOutlineArtifacts = Array.from(lineageGraph.nodes.values())
        .filter(node => {
            if (node.type !== 'artifact') return false;
            const lineageArtifactNode = node as any;
            const artifact = artifacts.find((a: any) => a.id === lineageArtifactNode.artifactId);
            return artifact && (
                artifact.schema_type === 'outline_settings_schema' ||
                artifact.type === 'outline_settings'
            );
        })
        .map(node => {
            const lineageArtifactNode = node as any;
            return artifacts.find((a: any) => a.id === lineageArtifactNode.artifactId);
        })
        .filter(artifact => artifact != null);

    let outlineSettings = null;
    if (canonicalOutlineArtifacts.length > 0) {
        // Find leaf nodes from canonical set
        const leafOutlineSettings = canonicalOutlineArtifacts.filter((artifact: any) => {
            const lineageNode = lineageGraph.nodes.get(artifact.id);
            return lineageNode && lineageNode.isLeaf;
        });

        if (leafOutlineSettings.length > 0) {
            // Prioritize user_input artifacts, then by most recent
            leafOutlineSettings.sort((a: any, b: any) => {
                // First priority: user_input origin type
                if (a.origin_type === 'user_input' && b.origin_type !== 'user_input') return -1;
                if (b.origin_type === 'user_input' && a.origin_type !== 'user_input') return 1;
                // Second priority: most recent
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
            outlineSettings = leafOutlineSettings[0];
        } else {
            // Fallback to most recent from canonical set if no leaf nodes found
            canonicalOutlineArtifacts.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            outlineSettings = canonicalOutlineArtifacts[0];
        }
    }

    return {
        projectId,
        currentStage: actionResult.currentStage,
        hasActiveTransforms: actionResult.hasActiveTransforms,
        effectiveBrainstormIdeas: canonicalBrainstormArtifacts,
        chosenBrainstormIdea: chosenIdea,
        latestOutlineSettings: outlineSettings,
        latestChronicles: artifacts.find((a: any) =>
            a.schema_type === 'chronicles_schema'
        ) || null,
        brainstormInput: artifacts.find((a: any) =>
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