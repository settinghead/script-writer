import express from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';

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

    return router;
} 