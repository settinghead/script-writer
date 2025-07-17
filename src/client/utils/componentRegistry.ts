import React from 'react';
import { ComponentId } from './workflowTypes';

// Import all the components that will be managed by the unified system
import { ProjectCreationForm } from '../components/ProjectCreationForm';
import BrainstormInputEditor from '../components/BrainstormInputEditor';
import IdeaCollection from '../components/brainstorm/IdeaCollection';
import { SingleBrainstormIdeaEditor } from '../components/brainstorm/SingleBrainstormIdeaEditor';
import { OutlineSettingsDisplay } from '../components/OutlineSettingsDisplay';
import { ChroniclesDisplay } from '../components/ChroniclesDisplay';
import { EpisodePlanningDisplay } from '../components/EpisodePlanningDisplay';

export const COMPONENT_REGISTRY = {
    'project-creation-form': ProjectCreationForm,
    'brainstorm-input-editor': BrainstormInputEditor,
    'idea-collection': IdeaCollection,
    'single-idea-editor': SingleBrainstormIdeaEditor,
    'outline-settings-display': OutlineSettingsDisplay,
    'chronicles-display': ChroniclesDisplay,
    'episode-planning-display': EpisodePlanningDisplay,
} as const;

export type ComponentRegistry = typeof COMPONENT_REGISTRY;

// Helper function to get component by ID
export function getComponentById(id: ComponentId): React.ComponentType<any> {
    const component = COMPONENT_REGISTRY[id];

    return component;
}

// Validate that all ComponentId values have corresponding components
type ValidateRegistry = {
    [K in ComponentId]: K extends keyof typeof COMPONENT_REGISTRY ? true : never;
};

// This will cause a TypeScript error if any ComponentId is missing from the registry
const _registryValidation: ValidateRegistry = {} as ValidateRegistry; 