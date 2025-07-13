import express from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { TransformExecutor } from '../transform-jsondoc-framework/TransformExecutor';
import { HumanTransformExecutor } from '../transform-jsondoc-framework/HumanTransformExecutor';


export function createJsondocRoutes(
    authMiddleware: AuthMiddleware,
    jsondocRepo: JsondocRepository,
    transformRepo: TransformRepository
) {
    const router = express.Router();
    const transformExecutor = new TransformExecutor(jsondocRepo, transformRepo);
    const schemaExecutor = new HumanTransformExecutor(jsondocRepo, transformRepo);

    // Create new jsondoc
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
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, projectId);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied - user not member of project' });
                return;
            }

            // Allow minimal data for brainstorm_input_params to enable empty jsondoc creation
            let jsondocData = data;
            let isInitialInput = false;

            if (schemaType === 'brainstorm_input_params') {
                // Check if this is explicitly marked as initial input
                isInitialInput = data && data.initialInput === true;

                // Provide defaults for brainstorm input if not specified
                jsondocData = {
                    platform: '抖音',
                    genre: '',
                    genrePaths: [],
                    other_requirements: '',
                    numberOfIdeas: 3,
                    ...data // Override with any provided data
                };

                // Remove the initialInput flag from the actual jsondoc data
                delete jsondocData.initialInput;
            } else if (!data) {
                res.status(400).json({ error: 'data is required for this jsondoc type' });
                return;
            }

            // Create the jsondoc
            const jsondoc = await jsondocRepo.createJsondoc(
                projectId,
                schemaType,
                jsondocData,
                'v1', // Default type version
                {}, // Empty metadata
                'completed', // New jsondocs are completed
                'user_input', // New jsondocs created via API are user input
                isInitialInput // Skip validation for initial brainstorm inputs
            );

            res.status(201).json(jsondoc);
        } catch (error: any) {
            console.error('Error creating jsondoc:', error);
            res.status(500).json({
                error: 'Failed to create jsondoc',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Get jsondoc by ID
    router.get('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const jsondoc = await jsondocRepo.getJsondoc(id);
            if (!jsondoc) {
                res.status(404).json({ error: 'Jsondoc not found' });
                return;
            }

            // Verify user has access to this jsondoc's project
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, jsondoc.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            res.json(jsondoc);
        } catch (error: any) {
            console.error('Error fetching jsondoc:', error);
            res.status(500).json({
                error: 'Failed to fetch jsondoc',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Edit jsondoc with path-based derivation
    router.post('/:id/edit-with-path', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: jsondocId } = req.params;
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

            // Get jsondoc to verify access
            const jsondoc = await jsondocRepo.getJsondoc(jsondocId);
            if (!jsondoc) {
                res.status(404).json({ error: 'Jsondoc not found' });
                return;
            }

            // Verify user has access to this jsondoc's project
            const hasAccess = await jsondocRepo.userHasProjectAccess(userId, jsondoc.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Execute human transform with path
            const result = await transformExecutor.executeHumanTransformWithPath(
                jsondoc.project_id,
                jsondocId,
                path,
                field,
                value,
                userId
            );

            res.json({
                jsondocId: result.derivedJsondoc.id,
                wasTransformed: result.wasTransformed,
                transformId: result.transform.id
            });
        } catch (error: any) {
            console.error('Error editing jsondoc with path:', error);
            res.status(500).json({ error: error.message || 'Internal server error' });
        }
    });

    // Get human transform for jsondoc and path
    router.get('/:id/human-transform', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: jsondocId } = req.params;
            const { path = "" } = req.query;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Get jsondoc to verify access
            const jsondoc = await jsondocRepo.getJsondoc(jsondocId);
            if (!jsondoc) {
                res.status(404).json({ error: 'Jsondoc not found' });
                return;
            }

            // Verify user has access to this jsondoc's project
            const hasAccess = await jsondocRepo.userHasProjectAccess(userId, jsondoc.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Find human transform
            const transform = await transformRepo.findHumanTransform(
                jsondocId,
                path as string,
                jsondoc.project_id
            );

            res.json(transform);
        } catch (error: any) {
            console.error('Error fetching human transform:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // List jsondocs by type and project
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
            const hasAccess = await jsondocRepo.userHasProjectAccess(userId, projectId as string);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            let jsondocs;
            if (schemaType) {
                jsondocs = await jsondocRepo.getJsondocsByType(
                    projectId as string,
                    schemaType,
                    schemaVersion
                );
            } else {
                jsondocs = await jsondocRepo.getProjectJsondocs(projectId as string);
            }

            res.json(jsondocs);
        } catch (error: any) {
            console.error('Error fetching jsondocs:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Schema-driven transform route
    router.post('/:id/human-transform', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: jsondocId } = req.params;
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

            // Get jsondoc to verify access
            const jsondoc = await jsondocRepo.getJsondoc(jsondocId);
            if (!jsondoc) {
                res.status(404).json({ error: 'Jsondoc not found' });
                return;
            }

            // Verify user has access to this jsondoc's project
            const hasAccess = await jsondocRepo.userHasProjectAccess(userId, jsondoc.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            const result = await schemaExecutor.executeSchemaHumanTransform(
                transformName,
                jsondocId,
                derivationPath,
                jsondoc.project_id,
                fieldUpdates
            );

            res.json(result);
        } catch (error: any) {
            console.error('Schema transform error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Delete jsondoc by ID
    router.delete('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: jsondocId } = req.params;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Get jsondoc to verify it exists and get project_id
            const jsondoc = await jsondocRepo.getJsondoc(jsondocId);
            if (!jsondoc) {
                res.status(404).json({ error: 'Jsondoc not found' });
                return;
            }

            // Verify user has access to this jsondoc's project
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, jsondoc.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Validate that this is a leaf jsondoc (no other transforms depend on it)
            const dependentTransforms = await transformRepo.getTransformInputsByJsondoc(jsondocId);
            if (dependentTransforms.length > 0) {
                res.status(400).json({
                    error: 'Cannot delete non-leaf jsondoc',
                    details: `Jsondoc ${jsondocId} is used by other transforms`,
                    dependentTransforms: dependentTransforms.map(t => t.transform_id)
                });
                return;
            }

            // Delete associated transform output records first
            await transformRepo.deleteTransformOutputsByJsondoc(jsondocId);

            // Now safe to delete the jsondoc
            await jsondocRepo.deleteJsondoc(jsondocId);

            res.json({
                success: true,
                deletedJsondocId: jsondocId,
                message: `Jsondoc ${jsondocId} deleted successfully`
            });

        } catch (error: any) {
            console.error('Error deleting jsondoc:', error);
            res.status(500).json({
                error: 'Failed to delete jsondoc',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Update jsondoc by ID
    router.put('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const { id: jsondocId } = req.params;
            const { text, data } = req.body;
            const user = authMiddleware.getCurrentUser(req);

            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Get existing jsondoc first
            const existingJsondoc = await jsondocRepo.getJsondoc(jsondocId);
            if (!existingJsondoc) {
                res.status(404).json({ error: 'Jsondoc not found' });
                return;
            }

            // Check if user has access to the project containing this jsondoc
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, existingJsondoc.project_id);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied - user not member of project' });
                return;
            }

            // CRITICAL: Prevent direct updates to LLM-generated jsondocs
            // Check if this jsondoc was created by an LLM transform
            const isLLMGenerated = await transformRepo.isJsondocLLMGenerated(jsondocId);
            if (isLLMGenerated) {
                res.status(403).json({
                    error: 'Cannot directly edit LLM-generated jsondocs',
                    details: 'LLM-generated jsondocs are immutable. Use human transforms to create editable versions.',
                    code: 'LLM_JSONDOC_IMMUTABLE'
                });
                return;
            }

            let updatedData;

            // Allow updates based on origin_type (human-created jsondocs) or specific types
            if (existingJsondoc.origin_type === 'user_input') {
                // For human-created jsondocs, allow direct data updates regardless of schema type
                if (!data || typeof data !== 'object') {
                    res.status(400).json({
                        error: 'Missing or invalid data',
                        details: 'data must be an object for user-created jsondocs'
                    });
                    return;
                }
                updatedData = data;
            } else if (existingJsondoc.schema_type === 'brainstorm_idea') {
                // Validate required fields for brainstorm_idea
                if (!data || typeof data !== 'object') {
                    res.status(400).json({
                        error: 'Missing or invalid data',
                        details: 'data must be an object for brainstorm_idea jsondocs'
                    });
                    return;
                }

                // Update the jsondoc in place (for brainstorm_idea jsondocs)
                updatedData = data;
            } else {
                res.status(400).json({ error: `Cannot update jsondocs of type: ${existingJsondoc.schema_type} with origin_type: ${existingJsondoc.origin_type}` });
                return;
            }

            // Update the jsondoc using the repository
            await jsondocRepo.updateJsondoc(jsondocId, updatedData, existingJsondoc.metadata);

            // Return the updated jsondoc with the same ID
            const updatedJsondoc = {
                ...existingJsondoc,
                data: updatedData
            };

            res.json(updatedJsondoc);
        } catch (error: any) {
            console.error('Error updating jsondoc:', error);
            res.status(500).json({
                error: 'Failed to update jsondoc',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    return router;
} 