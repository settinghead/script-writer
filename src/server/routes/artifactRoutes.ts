import { Router } from 'express';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';

export function createArtifactRoutes(
    authMiddleware: any,
    artifactRepo: ArtifactRepository,
    transformRepo: TransformRepository
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

    // Edit an artifact (LLM→Human transform logic)
    router.post('/:artifactId/edit', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { artifactId } = req.params;
            const { field, value, projectId } = req.body;
            const userId = req.user.id;

            // Validate required fields
            if (!field || value === undefined || !projectId) {
                return res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    message: 'Missing required fields: field, value, projectId'
                });
            }

            // Get the original artifact
            const artifact = await artifactRepo.getArtifact(artifactId, projectId);
            if (!artifact) {
                return res.status(404).json({
                    error: 'NOT_FOUND',
                    message: 'Artifact not found'
                });
            }

            // TODO: Verify user has access to this project

            // Parse metadata to check if it's LLM-generated
            let metadata = {};
            try {
                metadata = artifact.metadata ? JSON.parse(artifact.metadata as string) : {};
            } catch (e) {
                console.warn('Failed to parse artifact metadata:', e);
            }

            const isLLMGenerated = (metadata as any).source === 'llm';

            if (isLLMGenerated) {
                // Create human transform + new artifact for LLM-generated content
                const transform = await transformRepo.createTransform(
                    projectId,
                    'human',
                    'v1',
                    'completed'
                );

                // Parse existing data and update the field
                let newData = {};
                try {
                    newData = JSON.parse(artifact.data as string);
                } catch (e) {
                    console.warn('Failed to parse artifact data:', e);
                    newData = {};
                }
                (newData as any)[field] = value;

                // Create new artifact with user modification
                const newArtifact = await artifactRepo.createArtifact(
                    projectId,
                    artifact.type,
                    newData,
                    artifact.type_version,
                    {
                        source: 'human',
                        original_artifact_id: artifactId,
                        modified_field: field,
                        modified_at: new Date().toISOString()
                    }
                );

                // Link transform inputs and outputs
                await transformRepo.addTransformInputs(transform.id, [{ artifactId }]);
                await transformRepo.addTransformOutputs(transform.id, [{ artifactId: newArtifact.id }]);

                // Add human transform details
                await transformRepo.addHumanTransform({
                    transform_id: transform.id,
                    action_type: 'field_edit',
                    interface_context: { field, originalValue: (artifact.data as any)[field], newValue: value },
                    change_description: `User modified ${field} field`
                });

                res.json({
                    artifactId: newArtifact.id,
                    wasTransformed: true,
                    transformId: transform.id
                });
            } else {
                // Direct update for user-generated content
                let updatedData = {};
                try {
                    updatedData = JSON.parse(artifact.data as string);
                } catch (e) {
                    console.warn('Failed to parse artifact data:', e);
                    updatedData = {};
                }
                (updatedData as any)[field] = value;

                await artifactRepo.updateArtifact(artifactId, updatedData, {
                    ...metadata,
                    last_modified: new Date().toISOString(),
                    modified_field: field
                });

                res.json({
                    artifactId,
                    wasTransformed: false
                });
            }

        } catch (error) {
            console.error('Error editing artifact:', error);
            res.status(500).json({
                error: 'INTERNAL_ERROR',
                message: error instanceof Error ? error.message : 'Internal server error'
            });
        }
    });

    return router;
} 