import { useMemo } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';
import { ElectricArtifact } from '../../common/types';

interface OutlineDescendant {
    artifactId: string;
    artifact: ElectricArtifact;
    createdAt: string;
    title?: string;
}

interface UseOutlineDescendantsResult {
    hasOutlineDescendants: boolean;
    outlineDescendants: OutlineDescendant[];
    latestOutline: OutlineDescendant | null;
    isLoading: boolean;
    error: Error | null;
}

/**
 * Hook to detect if a brainstorm idea has outline artifact descendants
 * @param brainstormArtifactId - The brainstorm idea artifact ID to check
 * @returns Information about outline descendants
 */
export function useOutlineDescendants(brainstormArtifactId: string): UseOutlineDescendantsResult {
    const projectData = useProjectData();

    const result = useMemo((): UseOutlineDescendantsResult => {
        if (projectData.isLoading) {
            return {
                hasOutlineDescendants: false,
                outlineDescendants: [],
                latestOutline: null,
                isLoading: true,
                error: null
            };
        }

        if (projectData.error) {
            return {
                hasOutlineDescendants: false,
                outlineDescendants: [],
                latestOutline: null,
                isLoading: false,
                error: projectData.error
            };
        }

        try {
            // Use the globally shared lineage graph from context
            const graph = projectData.lineageGraph;

            // Find all outline artifacts that can be traced back to this brainstorm idea
            const outlineDescendants: OutlineDescendant[] = [];

            // Get all outline artifacts
            const outlineArtifacts = projectData.artifacts.filter(artifact =>
                artifact.schema_type === 'outline_schema' ||
                artifact.type === 'outline_response' ||
                artifact.type === 'outline'
            );

            // For each outline artifact, trace back through the lineage to see if it connects to our brainstorm idea
            for (const outlineArtifact of outlineArtifacts) {
                if (canTraceBackToBrainstormIdea(outlineArtifact.id, brainstormArtifactId, graph)) {
                    let title: string | undefined;

                    // Extract title from outline data
                    try {
                        const outlineData = JSON.parse(outlineArtifact.data);
                        title = outlineData.title;
                    } catch (error) {
                        console.warn('Failed to parse outline data for title:', error);
                    }

                    outlineDescendants.push({
                        artifactId: outlineArtifact.id,
                        artifact: outlineArtifact,
                        createdAt: outlineArtifact.created_at,
                        title
                    });
                }
            }

            // Sort by creation date (newest first)
            outlineDescendants.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            const latestOutline = outlineDescendants[0] || null;

            return {
                hasOutlineDescendants: outlineDescendants.length > 0,
                outlineDescendants,
                latestOutline,
                isLoading: false,
                error: null
            };

        } catch (error) {
            console.error('[useOutlineDescendants] Error:', error);
            return {
                hasOutlineDescendants: false,
                outlineDescendants: [],
                latestOutline: null,
                isLoading: false,
                error: error instanceof Error ? error : new Error('Failed to detect outline descendants')
            };
        }
    }, [
        brainstormArtifactId,
        projectData.isLoading,
        projectData.error,
        projectData.artifacts,
        projectData.lineageGraph
    ]);

    return result;
}

/**
 * Recursively trace back through the lineage graph to see if an outline can be traced to a brainstorm idea
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