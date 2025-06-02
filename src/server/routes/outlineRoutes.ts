import * as express from 'express';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { UnifiedStreamingService } from '../services/UnifiedStreamingService';
import { OutlineService } from '../services/OutlineService';

export function createOutlineRoutes(
    authMiddleware: any,
    unifiedStreamingService: UnifiedStreamingService,
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
                unifiedStreamingService
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
                unifiedStreamingService
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
                unifiedStreamingService
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
                unifiedStreamingService
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

            if (value === undefined || value === null) {
                return res.status(400).json({ error: 'Value is required' });
            }

            // Create specific edit artifact type instead of generic 'user_input'
            const artifactType = `${componentType}_edit`;
            const artifactData = {
                [componentType]: value,
                outline_session_id: sessionId,
                edited_at: new Date().toISOString()
            };

            const newArtifact = await artifactRepo.createArtifact(userId, artifactType, artifactData);

            // Find the original component artifact for this session
            const outlineService = new OutlineService(artifactRepo, transformRepo, unifiedStreamingService);
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

    // Get original LLM data (without user edits)
    router.get('/outlines/:id/original', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const userId = req.user?.id;
            const sessionId = req.params.id;

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const originalData = await unifiedStreamingService.getOriginalOutlineData(userId, sessionId);

            if (!originalData) {
                return res.status(404).json({ error: 'Original outline data not found' });
            }

            res.json(originalData);

        } catch (error) {
            console.error('Error getting original outline data:', error);
            res.status(500).json({ error: 'Failed to get original outline data' });
        }
    });

    // Clear all user edits for a session
    router.delete('/outlines/:id/edits', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const userId = req.user?.id;
            const sessionId = req.params.id;

            if (!userId) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const outlineService = new OutlineService(artifactRepo, transformRepo, unifiedStreamingService);
            await outlineService.clearUserEdits(userId, sessionId);

            res.json({ success: true, message: 'User edits cleared successfully' });

        } catch (error) {
            console.error('Error clearing user edits:', error);
            res.status(500).json({ error: 'Failed to clear user edits' });
        }
    });

    // Check for active streaming job
    router.get('/outlines/:id/active-job', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const userId = req.user?.id;
            const sessionId = req.params.id;

            console.log(`[OutlineRoutes] Active job check for session ${sessionId} by user ${userId}`);

            if (!userId) {
                console.warn(`[OutlineRoutes] User not authenticated for active job check`);
                return res.status(401).json({ error: 'User not authenticated' });
            }

            // Find active transforms for this outline session
            const userTransforms = await transformRepo.getUserTransforms(userId);
            console.log(`[OutlineRoutes] Found ${userTransforms.length} transforms for user ${userId}`);

            const activeTransform = userTransforms.find(t =>
                t.execution_context?.outline_session_id === sessionId &&
                t.status === 'running'
            );

            console.log(`[OutlineRoutes] Active transform search result:`, {
                sessionId,
                userId,
                foundActiveTransform: !!activeTransform,
                activeTransformId: activeTransform?.id,
                activeTransformStatus: activeTransform?.status,
                allTransforms: userTransforms.map(t => ({
                    id: t.id,
                    status: t.status,
                    outlineSessionId: t.execution_context?.outline_session_id,
                    templateId: t.execution_context?.template_id
                }))
            });

            if (activeTransform) {
                console.log(`[OutlineRoutes] Returning active transform ${activeTransform.id}`);
                res.json({
                    transformId: activeTransform.id,
                    status: activeTransform.status
                });
            } else {
                console.log(`[OutlineRoutes] No active streaming job found for session ${sessionId}`);
                res.status(404).json({ error: 'No active streaming job found' });
            }

        } catch (error) {
            console.error('[OutlineRoutes] Error checking active streaming job:', error);
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