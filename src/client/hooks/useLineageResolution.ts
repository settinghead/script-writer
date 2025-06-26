import { useState, useEffect, useMemo } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';
import {
    buildLineageGraph,
    findLatestArtifact,
    findEffectiveBrainstormIdeas,
    type LineageNode,
    type LineageResolutionResult,
    type EffectiveBrainstormIdea
} from '../../common/utils/lineageResolution';

interface UseLineageResolutionOptions {
    enabled?: boolean; // Allow disabling the hook
}

interface UseLineageResolutionResult {
    latestArtifactId: string | null;
    resolvedPath?: string;
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
 * @param path - Optional path for brainstorm ideas (e.g., "[0]", "[1]")
 * @param options - Configuration options
 * @returns Lineage resolution result with latest artifact ID
 */
export function useLineageResolution(
    { sourceArtifactId, path, options = {} }: { sourceArtifactId: string | null; path?: string; options?: UseLineageResolutionOptions; }): UseLineageResolutionResult {
    const { enabled = true } = options;
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
        resolvedPath: lineageResult.path,
        lineagePath: lineageResult.lineagePath,
        depth: lineageResult.depth,
        isLoading,
        error: projectData.error || error,
        hasLineage,
        originalArtifactId: sourceArtifactId || ''
    };
}

/**
 * Hook to resolve lineage for multiple artifacts at once
 * Useful for brainstorm collections where you need to resolve multiple ideas
 */
export function useMultipleLineageResolution(
    sourceArtifactId: string | null,
    paths: string[],
    options: UseLineageResolutionOptions = {}
): Record<string, UseLineageResolutionResult> {
    const { enabled = true } = options;

    // Use individual hooks for each path
    const results: Record<string, UseLineageResolutionResult> = {};

    paths.forEach(path => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        results[path] = useLineageResolution({ sourceArtifactId, path, options: { enabled } });
    });

    return results;
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

            // Use principled resolution to find all effective brainstorm ideas
            return findEffectiveBrainstormIdeas(graph, artifacts);

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
}
