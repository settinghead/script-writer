import { useState, useMemo } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';
import {
    findLatestArtifact,
    extractEffectiveBrainstormIdeas,
    convertEffectiveIdeasToIdeaWithTitle,
    findMainWorkflowPath,
    findParentArtifactsBySchemaType,
    type LineageNode,
    type LineageResolutionResult,
    type EffectiveBrainstormIdea,
    type IdeaWithTitle,
    type WorkflowNode
} from '../../common/transform-artifact-framework/lineageResolution';

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
    { sourceArtifactId, path, options }: { sourceArtifactId: string | null; path: string; options: UseLineageResolutionOptions; }): UseLineageResolutionResult | "pending" | "error" {
    const { enabled } = options;
    const projectData = useProjectData();

    const [error, setError] = useState<Error | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Use the globally shared lineage graph from context
    const lineageResult = useMemo((): LineageResolutionResult | "pending" | "error" => {
        // Return early if disabled, no source artifact, or graph not ready
        if (!enabled || !sourceArtifactId || !projectData.lineageGraph) {
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
            if (projectData.lineageGraph === "pending") {
                return "pending" as const;
            }
            if (projectData.lineageGraph === "error" || projectData.artifacts === "pending" || projectData.artifacts === "error") {
                return "error" as const;
            }
            const result = findLatestArtifact(sourceArtifactId, path, projectData.lineageGraph, projectData.artifacts);

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
    }, [enabled, sourceArtifactId, path, projectData.lineageGraph, projectData.artifacts]);

    // Determine loading state
    const isLoading = projectData.isLoading || isProcessing;

    // Extract results

    if (lineageResult === "pending") {
        return "pending" as const;
    }
    if (lineageResult === "error") {
        return "error" as const;
    }
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
    ideas: EffectiveBrainstormIdea[] | "pending" | "error";
    isLoading: boolean;
    error: Error | null;
} {
    const projectData = useProjectData();
    const [error, setError] = useState<Error | null>(null);

    const ideas = useMemo((): EffectiveBrainstormIdea[] | "pending" | "error" => {
        if (projectData.isLoading) {
            return [];
        }

        try {
            setError(null);
            if (projectData.artifacts === "pending" || projectData.transforms === "pending" || projectData.humanTransforms === "pending" || projectData.transformInputs === "pending" || projectData.transformOutputs === "pending") {
                return "pending" as const;
            }
            if (projectData.artifacts === "error" || projectData.transforms === "error" || projectData.humanTransforms === "error" || projectData.transformInputs === "error" || projectData.transformOutputs === "error") {
                return "error" as const;
            }

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
export function useLatestBrainstormIdeas(): IdeaWithTitle[] | "pending" | "error" {
    const { ideas, isLoading, error } = useEffectiveBrainstormIdeas();
    const projectData = useProjectData();

    return useMemo(() => {
        if (ideas === "pending" || ideas === "error") {
            return ideas;
        }

        if (isLoading) {
            return "pending" as const;
        }

        if (error) {
            return "error" as const;
        }
        if (projectData.artifacts === "pending" || projectData.artifacts === "error") {
            return "pending" as const;
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
    workflowNodes: WorkflowNode[] | "pending" | "error";
    isLoading: boolean;
    error: Error | null;
} {
    const projectData = useProjectData();
    const [error, setError] = useState<Error | null>(null);

    const workflowNodes = useMemo((): WorkflowNode[] | "pending" | "error" => {
        if (!projectData.lineageGraph || projectData.lineageGraph === "pending") {
            return "pending" as const;
        }

        try {
            setError(null);
            if (projectData.artifacts === "pending" || projectData.artifacts === "error" || projectData.lineageGraph === "error") {
                return "error" as const;
            }

            // Use the globally shared lineage graph to get workflow nodes
            return findMainWorkflowPath(projectData.artifacts, projectData.lineageGraph);

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Workflow nodes computation failed');
            console.error('[useWorkflowNodes] Error:', error);
            setError(error);
            return "pending" as const;
        }
    }, [projectData.lineageGraph, projectData.artifacts]);

    return {
        workflowNodes,
        isLoading: projectData.isLoading,
        error: projectData.error || error
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

/**
 * Hook to find characters from outline artifacts in the lineage graph
 * This searches backwards from the given artifact to find outline artifacts and extract character data
 */
export function useCharactersFromLineage(sourceArtifactId: string | null): {
    characters: string[];
    isLoading: boolean;
    error: Error | null;
} {
    const projectData = useProjectData();
    const [error, setError] = useState<Error | null>(null);

    const characters = useMemo((): string[] => {
        if (!sourceArtifactId || !projectData.lineageGraph) {
            return [];
        }

        try {
            setError(null);

            if (projectData.lineageGraph === "pending" || projectData.artifacts === "pending") {
                return [];
            }

            if (projectData.lineageGraph === "error" || projectData.artifacts === "error") {
                return [];
            }

            // Find parent outline artifacts using lineage graph
            const outlineArtifacts = findParentArtifactsBySchemaType(
                sourceArtifactId,
                'outline_schema',
                projectData.lineageGraph,
                projectData.artifacts
            );

            // Also check for outline_input_schema (human-transformed outlines)
            const outlineInputArtifacts = findParentArtifactsBySchemaType(
                sourceArtifactId,
                'outline_input_schema',
                projectData.lineageGraph,
                projectData.artifacts
            );

            // Also check for outline_settings_schema (outline settings)
            const outlineSettingsArtifacts = findParentArtifactsBySchemaType(
                sourceArtifactId,
                'outline_settings_schema',
                projectData.lineageGraph,
                projectData.artifacts
            );

            // Combine all types of outline artifacts
            const allOutlineArtifacts = [...outlineArtifacts, ...outlineInputArtifacts, ...outlineSettingsArtifacts];

            // Extract character names from all found outline artifacts
            const characterNames: string[] = [];

            for (const artifact of allOutlineArtifacts) {
                try {
                    const data = typeof artifact.data === 'string' ? JSON.parse(artifact.data) : artifact.data;
                    if (data.characters && Array.isArray(data.characters)) {
                        data.characters.forEach((char: any) => {
                            if (char.name && !characterNames.includes(char.name)) {
                                characterNames.push(char.name);
                            }
                        });
                    }
                } catch (parseError) {
                    // Ignore parsing errors for individual artifacts
                    console.warn('Failed to parse outline artifact data:', parseError);
                }
            }

            return characterNames;

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to extract characters from lineage');
            console.error('[useCharactersFromLineage] Error:', error);
            setError(error);
            return [];
        }
    }, [sourceArtifactId, projectData.lineageGraph, projectData.artifacts]);

    return {
        characters,
        isLoading: projectData.isLoading,
        error: projectData.error || error
    };
}

