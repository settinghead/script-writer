import express from 'express';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { TransformRepository } from '../repositories/TransformRepository';

export function createProjectStreamingRoutes(
    authMiddleware: any,
    transformRepo: TransformRepository
) {
    const router = express.Router();

    // Generic project-level streaming endpoint
    router.get('/:projectId/stream', authMiddleware.authenticate, async (req: any, res: any) => {
        const user = authMiddleware.getCurrentUser(req);
        if (!user) {
            console.log(`[Project Stream] User not authenticated`);
            return res.status(401).json({ error: "User not authenticated" });
        }

        const { projectId } = req.params;

        try {
            // Import services
            const { JobBroadcaster } = await import('../services/streaming/JobBroadcaster');
            const broadcaster = JobBroadcaster.getInstance();

            // Initialize project repository to verify access
            const db = (transformRepo as any).db;
            const { ProjectRepository } = await import('../repositories/ProjectRepository');
            const projectRepo = new ProjectRepository(db);

            // Verify project access
            const hasAccess = await projectRepo.userHasAccess(projectId, user.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Project not found or unauthorized' });
            }

            // Setup SSE connection
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });

            // Send initial status
            res.write(`data: ${JSON.stringify({ 
                status: 'connected', 
                projectId,
                message: 'Connected to project stream'
            })}\n\n`);

            // Find any active transforms for this project
            const projectTransforms = await transformRepo.getProjectTransforms(projectId, 10);
            const activeTransforms = projectTransforms.filter(t => t.status === 'running');

            if (activeTransforms.length > 0) {
                // Send info about active transforms
                res.write(`data: ${JSON.stringify({ 
                    type: 'active_operations',
                    operations: activeTransforms.map(t => ({
                        transformId: t.id,
                        type: t.type,
                        status: t.status,
                        created_at: t.created_at
                    }))
                })}\n\n`);

                // Subscribe to each active transform
                for (const transform of activeTransforms) {
                    broadcaster.addClient(transform.id, user.id, res);
                    
                    // Send any existing chunks from database
                    const chunks = await transformRepo.getTransformChunks(transform.id);
                    if (chunks.length > 0) {
                        for (const chunk of chunks) {
                            res.write(`data: ${chunk}\n\n`);
                        }
                    }
                }

                console.log(`[Project Stream] Connected to project ${projectId} with ${activeTransforms.length} active operations`);
            } else {
                // No active operations
                res.write(`data: ${JSON.stringify({ 
                    type: 'status',
                    message: 'No active operations for this project'
                })}\n\n`);

                console.log(`[Project Stream] Connected to project ${projectId} with no active operations`);
            }

            // Handle client disconnect
            req.on('close', () => {
                console.log(`[Project Stream] Client disconnected from project ${projectId}`);
                // Broadcaster will handle cleanup automatically
            });

        } catch (error: any) {
            console.error('Error in project streaming endpoint:', error);
            if (!res.headersSent) {
                return res.status(500).json({
                    error: "Failed to connect to project stream",
                    details: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }
    });

    // Get project status (non-streaming)
    router.get('/:projectId/status', authMiddleware.authenticate, async (req: any, res: any) => {
        const user = authMiddleware.getCurrentUser(req);
        if (!user) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const { projectId } = req.params;

        try {
            // Initialize project repository to verify access
            const db = (transformRepo as any).db;
            const { ProjectRepository } = await import('../repositories/ProjectRepository');
            const projectRepo = new ProjectRepository(db);

            // Verify project access
            const hasAccess = await projectRepo.userHasAccess(projectId, user.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Project not found or unauthorized' });
            }

            // Get project transforms
            const projectTransforms = await transformRepo.getProjectTransforms(projectId, 20);
            const activeTransforms = projectTransforms.filter(t => t.status === 'running');
            const completedTransforms = projectTransforms.filter(t => t.status === 'completed');
            const failedTransforms = projectTransforms.filter(t => t.status === 'failed');

            res.json({
                projectId,
                status: activeTransforms.length > 0 ? 'active' : 'idle',
                operations: {
                    active: activeTransforms.length,
                    completed: completedTransforms.length,
                    failed: failedTransforms.length,
                    total: projectTransforms.length
                },
                activeOperations: activeTransforms.map(t => ({
                    transformId: t.id,
                    type: t.type,
                    status: t.status,
                    created_at: t.created_at
                })),
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('Error getting project status:', error);
            res.status(500).json({
                error: "Failed to get project status",
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    return router;
} 