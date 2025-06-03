import express from 'express';
import { EpisodeGenerationService } from '../services/EpisodeGenerationService';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { AuthMiddleware } from '../middleware/auth';

export function createEpisodeRoutes(
    artifactRepo: ArtifactRepository,
    transformRepo: TransformRepository,
    authMiddleware: AuthMiddleware
) {
    const router = express.Router();
    const episodeService = new EpisodeGenerationService(artifactRepo, transformRepo);

    // Start episode generation for a stage
    router.post('/stages/:stageId/episodes/generate',
        authMiddleware.authenticate,
        async (req, res): Promise<void> => {
            const userId = req.user?.id;
            const { stageId } = req.params;
            const { numberOfEpisodes, customRequirements } = req.body;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            try {
                const result = await episodeService.startEpisodeGeneration(
                    userId,
                    stageId,
                    numberOfEpisodes,
                    customRequirements
                );
                res.json(result);
            } catch (error: any) {
                console.error('Error starting episode generation:', error);
                res.status(500).json({ error: error.message });
            }
        }
    );

    // Get episode generation session
    router.get('/episode-generation/:sessionId',
        authMiddleware.authenticate,
        async (req, res): Promise<void> => {
            const userId = req.user?.id;
            const { sessionId } = req.params;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            try {
                const session = await episodeService.getEpisodeGenerationSession(
                    userId,
                    sessionId
                );

                if (!session) {
                    res.status(404).json({ error: 'Episode generation session not found' });
                    return;
                }

                res.json(session);
            } catch (error: any) {
                console.error('Error getting episode generation session:', error);
                res.status(500).json({ error: error.message });
            }
        }
    );

    // Get stage artifacts for an outline
    router.get('/outlines/:outlineId/stages',
        authMiddleware.authenticate,
        async (req, res): Promise<void> => {
            const userId = req.user?.id;
            const { outlineId } = req.params;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            try {
                const stages = await episodeService.getStageArtifacts(userId, outlineId);
                res.json(stages);
            } catch (error: any) {
                console.error('Error getting stage artifacts:', error);
                res.status(500).json({ error: error.message });
            }
        }
    );

    // Get specific stage artifact
    router.get('/stages/:stageId',
        authMiddleware.authenticate,
        async (req, res): Promise<void> => {
            const userId = req.user?.id;
            const { stageId } = req.params;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            try {
                const stage = await episodeService.getStageArtifact(userId, stageId);

                if (!stage) {
                    res.status(404).json({ error: 'Stage not found' });
                    return;
                }

                res.json(stage);
            } catch (error: any) {
                console.error('Error getting stage artifact:', error);
                res.status(500).json({ error: error.message });
            }
        }
    );

    // Check for active episode generation
    router.get('/stages/:stageId/active-generation',
        authMiddleware.authenticate,
        async (req, res): Promise<void> => {
            const userId = req.user?.id;
            const { stageId } = req.params;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            try {
                const activeGeneration = await episodeService.checkActiveEpisodeGeneration(
                    userId,
                    stageId
                );
                res.json(activeGeneration);
            } catch (error: any) {
                console.error('Error checking active episode generation:', error);
                res.status(500).json({ error: error.message });
            }
        }
    );

    // Get all episode generation sessions for user
    router.get('/sessions',
        authMiddleware.authenticate,
        async (req, res): Promise<void> => {
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            try {
                const sessions = await episodeService.getAllEpisodeGenerationSessions(userId);
                res.json(sessions);
            } catch (error: any) {
                console.error('Error getting episode generation sessions:', error);
                res.status(500).json({ error: error.message });
            }
        }
    );

    return router;
} 