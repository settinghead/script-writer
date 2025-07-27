import { useEffect, useMemo } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';
import type { ElectricJsondoc } from '@/common/transform-jsondoc-types';

export interface PendingPatchItem {
    patchJsondoc: ElectricJsondoc;
    originalJsondoc: ElectricJsondoc;
    sourceTransformId: string;
    sourceTransformMetadata: any;
    patchIndex: number;
}

export interface PendingPatchApprovalState {
    patches: PendingPatchItem[];
    isLoading: boolean;
    error: Error | null;
}

/**
 * Hook to detect pending patch approvals using Electric SQL real-time subscriptions
 * 
 * This hook computes pending patches directly from the Electric SQL data,
 * providing real-time updates as patches are created/approved during streaming
 */
export function usePendingPatchApproval(projectId: string): PendingPatchApprovalState {
    const projectData = useProjectData();


    // Compute pending patches from Electric SQL data in real-time
    const electricPatches = useMemo((): PendingPatchItem[] => {

        // Check if data is available (not loading states like "pending" or "error")
        if (!projectData.jsondocs || projectData.jsondocs === "pending" || projectData.jsondocs === "error" ||
            !projectData.transforms || projectData.transforms === "pending" || projectData.transforms === "error" ||
            !projectData.transformInputs || projectData.transformInputs === "pending" || projectData.transformInputs === "error" ||
            !projectData.transformOutputs || projectData.transformOutputs === "pending" || projectData.transformOutputs === "error") {
            return [];
        }

        const jsondocs = projectData.jsondocs;
        const transforms = projectData.transforms;
        const transformInputs = projectData.transformInputs;
        const transformOutputs = projectData.transformOutputs;

        // Find all ai_patch transforms
        const aiPatchTransforms = transforms.filter((t: any) => t.type === 'ai_patch');

        // Helper function to check if a jsondoc has any human_patch_approval descendants
        function hasApprovalInLineage(jsondocId: string, visited = new Set<string>()): boolean {
            if (visited.has(jsondocId)) return false; // Avoid cycles
            visited.add(jsondocId);

            // Check if this jsondoc is directly used as input to a human_patch_approval transform
            const directApprovalInputs = transformInputs.filter((input: any) =>
                input.jsondoc_id === jsondocId
            );

            for (const input of directApprovalInputs) {
                const transform = transforms.find((t: any) => t.id === input.transform_id);
                if (transform && transform.type === 'human_patch_approval') {
                    return true; // Found direct approval
                }
            }

            // Check if this jsondoc is used as input to other transforms that might lead to approval
            const transformsUsingThisAsInput = transformInputs.filter((input: any) =>
                input.jsondoc_id === jsondocId
            );

            for (const input of transformsUsingThisAsInput) {
                const transform = transforms.find((t: any) => t.id === input.transform_id);
                if (!transform) continue;

                // Get outputs of this transform
                const outputs = transformOutputs.filter((output: any) =>
                    output.transform_id === transform.id
                );

                // Recursively check if any output leads to approval
                for (const output of outputs) {
                    if (hasApprovalInLineage(output.jsondoc_id, visited)) {
                        return true;
                    }
                }
            }

            return false;
        }

        const pendingPatches: PendingPatchItem[] = [];

        for (const transform of aiPatchTransforms) {
            // Get patch outputs for this transform
            const transformOutputsForThisTransform = transformOutputs.filter((output: any) =>
                output.transform_id === transform.id
            );


            for (const output of transformOutputsForThisTransform) {
                const patchJsondoc = jsondocs.find((j: any) => j.id === output.jsondoc_id);

                if (patchJsondoc && patchJsondoc.schema_type === 'json_patch') {

                    // Check if this patch has any human_patch_approval descendants in its lineage
                    const hasApproval = hasApprovalInLineage(patchJsondoc.id);

                    if (!hasApproval) {
                        // Find original jsondoc being edited
                        const inputsForTransform = transformInputs.filter((input: any) =>
                            input.transform_id === transform.id
                        );

                        const originalJsondoc = inputsForTransform.length > 0
                            ? jsondocs.find((j: any) => j.id === inputsForTransform[0].jsondoc_id)
                            : null;

                        if (originalJsondoc) {
                            pendingPatches.push({
                                patchJsondoc,
                                originalJsondoc,
                                sourceTransformId: transform.id,
                                sourceTransformMetadata: transform.execution_context || {},
                                patchIndex: pendingPatches.length
                            });
                        } else {
                        }
                    }
                }
            }
        }


        return pendingPatches;
    }, [projectData.jsondocs, projectData.transforms, projectData.transformInputs, projectData.transformOutputs, projectId]);


    return {
        patches: electricPatches,
        isLoading: projectData.isLoading,
        error: projectData.error
    };
} 