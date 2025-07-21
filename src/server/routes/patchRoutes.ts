import express from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import {
    computeCanonicalPatchContext,
    applyCanonicalPatches
} from '../../common/canonicalJsondocLogic';
import { TypedJsondoc } from '../../common/types';

/**
 * Find all human transforms that use a patch jsondoc as input
 */
async function findHumanTransformsUsingPatch(
    patchJsondocId: string,
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository,
    projectId: string
): Promise<any[]> {
    // Get all transform inputs for this project
    const allTransformInputs = await jsondocRepo.getAllProjectTransformInputsForLineage(projectId);

    // Find inputs that reference our patch jsondoc
    const relevantInputs = allTransformInputs.filter((input: any) =>
        input.jsondoc_id === patchJsondocId
    );

    // Get the transforms for these inputs
    const allTransforms = await jsondocRepo.getAllProjectTransformsForLineage(projectId);
    const humanTransforms = [];

    for (const input of relevantInputs) {
        const transform = allTransforms.find((t: any) => t.id === input.transform_id);
        if (transform && transform.type === 'human') {
            humanTransforms.push(transform);
        }
    }

    return humanTransforms;
}

/**
 * Find all transforms that use a jsondoc as input
 */
async function findTransformsUsingAsInput(
    jsondocId: string,
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository,
    projectId: string
): Promise<any[]> {
    const allTransformInputs = await jsondocRepo.getAllProjectTransformInputsForLineage(projectId);
    const allTransforms = await jsondocRepo.getAllProjectTransformsForLineage(projectId);

    const relevantInputs = allTransformInputs.filter((input: any) =>
        input.jsondoc_id === jsondocId
    );

    const dependentTransforms = [];
    for (const input of relevantInputs) {
        const transform = allTransforms.find((t: any) => t.id === input.transform_id);
        if (transform) {
            dependentTransforms.push(transform);
        }
    }

    return dependentTransforms;
}

/**
 * Recursively delete a human transform tree (children first)
 */
async function deleteHumanTransformTree(
    transformId: string,
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository,
    projectId: string,
    deletedTransformIds: string[] = [],
    deletedJsondocIds: string[] = []
): Promise<{ deletedTransformIds: string[], deletedJsondocIds: string[] }> {
    console.log(`[deleteHumanTransformTree] Processing transform: ${transformId}`);

    // Get all outputs of this transform
    const outputs = await transformRepo.getTransformOutputs(transformId);

    // For each output, find and delete any dependent transforms first
    for (const output of outputs) {
        const dependentTransforms = await findTransformsUsingAsInput(
            output.jsondoc_id,
            transformRepo,
            jsondocRepo,
            projectId
        );

        for (const dependent of dependentTransforms) {
            await deleteHumanTransformTree(
                dependent.id,
                transformRepo,
                jsondocRepo,
                projectId,
                deletedTransformIds,
                deletedJsondocIds
            );
        }

        // Remove transform_output relationship first
        const db = (transformRepo as any).db;
        await db.deleteFrom('transform_outputs')
            .where('transform_id', '=', transformId)
            .where('jsondoc_id', '=', output.jsondoc_id)
            .execute();

        // Delete the output jsondoc
        await jsondocRepo.deleteJsondoc(output.jsondoc_id);
        deletedJsondocIds.push(output.jsondoc_id);
        console.log(`[deleteHumanTransformTree] Deleted jsondoc: ${output.jsondoc_id}`);
    }

    // Delete the transform itself
    await transformRepo.deleteTransform(transformId);
    deletedTransformIds.push(transformId);
    console.log(`[deleteHumanTransformTree] Deleted transform: ${transformId}`);

    return { deletedTransformIds, deletedJsondocIds };
}

/**
 * Find the parent ai_patch transform for a patch jsondoc
 */
async function findParentAiPatchTransform(
    patchJsondocId: string,
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository,
    projectId: string
): Promise<any | null> {
    // Get all transform outputs for this project
    const allTransformOutputs = await jsondocRepo.getAllProjectTransformOutputsForLineage(projectId);
    const allTransforms = await jsondocRepo.getAllProjectTransformsForLineage(projectId);

    // Find the output record that references our patch jsondoc
    const outputRecord = allTransformOutputs.find((output: any) =>
        output.jsondoc_id === patchJsondocId
    );

    if (!outputRecord) {
        return null;
    }

    // Find the transform that created this output
    const parentTransform = allTransforms.find((t: any) =>
        t.id === outputRecord.transform_id && t.type === 'ai_patch'
    );

    return parentTransform || null;
}

/**
 * Simple patch rejection - delete patch and cleanup orphaned ai_patch transform
 */
export async function rejectPatch(
    patchJsondocId: string,
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository,
    projectId: string
): Promise<{ deletedTransformIds: string[], deletedJsondocIds: string[] }> {
    const deletedTransformIds: string[] = [];
    const deletedJsondocIds: string[] = [];

    // 1. Find parent ai_patch transform first (before deleting jsondoc)
    const parentTransform = await findParentAiPatchTransform(
        patchJsondocId,
        transformRepo,
        jsondocRepo,
        projectId
    );

    // 2. Remove the transform_output relationship first
    if (parentTransform) {
        const db = (transformRepo as any).db; // Access the db instance
        await db.deleteFrom('transform_outputs')
            .where('transform_id', '=', parentTransform.id)
            .where('jsondoc_id', '=', patchJsondocId)
            .execute();
        console.log(`[rejectPatch] Removed transform_output relationship for patch: ${patchJsondocId}`);
    }

    // 3. Now delete the patch jsondoc
    await jsondocRepo.deleteJsondoc(patchJsondocId);
    deletedJsondocIds.push(patchJsondocId);
    console.log(`[rejectPatch] Deleted patch jsondoc: ${patchJsondocId}`);

    if (parentTransform) {
        // 4. Check if ai_patch transform has any remaining patch outputs
        const remainingOutputs = await transformRepo.getTransformOutputs(parentTransform.id);
        const remainingPatches = [];

        for (const output of remainingOutputs) {
            try {
                const jsondoc = await jsondocRepo.getJsondoc(output.jsondoc_id);
                if (jsondoc && jsondoc.schema_type === 'json_patch') {
                    remainingPatches.push(jsondoc);
                }
            } catch (error) {
                // Jsondoc might have been deleted, ignore
            }
        }

        // 5. If no remaining patches, delete the ai_patch transform
        if (remainingPatches.length === 0) {
            await transformRepo.deleteTransform(parentTransform.id);
            deletedTransformIds.push(parentTransform.id);
            console.log(`[rejectPatch] Deleted orphaned ai_patch transform: ${parentTransform.id}`);
        }
    }

    return { deletedTransformIds, deletedJsondocIds };
}

/**
 * Complex patch rejection with human edits - delete human transform tree first
 */
export async function rejectPatchWithHumanEdits(
    patchJsondocId: string,
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository,
    projectId: string
): Promise<{ deletedTransformIds: string[], deletedJsondocIds: string[] }> {
    let deletedTransformIds: string[] = [];
    let deletedJsondocIds: string[] = [];

    // 1. Find all human transforms that use this patch as input
    const humanTransforms = await findHumanTransformsUsingPatch(
        patchJsondocId,
        transformRepo,
        jsondocRepo,
        projectId
    );

    // 2. Recursively delete human transform trees (children first)
    for (const humanTransform of humanTransforms) {
        const result = await deleteHumanTransformTree(
            humanTransform.id,
            transformRepo,
            jsondocRepo,
            projectId,
            deletedTransformIds,
            deletedJsondocIds
        );
        deletedTransformIds = result.deletedTransformIds;
        deletedJsondocIds = result.deletedJsondocIds;
    }

    // 3. Now delete the original patch (same as simple rejection)
    const patchResult = await rejectPatch(
        patchJsondocId,
        transformRepo,
        jsondocRepo,
        projectId
    );

    deletedTransformIds.push(...patchResult.deletedTransformIds);
    deletedJsondocIds.push(...patchResult.deletedJsondocIds);

    return { deletedTransformIds, deletedJsondocIds };
}

export function createPatchRoutes(
    authMiddleware: AuthMiddleware,
    jsondocRepo: JsondocRepository,
    transformRepo: TransformRepository
) {
    const router = express.Router();

    // Get all pending patches for a project
    router.get('/pending/:projectId', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { projectId } = req.params;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            // Verify user has access to this project
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, projectId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Get all project data for lineage analysis
            const [jsondocs, transforms, transformOutputs, transformInputs] = await Promise.all([
                jsondocRepo.getAllProjectJsondocsForLineage(projectId),
                jsondocRepo.getAllProjectTransformsForLineage(projectId),
                jsondocRepo.getAllProjectTransformOutputsForLineage(projectId),
                jsondocRepo.getAllProjectTransformInputsForLineage(projectId)
            ]);

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

            const pendingPatches = [];

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
                            const transformInputs = await jsondocRepo.getAllProjectTransformInputsForLineage(projectId);
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
                            }
                        }
                    }
                }
            }

            res.json({
                patches: pendingPatches,
                totalCount: pendingPatches.length
            });

        } catch (error: any) {
            console.error('Error fetching pending patches:', error);
            res.status(500).json({
                error: 'Failed to fetch pending patches',
                details: error.message
            });
        }
    });

    // Approve selected patches
    router.post('/approve', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { selectedPatchIds, projectId } = req.body;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            if (!selectedPatchIds || !Array.isArray(selectedPatchIds) || selectedPatchIds.length === 0) {
                return res.status(400).json({ error: 'selectedPatchIds array is required' });
            }

            if (!projectId) {
                return res.status(400).json({ error: 'projectId is required' });
            }

            // Verify user has access to this project
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, projectId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            console.log(`[PatchApproval] Starting approval for ${selectedPatchIds.length} patches`);

            // Get all project data needed for canonical computation
            const [jsondocs, transforms, humanTransforms, transformInputs, transformOutputs] = await Promise.all([
                jsondocRepo.getAllProjectJsondocsForLineage(projectId),
                jsondocRepo.getAllProjectTransformsForLineage(projectId),
                jsondocRepo.getAllProjectHumanTransformsForLineage(projectId),
                jsondocRepo.getAllProjectTransformInputsForLineage(projectId),
                jsondocRepo.getAllProjectTransformOutputsForLineage(projectId)
            ]);

            // Group patches by their parent ai_patch transform
            const patchesByTransform = new Map<string, any[]>();

            for (const patchId of selectedPatchIds) {
                const patchJsondoc = jsondocs.find((j: any) => j.id === patchId);
                if (!patchJsondoc) continue;

                // Find the parent transform
                const outputRecord = transformOutputs.find((output: any) =>
                    output.jsondoc_id === patchId
                );

                if (outputRecord) {
                    const transformId = outputRecord.transform_id;
                    if (!patchesByTransform.has(transformId)) {
                        patchesByTransform.set(transformId, []);
                    }
                    patchesByTransform.get(transformId)!.push(patchJsondoc);
                }
            }

            const approvalResults = [];

            // Process each transform's patches
            for (const [transformId, patches] of patchesByTransform) {
                try {
                    // Use canonical logic to compute patch context for this transform
                    const patchContext = computeCanonicalPatchContext(
                        transformId,
                        jsondocs,
                        transforms,
                        transformInputs,
                        transformOutputs
                    );

                    // Filter to only approved patches
                    const approvedPatches = patchContext.canonicalPatches.filter((patch: any) =>
                        selectedPatchIds.includes(patch.id)
                    );

                    if (approvedPatches.length === 0) continue;

                    // Apply approved patches to create new derived content
                    const derivedData = applyCanonicalPatches(
                        patchContext.originalJsondoc.data,
                        approvedPatches
                    );

                    // Create the human_patch_approval transform
                    const approvalTransform = await transformRepo.createTransform(
                        projectId,
                        'human_patch_approval',
                        'v1',
                        'completed',
                        {
                            original_ai_patch_transform_id: transformId,
                            approved_patch_ids: approvedPatches.map((p: any) => p.id),
                            approval_timestamp: new Date().toISOString(),
                            approved_by_user_id: user.id,
                            original_jsondoc_id: patchContext.originalJsondoc.id,
                            original_jsondoc_type: patchContext.originalJsondocType
                        }
                    );

                    // Create the new derived jsondoc with applied patches
                    const derivedJsondoc = await jsondocRepo.createJsondoc(
                        projectId,
                        patchContext.originalJsondocType as TypedJsondoc['schema_type'],
                        derivedData,
                        'v1',
                        {
                            source_transform_id: approvalTransform.id,
                            original_jsondoc_id: patchContext.originalJsondoc.id,
                            applied_patches: approvedPatches.map((p: any) => p.id),
                            approval_timestamp: new Date().toISOString()
                        },
                        'completed',
                        'user_input'
                    );

                    // Link approved patches as inputs to the approval transform
                    const approvalInputs = approvedPatches.map((patch: any, index: number) => ({
                        jsondocId: patch.id,
                        inputRole: `approved_patch_${index}`
                    }));

                    // Also link the original jsondoc as input
                    approvalInputs.push({
                        jsondocId: patchContext.originalJsondoc.id,
                        inputRole: 'original_jsondoc'
                    });

                    await transformRepo.addTransformInputs(approvalTransform.id, approvalInputs, projectId);

                    // Link the derived jsondoc as output of the approval transform
                    await transformRepo.addTransformOutputs(approvalTransform.id, [{
                        jsondocId: derivedJsondoc.id,
                        outputRole: 'approved_result'
                    }], projectId);

                    approvalResults.push({
                        transformId,
                        approvalTransformId: approvalTransform.id,
                        derivedJsondocId: derivedJsondoc.id,
                        approvedPatchCount: approvedPatches.length
                    });

                } catch (transformError) {
                    console.error(`[PatchApproval] Error processing transform ${transformId}:`, transformError);
                    // Continue with other transforms
                }
            }

            console.log(`[PatchApproval] Successfully processed ${approvalResults.length} transforms`);

            res.json({
                success: true,
                approvalResults,
                totalApprovedPatches: selectedPatchIds.length,
                message: `Approved ${selectedPatchIds.length} patches across ${approvalResults.length} transforms`
            });

        } catch (error: any) {
            console.error('Error approving patches:', error);
            res.status(500).json({
                error: 'Failed to approve patches',
                details: error.message
            });
        }
    });

    // Reject selected patches with cascading deletion
    router.post('/reject', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { selectedPatchIds, projectId, rejectionReason } = req.body;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            if (!selectedPatchIds || !Array.isArray(selectedPatchIds) || selectedPatchIds.length === 0) {
                return res.status(400).json({ error: 'selectedPatchIds array is required' });
            }

            if (!projectId) {
                return res.status(400).json({ error: 'projectId is required' });
            }

            // Verify user has access to this project
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, projectId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            console.log(`[PatchRejection] Starting rejection for ${selectedPatchIds.length} patches`);

            let totalDeletedTransforms: string[] = [];
            let totalDeletedJsondocs: string[] = [];

            // Process each patch for rejection
            for (const patchId of selectedPatchIds) {
                try {
                    // Check if this patch has human edits
                    const humanTransforms = await findHumanTransformsUsingPatch(
                        patchId,
                        transformRepo,
                        jsondocRepo,
                        projectId
                    );

                    let result;
                    if (humanTransforms.length > 0) {
                        // Complex rejection with human edits
                        console.log(`[PatchRejection] Complex rejection for patch ${patchId} with ${humanTransforms.length} human transforms`);
                        result = await rejectPatchWithHumanEdits(
                            patchId,
                            transformRepo,
                            jsondocRepo,
                            projectId
                        );
                    } else {
                        // Simple rejection
                        console.log(`[PatchRejection] Simple rejection for patch ${patchId}`);
                        result = await rejectPatch(
                            patchId,
                            transformRepo,
                            jsondocRepo,
                            projectId
                        );
                    }

                    totalDeletedTransforms.push(...result.deletedTransformIds);
                    totalDeletedJsondocs.push(...result.deletedJsondocIds);

                } catch (patchError) {
                    console.error(`[PatchRejection] Error rejecting patch ${patchId}:`, patchError);
                    // Continue with other patches
                }
            }

            console.log(`[PatchRejection] Rejection completed. Deleted ${totalDeletedTransforms.length} transforms and ${totalDeletedJsondocs.length} jsondocs`);

            res.json({
                success: true,
                deletedPatchIds: totalDeletedJsondocs,
                deletedTransformIds: totalDeletedTransforms,
                rejectionReason: rejectionReason || 'User rejected patches',
                message: `Rejected ${selectedPatchIds.length} patches. Deleted ${totalDeletedJsondocs.length} jsondocs and ${totalDeletedTransforms.length} transforms.`
            });

        } catch (error: any) {
            console.error('Error rejecting patches:', error);
            res.status(500).json({
                error: 'Failed to reject patches',
                details: error.message
            });
        }
    });

    return router;
} 