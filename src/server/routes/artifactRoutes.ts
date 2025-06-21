import express from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { TransformExecutor } from '../services/TransformExecutor';
import { SchemaTransformExecutor } from '../services/SchemaTransformExecutor';

export function createArtifactRoutes(
    authMiddleware: AuthMiddleware,
    artifactRepo: ArtifactRepository,
    transformRepo: TransformRepository
) {
    const router = express.Router();
    const transformExecutor = new TransformExecutor(artifactRepo, transformRepo);
    const schemaExecutor = new SchemaTransformExecutor(artifactRepo, transformRepo);

    // Get artifact by ID
    router.get('/:id', authMiddleware.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const artifact = await artifactRepo.getArtifact(id);
        if (!artifact) {
            return res.status(404).json({ error: 'Artifact not found' });
        }

        // Verify user has access to this artifact's project
        const hasAccess = await artifactRepo.userHasProjectAccess(userId, artifact.project_id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(artifact);
    } catch (error) {
        console.error('Error fetching artifact:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

    // Edit artifact with path-based derivation
    router.post('/:id/edit-with-path', authMiddleware.authenticate, async (req, res) => {
    try {
        const { id: artifactId } = req.params;
        const { path = "", field, value } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!field || value === undefined) {
            return res.status(400).json({ error: 'Field and value are required' });
        }

        // Get artifact to verify access
        const artifact = await artifactRepo.getArtifact(artifactId);
        if (!artifact) {
            return res.status(404).json({ error: 'Artifact not found' });
        }

        // Verify user has access to this artifact's project
        const hasAccess = await artifactRepo.userHasProjectAccess(userId, artifact.project_id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Execute human transform with path
        const result = await transformExecutor.executeHumanTransformWithPath(
            artifact.project_id,
            artifactId,
            path,
            field,
            value,
            userId
        );

        res.json({
            artifactId: result.derivedArtifact.id,
            wasTransformed: result.wasTransformed,
            transformId: result.transform.id
        });
    } catch (error) {
        console.error('Error editing artifact with path:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

    // Get human transform for artifact and path
    router.get('/:id/human-transform', authMiddleware.authenticate, async (req, res) => {
    try {
        const { id: artifactId } = req.params;
        const { path = "" } = req.query;
        const userId = req.user.id;

        // Get artifact to verify access
        const artifact = await artifactRepo.getArtifact(artifactId);
        if (!artifact) {
            return res.status(404).json({ error: 'Artifact not found' });
        }

        // Verify user has access to this artifact's project
        const hasAccess = await artifactRepo.userHasProjectAccess(userId, artifact.project_id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Find human transform
        const transform = await transformRepo.findHumanTransform(
            artifactId, 
            path as string, 
            artifact.project_id
        );

        res.json(transform);
    } catch (error) {
        console.error('Error fetching human transform:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

    // List artifacts by type and project
    router.get('/', authMiddleware.authenticate, async (req, res) => {
    try {
        const { projectId, type, typeVersion = 'v1' } = req.query;
        const userId = req.user.id;

        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }

        // Verify user has access to this project
        const hasAccess = await artifactRepo.userHasProjectAccess(userId, projectId as string);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        let artifacts;
        if (type) {
            artifacts = await artifactRepo.getArtifactsByType(
                projectId as string, 
                type as string, 
                typeVersion as string
            );
        } else {
            artifacts = await artifactRepo.getProjectArtifacts(projectId as string);
        }

        res.json(artifacts);
    } catch (error) {
        console.error('Error fetching artifacts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

    // Schema-driven transform route
    router.post('/:id/schema-transform', authMiddleware.authenticate, async (req, res) => {
        try {
            const { id: artifactId } = req.params;
            const { transformName, derivationPath, fieldUpdates } = req.body;
            const userId = req.user.id;

            if (!transformName || !derivationPath) {
                return res.status(400).json({ error: "transformName and derivationPath are required" });
            }

            // Get artifact to verify access
            const artifact = await artifactRepo.getArtifact(artifactId);
            if (!artifact) {
                return res.status(404).json({ error: 'Artifact not found' });
            }

            // Verify user has access to this artifact's project
            const hasAccess = await artifactRepo.userHasProjectAccess(userId, artifact.project_id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const result = await schemaExecutor.executeSchemaHumanTransform(
                transformName,
                artifactId,
                derivationPath,
                artifact.project_id,
                fieldUpdates
            );

            res.json(result);
        } catch (error: any) {
            console.error('Schema transform error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
} 