import express from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { JsonDocRepository } from '../transform-jsonDoc-framework/JsonDocRepository';
import { TransformRepository } from '../transform-jsonDoc-framework/TransformRepository';
import { TransformExecutor } from '../transform-jsonDoc-framework/TransformExecutor';
import { HumanTransformExecutor } from '../transform-jsonDoc-framework/HumanTransformExecutor';


export function createJsonDocRoutes(
    authMiddleware: AuthMiddleware,
    jsonDocRepo: JsonDocRepository,
    transformRepo: TransformRepository
) {
    const router = express.Router();
    const transformExecutor = new TransformExecutor(jsonDocRepo, transformRepo);
    const schemaExecutor = new HumanTransformExecutor(jsonDocRepo, transformRepo);

    // Create new jsonDoc
    router.post('/', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { projectId, schemaType, data } = req.body;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            if (!projectId || !schemaType) {
                res.status(400).json({ error: 'projectId and schemaType are required' });
                return;
            }

            // Verify user has access to this project
            const hasAccess = await jsonDocRepo.userHasProjectAccess(user.id, projectId);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied - user not member of project' });
                return;
            }

            // Allow minimal data for brainstorm_input_params to enable empty jsonDoc creation
            let jsonDocData = data;
            let isInitialInput = false;

            if (schemaType === 'brainstorm_input_params') {
                // Check if this is explicitly marked as initial input
                isInitialInput = data && data.initialInput === true;

                // Provide defaults for brainstorm input if not specified
                jsonDocData = {
                    platform: '抖音',
                    genre: '',
                    genrePaths: [],
                    other_requirements: '',
                    numberOfIdeas: 3,
                    ...data // Override with any provided data
                };

                // Remove the initialInput flag from the actual jsonDoc data
                delete jsonDocData.initialInput;
            } else if (!data) {
                res.status(400).json({ error: 'data is required for this jsonDoc type' });
                return;
            }

            // Create the jsonDoc
            const jsonDoc = await jsonDocRepo.createJsonDoc(
                projectId,
                schemaType,
                jsonDocData,
                'v1', // Default type version
                {}, // Empty metadata
                'completed', // New jsonDocs are completed
                'user_input', // New jsonDocs created via API are user input
                isInitialInput // Skip validation for initial brainstorm inputs
            );

            res.status(201).json(jsonDoc);
        } catch (error: any) {
            console.error('Error creating jsonDoc:', error);
            res.status(500).json({
                error: 'Failed to create jsonDoc',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Get jsonDoc by ID
    router.get('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const jsonDoc = await jsonDocRepo.getJsonDoc(id);
            if (!jsonDoc) {
                res.status(404).json({ error: 'JsonDoc not found' });
                return;
            }

            // Verify user has access to this jsonDoc's project
            const hasAccess = await jsonDocRepo.userHasProjectAccess(user.id, jsonDoc.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            res.json(jsonDoc);
        } catch (error: any) {
            console.error('Error fetching jsonDoc:', error);
            res.status(500).json({
                error: 'Failed to fetch jsonDoc',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Edit jsonDoc with path-based derivation
    router.post('/:id/edit-with-path', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: jsonDocId } = req.params;
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

            // Get jsonDoc to verify access
            const jsonDoc = await jsonDocRepo.getJsonDoc(jsonDocId);
            if (!jsonDoc) {
                res.status(404).json({ error: 'JsonDoc not found' });
                return;
            }

            // Verify user has access to this jsonDoc's project
            const hasAccess = await jsonDocRepo.userHasProjectAccess(userId, jsonDoc.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Execute human transform with path
            const result = await transformExecutor.executeHumanTransformWithPath(
                jsonDoc.project_id,
                jsonDocId,
                path,
                field,
                value,
                userId
            );

            res.json({
                jsonDocId: result.derivedJsonDoc.id,
                wasTransformed: result.wasTransformed,
                transformId: result.transform.id
            });
        } catch (error: any) {
            console.error('Error editing jsonDoc with path:', error);
            res.status(500).json({ error: error.message || 'Internal server error' });
        }
    });

    // Get human transform for jsonDoc and path
    router.get('/:id/human-transform', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: jsonDocId } = req.params;
            const { path = "" } = req.query;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Get jsonDoc to verify access
            const jsonDoc = await jsonDocRepo.getJsonDoc(jsonDocId);
            if (!jsonDoc) {
                res.status(404).json({ error: 'JsonDoc not found' });
                return;
            }

            // Verify user has access to this jsonDoc's project
            const hasAccess = await jsonDocRepo.userHasProjectAccess(userId, jsonDoc.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Find human transform
            const transform = await transformRepo.findHumanTransform(
                jsonDocId,
                path as string,
                jsonDoc.project_id
            );

            res.json(transform);
        } catch (error: any) {
            console.error('Error fetching human transform:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // List jsonDocs by type and project
    router.get('/', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { projectId, schemaType, schemaVersion = 'v1' } = req.query;
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
            const hasAccess = await jsonDocRepo.userHasProjectAccess(userId, projectId as string);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            let jsonDocs;
            if (schemaType) {
                jsonDocs = await jsonDocRepo.getJsonDocsByType(
                    projectId as string,
                    schemaType,
                    schemaVersion
                );
            } else {
                jsonDocs = await jsonDocRepo.getProjectJsonDocs(projectId as string);
            }

            res.json(jsonDocs);
        } catch (error: any) {
            console.error('Error fetching jsonDocs:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Schema-driven transform route
    router.post('/:id/human-transform', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: jsonDocId } = req.params;
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

            // Get jsonDoc to verify access
            const jsonDoc = await jsonDocRepo.getJsonDoc(jsonDocId);
            if (!jsonDoc) {
                res.status(404).json({ error: 'JsonDoc not found' });
                return;
            }

            // Verify user has access to this jsonDoc's project
            const hasAccess = await jsonDocRepo.userHasProjectAccess(userId, jsonDoc.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            const result = await schemaExecutor.executeSchemaHumanTransform(
                transformName,
                jsonDocId,
                derivationPath,
                jsonDoc.project_id,
                fieldUpdates
            );

            res.json(result);
        } catch (error: any) {
            console.error('Schema transform error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Delete jsonDoc by ID
    router.delete('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: jsonDocId } = req.params;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Get jsonDoc to verify it exists and get project_id
            const jsonDoc = await jsonDocRepo.getJsonDoc(jsonDocId);
            if (!jsonDoc) {
                res.status(404).json({ error: 'JsonDoc not found' });
                return;
            }

            // Verify user has access to this jsonDoc's project
            const hasAccess = await jsonDocRepo.userHasProjectAccess(user.id, jsonDoc.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Validate that this is a leaf jsonDoc (no other transforms depend on it)
            const dependentTransforms = await transformRepo.getTransformInputsByJsonDoc(jsonDocId);
            if (dependentTransforms.length > 0) {
                res.status(400).json({
                    error: 'Cannot delete non-leaf jsonDoc',
                    details: `JsonDoc ${jsonDocId} is used by other transforms`,
                    dependentTransforms: dependentTransforms.map(t => t.transform_id)
                });
                return;
            }

            // Delete associated transform output records first
            await transformRepo.deleteTransformOutputsByJsonDoc(jsonDocId);

            // Now safe to delete the jsonDoc
            await jsonDocRepo.deleteJsonDoc(jsonDocId);

            res.json({
                success: true,
                deletedJsonDocId: jsonDocId,
                message: `JsonDoc ${jsonDocId} deleted successfully`
            });

        } catch (error: any) {
            console.error('Error deleting jsonDoc:', error);
            res.status(500).json({
                error: 'Failed to delete jsonDoc',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Update jsonDoc by ID
    router.put('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: jsonDocId } = req.params;
            const { text, data } = req.body;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Get existing jsonDoc first
            const existingJsonDoc = await jsonDocRepo.getJsonDoc(jsonDocId);
            if (!existingJsonDoc) {
                res.status(404).json({ error: 'JsonDoc not found' });
                return;
            }

            // Check if user has access to the project containing this jsonDoc
            const hasAccess = await jsonDocRepo.userHasProjectAccess(user.id, existingJsonDoc.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied - user not member of project' });
                return;
            }

            // CRITICAL: Prevent direct updates to LLM-generated jsonDocs
            // Check if this jsonDoc was created by an LLM transform
            const isLLMGenerated = await transformRepo.isJsonDocLLMGenerated(jsonDocId);
            if (isLLMGenerated) {
                res.status(403).json({
                    error: 'Cannot directly edit LLM-generated jsonDocs',
                    details: 'LLM-generated jsonDocs are immutable. Use human transforms to create editable versions.',
                    code: 'LLM_JSONDOC_IMMUTABLE'
                });
                return;
            }

            let updatedData;

            // Allow updates based on origin_type (human-created jsonDocs) or specific types
            if (existingJsonDoc.origin_type === 'user_input') {
                // For human-created jsonDocs, allow direct data updates regardless of schema type
                if (!data || typeof data !== 'object') {
                    res.status(400).json({
                        error: 'Missing or invalid data',
                        details: 'data must be an object for user-created jsonDocs'
                    });
                    return;
                }
                updatedData = data;
            } else if (existingJsonDoc.schema_type === 'brainstorm_idea') {
                // Validate required fields for brainstorm_idea
                if (!data || typeof data !== 'object') {
                    res.status(400).json({
                        error: 'Missing or invalid data',
                        details: 'data must be an object for brainstorm_idea jsonDocs'
                    });
                    return;
                }

                // Update the jsonDoc in place (for brainstorm_idea jsonDocs)
                updatedData = data;
            } else {
                res.status(400).json({ error: `Cannot update jsonDocs of type: ${existingJsonDoc.schema_type} with origin_type: ${existingJsonDoc.origin_type}` });
                return;
            }

            // Update the jsonDoc using the repository
            await jsonDocRepo.updateJsonDoc(jsonDocId, updatedData, existingJsonDoc.metadata);

            // Return the updated jsonDoc with the same ID
            const updatedJsonDoc = {
                ...existingJsonDoc,
                data: updatedData
            };

            res.json(updatedJsonDoc);
        } catch (error: any) {
            console.error('Error updating jsonDoc:', error);
            res.status(500).json({
                error: 'Failed to update jsonDoc',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    return router;
} 