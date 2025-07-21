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
 * Recursively delete a transform and all its descendants
 */
async function deleteTransformRecursively(
    transformId: string,
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository,
    projectId: string,
    deletedTransformIds: string[] = [],
    deletedJsondocIds: string[] = []
): Promise<{ deletedTransformIds: string[], deletedJsondocIds: string[] }> {
    console.log(`[RecursiveDeletion] Processing transform: ${transformId}`);

    // Get all outputs of this transform BEFORE deleting the transform
    const outputs = await transformRepo.getTransformOutputs(transformId);

    // For each output, find any transforms that use it as input and delete them first
    for (const output of outputs) {
        // Find all transforms that use this jsondoc as input
        const allTransformInputs = await jsondocRepo.getAllProjectTransformInputsForLineage(projectId);
        const dependentInputs = allTransformInputs.filter((input: any) =>
            input.jsondoc_id === output.jsondoc_id && input.transform_id !== transformId
        );

        // Recursively delete dependent transforms
        for (const dependentInput of dependentInputs) {
            if (!deletedTransformIds.includes(dependentInput.transform_id)) {
                await deleteTransformRecursively(
                    dependentInput.transform_id,
                    transformRepo,
                    jsondocRepo,
                    projectId,
                    deletedTransformIds,
                    deletedJsondocIds
                );
            }
        }
    }

    // Delete the transform itself FIRST - this will CASCADE delete transform_inputs and transform_outputs
    if (!deletedTransformIds.includes(transformId)) {
        await transformRepo.deleteTransform(transformId);
        deletedTransformIds.push(transformId);
        console.log(`[RecursiveDeletion] Deleted transform: ${transformId}`);
    }

    // Now safely delete the output jsondocs (no more foreign key references)
    for (const output of outputs) {
        if (!deletedJsondocIds.includes(output.jsondoc_id)) {
            await jsondocRepo.deleteJsondoc(output.jsondoc_id);
            deletedJsondocIds.push(output.jsondoc_id);
            console.log(`[RecursiveDeletion] Deleted jsondoc: ${output.jsondoc_id}`);
        }
    }

    return { deletedTransformIds, deletedJsondocIds };
}

export function createTransformRoutes(
    authMiddleware: AuthMiddleware,
    jsondocRepo: JsondocRepository,
    transformRepo: TransformRepository
) {
    const router = express.Router();

    // Get all transforms for a project
    router.get('/', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { projectId } = req.query;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            if (!projectId) {
                return res.status(400).json({ error: 'projectId query parameter is required' });
            }

            // Verify user has access to this project
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, projectId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Get transforms for the project
            const transforms = await jsondocRepo.getAllProjectTransformsForLineage(projectId);

            res.json({
                transforms,
                count: transforms.length
            });

        } catch (error: any) {
            console.error('Error fetching transforms:', error);
            res.status(500).json({
                error: 'Failed to fetch transforms',
                details: error.message
            });
        }
    });

    // Get a specific transform by ID
    router.get('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const transform = await transformRepo.getTransform(id);
            if (!transform) {
                return res.status(404).json({ error: 'Transform not found' });
            }

            // Verify user has access to this project
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, transform.project_id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Get transform inputs and outputs
            const [inputs, outputs] = await Promise.all([
                transformRepo.getTransformInputs(id),
                transformRepo.getTransformOutputs(id)
            ]);

            res.json({
                transform,
                inputs,
                outputs
            });

        } catch (error: any) {
            console.error('Error fetching transform:', error);
            res.status(500).json({
                error: 'Failed to fetch transform',
                details: error.message
            });
        }
    });

    // Delete a transform (with recursive deletion of descendants)
    router.delete('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const transform = await transformRepo.getTransform(id);
            if (!transform) {
                return res.status(404).json({ error: 'Transform not found' });
            }

            // Verify user has access to this project
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, transform.project_id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            console.log(`[TransformDeletion] Starting recursive deletion for transform: ${id}`);

            // Use recursive deletion
            const deletionResult = await deleteTransformRecursively(
                id,
                transformRepo,
                jsondocRepo,
                transform.project_id
            );

            console.log(`[TransformDeletion] Successfully deleted transform ${id} and ${deletionResult.deletedTransformIds.length} descendants`);

            res.json({
                success: true,
                deletedTransformId: id,
                deletedTransformIds: deletionResult.deletedTransformIds,
                deletedJsondocIds: deletionResult.deletedJsondocIds,
                message: `Deleted transform and ${deletionResult.deletedTransformIds.length} descendant transforms, ${deletionResult.deletedJsondocIds.length} jsondocs`
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