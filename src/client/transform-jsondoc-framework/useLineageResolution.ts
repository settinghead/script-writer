import { useState, useMemo } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';
import {
    findLatestJsondoc,
    extractEffectiveBrainstormIdeas,
    convertEffectiveIdeasToIdeaWithTitle,
    findMainWorkflowPath,
    findParentJsondocsBySchemaType,
    hasHumanTransformForPath,
    findEffectiveBrainstormIdeas,
    buildLineageGraph,
    type LineageNode,
    type LineageResolutionResult,
    type EffectiveBrainstormIdea,
    type WorkflowNode
} from '../../common/transform-jsondoc-framework/lineageResolution';
import { IdeaWithTitle } from '../../common/types';

interface UseLineageResolutionOptions {
    enabled: boolean; // Caller must explicitly specify if enabled
}

interface UseLineageResolutionResult {
    latestJsondocId: string | null;
    resolvedPath: string;
    lineagePath: LineageNode[];
    depth: number;
    isLoading: boolean;
    error: Error | null;
    // Additional debugging info
    hasLineage: boolean;
    originalJsondocId: string;
}

/**
 * Hook to resolve the latest jsondoc in a lineage chain
 * 
 * @param sourceJsondocId - The original jsondoc ID to start resolution from
 * @param path - Path for brainstorm ideas (e.g., "[0]", "[1]", "$")
 * @param options - Configuration options (must be provided)
 * @returns Lineage resolution result with latest jsondoc ID
 */
export function useLineageResolution(
    { sourceJsondocId, path, options }: { sourceJsondocId: string | null; path: string; options: UseLineageResolutionOptions; }): UseLineageResolutionResult | "pending" | "error" {
    const { enabled } = options;
    const projectData = useProjectData();

    const [error, setError] = useState<Error | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Use the globally shared lineage graph from context
    const lineageResult = useMemo((): LineageResolutionResult | "pending" | "error" => {
        // Return early if disabled, no source jsondoc, or graph not ready
        if (!enabled || !sourceJsondocId || !projectData.lineageGraph) {
            return {
                jsondocId: sourceJsondocId,
                path: path,
                depth: 0,
                lineagePath: []
            };
        }

        try {
            setError(null);
            setIsProcessing(true);

            // Resolve the latest jsondoc for the given path using the shared graph
            if (projectData.lineageGraph === "pending") {
                return "pending" as const;
            }
            if (projectData.lineageGraph === "error" || projectData.jsondocs === "pending" || projectData.jsondocs === "error") {
                return "error" as const;
            }
            const result = findLatestJsondoc(sourceJsondocId, path, projectData.lineageGraph, projectData.jsondocs);

            setIsProcessing(false);
            return result;

        } catch (err) {
            setIsProcessing(false);
            const error = err instanceof Error ? err : new Error('Lineage resolution failed');
            console.error('[useLineageResolution] Error resolving lineage:', error);
            setError(error);

            // Return fallback result
            return {
                jsondocId: sourceJsondocId,
                path: path,
                depth: 0,
                lineagePath: []
            };
        }
    }, [enabled, sourceJsondocId, path, projectData.lineageGraph, projectData.jsondocs]);

    // Determine loading state
    const isLoading = projectData.isLoading || isProcessing;

    // Extract results

    if (lineageResult === "pending") {
        return "pending" as const;
    }
    if (lineageResult === "error") {
        return "error" as const;
    }
    const latestJsondocId = lineageResult.jsondocId;
    const hasLineage = lineageResult.lineagePath.length > 1; // More than just the source node

    return {
        latestJsondocId,
        resolvedPath: lineageResult.path || path,  // Use the resolved path or fallback to input path
        lineagePath: lineageResult.lineagePath,
        depth: lineageResult.depth,
        isLoading,
        error: projectData.error || error,
        hasLineage,
        originalJsondocId: sourceJsondocId || ''
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
            if (projectData.jsondocs === "pending" || projectData.transforms === "pending" || projectData.humanTransforms === "pending" || projectData.transformInputs === "pending" || projectData.transformOutputs === "pending") {
                return "pending" as const;
            }
            if (projectData.jsondocs === "error" || projectData.transforms === "error" || projectData.humanTransforms === "error" || projectData.transformInputs === "error" || projectData.transformOutputs === "error") {
                return "error" as const;
            }

            // Use the pure function to extract effective brainstorm ideas
            return extractEffectiveBrainstormIdeas(
                projectData.jsondocs,
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
    }, [projectData.isLoading, projectData.jsondocs, projectData.transforms, projectData.humanTransforms, projectData.transformInputs, projectData.transformOutputs]);

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
        console.log('[useLatestBrainstormIdeas] Computing with:', {
            ideas: ideas === "pending" ? "pending" : ideas === "error" ? "error" : `${ideas.length} ideas`,
            isLoading,
            error: error?.message,
            jsondocsState: projectData.jsondocs === "pending" ? "pending" : projectData.jsondocs === "error" ? "error" : `${projectData.jsondocs.length} jsondocs`
        });

        if (ideas === "pending" || ideas === "error") {
            console.log('[useLatestBrainstormIdeas] Returning early due to ideas state:', ideas);
            return ideas;
        }

        if (isLoading) {
            console.log('[useLatestBrainstormIdeas] Returning pending due to loading');
            return "pending" as const;
        }

        if (error) {
            console.log('[useLatestBrainstormIdeas] Returning error due to error:', error.message);
            return "error" as const;
        }

        if (projectData.jsondocs === "pending" || projectData.jsondocs === "error") {
            console.log('[useLatestBrainstormIdeas] Returning pending due to jsondocs state:', projectData.jsondocs);
            return "pending" as const;
        }

        console.log('[useLatestBrainstormIdeas] Converting effective ideas to IdeaWithTitle:', {
            effectiveIdeasCount: ideas.length,
            jsondocsCount: projectData.jsondocs.length
        });

        // Use the pure function to convert EffectiveBrainstormIdea[] to IdeaWithTitle[]
        const result = convertEffectiveIdeasToIdeaWithTitle(ideas, projectData.jsondocs);

        console.log('[useLatestBrainstormIdeas] Final result:', {
            resultCount: result.length
        });

        return result;
    }, [ideas, isLoading, error, projectData.jsondocs]);
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
            if (projectData.jsondocs === "pending" || projectData.jsondocs === "error" || projectData.lineageGraph === "error") {
                return "error" as const;
            }

            // Use the globally shared lineage graph to get workflow nodes
            return findMainWorkflowPath(projectData.jsondocs, projectData.lineageGraph);

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Workflow nodes computation failed');
            console.error('[useWorkflowNodes] Error:', error);
            setError(error);
            return "pending" as const;
        }
    }, [projectData.lineageGraph, projectData.jsondocs]);

    return {
        workflowNodes,
        isLoading: projectData.isLoading,
        error: projectData.error || error
    };
}

/**
 * Hook to detect if the project is in initial mode (no jsondocs)
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

            // Check if there are any jsondocs in the project
            const hasJsondocs = projectData.jsondocs && projectData.jsondocs.length > 0;

            // Initial mode means no jsondocs exist
            return !hasJsondocs;

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to detect initial mode');
            console.error('[useProjectInitialMode] Error:', error);
            setError(error);
            return false; // Default to false on error
        }
    }, [projectData.isLoading, projectData.jsondocs]);

    return {
        isInitialMode,
        isLoading: projectData.isLoading,
        error: projectData.error || error
    };
}

/**
 * Hook to find characters from outline jsondocs in the lineage graph
 * This searches backwards from the given jsondoc to find outline jsondocs and extract character data
 */
export function useCharactersFromLineage(sourceJsondocId: string | null): {
    characters: string[];
    isLoading: boolean;
    error: Error | null;
} {
    const projectData = useProjectData();
    const [error, setError] = useState<Error | null>(null);

    const characters = useMemo((): string[] => {
        if (!sourceJsondocId || !projectData.lineageGraph) {
            return [];
        }

        try {
            setError(null);

            if (projectData.lineageGraph === "pending" || projectData.jsondocs === "pending") {
                return [];
            }

            if (projectData.lineageGraph === "error" || projectData.jsondocs === "error") {
                return [];
            }


            // Also check for 剧本设定 (剧本设定)
            const outlineSettingsJsondocs = findParentJsondocsBySchemaType(
                sourceJsondocId, '剧本设定',
                projectData.lineageGraph,
                projectData.jsondocs
            );

            // Combine all types of outline jsondocs
            const allOutlineJsondocs = [...outlineSettingsJsondocs];

            // Extract character names from all found outline jsondocs
            const characterNames: string[] = [];

            for (const jsondoc of allOutlineJsondocs) {
                try {
                    const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
                    if (data.characters && Array.isArray(data.characters)) {
                        data.characters.forEach((char: any) => {
                            if (char.name && !characterNames.includes(char.name)) {
                                characterNames.push(char.name);
                            }
                        });
                    }
                } catch (parseError) {
                    // Ignore parsing errors for individual jsondocs
                    console.warn('Failed to parse outline jsondoc data:', parseError);
                }
            }

            return characterNames;

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to extract characters from lineage');
            console.error('[useCharactersFromLineage] Error:', error);
            setError(error);
            return [];
        }
    }, [sourceJsondocId, projectData.lineageGraph, projectData.jsondocs]);

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
    chroniclesJsondocId: string | null,
    stagePath: string | null
): {
    hasOverride: boolean;
    overrideJsondocId: string | null;
    isLoading: boolean;
    error: Error | null;
} {
    const projectData = useProjectData();
    const [error, setError] = useState<Error | null>(null);

    const result = useMemo(() => {
        if (!chroniclesJsondocId || !stagePath || !projectData.lineageGraph) {
            return {
                hasOverride: false,
                overrideJsondocId: null
            };
        }

        try {
            setError(null);

            if (projectData.lineageGraph === "pending" || projectData.lineageGraph === "error") {
                return {
                    hasOverride: false,
                    overrideJsondocId: null
                };
            }

            // Check if this stage path has a human transform
            const transformResult = hasHumanTransformForPath(
                chroniclesJsondocId,
                stagePath,
                projectData.lineageGraph
            );

            return {
                hasOverride: transformResult.hasTransform,
                overrideJsondocId: transformResult.overrideJsondocId || null
            };

        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to check stage override');
            console.error('[useStageOverride] Error:', error);
            setError(error);
            return {
                hasOverride: false,
                overrideJsondocId: null
            };
        }
    }, [chroniclesJsondocId, stagePath, projectData.lineageGraph]);

    return {
        ...result,
        isLoading: projectData.isLoading,
        error: projectData.error || error
    };
}

