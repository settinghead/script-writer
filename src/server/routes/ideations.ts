import express from 'express';
import { StreamingTransformExecutor } from '../services/streaming/StreamingTransformExecutor';
import { BrainstormingJobParamsV1 } from '../types/artifacts';
import { TransformRepository } from '../repositories/TransformRepository';

export function createIdeationRoutes(authMiddleware: any) {
    const router = express.Router();

    // Create brainstorming job (immediate creation and redirect)
    router.post('/create-brainstorming-job', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const { platform, genrePaths, genreProportions, requirements } = req.body;

            // Validate required fields
            if (!platform || !genrePaths || !genreProportions) {
                return res.status(400).json({
                    error: "Missing required fields: platform, genrePaths, genreProportions"
                });
            }

            const jobParams: BrainstormingJobParamsV1 = {
                platform,
                genrePaths,
                genreProportions,
                requirements: requirements || '',
                requestedAt: new Date().toISOString()
            };

            // Get the streaming executor (need to pass this from the main server)
            const streamingExecutor = req.app.locals.streamingExecutor as StreamingTransformExecutor;
            if (!streamingExecutor) {
                return res.status(500).json({ error: "Streaming executor not available" });
            }

            const { ideationRunId, transformId } = await streamingExecutor
                .startBrainstormingJob(user.id, jobParams);

            // Start streaming job in background
            setImmediate(() => {
                streamingExecutor.executeStreamingJobWithRetries(transformId);
            });

            res.json({ ideationRunId, transformId });
        } catch (error: any) {
            console.error('Error creating brainstorming job:', error);
            res.status(500).json({
                error: 'Failed to create brainstorming job',
                details: error.message
            });
        }
    });

    // Check for active job for ideation run
    router.get('/:id/active-job', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const ideationRunId = req.params.id;

            // Get the transform repository (need to pass this from the main server)
            const transformRepo = req.app.locals.transformRepo as TransformRepository;
            if (!transformRepo) {
                return res.status(500).json({ error: "Transform repository not available" });
            }

            // Find the most recent running transform for this ideation run
            const activeTransform = await transformRepo.getActiveTransformForRun(
                user.id,
                ideationRunId
            );

            if (activeTransform && activeTransform.status === 'running') {
                res.json({
                    transformId: activeTransform.id,
                    status: activeTransform.status,
                    retryCount: activeTransform.retry_count
                });
            } else {
                res.status(404).json({ message: 'No active job' });
            }
        } catch (error: any) {
            console.error('Error checking active job:', error);
            res.status(500).json({
                error: 'Failed to check active job',
                details: error.message
            });
        }
    });

    return router;
}