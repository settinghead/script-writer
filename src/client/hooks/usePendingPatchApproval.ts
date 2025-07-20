import { useMemo } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';
import type { ElectricJsondoc, ElectricTransform } from '../../common/types';

export interface PendingPatchGroup {
    transformId: string;
    originalJsondoc: ElectricJsondoc;
    patchJsondocs: ElectricJsondoc[];
    createdAt: string;
    templateName?: string;
    editRequirements?: string;
}

export interface PendingPatchApprovalState {
    pendingPatches: PendingPatchGroup | null;
    isLoading: boolean;
    error: Error | null;
}

/**
 * Hook to detect pending patch approvals from the lineage graph
 * 
 * This hook looks for:
 * 1. ai_patch transforms with status 'running'
 * 2. That have json_patch jsondocs as outputs
 * 3. Where the patch jsondocs are leaf nodes (not yet processed)
 */
export function usePendingPatchApproval(projectId: string): PendingPatchApprovalState {
    const projectData = useProjectData();

    const result = useMemo(() => {
        // Handle loading state
        if (!projectData.lineageGraph || projectData.lineageGraph === "pending") {
            return {
                pendingPatches: null,
                isLoading: true,
                error: null
            };
        }

        try {
            // Type guards for Electric SQL data
            if (projectData.transforms === "pending" || projectData.transforms === "error" ||
                projectData.transformOutputs === "pending" || projectData.transformOutputs === "error" ||
                projectData.transformInputs === "pending" || projectData.transformInputs === "error" ||
                projectData.jsondocs === "pending" || projectData.jsondocs === "error") {
                return {
                    pendingPatches: null,
                    isLoading: true,
                    error: null
                };
            }

            // Find ai_patch transforms with status 'running'
            const aiPatchTransforms = projectData.transforms.filter((t: ElectricTransform) =>
                t.type === 'ai_patch' && t.status === 'running'
            );

            // Look for the first pending patch group (following user requirement to pick "first" one)
            for (const transform of aiPatchTransforms) {
                // Get output jsondocs for this transform
                const transformOutputs = projectData.transformOutputs.filter((output: any) =>
                    output.transform_id === transform.id
                );

                const patchJsondocs = transformOutputs
                    .map((output: any) => {
                        // Type guard to ensure jsondocs is an array
                        if (Array.isArray(projectData.jsondocs)) {
                            return projectData.jsondocs.find((jsondoc: ElectricJsondoc) => jsondoc.id === output.jsondoc_id);
                        }
                        return undefined;
                    })
                    .filter((jsondoc): jsondoc is ElectricJsondoc =>
                        jsondoc !== undefined && jsondoc.schema_type === 'json_patch'
                    );

                if (patchJsondocs.length > 0) {
                    // Check if these patches are still leaf nodes (not yet processed by human_patch_approval)
                    const hasHumanApproval = projectData.transforms.some((t: ElectricTransform) =>
                        t.type === 'human_patch_approval' &&
                        Array.isArray(projectData.transformInputs) &&
                        projectData.transformInputs.some((input: any) =>
                            input.transform_id === t.id &&
                            patchJsondocs.some(patch => patch.id === input.jsondoc_id)
                        )
                    );

                    if (!hasHumanApproval) {
                        // This is a pending patch group
                        // Try to find the original jsondoc being edited
                        const transformInputs = projectData.transformInputs.filter((input: any) =>
                            input.transform_id === transform.id
                        );

                        const originalJsondoc = transformInputs.length > 0 && Array.isArray(projectData.jsondocs)
                            ? projectData.jsondocs.find((jsondoc: ElectricJsondoc) => jsondoc.id === transformInputs[0].jsondoc_id)
                            : null;

                        if (originalJsondoc) {
                            // Parse metadata for additional context
                            let metadata: any = {};
                            try {
                                metadata = typeof transform.execution_context === 'string'
                                    ? JSON.parse(transform.execution_context)
                                    : transform.execution_context || {};
                            } catch (e) {
                                // Ignore parsing errors
                            }

                            return {
                                pendingPatches: {
                                    transformId: transform.id,
                                    originalJsondoc,
                                    patchJsondocs,
                                    createdAt: transform.created_at,
                                    templateName: metadata.template_name,
                                    editRequirements: metadata.edit_requirements
                                },
                                isLoading: false,
                                error: null
                            };
                        }
                    }
                }
            }

            // No pending patches found
            return {
                pendingPatches: null,
                isLoading: false,
                error: null
            };

        } catch (error) {
            console.error('[usePendingPatchApproval] Error detecting pending patches:', error);
            return {
                pendingPatches: null,
                isLoading: false,
                error: error instanceof Error ? error : new Error('Unknown error detecting pending patches')
            };
        }
    }, [
        projectData.lineageGraph,
        // Use stable identifiers instead of array references
        Array.isArray(projectData.transforms) ?
            projectData.transforms.map((t: any) => `${t.id}-${t.status}-${t.type}`).join(',') : '',
        Array.isArray(projectData.transformOutputs) ?
            projectData.transformOutputs.map((o: any) => `${o.transform_id}-${o.jsondoc_id}`).join(',') : '',
        Array.isArray(projectData.transformInputs) ?
            projectData.transformInputs.map((i: any) => `${i.transform_id}-${i.jsondoc_id}`).join(',') : '',
        Array.isArray(projectData.jsondocs) ?
            projectData.jsondocs.map((j: any) => `${j.id}-${j.schema_type}`).join(',') : '',
        projectId
    ]);

    return result;
} 