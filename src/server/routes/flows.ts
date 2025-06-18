import express from 'express';
import { FlowService } from '../services/FlowService';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';

export function createFlowRoutes(
    authMiddleware: any,
    artifactRepo: ArtifactRepository,
    transformRepo: TransformRepository
) {
    const router = express.Router();

    // Get all project flows (unified endpoint)
    router.get('/', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const flowService = new FlowService(artifactRepo, transformRepo);
            const flows = await flowService.getProjectFlows(user.id);
            res.json(flows);
        } catch (error: any) {
            console.error('Error getting project flows:', error);
            res.status(500).json({
                error: 'Failed to get project flows',
                details: error.message
            });
        }
    });

    return router;
} 