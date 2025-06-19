import { Router } from 'express';
import { BrainstormService } from '../services/BrainstormService';
import { AuthMiddleware } from '../middleware/auth';

export function createBrainstormRoutes(
    authMiddleware: AuthMiddleware,
    brainstormService: BrainstormService
): Router {
    const router = Router();

    // Start brainstorm job
    router.post('/start', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { projectId, params } = req.body;
            const userId = req.user.id;

            if (!projectId || !params) {
                return res.status(400).json({ error: 'Missing projectId or params' });
            }

            // TODO: Verify user has access to project
            
            const result = await brainstormService.startBrainstorm({
                projectId,
                params
            });

            res.json(result);
        } catch (error) {
            console.error('Error starting brainstorm:', error);
            res.status(500).json({ 
                error: error instanceof Error ? error.message : 'Internal server error' 
            });
        }
    });

    // Get brainstorm status
    router.get('/status/:transformId', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { transformId } = req.params;
            const userId = req.user.id;

            const status = await brainstormService.getBrainstormStatus(transformId);
            res.json(status);
        } catch (error) {
            console.error('Error getting brainstorm status:', error);
            res.status(500).json({ 
                error: error instanceof Error ? error.message : 'Internal server error' 
            });
        }
    });

    // Get brainstorm result for a project
    router.get('/result/:projectId', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { projectId } = req.params;
            const userId = req.user.id;

            // TODO: Verify user has access to project

            const result = await brainstormService.getBrainstormResult(projectId);
            res.json(result);
        } catch (error) {
            console.error('Error getting brainstorm result:', error);
            res.status(500).json({ 
                error: error instanceof Error ? error.message : 'Internal server error' 
            });
        }
    });

    return router;
} 