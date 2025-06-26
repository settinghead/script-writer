import { useState, useEffect, useMemo } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';
import {
    buildLineageGraph,
    findLatestArtifact,
    findEffectiveBrainstormIdeas,
    extractEffectiveBrainstormIdeas,
    convertEffectiveIdeasToIdeaWithTitle,
    type LineageNode,
    type LineageResolutionResult,
    type EffectiveBrainstormIdea,
    type IdeaWithTitle
} from '../../common/utils/lineageResolution';

interface UseLineageResolutionOptions {
    enabled: boolean; // Caller must explicitly specify if enabled
}

interface UseLineageResolutionResult {
    latestArtifactId: string | null;
    resolvedPath: string;
    lineagePath: LineageNode[];
    depth: number;
    isLoading: boolean;
    error: Error | null;
    // Additional debugging info
    hasLineage: boolean;
    originalArtifactId: string;
}

/**
 * Hook to resolve the latest artifact in a lineage chain
 * 
 * @param sourceArtifactId - The original artifact ID to start resolution from
 * @param path - Path for brainstorm ideas (e.g., "[0]", "[1]", "$")
 * @param options - Configuration options (must be provided)
 * @returns Lineage resolution result with latest artifact ID
 */
export function useLineageResolution(
    { sourceArtifactId, path, options }: { sourceArtifactId: string | null; path: string; options: UseLineageResolutionOptions; }): UseLineageResolutionResult {
    const { enabled } = options;
    const projectData = useProjectData();

    const [error, setError] = useState<Error | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Build lineage graph from project data
    const lineageResult = useMemo((): LineageResolutionResult => {
        // Return early if disabled or no source artifact
        if (!enabled || !sourceArtifactId || projectData.isLoading) {
            return {
                artifactId: sourceArtifactId,
                path: path,
                depth: 0,
                lineagePath: []
            };
        }

        try {
            setError(null);
            setIsProcessing(true);

            // Get all project data needed for lineage resolution
            const artifacts = projectData.artifacts;
            const transforms = projectData.transforms;
            const humanTransforms = projectData.humanTransforms;
            const transformInputs = projectData.transformInputs;
            const transformOutputs = projectData.transformOutputs;

            // Build the lineage graph
            const graph = buildLineageGraph(
                artifacts,
                transforms,
                humanTransforms,
                transformInputs,
                transformOutputs
            );

            // Resolve the latest artifact for the given path
            const result = findLatestArtifact(sourceArtifactId, path, graph);

            setIsProcessing(false);
            return result;

        } catch (err) {
            setIsProcessing(false);
            const error = err instanceof Error ? err : new Error('Lineage resolution failed');
            console.error('[useLineageResolution] Error resolving lineage:', error);
            setError(error);

            // Return fallback result
            return {
                artifactId: sourceArtifactId,
                path: path,
                depth: 0,
                lineagePath: []
            };
        }
    }, [enabled, sourceArtifactId, path, projectData.isLoading, projectData.artifacts, projectData.transforms, projectData.humanTransforms, projectData.transformInputs, projectData.transformOutputs]);

    // Determine loading state
    const isLoading = projectData.isLoading || isProcessing;

    // Extract results
    const latestArtifactId = lineageResult.artifactId;
    const hasLineage = lineageResult.lineagePath.length > 1; // More than just the source node

    return {
        latestArtifactId,
        resolvedPath: lineageResult.path || path,  // Use the resolved path or fallback to input path
        lineagePath: lineageResult.lineagePath,
        depth: lineageResult.depth,
        isLoading,
        error: projectData.error || error,
        hasLineage,
        originalArtifactId: sourceArtifactId || ''
    };
}



/**
 * Hook to get all effective brainstorm ideas using principled lineage graph traversal
 * This replaces the patchy approach with proper graph-based resolution
 */
export function useEffectiveBrainstormIdeas(): {
    ideas: EffectiveBrainstormIdea[];
    isLoading: boolean;
    error: Error | null;
} {
    const projectData = useProjectData();
    const [error, setError] = useState<Error | null>(null);

    const ideas = useMemo((): EffectiveBrainstormIdea[] => {
        if (projectData.isLoading) {
            return [];
        }

        try {
            setError(null);

            // Use the pure function to extract effective brainstorm ideas
            return extractEffectiveBrainstormIdeas(
                projectData.artifacts,
                projectData.transforms,
                projectData.humanTransforms,
                projectData.transformInputs,
                projectData.transformOutputs
            );

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Effective brainstorm ideas resolution failed');
            console.error('[useEffectiveBrainstormIdeas] Error:', error);
            setError(error);
            return [];
        }
    }, [projectData.isLoading, projectData.artifacts, projectData.transforms, projectData.humanTransforms, projectData.transformInputs, projectData.transformOutputs]);

    return {
        ideas,
        isLoading: projectData.isLoading,
        error: projectData.error || error
    };
}/**
 * Hook to get effective brainstorm ideas using principled lineage graph traversal
 */
export function useLatestBrainstormIdeas(): IdeaWithTitle[] {
    const { ideas, isLoading, error } = useEffectiveBrainstormIdeas();
    const projectData = useProjectData();

    return useMemo(() => {
        if (isLoading || error) {
            return [];
        }

        // Use the pure function to convert EffectiveBrainstormIdea[] to IdeaWithTitle[]
        return convertEffectiveIdeasToIdeaWithTitle(ideas, projectData.artifacts);
    }, [ideas, isLoading, error, projectData.artifacts]);
}

