import { useMemo } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';
import { buildLineageGraph, findEffectiveBrainstormIdeas } from '../../common/utils/lineageResolution';

interface ChosenBrainstormIdea {
    originalArtifactId: string;
    originalArtifactPath: string;
    editableArtifactId: string;
    index: number;
    isFromCollection: boolean;
}

/**
 * Hook to detect when a brainstorm idea has been "chosen" for editing
 * An idea is chosen when it has both:
 * 1. A human transform (user clicked to edit)
 * 2. A user_input artifact (actual editable version exists)
 */
export function useChosenBrainstormIdea(): {
    chosenIdea: ChosenBrainstormIdea | null;
    isLoading: boolean;
    error: Error | null;
} {
    const projectData = useProjectData();

    const result = useMemo(() => {
        if (projectData.isLoading) {
            return { chosenIdea: null, isLoading: true, error: null };
        }

        try {
            // Look directly at human transforms for brainstorm idea editing
            console.log('[useChosenBrainstormIdea] Checking human transforms:', projectData.humanTransforms.length);

            for (const humanTransform of projectData.humanTransforms) {
                console.log('[useChosenBrainstormIdea] Checking transform:', humanTransform);

                // Check if this is a brainstorm idea editing transform
                if (humanTransform.transform_name &&
                    (humanTransform.transform_name.includes('brainstorm') ||
                        humanTransform.transform_name.includes('edit'))) {

                    console.log('[useChosenBrainstormIdea] Found brainstorm editing transform');

                    if (humanTransform.derived_artifact_id) {
                        const derivedArtifact = projectData.getArtifactById(humanTransform.derived_artifact_id);
                        console.log('[useChosenBrainstormIdea] Derived artifact:', derivedArtifact);

                        if (derivedArtifact && (derivedArtifact.type === 'user_input' || derivedArtifact.type === 'brainstorm_idea')) {
                            // Extract index from derivation path
                            let index = 0;
                            let isFromCollection = false;

                            if (humanTransform.derivation_path && humanTransform.derivation_path !== '$') {
                                // Path like "$.ideas[1]" - extract the index
                                const match = humanTransform.derivation_path.match(/\[(\d+)\]/);
                                if (match) {
                                    index = parseInt(match[1], 10);
                                    isFromCollection = true;
                                }
                            }

                            console.log('[useChosenBrainstormIdea] Found chosen idea!', {
                                originalArtifactId: humanTransform.source_artifact_id,
                                originalArtifactPath: humanTransform.derivation_path,
                                editableArtifactId: derivedArtifact.id,
                                index,
                                isFromCollection,
                                derivedType: derivedArtifact.type
                            });

                            return {
                                chosenIdea: {
                                    originalArtifactId: humanTransform.source_artifact_id!,
                                    originalArtifactPath: humanTransform.derivation_path || '$',
                                    editableArtifactId: derivedArtifact.id,
                                    index,
                                    isFromCollection
                                },
                                isLoading: false,
                                error: null
                            };
                        }
                    }
                }
            }

            // No chosen idea found
            console.log('[useChosenBrainstormIdea] No chosen idea found');
            return { chosenIdea: null, isLoading: false, error: null };

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to detect chosen brainstorm idea');
            console.error('[useChosenBrainstormIdea] Error:', error);
            return { chosenIdea: null, isLoading: false, error };
        }
    }, [
        projectData.isLoading,
        projectData.artifacts,
        projectData.transforms,
        projectData.humanTransforms,
        projectData.transformInputs,
        projectData.transformOutputs,
        projectData.getHumanTransformsForArtifact,
        projectData.getArtifactById
    ]);

    return result;
} 