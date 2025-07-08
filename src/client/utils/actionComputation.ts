import React from 'react';
import { ProjectDataContextType } from '../../common/types';
import { SelectedBrainstormIdea } from '../stores/actionItemsStore';

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
    | 'episode_generation';

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
        (artifact.schema_type === 'brainstorm_item_schema' || artifact.type === 'brainstorm_item_schema' ||
            artifact.schema_type === 'brainstorm_idea' || artifact.type === 'brainstorm_idea') &&
        artifact.origin_type === 'user_input'
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
        artifact.schema_type === 'outline_settings_schema'
    );

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
        return 'initial';
    }

    const transformInputs = projectData.transformInputs === "pending" || projectData.transformInputs === "error"
        ? [] : projectData.transformInputs;

    // Check for chosen idea (this works for both AI-generated and manual ideas)
    const chosenIdea = findChosenBrainstormIdea(projectData);

    // If we have brainstorm ideas (either from AI generation or manual input)
    if (brainstormIdeas.length > 0) {
        if (!chosenIdea) {
            // If we have multiple ideas or need selection, go to selection stage
            // For manual input, we typically have just one idea and it should be chosen automatically
            return brainstormIdeas.length > 1 ? 'brainstorm_selection' : 'idea_editing';
        }

        // Has chosen idea - check for outline settings
        const outlineSettings = findLatestOutlineSettings(projectData);
        if (!outlineSettings) {
            return 'idea_editing';
        }

        // Has outline settings - check if it's a leaf node
        if (!isLeafNode(outlineSettings.id, transformInputs)) {
            // Has chronicles - check for chronicles artifact
            const chronicles = findLatestChronicles(projectData);
            if (!chronicles) {
                return 'outline_generation';
            }

            // Has chronicles - check if it's a leaf node
            if (!isLeafNode(chronicles.id, transformInputs)) {
                return 'episode_generation';
            }

            return 'chronicles_generation';
        }

        return 'outline_generation';
    }

    // If we only have brainstorm input but no generated ideas yet
    if (brainstormInput && !isLeafNode(brainstormInput.id, transformInputs)) {
        // Brainstorm input has been used to generate ideas
        return 'brainstorm_selection';
    }

    // We have brainstorm input but it hasn't been used yet
    return 'brainstorm_input';
};

// Main function to compute available actions
export const computeParamsAndActions = (
    projectData: ProjectDataContextType,
    selectedBrainstormIdea?: SelectedBrainstormIdea | null
): ComputedActions => {
    const currentStage = detectCurrentStage(projectData);
    const hasActive = hasActiveTransforms(projectData);

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
                id: 'episode_generation',
                type: 'button',
                title: '生成剧本',
                description: '基于分集概要生成具体剧本',
                component: EpisodeGenerationAction,
                props: {},
                enabled: true,
                priority: 1
            });
            break;

        case 'episode_generation':
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