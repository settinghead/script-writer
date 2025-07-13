import React from 'react';

// Discriminated unions for component modes
export type ComponentDisplayState =
    | { mode: 'hidden' }
    | { mode: 'readonly'; data: any }
    | { mode: 'editable'; data: any; editableFields?: string[] }
    | { mode: 'collapsed'; data: any; expandable?: boolean }
    | { mode: 'loading'; message?: string }
    | { mode: 'error'; error: string; retry?: () => void };

// Component identification
export type ComponentId =
    | 'project-creation-form'
    | 'brainstorm-input-editor'
    | 'idea-collection'
    | 'single-idea-editor'
    | 'outline-settings-display'
    | 'chronicles-display';

// Component modes
export type ComponentMode =
    | 'hidden'
    | 'readonly'
    | 'editable'
    | 'collapsed'
    | 'loading'
    | 'error';

// Workflow step definition
export interface WorkflowStep {
    id: string;
    title: string;
    status: 'wait' | 'process' | 'finish' | 'error';
}

// Display component definition
export interface DisplayComponent {
    id: ComponentId;
    component: React.ComponentType<any>;
    mode: ComponentMode;
    props: Record<string, any>;
    priority: number;
}

// Workflow parameters for components and actions
export interface WorkflowParameters {
    projectId: string;
    currentStage: string;
    hasActiveTransforms: boolean;
    effectiveBrainstormIdeas: any[];
    chosenBrainstormIdea: any;
    latestOutlineSettings: any;
    latestChronicles: any;
    brainstormInput: any;
    // Add more as needed
}

// Main unified state
export interface UnifiedWorkflowState {
    steps: WorkflowStep[];
    displayComponents: DisplayComponent[];
    actions: any[]; // Will be ActionItem[] from existing types
    parameters: WorkflowParameters;
}

// Step definitions with proper states
export const WORKFLOW_STEPS = {
    INITIAL: 'initial',
    BRAINSTORM_INPUT: 'brainstorm_input',
    BRAINSTORM_GENERATION: 'brainstorm_generation',
    BRAINSTORM_SELECTION: 'brainstorm_selection',
    IDEA_EDITING: 'idea_editing',
    OUTLINE_GENERATION: 'outline_generation',
    CHRONICLES_GENERATION: 'chronicles_generation',
    EPISODE_GENERATION: 'episode_generation'
} as const;

export type WorkflowStageId = typeof WORKFLOW_STEPS[keyof typeof WORKFLOW_STEPS];

// Step configuration
export interface StepConfig {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    stages: WorkflowStageId[];
} 