import express from 'express';
import { StreamingTransformExecutor } from '../services/streaming/StreamingTransformExecutor';
import { BrainstormingJobParamsV1 } from '../types/artifacts';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { IdeationService } from '../services/IdeationService';
import { TransformExecutor } from '../services/TransformExecutor';
import { UnifiedStreamingService } from '../services/UnifiedStreamingService';

export function createIdeationRoutes(
    authMiddleware: any,
    artifactRepo: ArtifactRepository,
    transformRepo: TransformRepository,
    streamingExecutor: StreamingTransformExecutor
) {
    const router = express.Router();

    // Create brainstorming job (immediate creation and redirect)
    router.post('/create-brainstorming-job', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const { platform, genrePaths, requirements } = req.body;

            // Validate required fields
            if (!platform || !genrePaths) {
                return res.status(400).json({
                    error: "Missing required fields: platform, genrePaths"
                });
            }

            const jobParams: BrainstormingJobParamsV1 = {
                platform,
                genrePaths,
                requirements: requirements || '',
                requestedAt: new Date().toISOString()
            };

            // Use the injected streaming executor
            const { ideationRunId, transformId } = await streamingExecutor
                .startBrainstormingJob(user.id, jobParams);

            // Don't start the job immediately - let the SSE connection start it
            // This prevents duplicate streaming when the client connects
            console.log(`[IdeationRoutes] Created brainstorming job ${transformId}, waiting for client connection`);

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

            // Use the injected transform repository

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

    // Get outlines associated with ideas for an ideation session
    router.get('/:id/idea-outlines', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const sessionId = req.params.id;

            // Use injected dependencies
            const unifiedStreamingService = new UnifiedStreamingService(
                artifactRepo,
                transformRepo
            );

            const transformExecutor = new TransformExecutor(
                artifactRepo,
                transformRepo,
                unifiedStreamingService
            );

            const ideationService = new IdeationService(artifactRepo, transformRepo, transformExecutor, unifiedStreamingService);
            const ideaOutlines = await ideationService.getIdeaOutlines(user.id, sessionId);

            res.json(ideaOutlines);
        } catch (error: any) {
            console.error('Error getting idea outlines:', error);
            res.status(500).json({ error: 'Failed to get idea outlines', details: error.message });
        }
    });

    return router;
}