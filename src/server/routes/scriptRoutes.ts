import express from 'express';
import { AuthMiddleware } from '../middleware/auth.js';
import { ScriptGenerationService } from '../services/ScriptGenerationService.js';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository.js';
import { TransformRepository } from '../transform-artifact-framework/TransformRepository.js';
import { TransformExecutor } from '../services/TransformExecutor.js';
import { TemplateService } from '../services/templates/TemplateService.js';
import { ScriptGenerateRequest, ScriptGenerateResponse } from '../../common/streaming/types.js';

export function createScriptRoutes(
    artifactRepo: ArtifactRepository,
    transformRepo: TransformRepository,
    authMiddleware: AuthMiddleware
) {
    const router = express.Router();

    // Dependencies
    const templateService = new TemplateService();
    const transformExecutor = new TransformExecutor(artifactRepo, transformRepo);

    const scriptService = new ScriptGenerationService(
        artifactRepo,
        transformRepo,
        transformExecutor,
        templateService
    );

    // Generate script for an episode
    router.post('/generate', authMiddleware.authenticate, async (req, res): Promise<void> => {
        try {
            const userId = req.user!.id;
            const { episodeId, stageId, userRequirements }: ScriptGenerateRequest = req.body;

            if (!episodeId || !stageId) {
                res.status(400).json({ error: 'episodeId and stageId are required' });
                return;
            }

            const result = await scriptService.generateScript(
                userId,
                episodeId,
                stageId,
                userRequirements
            );

            const response: ScriptGenerateResponse = {
                sessionId: result.sessionId,
                transformId: result.transformId
            };

            res.json(response);
        } catch (error) {
            console.error('Error generating script:', error);
            res.status(500).json({ error: 'Failed to generate script' });
        }
    });

    // Get generated script
    router.get('/:episodeId/:stageId', authMiddleware.authenticate, async (req, res): Promise<void> => {
        try {
            const userId = req.user!.id;
            const { episodeId, stageId } = req.params;

            const script = await scriptService.getGeneratedScript(userId, episodeId, stageId);

            if (!script) {
                res.status(404).json({ error: 'Script not found' });
                return;
            }

            res.json(script);
        } catch (error) {
            console.error('Error getting script:', error);
            res.status(500).json({ error: 'Failed to get script' });
        }
    });

    // Check if script exists
    router.get('/:episodeId/:stageId/exists', authMiddleware.authenticate, async (req, res) => {
        try {
            const userId = req.user!.id;
            const { episodeId, stageId } = req.params;

            const exists = await scriptService.checkScriptExists(userId, episodeId, stageId);

            res.json({ exists });
        } catch (error) {
            console.error('Error checking script existence:', error);
            res.status(500).json({ error: 'Failed to check script existence' });
        }
    });

    return router;
} 