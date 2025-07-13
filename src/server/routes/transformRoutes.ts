import express from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { JsonDocRepository } from '../transform-jsonDoc-framework/JsonDocRepository';
import { TransformRepository } from '../transform-jsonDoc-framework/TransformRepository';

export function createTransformRoutes(
    authMiddleware: AuthMiddleware,
    jsonDocRepo: JsonDocRepository,
    transformRepo: TransformRepository
) {
    const router = express.Router();

    // Delete transform and its associated jsonDocs/records
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
            const hasAccess = await jsonDocRepo.userHasProjectAccess(user.id, transform.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Get all output jsonDocs for this transform
            const outputJsonDocs = await transformRepo.getTransformOutputs(transformId);

            // Validate that all output jsonDocs are leaf jsonDocs (no other transforms depend on them)
            for (const output of outputJsonDocs) {
                const dependentTransforms = await transformRepo.getTransformInputsByJsonDoc(output.jsonDoc_id);
                if (dependentTransforms.length > 0) {
                    res.status(400).json({
                        error: 'Cannot delete transform with non-leaf jsonDocs',
                        details: `JsonDoc ${output.jsonDoc_id} is used by other transforms`,
                        dependentTransforms: dependentTransforms.map(t => t.transform_id)
                    });
                    return;
                }
            }

            // Start deletion process - ORDER MATTERS due to foreign key constraints
            const deletedJsonDocIds: string[] = [];

            // 1. Delete transform inputs (references jsonDocs and transform)
            await transformRepo.deleteTransformInputs(transformId);

            // 2. Delete transform outputs (references jsonDocs and transform)
            await transformRepo.deleteTransformOutputs(transformId);

            // 3. Delete human transform record if it exists (references transform)
            await transformRepo.deleteHumanTransformByTransformId(transformId);

            // 4. Delete LLM transform record if it exists (references transform)
            await transformRepo.deleteLLMTransformByTransformId(transformId);

            // 5. Now safe to delete output jsonDocs (no more foreign key references)
            for (const output of outputJsonDocs) {
                await jsonDocRepo.deleteJsonDoc(output.jsonDoc_id);
                deletedJsonDocIds.push(output.jsonDoc_id);
            }

            // 6. Finally, delete the transform itself
            await transformRepo.deleteTransform(transformId);

            res.json({
                success: true,
                deletedTransformId: transformId,
                deletedJsonDocIds,
                message: `Transform ${transformId} and ${deletedJsonDocIds.length} associated jsonDocs deleted successfully`
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