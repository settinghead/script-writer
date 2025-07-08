import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth';
import { db } from '../database/connection';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';
import { AuthDatabase } from '../database/auth';

const router = Router();

// Initialize auth middleware
const authDB = new AuthDatabase(db);
const authMiddleware = createAuthMiddleware(authDB);
const requireAuth = authMiddleware.authenticate;

// Initialize artifact repository
const artifactRepo = new ArtifactRepository(db);

/**
 * Get artifact data for YJS initialization
 * GET /api/yjs/artifact/:artifactId
 */
router.get('/artifact/:artifactId', requireAuth, async (req, res): Promise<void> => {
    try {
        const { artifactId } = req.params;
        const userId = req.user!.id;

        // Verify user has access to this artifact's project
        const artifact = await artifactRepo.getArtifact(artifactId);
        if (!artifact) {
            res.status(404).json({ error: 'Artifact not found' });
            return;
        }

        const hasAccess = await artifactRepo.userHasProjectAccess(userId, artifact.project_id);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        // Return artifact data for YJS initialization
        res.json({
            artifactId: artifact.id,
            projectId: artifact.project_id,
            data: artifact.data,
            roomId: `artifact-${artifactId}`,
            success: true
        });
    } catch (error) {
        console.error('Error getting artifact for YJS:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Update artifact from YJS changes
 * PUT /api/yjs/artifact/:artifactId
 */
router.put('/artifact/:artifactId', requireAuth, async (req, res): Promise<void> => {
    try {
        const { artifactId } = req.params;
        const { data } = req.body;
        const userId = req.user!.id;

        // Verify user has access to this artifact's project
        const artifact = await artifactRepo.getArtifact(artifactId);
        if (!artifact) {
            res.status(404).json({ error: 'Artifact not found' });
            return;
        }

        const hasAccess = await artifactRepo.userHasProjectAccess(userId, artifact.project_id);
        if (!hasAccess) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        // Update artifact data
        // TODO: In Phase 2, this will create a proper human transform
        await artifactRepo.updateArtifact(artifactId, data);

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating artifact from YJS:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Health check for YJS service
 * GET /api/yjs/health
 */
router.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'yjs' });
});

export default router;
