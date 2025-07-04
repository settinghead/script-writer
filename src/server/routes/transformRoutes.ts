import express from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';
import { TransformRepository } from '../transform-artifact-framework/TransformRepository';

export function createTransformRoutes(
    authMiddleware: AuthMiddleware,
    artifactRepo: ArtifactRepository,
    transformRepo: TransformRepository
) {
    const router = express.Router();

    // Delete transform and its associated artifacts/records
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
            const hasAccess = await artifactRepo.userHasProjectAccess(user.id, transform.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Get all output artifacts for this transform
            const outputArtifacts = await transformRepo.getTransformOutputs(transformId);

            // Validate that all output artifacts are leaf artifacts (no other transforms depend on them)
            for (const output of outputArtifacts) {
                const dependentTransforms = await transformRepo.getTransformInputsByArtifact(output.artifact_id);
                if (dependentTransforms.length > 0) {
                    res.status(400).json({
                        error: 'Cannot delete transform with non-leaf artifacts',
                        details: `Artifact ${output.artifact_id} is used by other transforms`,
                        dependentTransforms: dependentTransforms.map(t => t.transform_id)
                    });
                    return;
                }
            }

            // Start deletion process - ORDER MATTERS due to foreign key constraints
            const deletedArtifactIds: string[] = [];

            // 1. Delete transform inputs (references artifacts and transform)
            await transformRepo.deleteTransformInputs(transformId);

            // 2. Delete transform outputs (references artifacts and transform)
            await transformRepo.deleteTransformOutputs(transformId);

            // 3. Delete human transform record if it exists (references transform)
            await transformRepo.deleteHumanTransformByTransformId(transformId);

            // 4. Delete LLM transform record if it exists (references transform)
            await transformRepo.deleteLLMTransformByTransformId(transformId);

            // 5. Now safe to delete output artifacts (no more foreign key references)
            for (const output of outputArtifacts) {
                await artifactRepo.deleteArtifact(output.artifact_id);
                deletedArtifactIds.push(output.artifact_id);
            }

            // 6. Finally, delete the transform itself
            await transformRepo.deleteTransform(transformId);

            res.json({
                success: true,
                deletedTransformId: transformId,
                deletedArtifactIds,
                message: `Transform ${transformId} and ${deletedArtifactIds.length} associated artifacts deleted successfully`
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