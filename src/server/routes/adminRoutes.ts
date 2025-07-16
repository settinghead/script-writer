import { Router, Request, Response } from 'express';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { ProjectRepository } from '../transform-jsondoc-framework/ProjectRepository';
import { buildToolsForRequestType } from '../services/AgentRequestBuilder';
import { TemplateService } from '../services/templates/TemplateService';

/**
 * Admin routes for debugging and development
 */
export function createAdminRoutes(
    jsondocRepo: JsondocRepository,
    authMiddleware: any,
    transformRepo: TransformRepository,
    projectRepo: ProjectRepository
) {
    const router = Router();
    const templateService = new TemplateService();

    // GET /api/admin/tools - List available tools
    router.get('/tools', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Use a dummy project ID for tool listing (tools are the same across projects)
            const dummyProjectId = 'admin-tools-listing';

            // Get all available tools using the same function as the agent
            const tools = buildToolsForRequestType(
                transformRepo || {} as any, // Fallback if transformRepo not provided
                jsondocRepo,
                dummyProjectId,
                userId
            );

            // Map tool names to template names for frontend compatibility
            const toolToTemplate: Record<string, string> = {
                'generate_brainstorm_ideas': 'brainstorming',
                'edit_brainstorm_idea': 'brainstorm_edit_patch',
                'generate_outline_settings': 'outline_settings',
                'edit_outline_settings': 'outline_settings_edit_patch',
                'generate_chronicles': 'chronicles'
            };

            // Format tools for admin display (matching frontend Tool interface)
            const toolList = tools.map(tool => {
                // Safely extract schema properties for display
                let inputProperties: Record<string, any> = {};
                try {
                    // Try to access shape if it's a ZodObject
                    const schema = tool.inputSchema as any;
                    if (schema.shape) {
                        inputProperties = Object.fromEntries(
                            Object.entries(schema.shape).map(([key, value]) => [
                                key,
                                {
                                    type: (value as any)?._def?.typeName?.toLowerCase() || 'unknown',
                                    description: `${key} parameter`
                                }
                            ])
                        );
                    }
                } catch (error) {
                    // Fallback if schema introspection fails
                    inputProperties = { note: 'Schema details not available' };
                }

                return {
                    name: tool.name,
                    description: tool.description,
                    inputSchema: {
                        type: 'object',
                        properties: inputProperties
                    },
                    templatePath: toolToTemplate[tool.name] || 'unknown',
                    hasCustomTemplateVariables: tool.name === 'edit_brainstorm_idea' // Only brainstorm edit has custom logic
                };
            });

            // Also list available templates
            const templates = [
                'brainstorming',
                'brainstorm_edit_patch',
                'outline_settings',
                'outline_settings_edit_patch',
                'chronicles',
                'episode_synopsis_generation',
                'script_generation'
            ].map(templateId => {
                try {
                    const template = templateService.getTemplate(templateId);
                    return {
                        id: template.id,
                        name: template.name,
                        outputFormat: template.outputFormat,
                        hasResponseWrapper: !!template.responseWrapper
                    };
                } catch (error) {
                    return {
                        id: templateId,
                        name: templateId,
                        error: 'Template not found'
                    };
                }
            });

            res.json({
                success: true,
                tools: toolList,
                templates: templates,
                totalTools: toolList.length,
                totalTemplates: templates.length
            });

        } catch (error) {
            console.error('Error listing tools:', error);
            res.status(500).json({
                error: 'Failed to list tools',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    });

    // GET /api/admin/tools/:toolName/prompt - Get template prompt for a tool
    router.get('/tools/:toolName/prompt', async (req: Request, res: Response) => {
        try {
            const { toolName } = req.params;

            // Map tool names to template names (reuse the mapping from above)
            const toolToTemplate: Record<string, string> = {
                'generate_brainstorm_ideas': 'brainstorming',
                'edit_brainstorm_idea': 'brainstorm_edit_patch',
                'generate_outline_settings': 'outline_settings',
                'edit_outline_settings': 'outline_settings_edit_patch',
                'generate_chronicles': 'chronicles'
            };

            const templateName = toolToTemplate[toolName];
            if (!templateName) {
                res.status(404).json({
                    error: 'Tool not found or no template mapping',
                    availableTools: Object.keys(toolToTemplate)
                });
                return;
            }

            const template = templateService.getTemplate(templateName);

            res.json({
                toolName,
                templateName,
                template: {
                    id: template.id,
                    name: template.name,
                    promptTemplate: template.promptTemplate,
                    outputFormat: template.outputFormat,
                    responseWrapper: template.responseWrapper
                }
            });

        } catch (error) {
            console.error('Error getting template prompt:', error);
            res.status(500).json({
                error: 'Failed to get template prompt',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    });

    // POST /api/admin/tools/:toolName/non-persistent - Execute tool in non-persistent mode with SSE streaming
    router.post('/tools/:toolName/non-persistent', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const { toolName } = req.params;
            const { jsondocs, additionalParams } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Set up SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });

            // Helper function to send SSE data
            const sendSSE = (event: string, data: any) => {
                res.write(`event: ${event}\n`);
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            };

            // Map tool names to their instantiation functions
            const toolMap: Record<string, any> = {
                'generate_brainstorm_ideas': async (projectId: string, userId: string) => {
                    const { createBrainstormToolDefinition } = await import('../tools/BrainstormTools.js');
                    return createBrainstormToolDefinition(transformRepo, jsondocRepo, projectId, userId);
                },
                'edit_brainstorm_idea': async (projectId: string, userId: string) => {
                    const { createBrainstormEditToolDefinition } = await import('../tools/BrainstormTools.js');
                    return createBrainstormEditToolDefinition(transformRepo, jsondocRepo, projectId, userId);
                },
                'generate_outline_settings': async (projectId: string, userId: string) => {
                    const { createOutlineSettingsToolDefinition } = await import('../tools/OutlineSettingsTool.js');
                    return createOutlineSettingsToolDefinition(transformRepo, jsondocRepo, projectId, userId);
                },
                'edit_outline_settings': async (projectId: string, userId: string) => {
                    const { createOutlineSettingsEditToolDefinition } = await import('../tools/OutlineSettingsTool.js');
                    return createOutlineSettingsEditToolDefinition(transformRepo, jsondocRepo, projectId, userId);
                },
                'generate_chronicles': async (projectId: string, userId: string) => {
                    const { createChroniclesToolDefinition } = await import('../tools/ChroniclesTool.js');
                    return createChroniclesToolDefinition(transformRepo, jsondocRepo, projectId, userId);
                }
            };

            const toolLoader = toolMap[toolName];
            if (!toolLoader) {
                sendSSE('error', { message: `Tool '${toolName}' not found` });
                res.end();
                return;
            }

            sendSSE('status', { message: 'Loading tool...', toolName });

            // Get a default project ID for dry run (use first accessible project)
            const projects = await projectRepo.getUserProjects(userId);
            if (projects.length === 0) {
                sendSSE('error', { message: 'No accessible projects found' });
                res.end();
                return;
            }
            const projectId = projects[0].id;

            // Load the tool definition
            const toolDefinition = await toolLoader(projectId, userId);

            // Prepare input data
            const input: any = { ...additionalParams };

            // Add jsondoc references if provided
            if (jsondocs && Array.isArray(jsondocs)) {
                input.jsondocs = jsondocs.map((j: any) => ({
                    jsondocId: j.jsondocId,
                    description: j.description || j.schemaType || 'input_data',
                    schemaType: j.schemaType || 'unknown'
                }));
            }

            sendSSE('status', { message: 'Executing tool in non-persistence mode...', input });

            // Import the executeStreamingTransform function directly
            const { executeStreamingTransform } = await import('../transform-jsondoc-framework/StreamingTransformExecutor.js');

            // Get the tool's configuration by examining its structure
            // We'll need to create a custom streaming execution with dryRun: true
            let config: any;
            let transformMetadata: any;
            let outputJsondocType: 'brainstorm_collection' | 'brainstorm_idea' | 'outline_settings' | 'chronicles';

            // Extract configuration based on tool type
            if (toolName === 'generate_brainstorm_ideas') {
                const { IdeationInputSchema, IdeationOutputSchema } = await import('@/common/transform_schemas.js');
                config = {
                    templateName: 'brainstorming',
                    inputSchema: IdeationInputSchema,
                    outputSchema: IdeationOutputSchema
                };
                outputJsondocType = 'brainstorm_collection';
                transformMetadata = {
                    toolName: 'generate_brainstorm_ideas',
                    platform: 'unknown',
                    genre: 'unknown',
                    numberOfIdeas: 2
                };
            } else if (toolName === 'edit_brainstorm_idea') {
                const { BrainstormEditInputSchema } = await import('@/common/schemas/transforms.js');
                const { z } = await import('zod');
                config = {
                    templateName: 'brainstorm_edit_patch',
                    inputSchema: BrainstormEditInputSchema,
                    outputSchema: z.array(z.object({
                        op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),
                        path: z.string(),
                        value: z.any().optional(),
                        from: z.string().optional()
                    }))
                };
                outputJsondocType = 'brainstorm_idea';
                transformMetadata = { toolName: 'edit_brainstorm_idea' };
            } else if (toolName === 'generate_outline_settings') {
                // Import outline schemas
                const { OutlineSettingsInputSchema, OutlineSettingsOutputSchema } = await import('@/common/schemas/outlineSchemas.js');
                config = {
                    templateName: 'outline_settings',
                    inputSchema: OutlineSettingsInputSchema,
                    outputSchema: OutlineSettingsOutputSchema
                };
                outputJsondocType = 'outline_settings';
                transformMetadata = { toolName: 'generate_outline_settings' };
            } else if (toolName === 'edit_outline_settings') {
                const { OutlineSettingsEditInputSchema } = await import('@/common/schemas/transforms.js');
                const { z } = await import('zod');
                config = {
                    templateName: 'outline_settings_edit_patch',
                    inputSchema: OutlineSettingsEditInputSchema,
                    outputSchema: z.array(z.object({
                        op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),
                        path: z.string(),
                        value: z.any().optional(),
                        from: z.string().optional()
                    }))
                };
                outputJsondocType = 'outline_settings';
                transformMetadata = { toolName: 'edit_outline_settings' };
            } else if (toolName === 'generate_chronicles') {
                // Import chronicles schemas
                const { ChroniclesInputSchema, ChroniclesOutputSchema } = await import('@/common/schemas/outlineSchemas.js');
                config = {
                    templateName: 'chronicles',
                    inputSchema: ChroniclesInputSchema,
                    outputSchema: ChroniclesOutputSchema
                };
                outputJsondocType = 'chronicles';
                transformMetadata = { toolName: 'generate_chronicles' };
            } else {
                sendSSE('error', { message: `Unsupported tool for non-persistent run: ${toolName}` });
                res.end();
                return;
            }

            // Execute the streaming transform with dryRun: true and streaming callback
            const result = await executeStreamingTransform({
                config,
                input,
                projectId,
                userId,
                transformRepo,
                jsondocRepo,
                outputJsondocType,
                transformMetadata,
                dryRun: true,  // This will skip database operations but still call LLM
                onStreamChunk: async (chunk: any, chunkCount: number) => {
                    // Send each chunk as SSE event
                    sendSSE('chunk', {
                        chunkCount,
                        data: chunk,
                        toolName
                    });
                }
            });

            sendSSE('result', {
                message: 'Non-persistence run completed successfully',
                result,
                toolName,
                input
            });

        } catch (error) {
            console.error(`[AdminRoutes] Non-persistent run error for ${req.params.toolName}:`, error);
            const sendSSE = (event: string, data: any) => {
                res.write(`event: ${event}\n`);
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            };
            sendSSE('error', {
                message: error instanceof Error ? error.message : 'Unknown error',
                toolName: req.params.toolName
            });
        } finally {
            res.end();
        }
    });

    // POST /api/admin/tools/:toolName/prompt - Generate prompt for debugging
    router.post('/tools/:toolName/prompt', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const { toolName } = req.params;
            const { jsondocs, additionalParams } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Map tool names to template names
            const toolToTemplate: Record<string, string> = {
                'generate_brainstorm_ideas': 'brainstorming',
                'edit_brainstorm_idea': 'brainstorm_edit_patch',
                'generate_outline_settings': 'outline_settings',
                'edit_outline_settings': 'outline_settings_edit_patch',
                'generate_chronicles': 'chronicles'
            };

            const templateName = toolToTemplate[toolName];
            if (!templateName) {
                res.status(404).json({
                    error: 'Tool not found or no template mapping',
                    availableTools: Object.keys(toolToTemplate)
                });
                return;
            }

            // Get the template using the same method as tools
            const template = templateService.getTemplate(templateName);

            // Prepare context data exactly like tools do
            let jsondocData: any[] = [];
            if (jsondocs && jsondocs.length > 0) {
                // Fetch actual jsondoc content from database (same as tools do)
                for (const jsondocRef of jsondocs) {
                    const jsondocId = jsondocRef.jsondocId || jsondocRef.id;
                    if (jsondocId) {
                        try {
                            const jsondoc = await jsondocRepo.getJsondoc(jsondocId);
                            if (jsondoc) {
                                // Check user has access to this jsondoc's project
                                const hasAccess = await jsondocRepo.userHasProjectAccess(userId, jsondoc.project_id);
                                if (hasAccess) {
                                    jsondocData.push({
                                        id: jsondoc.id,
                                        type: jsondoc.schema_type,
                                        data: jsondoc.data
                                    });
                                }
                            }
                        } catch (error) {
                            console.warn(`Failed to fetch jsondoc ${jsondocId}:`, error);
                        }
                    }
                }
            }

            // Use the exact same template rendering as tools
            const finalPrompt = await templateService.renderTemplate(template, {
                params: additionalParams,
                jsondocs: jsondocData
            });

            // Prepare response in the same format as before (for frontend compatibility)
            const result = {
                success: true,
                tool: {
                    name: toolName,
                    description: `Debug prompt generation for ${toolName}`,
                    templatePath: templateName
                },
                input: {
                    jsondocs,
                    additionalParams
                },
                templateVariables: {
                    params: additionalParams ? JSON.stringify(additionalParams, null, 2) : 'No additional parameters provided',
                    jsondocs: jsondocData.length > 0 ? JSON.stringify(jsondocData, null, 2) : 'No jsondocs provided'
                },
                fieldTitles: {
                    params: 'Input Parameters',
                    jsondocs: 'Referenced Jsondocs'
                },
                prompt: finalPrompt
            };

            res.json(result);

        } catch (error) {
            console.error('Error generating prompt:', error);
            res.status(500).json({
                error: 'Failed to generate prompt',
                details: error instanceof Error ? error.message : String(error)
            });
        }
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
                success: true,
                projectId,
                jsondocs: jsondocs.map((jsondoc: any) => ({
                    id: jsondoc.id,
                    schemaType: jsondoc.schema_type,
                    schemaVersion: jsondoc.schema_version,
                    originType: jsondoc.origin_type,
                    createdAt: jsondoc.created_at,
                    // Include a preview of the data as a string
                    dataPreview: typeof jsondoc.data === 'object'
                        ? Object.keys(jsondoc.data || {}).slice(0, 5).join(', ')
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