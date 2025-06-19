import express from 'express';
import { JobBroadcaster } from '../services/streaming/JobBroadcaster';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';

export function createStreamingRoutes(authMiddleware: any, transformRepo: TransformRepository, artifactRepo: ArtifactRepository) {
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

            // Check for existing streaming state and replay chunks
            try {
                const transforms = await transformRepo.getProjectTransforms(projectId);
                const runningTransform = transforms.find(t => t.status === 'running');
                
                if (runningTransform) {
                    console.log(`[SSE] Found running transform ${runningTransform.id}, replaying chunks`);
                    const chunks = await transformRepo.getTransformChunks(runningTransform.id);
                    
                    // Replay all existing chunks
                    for (const chunk of chunks) {
                        res.write(`data: ${chunk}\n\n`);
                    }
                    
                    console.log(`[SSE] Replayed ${chunks.length} chunks for transform ${runningTransform.id}`);
                } else {
                    // Check for completed transforms and send final results
                    const completedTransforms = transforms.filter(t => t.status === 'completed');
                    if (completedTransforms.length > 0) {
                        console.log(`[SSE] Found ${completedTransforms.length} completed transforms, sending final results`);
                        
                        // Get final artifacts and send them
                        for (const transform of completedTransforms) {
                            const outputs = await transformRepo.getTransformOutputs(transform.id);
                            for (const output of outputs) {
                                const artifact = await artifactRepo.getArtifact(output.artifact_id, user.id);
                                if (artifact && artifact.type === 'brainstorm_idea_collection') {
                                    const finalData = JSON.stringify({
                                        type: 'final_result',
                                        data: artifact.data
                                    });
                                    res.write(`data: ${finalData}\n\n`);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`[SSE] Error replaying chunks for project ${projectId}:`, error);
            }

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