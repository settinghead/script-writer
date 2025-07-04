import { useState, useEffect, useMemo } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';
import {
    buildLineageGraph,
    findLatestArtifact,
    findEffectiveBrainstormIdeas,
    extractEffectiveBrainstormIdeas,
    convertEffectiveIdeasToIdeaWithTitle,
    findMainWorkflowPath,
    type LineageNode,
    type LineageResolutionResult,
    type EffectiveBrainstormIdea,
    type IdeaWithTitle,
    type WorkflowNode
} from '../../common/transform-artifact-framework/lineageResolution';

interface UseLineageGraphResult {
    graph: any; // The lineage graph
    isLoading: boolean;
    error: Error | null;
}

interface UseLineageResolutionOptions {
    enabled: boolean; // Caller must explicitly specify if enabled
}

/**
 * Hook to get the memoized lineage graph for the current project
 * This is the centralized way to access the lineage graph to avoid rebuilding it multiple times
 */
export function useLineageGraph(): UseLineageGraphResult {
    const projectData = useProjectData();
    const [error, setError] = useState<Error | null>(null);

    const graph = useMemo(() => {
        if (projectData.isLoading) {
            return null;
        }

        try {
            setError(null);

            // Build the lineage graph from project data
            return buildLineageGraph(
                projectData.artifacts,
                projectData.transforms,
                projectData.humanTransforms,
                projectData.transformInputs,
                projectData.transformOutputs
            );

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to build lineage graph');
            console.error('[useLineageGraph] Error building graph:', error);
            setError(error);
            return null;
        }
    }, [
        projectData.isLoading,
        projectData.artifacts,
        projectData.transforms,
        projectData.humanTransforms,
        projectData.transformInputs,
        projectData.transformOutputs
    ]);

    return {
        graph,
        isLoading: projectData.isLoading,
        error: projectData.error || error
    };
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
    const { graph, isLoading: graphLoading, error: graphError } = useLineageGraph();
    const projectData = useProjectData();

    const [error, setError] = useState<Error | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Use the shared lineage graph for resolution
    const lineageResult = useMemo((): LineageResolutionResult => {
        // Return early if disabled, no source artifact, or graph not ready
        if (!enabled || !sourceArtifactId || !graph) {
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

            // Resolve the latest artifact for the given path using the shared graph
            const result = findLatestArtifact(sourceArtifactId, path, graph, projectData.artifacts);

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
    }, [enabled, sourceArtifactId, path, graph, projectData.artifacts]);

    // Determine loading state
    const isLoading = graphLoading || isProcessing;

    // Extract results
    const latestArtifactId = lineageResult.artifactId;
    const hasLineage = lineageResult.lineagePath.length > 1; // More than just the source node

    return {
        latestArtifactId,
        resolvedPath: lineageResult.path || path,  // Use the resolved path or fallback to input path
        lineagePath: lineageResult.lineagePath,
        depth: lineageResult.depth,
        isLoading,
        error: graphError || error,
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
}

/**
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

/**
 * Hook to get workflow nodes for the current project
 * This represents the main workflow path from brainstorm to outline to episodes
 */
export function useWorkflowNodes(): {
    workflowNodes: WorkflowNode[];
    isLoading: boolean;
    error: Error | null;
} {
    const projectData = useProjectData();
    const { graph, isLoading: graphLoading, error: graphError } = useLineageGraph();
    const [error, setError] = useState<Error | null>(null);

    const workflowNodes = useMemo((): WorkflowNode[] => {
        if (!graph) {
            return [];
        }

        try {
            setError(null);

            // Use the shared lineage graph to get workflow nodes
            return findMainWorkflowPath(projectData.artifacts, graph);

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Workflow nodes computation failed');
            console.error('[useWorkflowNodes] Error:', error);
            setError(error);
            return [];
        }
    }, [graph, projectData.artifacts]);

    return {
        workflowNodes,
        isLoading: graphLoading,
        error: graphError || error
    };
}

/**
 * Hook to detect if the project is in initial mode (no artifacts)
 * This is used by the chat UI to determine if it should show the special initial mode
 */
export function useProjectInitialMode(): {
    isInitialMode: boolean;
    isLoading: boolean;
    error: Error | null;
} {
    const projectData = useProjectData();
    const [error, setError] = useState<Error | null>(null);

    const isInitialMode = useMemo(() => {
        if (projectData.isLoading) {
            return false; // Default to false while loading
        }

        try {
            setError(null);

            // Check if there are any artifacts in the project
            const hasArtifacts = projectData.artifacts && projectData.artifacts.length > 0;

            // Initial mode means no artifacts exist
            return !hasArtifacts;

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to detect initial mode');
            console.error('[useProjectInitialMode] Error:', error);
            setError(error);
            return false; // Default to false on error
        }
    }, [projectData.isLoading, projectData.artifacts]);

    return {
        isInitialMode,
        isLoading: projectData.isLoading,
        error: projectData.error || error
    };
}

