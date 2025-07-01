import express from 'express';
import { EpisodeGenerationService } from '../services/EpisodeGenerationService';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';
import { TransformRepository } from '../transform-artifact-framework/TransformRepository';
import { AuthMiddleware } from '../middleware/auth';

export function createEpisodeRoutes(
    artifactRepo: ArtifactRepository,
    transformRepo: TransformRepository,
    authMiddleware: AuthMiddleware
) {
    const router = express.Router();
    const episodeService = new EpisodeGenerationService(artifactRepo, transformRepo);

    // 🔥 NEW: General episode generation endpoint (called by EpisodeGenerationForm)
    router.post('/generate',
        authMiddleware.authenticate,
        async (req, res): Promise<void> => {
            const userId = req.user?.id;
            const {
                outlineSessionId,
                episode_count,
                episode_duration,
                custom_requirements,
                cascadedParams
            } = req.body;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            try {
                // Get stages for this outline session
                const stages = await episodeService.getStageArtifacts(userId, outlineSessionId);

                if (!stages || stages.length === 0) {
                    res.status(404).json({ error: 'No stages found for outline session' });
                    return;
                }

                // For now, generate for first stage (can be extended to handle all stages)
                const firstStage = stages[0];

                const result = await episodeService.startEpisodeGeneration(
                    userId,
                    firstStage.artifactId,
                    episode_count,
                    custom_requirements,
                    cascadedParams // 🔥 NEW: Pass cascaded parameters
                );

                res.json(result);
            } catch (error: any) {
                console.error('Error generating episodes:', error);
                res.status(500).json({ error: error.message });
            }
        }
    );

    // Start episode generation for a specific stage
    router.post('/stages/:stageId/episodes/generate',
        authMiddleware.authenticate,
        async (req, res): Promise<void> => {
            const userId = req.user?.id;
            const { stageId } = req.params;
            const { numberOfEpisodes, customRequirements, cascadedParams } = req.body; // 🔥 NEW: Extract cascadedParams

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            try {
                const result = await episodeService.startEpisodeGeneration(
                    userId,
                    stageId,
                    numberOfEpisodes,
                    customRequirements,
                    cascadedParams // 🔥 NEW: Pass cascaded parameters
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

    // Get latest episode generation for a stage (any status)
    router.get('/stages/:stageId/latest-generation',
        authMiddleware.authenticate,
        async (req, res): Promise<void> => {
            const userId = req.user?.id;
            const { stageId } = req.params;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            try {
                const latestGeneration = await episodeService.getLatestEpisodeGeneration(
                    userId,
                    stageId
                );
                res.json(latestGeneration);
            } catch (error: any) {
                console.error('Error getting latest episode generation:', error);
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

    // Get a specific episode synopsis
    router.get('/stages/:stageId/episodes/:episodeId',
        authMiddleware.authenticate,
        async (req, res): Promise<void> => {
            const userId = req.user?.id;
            const { stageId, episodeId } = req.params;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            try {
                const episode = await episodeService.getSpecificEpisode(userId, stageId, episodeId);

                if (!episode) {
                    res.status(404).json({ error: 'Episode not found' });
                    return;
                }

                res.json(episode);
            } catch (error: any) {
                console.error('Error getting specific episode:', error);
                res.status(500).json({ error: error.message });
            }
        }
    );

    return router;
} 