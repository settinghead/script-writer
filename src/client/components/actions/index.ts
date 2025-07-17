// Shared interfaces for action components
export interface BaseActionProps {
    projectId: string;
    onSuccess?: () => void;
    onError?: (error: Error) => void;
}

// Re-export action components (will be created)
export { default as BrainstormCreationActions } from './BrainstormCreationActions';
export { default as BrainstormInputForm } from './BrainstormInputForm';
export { default as BrainstormIdeaSelection } from './BrainstormIdeaSelection';
export { default as OutlineGenerationForm } from './OutlineGenerationForm';
export { default as ChroniclesGenerationAction } from './ChroniclesGenerationAction';
export { default as EpisodePlanningAction } from './EpisodePlanningAction';
export { default as EpisodeGenerationAction } from './EpisodeGenerationAction';

// Action item renderer component
export { default as ActionItemRenderer } from './ActionItemRenderer'; 