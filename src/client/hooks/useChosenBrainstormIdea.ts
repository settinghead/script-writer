import { useMemo } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';
import { buildLineageGraph, findEffectiveBrainstormIdeas } from '../../common/transform-artifact-framework/lineageResolution';

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
            if (projectData.humanTransforms === "pending" || projectData.humanTransforms === "error") {
                return { chosenIdea: null, isLoading: false, error: null };
            }

            for (const humanTransform of projectData.humanTransforms) {

                // Check if this is a brainstorm idea editing transform
                if (humanTransform.transform_name &&
                    (humanTransform.transform_name.includes('brainstorm') ||
                        humanTransform.transform_name.includes('edit'))) {


                    if (humanTransform.derived_artifact_id) {
                        const derivedArtifact = projectData.getArtifactById(humanTransform.derived_artifact_id);

                        if (derivedArtifact && (derivedArtifact.schema_type === 'brainstorm_idea')) {
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
            return { chosenIdea: null, isLoading: false, error: null };

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to detect chosen brainstorm idea');
            console.error('[useChosenBrainstormIdea] Error:', error);
            return { chosenIdea: null, isLoading: false, error };
        }
    }, [
        projectData.isLoading,
        projectData.humanTransforms,
        // Remove unstable function references from dependencies
        // The getArtifactById function should be stable, but we'll rely on the artifacts array instead
        projectData.artifacts
    ]);

    return result;
} 