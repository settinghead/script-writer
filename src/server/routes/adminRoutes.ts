import { Router, Request, Response } from 'express';
import { ToolRegistry } from '../services/ToolRegistry';
import { TemplateVariableService, TemplateExecutionContext } from '../services/TemplateVariableService';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { z } from 'zod';
import { Kysely } from 'kysely';
import type { DB } from '../database/types';

// Admin routes for debugging and development tools

// Schema for debug prompt request
const DebugPromptRequestSchema = z.object({
    toolName: z.string().min(1, 'Tool name is required'),
    jsondocs: z.array(z.object({
        jsondocId: z.string().min(1, 'Jsondoc ID is required'),
        description: z.string().min(1, 'Description is required'),
        schemaType: z.string().min(1, 'Schema type is required')
    })).min(1, 'At least one jsondoc is required'),
    additionalParams: z.record(z.any()).optional()
});

export function createAdminRoutes(
    jsondocRepo: JsondocRepository,
    authMiddleware: any
) {
    const router = Router();

    // GET /api/admin/tools - Get all available tools
    router.get('/tools', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const toolRegistry = ToolRegistry.getInstance();
            const tools = toolRegistry.getAllTools();

            const toolsInfo = tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema._def, // Zod schema definition
                templatePath: tool.templatePath,
                hasCustomTemplateVariables: !!tool.customTemplateVariables
            }));

            res.json({
                success: true,
                tools: toolsInfo
            });
        } catch (error) {
            console.error('Error getting tools:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get tools'
            });
        }
    });

    // POST /api/admin/tools/:toolName/prompt - Generate prompt for a specific tool
    router.post('/tools/:toolName/prompt', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const { toolName } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated'
                });
                return;
            }

            // Validate request body
            const validatedRequest = DebugPromptRequestSchema.parse(req.body);

            // Get tool from registry
            const toolRegistry = ToolRegistry.getInstance();
            const tool = toolRegistry.getTool(toolName);

            if (!tool) {
                res.status(404).json({
                    success: false,
                    error: `Tool '${toolName}' not found`
                });
                return;
            }

            // Create template execution context using injected jsondocRepo
            const executionContext: TemplateExecutionContext = {
                jsondocRepo,
                projectId: 'debug-project', // Debug context
                userId
            };

            // Prepare input data
            const inputData = {
                jsondocs: validatedRequest.jsondocs,
                ...validatedRequest.additionalParams
            };

            // Validate input against tool's schema
            const validatedInput = tool.inputSchema.parse(inputData);

            // Prepare template variables
            const templateVariableService = new TemplateVariableService();
            const templateVariables = await templateVariableService.prepareTemplateVariables(
                validatedInput,
                tool.inputSchema,
                executionContext,
                tool.customTemplateVariables
            );

            // Get field titles from schema
            const fieldTitles = templateVariableService.extractFieldTitles(tool.inputSchema);

            res.json({
                success: true,
                tool: {
                    name: tool.name,
                    description: tool.description,
                    templatePath: tool.templatePath
                },
                input: validatedInput,
                templateVariables,
                fieldTitles,
                prompt: `Template Variables:\n${Object.entries(templateVariables).map(([key, value]) => `%%${key}%%:\n${value}\n`).join('\n')}`
            });
        } catch (error) {
            console.error('Error generating prompt:', error);

            if (error instanceof z.ZodError) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid input data',
                    details: error.errors
                });
                return;
            }

            res.status(500).json({
                success: false,
                error: 'Failed to generate prompt'
            });
        }
    });

    // GET /api/admin/jsondocs/:projectId - Get jsondocs for a project (for selection)
    router.get('/jsondocs/:projectId', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const { projectId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'User not authenticated'
                });
                return;
            }

            // Verify user has access to this project using injected jsondocRepo
            const hasAccess = await jsondocRepo.userHasProjectAccess(userId, projectId);
            if (!hasAccess) {
                res.status(403).json({
                    success: false,
                    error: 'Access denied to project'
                });
                return;
            }

            // Get jsondocs for the project
            const jsondocs = await jsondocRepo.getProjectJsondocs(projectId, 100);

            const jsondocInfo = jsondocs.map(jsondoc => ({
                id: jsondoc.id,
                schemaType: jsondoc.schema_type,
                schemaVersion: jsondoc.schema_version,
                originType: jsondoc.origin_type,
                createdAt: jsondoc.created_at,
                // Preview of data (first 100 chars)
                dataPreview: typeof jsondoc.data === 'string'
                    ? jsondoc.data.substring(0, 100) + (jsondoc.data.length > 100 ? '...' : '')
                    : JSON.stringify(jsondoc.data).substring(0, 100) + '...'
            }));

            res.json({
                success: true,
                jsondocs: jsondocInfo
            });
        } catch (error) {
            console.error('Error getting jsondocs:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get jsondocs'
            });
        }
    });

    return router;
} 