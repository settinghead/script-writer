import express from 'express';
import { JobBroadcaster } from '../services/streaming/JobBroadcaster';
import { TransformRepository } from '../repositories/TransformRepository';

export function createStreamingRoutes(authMiddleware: any, transformRepo: TransformRepository) {
    const router = express.Router();
    const broadcaster = JobBroadcaster.getInstance();

    // Project-level streaming endpoint
    router.get('/project/:projectId', authMiddleware.authenticate, async (req: any, res: any) => {
        const user = authMiddleware.getCurrentUser(req);
        if (!user) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const { projectId } = req.params;

        try {
            // TODO: Add project access validation here
            // For now, we assume if the user is authenticated, they have access.

            // Set up SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            });

            // Register this client with the broadcaster for the given project
            broadcaster.addClient(projectId, res);

            // Send initial connection confirmation
            res.write(`data: ${JSON.stringify({ type: 'connection_established', projectId })}\n\n`);

            // Handle client disconnect
            req.on('close', () => {
                broadcaster.removeClient(projectId, res);
                console.log(`[Streaming] Client disconnected from project ${projectId}`);
            });

        } catch (error: any) {
            console.error(`Error in project streaming endpoint for project ${projectId}:`, error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: "Failed to connect to project stream",
                    details: error.message
                });
            } else {
                res.end();
            }
        }
    });

    return router;
} 