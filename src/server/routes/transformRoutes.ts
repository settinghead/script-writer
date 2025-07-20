import express from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { getPatchApprovalEventBus } from '../services/ParticleSystemInitializer';
import {
    computeCanonicalPatchContext,
    applyCanonicalPatches
} from '../../common/canonicalJsondocLogic';
import { TypedJsondoc } from '../../common/types';

export function createTransformRoutes(
    authMiddleware: AuthMiddleware,
    jsondocRepo: JsondocRepository,
    transformRepo: TransformRepository
) {
    const router = express.Router();

    // Delete transform and its associated jsondocs/records
    router.delete('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: transformId } = req.params;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Get transform to verify it exists and get project_id
            const transform = await transformRepo.getTransform(transformId);
            if (!transform) {
                res.status(404).json({ error: 'Transform not found' });
                return;
            }

            // Verify user has access to this transform's project
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, transform.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Get all output jsondocs for this transform
            const outputJsondocs = await transformRepo.getTransformOutputs(transformId);

            // Validate that all output jsondocs are leaf jsondocs (no other transforms depend on them)
            for (const output of outputJsondocs) {
                const dependentTransforms = await transformRepo.getTransformInputsByJsondoc(output.jsondoc_id);
                if (dependentTransforms.length > 0) {
                    res.status(400).json({
                        error: 'Cannot delete transform with non-leaf jsondocs',
                        details: `Jsondoc ${output.jsondoc_id} is used by other transforms`,
                        dependentTransforms: dependentTransforms.map(t => t.transform_id)
                    });
                    return;
                }
            }

            // Start deletion process - ORDER MATTERS due to foreign key constraints
            const deletedJsondocIds: string[] = [];

            // 1. Delete transform inputs (references jsondocs and transform)
            await transformRepo.deleteTransformInputs(transformId);

            // 2. Delete transform outputs (references jsondocs and transform)
            await transformRepo.deleteTransformOutputs(transformId);

            // 3. Delete human transform record if it exists (references transform)
            await transformRepo.deleteHumanTransformByTransformId(transformId);

            // 4. Delete LLM transform record if it exists (references transform)
            await transformRepo.deleteLLMTransformByTransformId(transformId);

            // 5. Now safe to delete output jsondocs (no more foreign key references)
            for (const output of outputJsondocs) {
                await jsondocRepo.deleteJsondoc(output.jsondoc_id);
                deletedJsondocIds.push(output.jsondoc_id);
            }

            // 6. Finally, delete the transform itself
            await transformRepo.deleteTransform(transformId);

            res.json({
                success: true,
                deletedTransformId: transformId,
                deletedJsondocIds,
                message: `Transform ${transformId} and ${deletedJsondocIds.length} associated jsondocs deleted successfully`
            });

        } catch (error: any) {
            console.error('Error deleting transform:', error);
            res.status(500).json({
                error: 'Failed to delete transform',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Approve patches from an ai_patch transform
    router.post('/:id/approve', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: aiPatchTransformId } = req.params;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            console.log(`[Approval] Starting approval for transform: ${aiPatchTransformId}`);

            // Get the ai_patch transform
            const aiPatchTransform = await transformRepo.getTransform(aiPatchTransformId);
            if (!aiPatchTransform) {
                res.status(404).json({ error: 'Transform not found' });
                return;
            }

            if (aiPatchTransform.type !== 'ai_patch') {
                res.status(400).json({ error: 'Transform is not an ai_patch transform' });
                return;
            }

            // Verify user has access to this transform's project
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, aiPatchTransform.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            console.log(`[Approval] Basic validation passed`);

            // Get all project data needed for canonical computation
            const projectId = aiPatchTransform.project_id;
            console.log(`[Approval] Getting project data for: ${projectId}`);

            const [jsondocs, transforms, humanTransforms, transformInputs, transformOutputs] = await Promise.all([
                jsondocRepo.getAllProjectJsondocsForLineage(projectId),
                jsondocRepo.getAllProjectTransformsForLineage(projectId),
                jsondocRepo.getAllProjectHumanTransformsForLineage(projectId),
                jsondocRepo.getAllProjectTransformInputsForLineage(projectId),
                jsondocRepo.getAllProjectTransformOutputsForLineage(projectId)
            ]);

            console.log(`[Approval] Retrieved data:`, {
                jsondocs: jsondocs.length,
                transforms: transforms.length,
                humanTransforms: humanTransforms.length,
                transformInputs: transformInputs.length,
                transformOutputs: transformOutputs.length
            });

            // Use canonical logic to compute patch context
            const patchContext = computeCanonicalPatchContext(
                aiPatchTransformId,
                jsondocs,
                transforms,
                transformInputs,
                transformOutputs
            );

            console.log(`[Approval] Found ${patchContext.canonicalPatches.length} canonical patches for transform ${aiPatchTransformId}`);
            console.log(`[Approval] Original jsondoc: ${patchContext.originalJsondoc.id} (${patchContext.originalJsondocType})`);

            // Apply canonical patches to create new derived content
            const derivedData = applyCanonicalPatches(
                patchContext.originalJsondoc.data,
                patchContext.canonicalPatches
            );

            console.log(`[Approval] Applied patches, creating derived jsondoc of type: ${patchContext.originalJsondocType}`);
            console.log(`[Approval] Derived data:`, JSON.stringify(derivedData, null, 2));

            // Create the human_patch_approval transform
            const approvalTransform = await transformRepo.createTransform(
                projectId,
                'human_patch_approval',
                'v1',
                'completed',
                {
                    original_ai_patch_transform_id: aiPatchTransformId,
                    approved_patch_ids: patchContext.canonicalPatches.map(p => p.id),
                    approval_timestamp: new Date().toISOString(),
                    approved_by_user_id: user.id,
                    original_jsondoc_id: patchContext.originalJsondoc.id,
                    original_jsondoc_type: patchContext.originalJsondocType
                }
            );

            console.log(`[Approval] Created approval transform: ${approvalTransform.id}`);

            // Create the new derived jsondoc with applied patches
            let derivedJsondoc;
            try {
                console.log(`[Approval] Creating jsondoc with schema type: ${patchContext.originalJsondocType}`);
                derivedJsondoc = await jsondocRepo.createJsondoc(
                    projectId,
                    patchContext.originalJsondocType as TypedJsondoc['schema_type'], // Same type as original
                    derivedData,
                    'v1',
                    {
                        source_transform_id: approvalTransform.id,
                        original_jsondoc_id: patchContext.originalJsondoc.id,
                        applied_patches: patchContext.canonicalPatches.map(p => p.id),
                        approval_timestamp: new Date().toISOString()
                    },
                    'completed',
                    'user_input' // This is user-approved content
                );
                console.log(`[Approval] Created derived jsondoc: ${derivedJsondoc.id}`);
            } catch (createError) {
                console.error(`[Approval] Error creating derived jsondoc:`, createError);
                throw createError;
            }

            // Link canonical patches as inputs to the approval transform
            const approvalInputs = patchContext.canonicalPatches.map((patch, index) => ({
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

            // Mark the original ai_patch transform as completed
            await transformRepo.updateTransformStatus(aiPatchTransformId, 'completed');

            // Notify the PatchApprovalEventBus
            const patchApprovalEventBus = getPatchApprovalEventBus();
            if (patchApprovalEventBus) {
                await patchApprovalEventBus.manuallyApprove(aiPatchTransformId);
            }

            console.log(`[Approval] Successfully created approval transform ${approvalTransform.id} with derived jsondoc ${derivedJsondoc.id}`);

            res.json({
                success: true,
                approvalTransformId: approvalTransform.id,
                derivedJsondocId: derivedJsondoc.id,
                approvedPatchIds: patchContext.canonicalPatches.map(p => p.id),
                originalJsondocId: patchContext.originalJsondoc.id,
                message: `Approved ${patchContext.canonicalPatches.length} patches and created derived ${patchContext.originalJsondocType}`
            });

        } catch (error: any) {
            console.error('Error approving patches:', error);
            res.status(500).json({
                error: 'Failed to approve patches',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Reject patches from an ai_patch transform
    router.post('/:id/reject', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: transformId } = req.params;
            const { rejectionReason } = req.body;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Get the ai_patch transform
            const transform = await transformRepo.getTransform(transformId);
            if (!transform) {
                res.status(404).json({ error: 'Transform not found' });
                return;
            }

            if (transform.type !== 'ai_patch') {
                res.status(400).json({ error: 'Transform is not an ai_patch transform' });
                return;
            }

            // Verify user has access to this transform's project
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, transform.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Get all output jsondocs (patches) for this transform
            const outputJsondocs = await transformRepo.getTransformOutputs(transformId);

            // Delete all patch jsondocs
            const deletedJsondocIds: string[] = [];
            for (const output of outputJsondocs) {
                await jsondocRepo.deleteJsondoc(output.jsondoc_id);
                deletedJsondocIds.push(output.jsondoc_id);
            }

            // Delete the ai_patch transform itself
            await transformRepo.deleteTransform(transformId);

            // Notify the PatchApprovalEventBus
            const patchApprovalEventBus = getPatchApprovalEventBus();
            if (patchApprovalEventBus) {
                await patchApprovalEventBus.manuallyReject(transformId);
            }

            res.json({
                success: true,
                deletedTransformId: transformId,
                deletedPatchIds: deletedJsondocIds,
                rejectionReason: rejectionReason || 'No reason provided',
                message: `Rejected and deleted ${deletedJsondocIds.length} patches`
            });

        } catch (error: any) {
            console.error('Error rejecting patches:', error);
            res.status(500).json({
                error: 'Failed to reject patches',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    return router;
} 