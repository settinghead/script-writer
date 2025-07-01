import { useMemo } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';
import { buildLineageGraph } from '../../common/utils/lineageResolution';
import { ElectricArtifact } from '../../common/types';

interface EditableDescendant {
    artifactId: string;
    artifact: ElectricArtifact;
    createdAt: string;
    transformId: string;
}

interface UseEditableDescendantsResult {
    hasEditableDescendants: boolean;
    editableDescendants: EditableDescendant[];
    latestEditable: EditableDescendant | null;
    isLoading: boolean;
    error: Error | null;
}

/**
 * Hook to detect if a brainstorm idea has editable (user-input with human transform) descendants
 * @param brainstormArtifactId - The brainstorm idea artifact ID to check
 * @returns Information about editable descendants
 */
export function useEditableDescendants(brainstormArtifactId: string): UseEditableDescendantsResult {
    const projectData = useProjectData();

    const result = useMemo((): UseEditableDescendantsResult => {
        if (projectData.isLoading) {
            return {
                hasEditableDescendants: false,
                editableDescendants: [],
                latestEditable: null,
                isLoading: true,
                error: null
            };
        }

        if (projectData.error) {
            return {
                hasEditableDescendants: false,
                editableDescendants: [],
                latestEditable: null,
                isLoading: false,
                error: projectData.error
            };
        }

        try {
            // Build lineage graph
            const graph = buildLineageGraph(
                projectData.artifacts,
                projectData.transforms,
                projectData.humanTransforms,
                projectData.transformInputs,
                projectData.transformOutputs
            );

            // Find all user-input artifacts that can be traced back to this brainstorm idea
            const editableDescendants: EditableDescendant[] = [];

            // Get all user-input artifacts that have human transforms
            const userInputArtifacts = projectData.artifacts.filter(artifact =>
                artifact.origin_type === 'user_input' &&
                (artifact.schema_type === 'brainstorm_idea' || artifact.type === 'brainstorm_idea')
            );

            // For each user-input artifact, check if it has a human transform and traces back to our brainstorm idea
            for (const userInputArtifact of userInputArtifacts) {
                // Find the human transform that created this artifact
                const humanTransform = projectData.humanTransforms.find(ht =>
                    projectData.transformOutputs.some(to =>
                        to.transform_id === ht.id && to.artifact_id === userInputArtifact.id
                    )
                );

                if (humanTransform && canTraceBackToBrainstormIdea(userInputArtifact.id, brainstormArtifactId, graph)) {
                    editableDescendants.push({
                        artifactId: userInputArtifact.id,
                        artifact: userInputArtifact,
                        createdAt: userInputArtifact.created_at,
                        transformId: String(humanTransform.id)
                    });
                }
            }

            // Sort by creation date (newest first)
            editableDescendants.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            const latestEditable = editableDescendants[0] || null;

            return {
                hasEditableDescendants: editableDescendants.length > 0,
                editableDescendants,
                latestEditable,
                isLoading: false,
                error: null
            };

        } catch (error) {
            console.error('[useEditableDescendants] Error:', error);
            return {
                hasEditableDescendants: false,
                editableDescendants: [],
                latestEditable: null,
                isLoading: false,
                error: error instanceof Error ? error : new Error('Failed to detect editable descendants')
            };
        }
    }, [
        brainstormArtifactId,
        projectData.isLoading,
        projectData.error,
        projectData.artifacts,
        projectData.transforms,
        projectData.humanTransforms,
        projectData.transformInputs,
        projectData.transformOutputs
    ]);

    return result;
}

/**
 * Recursively trace back through the lineage graph to see if an artifact can be traced to a brainstorm idea
 */
function canTraceBackToBrainstormIdea(
    currentArtifactId: string,
    targetBrainstormId: string,
    graph: any,
    visited: Set<string> = new Set()
): boolean {
    // Prevent infinite loops
    if (visited.has(currentArtifactId)) {
        return false;
    }
    visited.add(currentArtifactId);

    // If we've reached the target brainstorm idea, we found a connection
    if (currentArtifactId === targetBrainstormId) {
        return true;
    }

    // Get the node for this artifact
    const node = graph.nodes.get(currentArtifactId);
    if (!node || node.type !== 'artifact') {
        return false;
    }

    // If this artifact has no source transform, it's a root node
    if (node.sourceTransform === 'none') {
        return false;
    }

    // Trace back through all source artifacts of the transform that created this artifact
    const sourceTransform = node.sourceTransform;
    if (sourceTransform && sourceTransform.sourceArtifacts) {
        for (const sourceArtifact of sourceTransform.sourceArtifacts) {
            if (canTraceBackToBrainstormIdea(sourceArtifact.artifactId, targetBrainstormId, graph, new Set(visited))) {
                return true;
            }
        }
    }

    return false;
} 