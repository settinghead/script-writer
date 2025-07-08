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

// Helper function to check if an artifact is a leaf node (no descendants)
export const isLeafNode = (artifactId: string, transformInputs: any[]): boolean => {
    if (!Array.isArray(transformInputs)) return true;
    return !transformInputs.some(input => input.artifact_id === artifactId);
};

// Helper function to check if an artifact can become editable
export const canBecomeEditable = (artifact: any, transformInputs: any[]): boolean => {
    return isLeafNode(artifact.id, transformInputs) && artifact.origin_type === 'ai_generated';
};

// Find brainstorm input artifact
export const findBrainstormInputArtifact = (artifacts: any[]) => {
    if (!Array.isArray(artifacts)) return null;
    return artifacts.find(artifact =>
        artifact.type === 'brainstorm_tool_input_schema' ||
        artifact.schema_type === 'brainstorm_tool_input_schema'
    ) || null;
};

// Find brainstorm idea artifacts
export const findBrainstormIdeaArtifacts = (artifacts: any[]) => {
    if (!Array.isArray(artifacts)) return [];
    return artifacts.filter(artifact =>
        artifact.schema_type === 'brainstorm_item_schema' || artifact.type === 'brainstorm_item_schema' ||
        artifact.schema_type === 'brainstorm_idea' || artifact.type === 'brainstorm_idea' ||
        artifact.schema_type === 'brainstorm_collection_schema' || artifact.type === 'brainstorm_collection_schema'
    );
};

// Find chosen brainstorm idea (editable brainstorm idea that's a leaf node)
export const findChosenBrainstormIdea = (projectData: ProjectDataContextType) => {
    if (projectData.artifacts === "pending" || projectData.artifacts === "error" ||
        projectData.transformInputs === "pending" || projectData.transformInputs === "error") {
        return null;
    }

    const brainstormIdeaArtifacts = findBrainstormIdeaArtifacts(projectData.artifacts);

    // Find the one that doesn't have descendants (no transforms using it as input)
    const editableArtifacts = brainstormIdeaArtifacts.filter((artifact: any) => {
        const hasDescendants = (projectData.transformInputs as any[]).some((input: any) =>
            input.artifact_id === artifact.id
        );
        return !hasDescendants;
    });

    if (editableArtifacts.length > 0) {
        // Sort by creation time and get the latest
        editableArtifacts.sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        return editableArtifacts[0];
    }

    return null;
};

// Find outline settings artifact
export const findLatestOutlineSettings = (projectData: ProjectDataContextType) => {
    if (projectData.artifacts === "pending" || projectData.artifacts === "error") {
        return null;
    }

    const outlineSettingsArtifacts = projectData.artifacts.filter(artifact =>
        artifact.schema_type === 'outline_settings_schema' || artifact.type === 'outline_settings'
    );

    console.log('[findLatestOutlineSettings] Debug:', {
        totalArtifacts: projectData.artifacts.length,
        outlineSettingsCount: outlineSettingsArtifacts.length,
        allArtifacts: projectData.artifacts.map(a => ({
            id: a.id.substring(0, 8),
            type: a.type,
            schema_type: a.schema_type
        }))
    });

    if (outlineSettingsArtifacts.length === 0) return null;

    // Sort by creation time and get the latest
    outlineSettingsArtifacts.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return outlineSettingsArtifacts[0];
};

// Find chronicles artifact
export const findLatestChronicles = (projectData: ProjectDataContextType) => {
    if (projectData.artifacts === "pending" || projectData.artifacts === "error") {
        return null;
    }

    const chroniclesArtifacts = projectData.artifacts.filter(artifact =>
        artifact.schema_type === 'chronicles_schema'
    );

    if (chroniclesArtifacts.length === 0) return null;

    // Sort by creation time and get the latest
    chroniclesArtifacts.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return chroniclesArtifacts[0];
};

// Check if there are active transforms
export const hasActiveTransforms = (projectData: ProjectDataContextType): boolean => {
    if (projectData.transforms === "pending" || projectData.transforms === "error") {
        return false;
    }

    return (projectData.transforms as any[]).some((transform: any) =>
        transform.status === 'running' || transform.status === 'pending'
    );
};

// Detect current workflow stage
export const detectCurrentStage = (projectData: ProjectDataContextType): WorkflowStage => {
    console.log('[detectCurrentStage] Starting stage detection...');
    // Check for brainstorm input artifact
    const brainstormInput = findBrainstormInputArtifact(
        projectData.artifacts === "pending" || projectData.artifacts === "error" ? [] : projectData.artifacts
    );

    // Also check for brainstorm idea artifacts (manual input case)
    const brainstormIdeas = findBrainstormIdeaArtifacts(
        projectData.artifacts === "pending" || projectData.artifacts === "error" ? [] : projectData.artifacts
    );



    // If we have neither brainstorm input nor brainstorm ideas, we're at initial stage
    if (!brainstormInput && brainstormIdeas.length === 0) {
        console.log('[detectCurrentStage] No brainstorm input or ideas, returning initial');
        return 'initial';
    }

    const transformInputs = projectData.transformInputs === "pending" || projectData.transformInputs === "error"
        ? [] : projectData.transformInputs;

    // Check for chosen idea (this works for both AI-generated and manual ideas)
    const chosenIdea = findChosenBrainstormIdea(projectData);

    console.log('[detectCurrentStage] Debug:', {
        brainstormIdeasCount: brainstormIdeas.length,
        hasChosenIdea: !!chosenIdea,
        chosenIdeaId: chosenIdea?.id.substring(0, 8)
    });

    // If we have brainstorm ideas (either from AI generation or manual input)
    if (brainstormIdeas.length > 0) {
        // Check for outline settings first, regardless of chosen idea status
        const outlineSettings = findLatestOutlineSettings(projectData);
        console.log('[detectCurrentStage] Outline settings check:', !!outlineSettings);

        if (!outlineSettings) {
            // No outline settings yet

            // Check if we have a single manually entered idea
            const isSingleManualEntry = brainstormIdeas.length === 1 &&
                brainstormIdeas[0].origin_type === 'user_input' &&
                (brainstormIdeas[0].schema_type === 'brainstorm_item_schema' || brainstormIdeas[0].type === 'brainstorm_item_schema');

            if (isSingleManualEntry) {
                console.log('[detectCurrentStage] Single manual entry detected, returning idea_editing');
                return 'idea_editing';
            }

            // Check if we have multiple AI-generated ideas
            const hasMultipleAIIdeas = brainstormIdeas.length > 1 &&
                brainstormIdeas.some(idea => idea.origin_type === 'ai_generated');

            if (hasMultipleAIIdeas) {
                console.log('[detectCurrentStage] Multiple AI-generated ideas detected, returning brainstorm_selection');
                return 'brainstorm_selection';
            }

            // For other cases (single AI idea or multiple manual ideas), check if one is chosen
            if (!chosenIdea) {
                console.log('[detectCurrentStage] No chosen idea, returning brainstorm_selection for multiple ideas or idea_editing for single');
                return brainstormIdeas.length > 1 ? 'brainstorm_selection' : 'idea_editing';
            }

            // Has chosen idea but no outline settings
            return 'idea_editing';
        }

        // Has outline settings - check for chronicles
        const chronicles = findLatestChronicles(projectData);
        console.log('[detectCurrentStage] Chronicles check:', !!chronicles);

        if (!chronicles) {
            // No chronicles yet, should generate chronicles
            console.log('[detectCurrentStage] Has outline settings, no chronicles, returning outline_generation');
            return 'outline_generation';
        }

        // Has chronicles - check if it's been used for LLM episode generation
        // We need to distinguish between human transforms (chronicle stage editing) 
        // and LLM transforms (episode generation)
        const chroniclesHasLLMTransforms = transformInputs.some(input => {
            if (input.artifact_id === chronicles.id) {
                const transform = (projectData.transforms === "pending" || projectData.transforms === "error")
                    ? [] : projectData.transforms;
                const relatedTransform = Array.isArray(transform)
                    ? transform.find(t => t.id === input.transform_id)
                    : null;
                return relatedTransform?.type === 'llm';
            }
            return false;
        });

        if (!chroniclesHasLLMTransforms) {
            // Chronicles hasn't been used for LLM episode generation yet, should generate episodes
            return 'chronicles_generation';
        }

        // Chronicles has been used for LLM episode generation, we're in episode generation
        return 'episode_synopsis_generation';
    }

    // If we only have brainstorm input but no generated ideas yet
    if (brainstormInput && !isLeafNode(brainstormInput.id, transformInputs)) {
        // Brainstorm input has been used to generate ideas
        return 'brainstorm_selection';
    }

    // We have brainstorm input but it hasn't been used yet
    return 'brainstorm_input';
};

/**
 * NEW: Lineage-based action computation (preferred method)
 * Uses lineage graph traversal for robust state detection
 */
export const computeParamsAndActionsFromLineage = (
    projectData: ProjectDataContextType
): ComputedActions => {
    console.log('[computeParamsAndActionsFromLineage] Starting computation');
    console.log('[computeParamsAndActionsFromLineage] Project data summary:', {
        lineageGraph: typeof projectData.lineageGraph,
        artifacts: Array.isArray(projectData.artifacts) ? projectData.artifacts.length : projectData.artifacts,
        transforms: Array.isArray(projectData.transforms) ? projectData.transforms.length : projectData.transforms
    });

    // Check if any data is still loading
    if (projectData.artifacts === "pending" ||
        projectData.transforms === "pending" ||
        projectData.humanTransforms === "pending" ||
        projectData.transformInputs === "pending" ||
        projectData.transformOutputs === "pending") {
        console.log('[computeParamsAndActionsFromLineage] Some data still loading, returning initial state');
        return {
            actions: [],
            currentStage: 'initial',
            hasActiveTransforms: false,
            stageDescription: '加载中...'
        };
    }

    // If lineage graph is pending but artifacts are loaded, fall back to legacy computation
    if (projectData.lineageGraph === "pending") {
        console.log('[computeParamsAndActionsFromLineage] Lineage graph pending, falling back to legacy computation');
        return computeParamsAndActions(projectData);
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

    // Use the new lineage-based computation
    console.log('[computeParamsAndActionsFromLineage] Calling computeActionsFromLineage with:', {
        lineageGraph: typeof projectData.lineageGraph,
        artifacts: projectData.artifacts.length,
        transforms: projectData.transforms.length
    });

    const lineageResult = computeActionsFromLineage(
        projectData.lineageGraph,
        projectData.artifacts,
        projectData.transforms,
        projectData.humanTransforms,
        projectData.transformInputs,
        projectData.transformOutputs
    );

    console.log('[computeParamsAndActionsFromLineage] Lineage result:', {
        actionsCount: lineageResult.actions.length,
        currentStage: lineageResult.actionContext.currentStage,
        hasActiveTransforms: lineageResult.actionContext.hasActiveTransforms
    });

    // Convert to the expected format for backward compatibility
    const result = {
        actions: lineageResult.actions,
        currentStage: lineageResult.actionContext.currentStage,
        hasActiveTransforms: lineageResult.actionContext.hasActiveTransforms,
        stageDescription: lineageResult.stageDescription
    };

    // If lineage-based computation failed to generate actions, fall back to legacy computation
    if (result.actions.length === 0 && result.currentStage === 'initial') {
        console.log('[computeParamsAndActionsFromLineage] Lineage computation returned empty, falling back to legacy');
        return computeParamsAndActions(projectData);
    }

    return result;
};

// LEGACY: Original artifact-based computation (for backward compatibility)
export const computeParamsAndActions = (
    projectData: ProjectDataContextType,
    selectedBrainstormIdea?: SelectedBrainstormIdea | null
): ComputedActions => {
    const currentStage = detectCurrentStage(projectData);
    const hasActive = hasActiveTransforms(projectData);

    console.log('[computeParamsAndActions] Stage:', currentStage, 'HasActive:', hasActive);

    // If there are active transforms, return minimal state
    if (hasActive) {
        return {
            actions: [],
            currentStage,
            hasActiveTransforms: true,
            stageDescription: '正在处理中...'
        };
    }

    const actions: ActionItem[] = [];
    let stageDescription = '';

    switch (currentStage) {
        case 'initial':
            stageDescription = '开始创建项目';
            actions.push({
                id: 'brainstorm_creation',
                type: 'button',
                title: '创建头脑风暴',
                description: '使用AI辅助生成创意想法',
                component: BrainstormCreationActions,
                props: {},
                enabled: true,
                priority: 1
            });
            break;

        case 'brainstorm_input':
            stageDescription = '填写参数并开始头脑风暴';
            const brainstormInput = findBrainstormInputArtifact(
                projectData.artifacts === "pending" || projectData.artifacts === "error" ? [] : projectData.artifacts
            );
            if (brainstormInput) {
                actions.push({
                    id: 'brainstorm_start_button',
                    type: 'button',
                    title: '开始头脑风暴',
                    description: '基于上方填写的参数开始生成创意',
                    component: BrainstormInputForm,
                    props: { brainstormArtifact: brainstormInput },
                    enabled: true,
                    priority: 1
                });
            }
            break;

        case 'brainstorm_selection':
            stageDescription = '选择一个创意继续开发';
            actions.push({
                id: 'brainstorm_idea_selection',
                type: 'selection',
                title: '选择创意',
                description: '从生成的创意中选择一个继续开发',
                component: BrainstormIdeaSelection,
                props: {},
                enabled: true,
                priority: 1
            });
            break;

        case 'idea_editing':
            stageDescription = '编辑创意并生成大纲';
            actions.push({
                id: 'outline_generation',
                type: 'form',
                title: '生成大纲',
                description: '基于选中的创意生成详细大纲',
                component: OutlineGenerationForm,
                props: {},
                enabled: true,
                priority: 1
            });
            break;

        case 'outline_generation':
            stageDescription = '生成时间顺序大纲';
            actions.push({
                id: 'chronicles_generation',
                type: 'button',
                title: '生成分集概要',
                description: '基于大纲生成分集概要',
                component: ChroniclesGenerationAction,
                props: {},
                enabled: true,
                priority: 1
            });
            break;

        case 'chronicles_generation':
            stageDescription = '生成分集概要';
            actions.push({
                id: 'episode_synopsis_generation',
                type: 'button',
                title: '生成剧本',
                description: '基于分集概要生成具体剧本',
                component: EpisodeGenerationAction,
                props: {},
                enabled: true,
                priority: 1
            });
            break;

        case 'episode_synopsis_generation':
            stageDescription = '生成剧本内容';
            // No more actions at this stage
            break;
    }

    return {
        actions,
        currentStage,
        hasActiveTransforms: false,
        stageDescription
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
    console.log('[computeWorkflowSteps] Called with:', {
        currentStage,
        hasActiveTransforms,
        artifactsLength: projectData.artifacts === "pending" || projectData.artifacts === "error" ? 0 : projectData.artifacts.length
    });

    // Return empty array if currentStage is initial - no workflow steps to show
    if (currentStage === 'initial') {
        console.log('[computeWorkflowSteps] Initial stage, returning empty steps');
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
            title: '大纲生成',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.CHRONICLES_GENERATION,
            title: '分集概要',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.EPISODE_GENERATION,
            title: '剧本生成',
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
            title: '大纲生成',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.CHRONICLES_GENERATION,
            title: '分集概要',
            status: 'wait'
        },
        {
            id: WORKFLOW_STEPS.EPISODE_GENERATION,
            title: '剧本生成',
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
        'episode_synopsis_generation': 3
    };

    const aiStageToStepMap: Record<WorkflowStage, number> = {
        'initial': -1,
        'brainstorm_input': 0,
        'brainstorm_selection': 1,
        'idea_editing': 2,
        'outline_generation': 3,
        'chronicles_generation': 4,
        'episode_synopsis_generation': 5
    };

    const stageToStepMap = isManualPath ? manualStageToStepMap : aiStageToStepMap;
    const currentStepIndex = stageToStepMap[currentStage];

    // Update step statuses
    steps.forEach((step, index) => {
        if (index < currentStepIndex) {
            step.status = 'finish';
        } else if (index === currentStepIndex) {
            if (hasActiveTransforms) {
                step.status = 'process';
            } else {
                step.status = 'process';
            }
        } else {
            step.status = 'wait';
        }
    });

    console.log('[computeWorkflowSteps] Returning steps:', {
        stepsCount: steps.length,
        currentStepIndex,
        isManualPath,
        steps: steps.map(s => ({ id: s.id, title: s.title, status: s.status }))
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

    const brainstormInput = findBrainstormInputArtifact(projectData.artifacts);
    const brainstormIdeas = findBrainstormIdeaArtifacts(projectData.artifacts);

    // Manual path: no brainstorm input artifact, but has brainstorm ideas from user input
    const hasManualIdea = brainstormIdeas.length > 0 &&
        brainstormIdeas.some(idea => idea.origin_type === 'user_input');

    // AI path: has brainstorm input artifact or AI-generated ideas
    const hasAIPath = !!brainstormInput ||
        brainstormIdeas.some(idea => idea.origin_type === 'ai_generated');

    // If we have both manual and AI ideas, prefer AI path (user went through full flow)
    if (hasAIPath && hasManualIdea) {
        return false;
    }

    // If we only have manual ideas and no brainstorm input, it's manual path
    return hasManualIdea && !brainstormInput;
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

    const brainstormInput = findBrainstormInputArtifact(projectData.artifacts);
    const brainstormIdeas = findBrainstormIdeaArtifacts(projectData.artifacts);
    const chosenIdea = findChosenBrainstormIdea(projectData);
    const outlineSettings = findLatestOutlineSettings(projectData);
    const chronicles = findLatestChronicles(projectData);

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

            // Show collapsed brainstorm ideas
            if (brainstormIdeas.length > 1) {
                components.push({
                    id: 'project-brainstorm-page',
                    component: getComponentById('project-brainstorm-page'),
                    mode: 'collapsed',
                    props: {
                        ideas: brainstormIdeas,
                        selectionMode: false,
                        collapsed: true
                    },
                    priority: 2
                });
            }

            // Show chosen idea editor
            if (chosenIdea) {
                components.push({
                    id: 'single-brainstorm-idea-editor',
                    component: getComponentById('single-brainstorm-idea-editor'),
                    mode: hasActiveTransforms ? 'readonly' : 'editable',
                    props: {
                        idea: chosenIdea,
                        isEditable: !hasActiveTransforms
                    },
                    priority: 3
                });
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

            if (brainstormIdeas.length > 1) {
                components.push({
                    id: 'project-brainstorm-page',
                    component: getComponentById('project-brainstorm-page'),
                    mode: 'collapsed',
                    props: {
                        ideas: brainstormIdeas,
                        collapsed: true
                    },
                    priority: 2
                });
            }

            if (chosenIdea) {
                components.push({
                    id: 'single-brainstorm-idea-editor',
                    component: getComponentById('single-brainstorm-idea-editor'),
                    mode: 'readonly',
                    props: {
                        idea: chosenIdea,
                        isEditable: false
                    },
                    priority: 3
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

            if (brainstormIdeas.length > 1) {
                components.push({
                    id: 'project-brainstorm-page',
                    component: getComponentById('project-brainstorm-page'),
                    mode: 'collapsed',
                    props: {
                        ideas: brainstormIdeas,
                        collapsed: true
                    },
                    priority: 2
                });
            }

            if (chosenIdea) {
                components.push({
                    id: 'single-brainstorm-idea-editor',
                    component: getComponentById('single-brainstorm-idea-editor'),
                    mode: 'readonly',
                    props: {
                        idea: chosenIdea,
                        isEditable: false
                    },
                    priority: 3
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

            if (brainstormIdeas.length > 1) {
                components.push({
                    id: 'project-brainstorm-page',
                    component: getComponentById('project-brainstorm-page'),
                    mode: 'collapsed',
                    props: {
                        ideas: brainstormIdeas,
                        collapsed: true
                    },
                    priority: 2
                });
            }

            if (chosenIdea) {
                components.push({
                    id: 'single-brainstorm-idea-editor',
                    component: getComponentById('single-brainstorm-idea-editor'),
                    mode: 'readonly',
                    props: {
                        idea: chosenIdea,
                        isEditable: false
                    },
                    priority: 3
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
    return components.sort((a, b) => a.priority - b.priority);
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

    const currentStage = detectCurrentStage(projectData);
    const hasActive = hasActiveTransforms(projectData);

    return {
        projectId,
        currentStage,
        hasActiveTransforms: hasActive,
        effectiveBrainstormIdeas: findBrainstormIdeaArtifacts(projectData.artifacts),
        chosenBrainstormIdea: findChosenBrainstormIdea(projectData),
        latestOutlineSettings: findLatestOutlineSettings(projectData),
        latestChronicles: findLatestChronicles(projectData),
        brainstormInput: findBrainstormInputArtifact(projectData.artifacts)
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
    console.log('[computeUnifiedWorkflowState] Starting unified computation');

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

    console.log('[computeUnifiedWorkflowState] Unified result:', {
        stepsCount: result.steps.length,
        componentsCount: result.displayComponents.length,
        actionsCount: result.actions.length,
        currentStage: parameters.currentStage,
        steps: result.steps.map(s => ({ id: s.id, title: s.title, status: s.status }))
    });

    return result;
}; 