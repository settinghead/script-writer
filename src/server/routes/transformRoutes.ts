import express from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';

import {
    computeCanonicalPatchContext,
    applyCanonicalPatches
} from '../../common/canonicalJsondocLogic';

/**
 * Recursively delete a transform and all its descendants
 */
async function deleteTransformRecursively(
    transformId: string,
    transformRepo: TransformJsondocRepository,
    jsondocRepo: TransformJsondocRepository,
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
    jsondocRepo: TransformJsondocRepository,
    transformRepo: TransformJsondocRepository,
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

    // Add new route to fetch conversation history for a transform
    router.get('/:transformId/conversation', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { transformId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            // Get transform details to verify project access
            const transform = await transformRepo.getTransform(transformId);
            if (!transform) {
                return res.status(404).json({ error: 'Transform not found' });
            }

            // Verify user has access to this project
            const hasAccess = await jsondocRepo.userHasProjectAccess(userId, transform.project_id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Create ChatMessageRepository instance
            // const { db } = await import('../database/connection.js');
            // const chatMessageRepo = new ChatMessageRepository(db);

            // Fetch raw messages associated with this transform
            // const rawMessages = await chatMessageRepo.getRawMessages(transform.project_id);

            // Filter messages that belong to this transform
            // const transformMessages = rawMessages.filter(message =>
            //     message.metadata?.transform_id === transformId
            // );

            // Sort by creation time
            // transformMessages.sort((a, b) =>
            //     new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            // );

            res.json([]); // Placeholder for now, as ChatMessageRepository is not imported
        } catch (error: any) {
            console.error('Error fetching transform conversation:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
} 