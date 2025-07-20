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
    | 'chronicles-display'
    | 'episode-planning-display';

// Component modes
export type ComponentMode =
    | 'hidden'
    | 'readonly'
    | 'editable'
    | 'collapsed'
    | 'loading'
    | 'error';

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
    hasActiveTransforms: boolean;
    latestOutlineSettings: any;
    latestChronicles: any;
    brainstormInput: any;
    // Add more as needed
}

// Main unified state
export interface UnifiedWorkflowState {
    displayComponents: DisplayComponent[];
    actions: any[]; // Will be ActionItem[] from existing types
    parameters: WorkflowParameters; // Update this without currentStage
} 