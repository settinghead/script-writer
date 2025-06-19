import { Router } from 'express';
import { BrainstormService } from '../services/BrainstormService';

export function createBrainstormRoutes(
    authMiddleware: any,
    brainstormService: BrainstormService
): Router {
    const router = Router();

    // Create project and start brainstorm in one call
    router.post('/create-project', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { params } = req.body;
            const userId = req.user.id;

            if (!params) {
                return res.status(400).json({ error: 'Missing brainstorm params' });
            }

            // Create project first
            const { v4: uuidv4 } = await import('uuid');
            const projectId = uuidv4();
            const projectName = `Brainstorm Project - ${new Date().toLocaleString()}`;
            
            // Insert project into database
            const { db } = await import('../database/connection');
            await db.insertInto('projects')
                .values({
                    id: projectId,
                    name: projectName,
                    description: `Generated from brainstorm: ${params.genre || 'Unknown genre'}`,
                    project_type: 'script',
                    status: 'active'
                })
                .execute();

            // Add user to project
            await db.insertInto('projects_users')
                .values({
                    project_id: projectId,
                    user_id: userId,
                    role: 'owner'
                })
                .execute();

            // Start brainstorm
            const result = await brainstormService.startBrainstorm({
                projectId,
                params
            });

            res.json({ 
                projectId,
                transformId: result.transformId,
                message: 'Project created and brainstorming started'
            });
        } catch (error) {
            console.error('Error creating project and starting brainstorm:', error);
            res.status(500).json({ 
                error: error instanceof Error ? error.message : 'Internal server error' 
            });
        }
    });

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

    // Get project artifacts (for polling until Electric is set up)
    router.get('/result/:projectId', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { projectId } = req.params;
            const userId = req.user.id;

            // Get brainstorm result artifact for this project
            const result = await brainstormService.getBrainstormResult(projectId);
            res.json(result);
        } catch (error) {
            console.error('Error getting brainstorm result:', error);
            res.status(500).json({ 
                error: error instanceof Error ? error.message : 'Internal server error' 
            });
        }
    });

    // Get status of brainstorm for a project (find latest transform)
    router.get('/status/:projectId', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { projectId } = req.params;
            const userId = req.user.id;

            // Find the latest brainstorm transform for this project
            const { db } = await import('../database/connection');
            const transform = await db
                .selectFrom('transforms')
                .selectAll()
                .where('project_id', '=', projectId)
                .where('type', '=', 'llm')
                .orderBy('created_at', 'desc')
                .executeTakeFirst();

            if (!transform) {
                return res.json(null);
            }

            const status = {
                transformId: transform.id,
                status: transform.status,
                streamingStatus: transform.streaming_status,
                progress: transform.progress_percentage || 0,
                errorMessage: transform.error_message
            };

            res.json(status);
        } catch (error) {
            console.error('Error getting brainstorm status:', error);
            res.status(500).json({ 
                error: error instanceof Error ? error.message : 'Internal server error' 
            });
        }
    });

    return router;
} 