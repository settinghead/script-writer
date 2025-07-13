import { useState, useMemo } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';
import {
    findLatestJsonDoc,
    extractEffectiveBrainstormIdeas,
    convertEffectiveIdeasToIdeaWithTitle,
    findMainWorkflowPath,
    findParentJsonDocsBySchemaType,
    hasHumanTransformForPath,
    type LineageNode,
    type LineageResolutionResult,
    type EffectiveBrainstormIdea,
    type IdeaWithTitle,
    type WorkflowNode
} from '../../common/transform-jsonDoc-framework/lineageResolution';

interface UseLineageResolutionOptions {
    enabled: boolean; // Caller must explicitly specify if enabled
}

interface UseLineageResolutionResult {
    latestJsonDocId: string | null;
    resolvedPath: string;
    lineagePath: LineageNode[];
    depth: number;
    isLoading: boolean;
    error: Error | null;
    // Additional debugging info
    hasLineage: boolean;
    originalJsonDocId: string;
}

/**
 * Hook to resolve the latest jsonDoc in a lineage chain
 * 
 * @param sourceJsonDocId - The original jsonDoc ID to start resolution from
 * @param path - Path for brainstorm ideas (e.g., "[0]", "[1]", "$")
 * @param options - Configuration options (must be provided)
 * @returns Lineage resolution result with latest jsonDoc ID
 */
export function useLineageResolution(
    { sourceJsonDocId, path, options }: { sourceJsonDocId: string | null; path: string; options: UseLineageResolutionOptions; }): UseLineageResolutionResult | "pending" | "error" {
    const { enabled } = options;
    const projectData = useProjectData();

    const [error, setError] = useState<Error | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Use the globally shared lineage graph from context
    const lineageResult = useMemo((): LineageResolutionResult | "pending" | "error" => {
        // Return early if disabled, no source jsonDoc, or graph not ready
        if (!enabled || !sourceJsonDocId || !projectData.lineageGraph) {
            return {
                jsonDocId: sourceJsonDocId,
                path: path,
                depth: 0,
                lineagePath: []
            };
        }

        try {
            setError(null);
            setIsProcessing(true);

            // Resolve the latest jsonDoc for the given path using the shared graph
            if (projectData.lineageGraph === "pending") {
                return "pending" as const;
            }
            if (projectData.lineageGraph === "error" || projectData.jsonDocs === "pending" || projectData.jsonDocs === "error") {
                return "error" as const;
            }
            const result = findLatestJsonDoc(sourceJsonDocId, path, projectData.lineageGraph, projectData.jsonDocs);

            setIsProcessing(false);
            return result;

        } catch (err) {
            setIsProcessing(false);
            const error = err instanceof Error ? err : new Error('Lineage resolution failed');
            console.error('[useLineageResolution] Error resolving lineage:', error);
            setError(error);

            // Return fallback result
            return {
                jsonDocId: sourceJsonDocId,
                path: path,
                depth: 0,
                lineagePath: []
            };
        }
    }, [enabled, sourceJsonDocId, path, projectData.lineageGraph, projectData.jsonDocs]);

    // Determine loading state
    const isLoading = projectData.isLoading || isProcessing;

    // Extract results

    if (lineageResult === "pending") {
        return "pending" as const;
    }
    if (lineageResult === "error") {
        return "error" as const;
    }
    const latestJsonDocId = lineageResult.jsonDocId;
    const hasLineage = lineageResult.lineagePath.length > 1; // More than just the source node

    return {
        latestJsonDocId,
        resolvedPath: lineageResult.path || path,  // Use the resolved path or fallback to input path
        lineagePath: lineageResult.lineagePath,
        depth: lineageResult.depth,
        isLoading,
        error: projectData.error || error,
        hasLineage,
        originalJsonDocId: sourceJsonDocId || ''
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
            if (projectData.jsonDocs === "pending" || projectData.transforms === "pending" || projectData.humanTransforms === "pending" || projectData.transformInputs === "pending" || projectData.transformOutputs === "pending") {
                return "pending" as const;
            }
            if (projectData.jsonDocs === "error" || projectData.transforms === "error" || projectData.humanTransforms === "error" || projectData.transformInputs === "error" || projectData.transformOutputs === "error") {
                return "error" as const;
            }

            // Use the pure function to extract effective brainstorm ideas
            return extractEffectiveBrainstormIdeas(
                projectData.jsonDocs,
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
    }, [projectData.isLoading, projectData.jsonDocs, projectData.transforms, projectData.humanTransforms, projectData.transformInputs, projectData.transformOutputs]);

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
        if (projectData.jsonDocs === "pending" || projectData.jsonDocs === "error") {
            return "pending" as const;
        }

        // Use the pure function to convert EffectiveBrainstormIdea[] to IdeaWithTitle[]
        return convertEffectiveIdeasToIdeaWithTitle(ideas, projectData.jsonDocs);
    }, [ideas, isLoading, error, projectData.jsonDocs]);
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
            if (projectData.jsonDocs === "pending" || projectData.jsonDocs === "error" || projectData.lineageGraph === "error") {
                return "error" as const;
            }

            // Use the globally shared lineage graph to get workflow nodes
            return findMainWorkflowPath(projectData.jsonDocs, projectData.lineageGraph);

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Workflow nodes computation failed');
            console.error('[useWorkflowNodes] Error:', error);
            setError(error);
            return "pending" as const;
        }
    }, [projectData.lineageGraph, projectData.jsonDocs]);

    return {
        workflowNodes,
        isLoading: projectData.isLoading,
        error: projectData.error || error
    };
}

/**
 * Hook to detect if the project is in initial mode (no jsonDocs)
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

            // Check if there are any jsonDocs in the project
            const hasJsonDocs = projectData.jsonDocs && projectData.jsonDocs.length > 0;

            // Initial mode means no jsonDocs exist
            return !hasJsonDocs;

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to detect initial mode');
            console.error('[useProjectInitialMode] Error:', error);
            setError(error);
            return false; // Default to false on error
        }
    }, [projectData.isLoading, projectData.jsonDocs]);

    return {
        isInitialMode,
        isLoading: projectData.isLoading,
        error: projectData.error || error
    };
}

/**
 * Hook to find characters from outline jsonDocs in the lineage graph
 * This searches backwards from the given jsonDoc to find outline jsonDocs and extract character data
 */
export function useCharactersFromLineage(sourceJsonDocId: string | null): {
    characters: string[];
    isLoading: boolean;
    error: Error | null;
} {
    const projectData = useProjectData();
    const [error, setError] = useState<Error | null>(null);

    const characters = useMemo((): string[] => {
        if (!sourceJsonDocId || !projectData.lineageGraph) {
            return [];
        }

        try {
            setError(null);

            if (projectData.lineageGraph === "pending" || projectData.jsonDocs === "pending") {
                return [];
            }

            if (projectData.lineageGraph === "error" || projectData.jsonDocs === "error") {
                return [];
            }


            // Also check for outline_settings (outline settings)
            const outlineSettingsJsonDocs = findParentJsonDocsBySchemaType(
                sourceJsonDocId, 'outline_settings',
                projectData.lineageGraph,
                projectData.jsonDocs
            );

            // Combine all types of outline jsonDocs
            const allOutlineJsonDocs = [...outlineSettingsJsonDocs];

            // Extract character names from all found outline jsonDocs
            const characterNames: string[] = [];

            for (const jsonDoc of allOutlineJsonDocs) {
                try {
                    const data = typeof jsonDoc.data === 'string' ? JSON.parse(jsonDoc.data) : jsonDoc.data;
                    if (data.characters && Array.isArray(data.characters)) {
                        data.characters.forEach((char: any) => {
                            if (char.name && !characterNames.includes(char.name)) {
                                characterNames.push(char.name);
                            }
                        });
                    }
                } catch (parseError) {
                    // Ignore parsing errors for individual jsonDocs
                    console.warn('Failed to parse outline jsonDoc data:', parseError);
                }
            }

            return characterNames;

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to extract characters from lineage');
            console.error('[useCharactersFromLineage] Error:', error);
            setError(error);
            return [];
        }
    }, [sourceJsonDocId, projectData.lineageGraph, projectData.jsonDocs]);

    return {
        characters,
        isLoading: projectData.isLoading,
        error: projectData.error || error
    };
}

/**
 * Hook to check if a specific path has a human transform override
 */
export function useStageOverride(
    chroniclesJsonDocId: string | null,
    stagePath: string | null
): {
    hasOverride: boolean;
    overrideJsonDocId: string | null;
    isLoading: boolean;
    error: Error | null;
} {
    const projectData = useProjectData();
    const [error, setError] = useState<Error | null>(null);

    const result = useMemo(() => {
        if (!chroniclesJsonDocId || !stagePath || !projectData.lineageGraph) {
            return {
                hasOverride: false,
                overrideJsonDocId: null
            };
        }

        try {
            setError(null);

            if (projectData.lineageGraph === "pending" || projectData.lineageGraph === "error") {
                return {
                    hasOverride: false,
                    overrideJsonDocId: null
                };
            }

            // Check if this stage path has a human transform
            const transformResult = hasHumanTransformForPath(
                chroniclesJsonDocId,
                stagePath,
                projectData.lineageGraph
            );

            return {
                hasOverride: transformResult.hasTransform,
                overrideJsonDocId: transformResult.overrideJsonDocId || null
            };

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to check stage override');
            console.error('[useStageOverride] Error:', error);
            setError(error);
            return {
                hasOverride: false,
                overrideJsonDocId: null
            };
        }
    }, [chroniclesJsonDocId, stagePath, projectData.lineageGraph]);

    return {
        ...result,
        isLoading: projectData.isLoading,
        error: projectData.error || error
    };
}

