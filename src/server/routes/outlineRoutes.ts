import * as express from 'express';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { CacheService } from '../services/CacheService';
import { OutlineService } from '../services/OutlineService';

export function createOutlineRoutes(
    authMiddleware: any,
    cacheService: CacheService,
    artifactRepo: ArtifactRepository,
    transformRepo: TransformRepository
) {
    const router = express.Router();

    // List all outline sessions
    router.get('/outlines', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const outlineService = new OutlineService(
                artifactRepo,
                transformRepo,
                cacheService
            );

            const sessions = await outlineService.listOutlineSessions(userId);
            res.json(sessions);

        } catch (error) {
            console.error('Error listing outline sessions:', error);
            res.status(500).json({ error: 'Failed to list outline sessions' });
        }
    });

    // Get specific outline session
    router.get('/outlines/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const userId = req.user?.id;
            const sessionId = req.params.id;

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const outlineService = new OutlineService(
                artifactRepo,
                transformRepo,
                cacheService
            );

            const session = await outlineService.getOutlineSession(userId, sessionId);

            if (!session) {
                return res.status(404).json({ error: 'Outline session not found' });
            }

            res.json(session);

        } catch (error) {
            console.error('Error getting outline session:', error);
            res.status(500).json({ error: 'Failed to get outline session' });
        }
    });

    // Delete outline session
    router.delete('/outlines/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const userId = req.user?.id;
            const sessionId = req.params.id;

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const outlineService = new OutlineService(
                artifactRepo,
                transformRepo,
                cacheService
            );

            const deleted = await outlineService.deleteOutlineSession(userId, sessionId);

            if (!deleted) {
                return res.status(404).json({ error: 'Outline session not found' });
            }

            res.json({ success: true });

        } catch (error) {
            console.error('Error deleting outline session:', error);
            res.status(500).json({ error: 'Failed to delete outline session' });
        }
    });

    // Get lineage data for visualization
    router.get('/outlines/:id/lineage', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const userId = req.user?.id;
            const sessionId = req.params.id;

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const outlineService = new OutlineService(
                artifactRepo,
                transformRepo,
                cacheService
            );

            const lineage = await outlineService.getOutlineLineage(userId, sessionId);
            res.json(lineage);

        } catch (error) {
            console.error('Error getting outline lineage:', error);
            res.status(500).json({ error: 'Failed to get outline lineage' });
        }
    });

    // Update outline component - creates new artifact and human transform
    router.patch('/outlines/:id/components/:componentType', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const userId = req.user?.id;
            const sessionId = req.params.id;
            const componentType = req.params.componentType;
            const { value } = req.body;

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            if (!value) {
                return res.status(400).json({ error: 'Value is required' });
            }

            // Create new user_input artifact with the edited content
            const newArtifact = await artifactRepo.createArtifact(userId, 'user_input', {
                text: value,
                source: `edited_${componentType}`,
                outline_session_id: sessionId
            });

            // Find the original component artifact for this session
            const outlineService = new OutlineService(artifactRepo, transformRepo, cacheService);
            const session = await outlineService.getOutlineSession(userId, sessionId);

            if (!session) {
                return res.status(404).json({ error: 'Outline session not found' });
            }

            // Create human transform to record the edit
            const humanTransform = await transformRepo.createTransform(
                userId,
                'human',
                'v1',
                'completed',
                {
                    field: componentType,
                    interface: 'outline_editor',
                    outline_session_id: sessionId,
                    edited_at: new Date().toISOString()
                }
            );

            // Add the inputs and outputs
            await transformRepo.addTransformOutputs(humanTransform.id, [
                { artifactId: newArtifact.id, outputRole: 'edited_content' }
            ]);

            // Add human-specific data
            await transformRepo.addHumanTransform({
                transform_id: humanTransform.id,
                action_type: 'edit_field',
                interface_context: {
                    field: componentType,
                    interface: 'outline_editor',
                    outline_session_id: sessionId
                },
                change_description: `Edited ${componentType} field`
            });

            res.json({
                success: true,
                artifactId: newArtifact.id,
                message: 'Component updated successfully'
            });

        } catch (error) {
            console.error('Error updating outline component:', error);
            res.status(500).json({ error: 'Failed to update outline component' });
        }
    });

    // Check for active streaming job
    router.get('/outlines/:id/active-job', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const userId = req.user?.id;
            const sessionId = req.params.id;

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            // Find active transforms for this outline session
            const userTransforms = await transformRepo.getUserTransforms(userId);
            const activeTransform = userTransforms.find(t =>
                t.execution_context?.outline_session_id === sessionId &&
                t.status === 'running'
            );

            if (activeTransform) {
                res.json({
                    transformId: activeTransform.id,
                    status: activeTransform.status
                });
            } else {
                res.status(404).json({ error: 'No active streaming job found' });
            }

        } catch (error) {
            console.error('Error checking active streaming job:', error);
            res.status(500).json({ error: 'Failed to check active streaming job' });
        }
    });

    // Get user artifacts/ideas for outline input
    router.get('/artifacts/ideas', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            // Get brainstorm_idea and user_input artifacts that could be used as outline sources
            const ideaArtifacts = await artifactRepo.getArtifactsByType(userId, 'brainstorm_idea');
            const userInputArtifacts = await artifactRepo.getArtifactsByType(userId, 'user_input');

            // Return the full artifact objects as the client expects them
            const allIdeas = [...ideaArtifacts, ...userInputArtifacts];

            // Sort by creation date, newest first
            allIdeas.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            res.json(allIdeas);

        } catch (error) {
            console.error('Error getting user ideas:', error);
            res.status(500).json({ error: 'Failed to get user ideas' });
        }
    });

    return router;
} 