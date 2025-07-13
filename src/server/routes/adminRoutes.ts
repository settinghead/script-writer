import { Router, Request, Response } from 'express';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';

/**
 * Admin routes for debugging and development
 * TODO: Update these routes to work with the new template system
 */
export function createAdminRoutes(
    jsondocRepo: JsondocRepository,
    authMiddleware: any
) {
    const router = Router();

    // GET /api/admin/tools - List available tools
    router.get('/tools', authMiddleware.authenticate, async (req: Request, res: Response) => {
        // TODO: Update to list tools from new system
        res.json({
            message: 'Tool listing is being updated for the new template system',
            status: 'under_construction'
        });
    });

    // POST /api/admin/tools/:toolName/prompt - Execute tool and show prompt
    router.post('/tools/:toolName/prompt', authMiddleware.authenticate, async (req: Request, res: Response) => {
        // TODO: Update to work with new template system
        const { toolName } = req.params;
        res.json({
            message: 'Tool execution is being updated for the new template system',
            toolName,
            status: 'under_construction'
        });
    });

    // GET /api/admin/tools/:toolName/prompt - Get template prompt
    router.get('/tools/:toolName/prompt', async (req: Request, res: Response) => {
        const { toolName } = req.params;

        // TODO: Update to work with new template system
        res.json({
            message: 'Template prompt generation is being updated for the new template system',
            toolName,
            status: 'under_construction'
        });
    });

    // GET /api/admin/jsondocs/:projectId - Get jsondocs for a project
    router.get('/jsondocs/:projectId', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const { projectId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Check if user has access to this project
            const hasAccess = await jsondocRepo.userHasProjectAccess(userId, projectId);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied to project' });
                return;
            }

            // Get jsondocs for the project
            const jsondocs = await jsondocRepo.getProjectJsondocs(projectId);

            res.json({
                projectId,
                jsondocs: jsondocs.map((jsondoc: any) => ({
                    id: jsondoc.id,
                    schema_type: jsondoc.schema_type,
                    schema_version: jsondoc.schema_version,
                    origin_type: jsondoc.origin_type,
                    streaming_status: jsondoc.streaming_status,
                    created_at: jsondoc.created_at,
                    // Include a preview of the data
                    dataPreview: typeof jsondoc.data === 'object'
                        ? Object.keys(jsondoc.data || {}).slice(0, 5)
                        : 'non-object'
                }))
            });

        } catch (error) {
            console.error('Error fetching jsondocs:', error);
            res.status(500).json({
                error: 'Failed to fetch jsondocs',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    });

    return router;
} 