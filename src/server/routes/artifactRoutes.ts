import express from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';
import { TransformRepository } from '../transform-artifact-framework/TransformRepository';
import { TransformExecutor } from '../transform-artifact-framework/TransformExecutor';
import { HumanTransformExecutor } from '../transform-artifact-framework/HumanTransformExecutor';


export function createArtifactRoutes(
    authMiddleware: AuthMiddleware,
    artifactRepo: ArtifactRepository,
    transformRepo: TransformRepository
) {
    const router = express.Router();
    const transformExecutor = new TransformExecutor(artifactRepo, transformRepo);
    const schemaExecutor = new HumanTransformExecutor(artifactRepo, transformRepo);

    // Create new artifact
    router.post('/', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { projectId, type, data } = req.body;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            if (!projectId || !type) {
                res.status(400).json({ error: 'projectId and type are required' });
                return;
            }

            // Verify user has access to this project
            const hasAccess = await artifactRepo.userHasProjectAccess(user.id, projectId);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied - user not member of project' });
                return;
            }

            // Allow minimal data for brainstorm_tool_input_schema to enable empty artifact creation
            let artifactData = data;
            let isInitialInput = false;

            if (type === 'brainstorm_tool_input_schema') {
                // Check if this is explicitly marked as initial input
                isInitialInput = data && data.initialInput === true;

                // Provide defaults for brainstorm input if not specified
                artifactData = {
                    platform: '抖音',
                    genre: '',
                    genrePaths: [],
                    other_requirements: '',
                    numberOfIdeas: 3,
                    ...data // Override with any provided data
                };

                // Remove the initialInput flag from the actual artifact data
                delete artifactData.initialInput;
            } else if (!data) {
                res.status(400).json({ error: 'data is required for this artifact type' });
                return;
            }

            // Create the artifact
            const artifact = await artifactRepo.createArtifact(
                projectId,
                type,
                artifactData,
                'v1', // Default type version
                {}, // Empty metadata
                'completed', // New artifacts are completed
                'user_input', // New artifacts created via API are user input
                isInitialInput // Skip validation for initial brainstorm inputs
            );

            res.status(201).json(artifact);
        } catch (error: any) {
            console.error('Error creating artifact:', error);
            res.status(500).json({
                error: 'Failed to create artifact',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Get artifact by ID
    router.get('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const artifact = await artifactRepo.getArtifact(id);
            if (!artifact) {
                res.status(404).json({ error: 'Artifact not found' });
                return;
            }

            // Verify user has access to this artifact's project
            const hasAccess = await artifactRepo.userHasProjectAccess(user.id, artifact.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            res.json(artifact);
        } catch (error: any) {
            console.error('Error fetching artifact:', error);
            res.status(500).json({
                error: 'Failed to fetch artifact',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Edit artifact with path-based derivation
    router.post('/:id/edit-with-path', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: artifactId } = req.params;
            const { path = "", field, value } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Validate required fields
            if (!field || value === undefined) {
                res.status(400).json({ error: 'Field and value are required' });
                return;
            }

            // Get artifact to verify access
            const artifact = await artifactRepo.getArtifact(artifactId);
            if (!artifact) {
                res.status(404).json({ error: 'Artifact not found' });
                return;
            }

            // Verify user has access to this artifact's project
            const hasAccess = await artifactRepo.userHasProjectAccess(userId, artifact.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
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
        } catch (error: any) {
            console.error('Error editing artifact with path:', error);
            res.status(500).json({ error: error.message || 'Internal server error' });
        }
    });

    // Get human transform for artifact and path
    router.get('/:id/human-transform', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: artifactId } = req.params;
            const { path = "" } = req.query;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Get artifact to verify access
            const artifact = await artifactRepo.getArtifact(artifactId);
            if (!artifact) {
                res.status(404).json({ error: 'Artifact not found' });
                return;
            }

            // Verify user has access to this artifact's project
            const hasAccess = await artifactRepo.userHasProjectAccess(userId, artifact.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Find human transform
            const transform = await transformRepo.findHumanTransform(
                artifactId,
                path as string,
                artifact.project_id
            );

            res.json(transform);
        } catch (error: any) {
            console.error('Error fetching human transform:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // List artifacts by type and project
    router.get('/', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { projectId, type, typeVersion = 'v1' } = req.query;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            if (!projectId) {
                res.status(400).json({ error: 'projectId is required' });
                return;
            }

            // Verify user has access to this project
            const hasAccess = await artifactRepo.userHasProjectAccess(userId, projectId as string);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
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
        } catch (error: any) {
            console.error('Error fetching artifacts:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Schema-driven transform route
    router.post('/:id/human-transform', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: artifactId } = req.params;
            const { transformName, derivationPath, fieldUpdates } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            if (!transformName || (derivationPath === null || derivationPath === undefined)) {
                res.status(400).json({ error: "transformName and derivationPath are required" });
                return;
            }

            // Get artifact to verify access
            const artifact = await artifactRepo.getArtifact(artifactId);
            if (!artifact) {
                res.status(404).json({ error: 'Artifact not found' });
                return;
            }

            // Verify user has access to this artifact's project
            const hasAccess = await artifactRepo.userHasProjectAccess(userId, artifact.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
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

    // Delete artifact by ID
    router.delete('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: artifactId } = req.params;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Get artifact to verify it exists and get project_id
            const artifact = await artifactRepo.getArtifact(artifactId);
            if (!artifact) {
                res.status(404).json({ error: 'Artifact not found' });
                return;
            }

            // Verify user has access to this artifact's project
            const hasAccess = await artifactRepo.userHasProjectAccess(user.id, artifact.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Validate that this is a leaf artifact (no other transforms depend on it)
            const dependentTransforms = await transformRepo.getTransformInputsByArtifact(artifactId);
            if (dependentTransforms.length > 0) {
                res.status(400).json({
                    error: 'Cannot delete non-leaf artifact',
                    details: `Artifact ${artifactId} is used by other transforms`,
                    dependentTransforms: dependentTransforms.map(t => t.transform_id)
                });
                return;
            }

            // Delete associated transform output records first
            await transformRepo.deleteTransformOutputsByArtifact(artifactId);

            // Now safe to delete the artifact
            await artifactRepo.deleteArtifact(artifactId);

            res.json({
                success: true,
                deletedArtifactId: artifactId,
                message: `Artifact ${artifactId} deleted successfully`
            });

        } catch (error: any) {
            console.error('Error deleting artifact:', error);
            res.status(500).json({
                error: 'Failed to delete artifact',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Update artifact by ID
    router.put('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: artifactId } = req.params;
            const { text, data } = req.body;
            const user = authMiddleware.getCurrentUser(req);

            // DEBUG: Log the incoming request data
            console.log(`[ARTIFACT UPDATE] ${artifactId}`);
            console.log('Request body:', JSON.stringify(req.body, null, 2));
            console.log('Data type:', typeof data);
            console.log('Data value:', data);

            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Get existing artifact first
            const existingArtifact = await artifactRepo.getArtifact(artifactId);
            if (!existingArtifact) {
                res.status(404).json({ error: 'Artifact not found' });
                return;
            }

            // Check if user has access to the project containing this artifact
            const hasAccess = await artifactRepo.userHasProjectAccess(user.id, existingArtifact.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied - user not member of project' });
                return;
            }

            // CRITICAL: Prevent direct updates to LLM-generated artifacts
            // Check if this artifact was created by an LLM transform
            const isLLMGenerated = await transformRepo.isArtifactLLMGenerated(artifactId);
            if (isLLMGenerated) {
                res.status(403).json({
                    error: 'Cannot directly edit LLM-generated artifacts',
                    details: 'LLM-generated artifacts are immutable. Use human transforms to create editable versions.',
                    code: 'LLM_ARTIFACT_IMMUTABLE'
                });
                return;
            }

            let updatedData;

            // Allow updates based on origin_type (human-created artifacts) or specific types
            if (existingArtifact.origin_type === 'user_input') {
                // For human-created artifacts, allow direct data updates regardless of schema type
                if (!data || typeof data !== 'object') {
                    res.status(400).json({
                        error: 'Missing or invalid data',
                        details: 'data must be an object for user-created artifacts'
                    });
                    return;
                }
                updatedData = data;
            } else if (existingArtifact.schema_type === 'brainstorm_idea_schema') {
                // Validate required fields for brainstorm_idea
                if (!data || typeof data !== 'object') {
                    res.status(400).json({
                        error: 'Missing or invalid data',
                        details: 'data must be an object for brainstorm_idea artifacts'
                    });
                    return;
                }

                // Update the artifact in place (for brainstorm_idea artifacts)
                updatedData = data;
            } else {
                res.status(400).json({ error: `Cannot update artifacts of type: ${existingArtifact.schema_type} with origin_type: ${existingArtifact.origin_type}` });
                return;
            }

            // Update the artifact using the repository
            await artifactRepo.updateArtifact(artifactId, updatedData, existingArtifact.metadata);

            // Return the updated artifact with the same ID
            const updatedArtifact = {
                ...existingArtifact,
                data: updatedData
            };

            res.json(updatedArtifact);
        } catch (error: any) {
            console.error('Error updating artifact:', error);
            res.status(500).json({
                error: 'Failed to update artifact',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    return router;
} 