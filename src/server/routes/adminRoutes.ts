import { Router, Request, Response } from 'express';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { buildToolsForRequestType } from '../services/AgentRequestBuilder';
import { TemplateService } from '../services/templates/TemplateService';

/**
 * Admin routes for debugging and development
 */
export function createAdminRoutes(
    jsondocRepo: JsondocRepository,
    authMiddleware: any,
    transformRepo?: TransformRepository
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
                'edit_brainstorm_idea': 'brainstorm_edit',
                'generate_outline_settings': 'outline_settings',
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
                'brainstorm_edit',
                'outline_settings',
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
                'edit_brainstorm_idea': 'brainstorm_edit',
                'generate_outline_settings': 'outline_settings',
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
                'edit_brainstorm_idea': 'brainstorm_edit',
                'generate_outline_settings': 'outline_settings',
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

            // Get the template
            const template = templateService.getTemplate(templateName);

            // Prepare template variables using default schema-driven extraction
            const templateVariables: Record<string, string> = {};

            // Add params section
            if (additionalParams) {
                templateVariables['params'] = Object.entries(additionalParams)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\n');
            } else {
                templateVariables['params'] = 'No additional parameters provided';
            }

            // Add jsondocs section
            if (jsondocs && jsondocs.length > 0) {
                // For debugging, we'll just show the jsondoc IDs and types
                templateVariables['jsondocs'] = jsondocs
                    .map((doc: any) => `- ${doc.jsondocId} (${doc.schemaType})`)
                    .join('\n');
            } else {
                templateVariables['jsondocs'] = 'No jsondocs provided';
            }

            // Generate the final prompt by replacing template variables
            let finalPrompt = template.promptTemplate;
            for (const [key, value] of Object.entries(templateVariables)) {
                const placeholder = `%%${key}%%`;
                finalPrompt = finalPrompt.replace(new RegExp(placeholder, 'g'), value);
            }

            // Prepare response in the format expected by frontend
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
                templateVariables,
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