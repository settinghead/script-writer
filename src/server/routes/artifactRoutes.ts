import { Router } from 'express';
import { ArtifactRepository } from '../repositories/ArtifactRepository';

export function createArtifactRoutes(
    authMiddleware: any,
    artifactRepo: ArtifactRepository
): Router {
    const router = Router();

    // Get artifacts for a project
    router.get('/project/:projectId', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { projectId } = req.params;
            const { type } = req.query;
            const userId = req.user.id;

            // TODO: Verify user has access to this project

            const artifacts = await artifactRepo.getArtifactsByType(
                projectId,
                type || undefined
            );

            res.json(artifacts);
        } catch (error) {
            console.error('Error getting artifacts:', error);
            res.status(500).json({ 
                error: error instanceof Error ? error.message : 'Internal server error' 
            });
        }
    });

    return router;
} 