import { Router, Request, Response } from 'express';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { ProjectRepository } from '../transform-jsondoc-framework/ProjectRepository';
import { ChatMessageRepository } from '../transform-jsondoc-framework/ChatMessageRepository';
import { TemplateService } from '../services/templates/TemplateService';
import { createBrainstormToolDefinition } from '../tools/BrainstormGenerationTool';
import { createBrainstormEditToolDefinition } from '../tools/BrainstormEditTool';
import { createOutlineSettingsToolDefinition, createOutlineSettingsEditToolDefinition } from '../tools/OutlineSettingsTool';
import { createChroniclesToolDefinition, createChroniclesEditToolDefinition } from '../tools/ChroniclesTool';
import { createEpisodePlanningToolDefinition, createEpisodePlanningEditToolDefinition } from '../tools/EpisodePlanningTool';
import { createEpisodeSynopsisToolDefinition } from '../tools/EpisodeSynopsisTool';
import { JsonPatchOperationsSchema } from '@/common/schemas/transforms';
import { StreamingExecutionMode } from '../transform-jsondoc-framework/StreamingTransformExecutor';

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

    /**
     * Dynamically build tool registry from actual tool definitions
     */
    async function buildToolRegistry(userId: string) {
        // Use a dummy project ID for tool listing (tools are the same across projects)
        const dummyProjectId = 'admin-tools-listing';

        // Get all available tools (admin routes need all tools for debugging)
        const tools = [
            createBrainstormToolDefinition(transformRepo, jsondocRepo, dummyProjectId, userId),
            createBrainstormEditToolDefinition(transformRepo, jsondocRepo, dummyProjectId, userId),
            createOutlineSettingsToolDefinition(transformRepo, jsondocRepo, dummyProjectId, userId),
            createOutlineSettingsEditToolDefinition(transformRepo, jsondocRepo, dummyProjectId, userId),
            createChroniclesToolDefinition(transformRepo, jsondocRepo, dummyProjectId, userId),
            createChroniclesEditToolDefinition(transformRepo, jsondocRepo, dummyProjectId, userId),
            createEpisodePlanningToolDefinition(transformRepo, jsondocRepo, dummyProjectId, userId),
            createEpisodePlanningEditToolDefinition(transformRepo, jsondocRepo, dummyProjectId, userId),
            createEpisodeSynopsisToolDefinition(transformRepo, jsondocRepo, dummyProjectId, userId)
        ];

        // Build registry with tool metadata
        const toolRegistry = new Map();

        for (const tool of tools) {
            // Map tool names to their template configurations based on known patterns
            const toolConfigs: Record<string, { templateName: string; outputJsondocType: string; schemas: any }> = {
                'generate_灵感创意s': {
                    templateName: 'brainstorming',
                    outputJsondocType: 'brainstorm_collection',
                    schemas: {
                        inputSchema: () => import('@/common/transform_schemas.js').then(m => m.IdeationInputSchema),
                        outputSchema: () => import('@/common/transform_schemas.js').then(m => m.IdeationOutputSchema)
                    }
                },
                'edit_灵感创意': {
                    templateName: 'brainstorm_edit_diff',
                    outputJsondocType: '灵感创意',
                    schemas: {
                        inputSchema: () => import('@/common/schemas/transforms.js').then(m => m.BrainstormEditInputSchema),
                        outputSchema: () => Promise.resolve(JsonPatchOperationsSchema)
                    }
                },
                'generate_剧本设定': {
                    templateName: '剧本设定',
                    outputJsondocType: '剧本设定',
                    schemas: {
                        inputSchema: () => import('@/common/schemas/outlineSchemas.js').then(m => m.OutlineSettingsInputSchema),
                        outputSchema: () => import('@/common/schemas/outlineSchemas.js').then(m => m.OutlineSettingsOutputSchema)
                    }
                },
                'edit_剧本设定': {
                    templateName: '剧本设定_edit_diff',
                    outputJsondocType: '剧本设定',
                    schemas: {
                        inputSchema: () => import('@/common/schemas/transforms.js').then(m => m.OutlineSettingsEditInputSchema),
                        outputSchema: () => Promise.resolve(JsonPatchOperationsSchema)
                    }
                },
                'generate_chronicles': {
                    templateName: 'chronicles',
                    outputJsondocType: 'chronicles',
                    schemas: {
                        inputSchema: () => import('@/common/schemas/outlineSchemas.js').then(m => m.ChroniclesInputSchema),
                        outputSchema: () => import('@/common/schemas/outlineSchemas.js').then(m => m.ChroniclesOutputSchema)
                    }
                },
                'edit_chronicles': {
                    templateName: 'chronicles_edit_diff',
                    outputJsondocType: 'chronicles',
                    schemas: {
                        inputSchema: () => import('@/common/schemas/transforms.js').then(m => m.ChroniclesEditInputSchema),
                        outputSchema: () => Promise.resolve(JsonPatchOperationsSchema)
                    }
                },
                'generate_episode_planning': {
                    templateName: 'episode_planning',
                    outputJsondocType: 'episode_planning',
                    schemas: {
                        inputSchema: () => import('@/common/schemas/outlineSchemas.js').then(m => m.EpisodePlanningInputSchema),
                        outputSchema: () => import('@/common/schemas/outlineSchemas.js').then(m => m.EpisodePlanningOutputSchema)
                    }
                },
                'edit_episode_planning': {
                    templateName: 'episode_planning_edit_diff',
                    outputJsondocType: 'episode_planning',
                    schemas: {
                        inputSchema: () => import('@/common/schemas/outlineSchemas.js').then(m => m.EpisodePlanningEditInputSchema),
                        outputSchema: () => Promise.resolve(JsonPatchOperationsSchema)
                    }
                },
                'generate_单集大纲': {
                    templateName: '单集大纲生成',
                    outputJsondocType: '单集大纲',
                    schemas: {
                        inputSchema: () => import('@/common/schemas/outlineSchemas.js').then(m => m.EpisodeSynopsisInputSchema),
                        outputSchema: () => import('@/common/schemas/outlineSchemas.js').then(m => m.EpisodeSynopsisSchema)
                    }
                }
            };

            const config = toolConfigs[tool.name];
            if (!config) {
                throw new Error(`Tool configuration not found for '${tool.name}'. Please add it to toolConfigs in buildToolRegistry().`);
            }

            toolRegistry.set(tool.name, {
                tool,
                templateName: config.templateName,
                outputJsondocType: config.outputJsondocType,
                config
            });
        }

        return toolRegistry;
    }

    // GET /api/admin/tools - List available tools
    router.get('/tools', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const toolRegistry = await buildToolRegistry(userId);

            // Format tools for admin display (matching frontend Tool interface)
            const toolList = Array.from(toolRegistry.values()).map(({ tool, templateName }) => {
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
                                    type: (value as any)?._def?.typeName?.toLowerCase() || (() => {
                                        throw new Error(`Unable to determine type for schema property '${key}' in tool '${tool.name}'. Schema introspection failed.`);
                                    })(),
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
                    templatePath: templateName,
                    hasCustomTemplateVariables: tool.name === 'edit_灵感创意' // Only brainstorm edit has custom logic
                };
            });

            // Also list available templates
            const templates = [
                'brainstorming',
                'brainstorm_edit_diff',
                '剧本设定',
                '剧本设定_edit_diff',
                'chronicles',
                'chronicles_edit_diff',
                'episode_planning',
                'episode_planning_edit_diff',
                '单集大纲生成',
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

    // GET /api/admin/intents - List available intents
    router.get('/intents', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            // Extract intent mapping from tool names and their descriptions
            const intentMapping = [
                {
                    value: 'generate_灵感创意s',
                    label: '生成故事创意',
                    description: '基于头脑风暴参数生成多个故事想法',
                    category: '创意生成'
                },
                {
                    value: 'edit_灵感创意',
                    label: '编辑故事创意',
                    description: '修改现有的故事创意内容',
                    category: '内容编辑'
                },
                {
                    value: 'generate_剧本设定',
                    label: '生成剧本设定',
                    description: '基于故事创意生成角色、背景和商业设定',
                    category: '设定生成'
                },
                {
                    value: 'edit_剧本设定',
                    label: '编辑剧本设定',
                    description: '修改现有的剧本设定内容',
                    category: '内容编辑'
                },
                {
                    value: 'generate_chronicles',
                    label: '生成时间顺序大纲',
                    description: '基于剧本设定创建故事时序结构',
                    category: '结构生成'
                },
                {
                    value: 'edit_chronicles',
                    label: '编辑时间顺序大纲',
                    description: '修改现有的时间顺序大纲内容',
                    category: '内容编辑'
                },
                {
                    value: 'generate_episode_planning',
                    label: '生成分集结构',
                    description: '基于时间顺序大纲创建分集结构',
                    category: '框架生成'
                },
                {
                    value: 'edit_episode_planning',
                    label: '编辑分集结构',
                    description: '修改现有的分集结构内容',
                    category: '内容编辑'
                },
                {
                    value: 'generate_单集大纲',
                    label: '生成单集大纲',
                    description: '基于分集结构生成详细的每集内容',
                    category: '内容生成'
                }
            ];

            // Group by category for better UX
            const categorizedIntents = intentMapping.reduce((acc, intent) => {
                if (!acc[intent.category]) {
                    acc[intent.category] = [];
                }
                acc[intent.category].push({
                    value: intent.value,
                    label: intent.label,
                    description: intent.description
                });
                return acc;
            }, {} as Record<string, Array<{ value: string, label: string, description: string }>>);

            res.json({
                success: true,
                intents: intentMapping,
                categorizedIntents,
                totalIntents: intentMapping.length
            });

        } catch (error) {
            console.error('Error fetching intents:', error);
            res.status(500).json({
                error: 'Failed to fetch intents',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    });

    // GET /api/admin/tools/:toolName/prompt - Get template prompt for a tool
    router.get('/tools/:toolName/prompt', async (req: Request, res: Response) => {
        try {
            const { toolName } = req.params;
            const userId = req.user?.id || 'anonymous'; // Allow anonymous for prompt viewing

            const toolRegistry = await buildToolRegistry(userId);
            const toolInfo = toolRegistry.get(toolName);

            if (!toolInfo) {
                res.status(404).json({
                    error: 'Tool not found',
                    availableTools: Array.from(toolRegistry.keys())
                });
                return;
            }

            const template = templateService.getTemplate(toolInfo.templateName);

            res.json({
                toolName,
                templateName: toolInfo.templateName,
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

            // Build tool registry to check if tool exists
            const toolRegistry = await buildToolRegistry(userId);
            const toolInfo = toolRegistry.get(toolName);

            if (!toolInfo) {
                // Return 404 for unknown tools instead of silent 200
                res.status(404).json({
                    error: `Tool '${toolName}' not found`,
                    availableTools: Array.from(toolRegistry.keys())
                });
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

            sendSSE('status', { message: 'Loading tool...', toolName });

            // Get a default project ID for dry run (use first accessible project)
            const projects = await projectRepo.getUserProjects(userId);
            if (projects.length === 0) {
                sendSSE('error', { message: 'No accessible projects found' });
                res.end();
                return;
            }
            const projectId = projects[0].id;

            // Load the tool definition using the actual tool factory
            const toolDefinition = toolInfo.tool;

            // Prepare input data
            const input: any = { ...additionalParams };

            // Add jsondoc references if provided
            if (jsondocs && Array.isArray(jsondocs)) {
                input.jsondocs = jsondocs.map((j: any) => {
                    if (!j.jsondocId) {
                        throw new Error(`Jsondoc reference missing jsondocId field. Received: ${JSON.stringify(j)}`);
                    }
                    if (!j.schemaType) {
                        throw new Error(`Jsondoc reference ${j.jsondocId} missing schemaType field. This indicates a data integrity issue.`);
                    }
                    return {
                        jsondocId: j.jsondocId,
                        description: j.description || j.schemaType,
                        schemaType: j.schemaType
                    };
                });
            }

            sendSSE('status', { message: 'Executing tool in non-persistence mode...', input });

            // Import the executeStreamingTransform function directly
            const { executeStreamingTransform } = await import('../transform-jsondoc-framework/StreamingTransformExecutor.js');

            // Get the tool's configuration from our registry
            if (!toolInfo.config || !toolInfo.config.schemas) {
                sendSSE('error', { message: `Tool configuration not found for: ${toolName}` });
                res.end();
                return;
            }

            // Load schemas dynamically
            const inputSchema = await toolInfo.config.schemas.inputSchema();
            const outputSchema = await toolInfo.config.schemas.outputSchema();

            const config = {
                templateName: toolInfo.templateName,
                inputSchema,
                outputSchema
            };

            const transformMetadata = {
                toolName,
                ...(additionalParams || {})
            };

            // Determine execution mode for edit tools
            let executionMode: StreamingExecutionMode | null = null;
            const isEditTool = toolName.includes('edit') || toolInfo.templateName.endsWith('_diff');

            if (isEditTool && input.jsondocs && input.jsondocs.length > 0) {
                // For edit tools, get the original jsondoc being edited (first one in the array)
                const originalJsondocId = input.jsondocs[0].jsondocId;
                sendSSE('status', { message: `Loading original jsondoc ${originalJsondocId} for edit tool...` });

                const originalJsondoc = await jsondocRepo.getJsondoc(originalJsondocId);
                if (originalJsondoc) {
                    executionMode = {
                        mode: 'patch-approval',  // Use patch-approval mode for debug/non-persistent runs
                        originalJsondoc: originalJsondoc
                    };
                    console.log(`[AdminRoutes] Set execution mode for edit tool ${toolName}: patch-approval with jsondoc ${originalJsondocId}`);
                } else {
                    sendSSE('error', { message: `Original jsondoc ${originalJsondocId} not found for edit tool` });
                    res.end();
                    return;
                }
            }

            if (toolName.startsWith("generate_")) {
                executionMode = {
                    mode: "full-object"
                }
            } else {
                throw new Error("Unknown toolName: " + toolName);
            }

            // Execute the streaming transform with dryRun: true and streaming callback
            const result = await executeStreamingTransform({
                config,
                input,
                projectId,
                userId,
                transformRepo,
                jsondocRepo,
                outputJsondocType: toolInfo.outputJsondocType as any,
                transformMetadata,
                executionMode,  // Add the execution mode
                dryRun: true,  // This will skip database operations but still call LLM
                onStreamChunk: async (chunk: any, chunkCount: number) => {
                    // Handle new streaming format with internalized pipeline results
                    if (chunk && typeof chunk === 'object' && 'type' in chunk) {
                        // New format with detailed streaming info
                        if (chunk.type === 'rawText') {
                            // Send raw text chunks for debugging
                            sendSSE('rawText', {
                                chunkCount,
                                textDelta: chunk.textDelta,
                                accumulatedText: chunk.accumulatedText,
                                templateName: chunk.templateName,
                                toolName
                            });
                        } else if (chunk.type === 'eagerPatches') {
                            // Send eager patch data - NEW!
                            sendSSE('eagerPatches', {
                                chunkCount,
                                patches: chunk.patches,
                                source: chunk.source,
                                attempt: chunk.attempt,
                                newPatchCount: chunk.newPatchCount,
                                templateName: chunk.templateName,
                                toolName
                            });
                        } else if (chunk.type === 'patches') {
                            // Send regular patch data
                            sendSSE('patches', {
                                chunkCount,
                                patches: chunk.patches,
                                source: chunk.source,
                                templateName: chunk.templateName,
                                rawText: chunk.rawText,
                                toolName
                            });
                        } else if (chunk.type === 'finalPatches') {
                            // Send final patch data
                            sendSSE('finalPatches', {
                                chunkCount,
                                patches: chunk.patches,
                                source: chunk.source,
                                templateName: chunk.templateName,
                                rawText: chunk.rawText,
                                toolName
                            });
                        } else if (chunk.type === 'error') {
                            // Send error information
                            sendSSE('error', {
                                chunkCount,
                                patches: chunk.patches,
                                rawText: chunk.rawText,
                                error: chunk.error,
                                templateName: chunk.templateName,
                                toolName
                            });
                        }

                        // NEW: Send internalized pipeline results for real-time debugging
                        if (chunk.pipelineResults) {
                            sendSSE('pipelineResults', {
                                chunkCount,
                                status: chunk.pipelineResults.status,
                                rawLLMOutput: chunk.pipelineResults.rawLLMOutput,
                                modifiedJson: chunk.pipelineResults.modifiedJson,
                                patches: chunk.pipelineResults.patches,
                                originalJsonLength: chunk.pipelineResults.originalJsonLength,
                                modifiedJsonLength: chunk.pipelineResults.modifiedJsonLength,
                                patchCount: chunk.pipelineResults.patchCount,
                                toolName,
                                templateName: chunk.templateName
                            });
                        }

                        // Also send the standard chunk format for compatibility
                        sendSSE('chunk', {
                            chunkCount,
                            data: chunk.patches || chunk,
                            streamType: chunk.type,
                            toolName
                        });
                    } else {
                        // Standard format - send as before
                        sendSSE('chunk', {
                            chunkCount,
                            data: chunk,
                            toolName
                        });
                    }
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

            // Build tool registry to check if tool exists
            const toolRegistry = await buildToolRegistry(userId);
            const toolInfo = toolRegistry.get(toolName);

            if (!toolInfo) {
                res.status(404).json({
                    error: 'Tool not found',
                    availableTools: Array.from(toolRegistry.keys())
                });
                return;
            }

            // Get the template using the same method as tools
            const template = templateService.getTemplate(toolInfo.templateName);

            // Prepare context data exactly like tools do
            let jsondocData: Record<string, any> = {};
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
                                    // Structure jsondocs for template service:
                                    // Key = schema_type, Value = jsondoc object with schema_type and data fields
                                    jsondocData[jsondoc.schema_type] = {
                                        schema_type: jsondoc.schema_type,
                                        schema_version: jsondoc.schema_version,
                                        origin_type: jsondoc.origin_type,
                                        data: jsondoc.data
                                    };
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
                    templatePath: toolInfo.templateName
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

    // GET /api/admin/transforms/:projectId - Get transforms for a project
    router.get('/transforms/:projectId', authMiddleware.authenticate, async (req: Request, res: Response) => {
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

            // Get transforms for the project
            const transforms = await transformRepo.getProjectTransforms(projectId);

            res.json({
                success: true,
                projectId,
                transforms
            });

        } catch (error) {
            console.error('Error fetching transforms:', error);
            res.status(500).json({
                error: 'Failed to fetch transforms',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    });

    // GET /api/admin/human-transforms/:projectId - Get human transforms for a project
    router.get('/human-transforms/:projectId', authMiddleware.authenticate, async (req: Request, res: Response) => {
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

            // Get human transforms for the project using direct database query
            const { db } = await import('../database/connection.js');
            const humanTransforms = await db
                .selectFrom('human_transforms as ht')
                .innerJoin('transforms as t', 't.id', 'ht.transform_id')
                .selectAll(['ht', 't'])
                .where('t.project_id', '=', projectId)
                .orderBy('t.created_at', 'desc')
                .execute();

            const mappedHumanTransforms = humanTransforms.map(row => ({
                id: row.id,
                transform_id: row.transform_id,
                action_type: row.action_type,
                interface_context: row.interface_context ? JSON.parse(row.interface_context) : null,
                change_description: row.change_description,
                source_jsondoc_id: row.source_jsondoc_id,
                derivation_path: row.derivation_path,
                derived_jsondoc_id: row.derived_jsondoc_id,
                transform_name: row.transform_name,
                project_id: row.project_id,
                created_at: row.created_at?.toISOString() || new Date().toISOString(),
                updated_at: row.updated_at?.toISOString() || new Date().toISOString()
            }));

            res.json({
                success: true,
                projectId,
                humanTransforms: mappedHumanTransforms
            });

        } catch (error) {
            console.error('Error fetching human transforms:', error);
            res.status(500).json({
                error: 'Failed to fetch human transforms',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    });

    // GET /api/admin/transform-inputs/:projectId - Get transform inputs for a project
    router.get('/transform-inputs/:projectId', authMiddleware.authenticate, async (req: Request, res: Response) => {
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

            // Get transform inputs for the project using direct database query
            const { db } = await import('../database/connection.js');
            const inputs = await db
                .selectFrom('transform_inputs')
                .selectAll()
                .where('project_id', '=', projectId)
                .execute();

            res.json({
                success: true,
                projectId,
                inputs
            });

        } catch (error) {
            console.error('Error fetching transform inputs:', error);
            res.status(500).json({
                error: 'Failed to fetch transform inputs',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    });

    // GET /api/admin/transform-outputs/:projectId - Get transform outputs for a project
    router.get('/transform-outputs/:projectId', authMiddleware.authenticate, async (req: Request, res: Response) => {
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

            // Get transform outputs for the project using direct database query
            const { db } = await import('../database/connection.js');
            const outputs = await db
                .selectFrom('transform_outputs')
                .selectAll()
                .where('project_id', '=', projectId)
                .execute();

            res.json({
                success: true,
                projectId,
                outputs
            });

        } catch (error) {
            console.error('Error fetching transform outputs:', error);
            res.status(500).json({
                error: 'Failed to fetch transform outputs',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    });

    // POST /api/admin/agent-prompt - Get agent prompt construction
    router.post('/agent-prompt', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const { projectId, userRequest, contextType = 'general', contextData } = req.body;

            if (!projectId || !userRequest) {
                res.status(400).json({ error: 'projectId and userRequest are required' });
                return;
            }

            // Import buildAgentConfiguration to get the same prompt construction as AgentService
            const { buildAgentConfiguration } = await import('../services/AgentRequestBuilder.js');

            // Build the agent configuration exactly as AgentService does
            const agentConfig = await buildAgentConfiguration(
                {
                    userRequest,
                    projectId,
                    contextType,
                    contextData
                },
                projectId,
                transformRepo,
                jsondocRepo,
                userId,
                {
                    enableCaching: false // Disable caching for debug view
                }
            );

            // Extract tools information
            const availableTools = agentConfig.tools.map((tool: any) => tool.name);

            // Extract workflow state from context data
            const workflowState = contextData?.workflowState || {};

            // Determine current stage based on available actions (more reliable than trying to extract from parameters)
            const determineCurrentStage = (actions: any[], hasActiveTransforms: boolean) => {
                if (hasActiveTransforms) return 'processing';
                if (!actions || actions.length === 0) return 'initial';

                // Analyze actions to determine stage
                const actionIds = actions.map((a: any) => a.id);
                if (actionIds.includes('brainstorm_creation')) return 'initial';
                if (actionIds.includes('outline_generation')) return 'idea_editing';
                if (actionIds.includes('chronicles_generation')) return 'outline_generation';
                if (actionIds.includes('episode_planning_generation')) return 'chronicles_generation';
                if (actionIds.includes('单集大纲生成')) return 'episode_planning';

                return 'unknown';
            };

            const currentStage = determineCurrentStage(
                workflowState.actions || [],
                workflowState.parameters?.hasActiveTransforms || false
            );

            res.json({
                success: true,
                prompt: agentConfig.prompt,
                context: {
                    currentStage,
                    hasActiveTransforms: workflowState.parameters?.hasActiveTransforms || false,
                    availableTools,
                    workflowState
                },
                input: {
                    userRequest,
                    contextType,
                    contextData
                }
            });

        } catch (error) {
            console.error('Error building agent prompt:', error);
            res.status(500).json({
                error: 'Failed to build agent prompt',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    });

    // POST /api/admin/particles/nuke-rebore/:projectId - Delete and recreate all particles for a project
    router.post('/particles/nuke-rebore/:projectId', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const { projectId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Verify user has access to the project
            const hasAccess = await jsondocRepo.userHasProjectAccess(userId, projectId);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied to project' });
                return;
            }

            console.log(`[AdminRoutes] Starting nuke & rebore for project ${projectId}`);

            // Get particle system
            const { getParticleSystem } = await import('../services/ParticleSystemInitializer.js');
            const particleSystem = getParticleSystem();

            if (!particleSystem) {
                res.status(503).json({
                    error: 'Particle system not available',
                    details: 'Particle system may not be initialized due to missing configuration'
                });
                return;
            }

            // Step 1: Delete all particles for the project
            const { db } = await import('../database/connection.js');
            const deleteResult = await db
                .deleteFrom('particles')
                .where('project_id', '=', projectId)
                .executeTakeFirst();

            const deletedCount = Number(deleteResult.numDeletedRows) || 0;
            console.log(`[AdminRoutes] Deleted ${deletedCount} particles for project ${projectId}`);

            // Step 2: Get all jsondocs for the project
            const jsondocs = await jsondocRepo.getProjectJsondocs(projectId);
            console.log(`[AdminRoutes] Found ${jsondocs.length} jsondocs to process for project ${projectId}`);

            // Step 3: Recreate particles for each jsondoc
            let processedCount = 0;
            let errorCount = 0;
            const errors: string[] = [];

            for (const jsondoc of jsondocs) {
                try {
                    // Skip patch-type jsondocs as they are temporary
                    if (jsondoc.schema_type === 'json_patch') {
                        continue;
                    }

                    await particleSystem.particleService.updateParticlesForJsondoc(jsondoc.id, projectId);
                    processedCount++;
                } catch (error) {
                    errorCount++;
                    const errorMsg = `Failed to process jsondoc ${jsondoc.id}: ${error instanceof Error ? error.message : String(error)}`;
                    errors.push(errorMsg);
                    console.error(`[AdminRoutes] ${errorMsg}`);
                }
            }

            // Step 4: Count final particles
            const finalParticleCount = await db
                .selectFrom('particles')
                .select(db.fn.count('id').as('count'))
                .where('project_id', '=', projectId)
                .executeTakeFirst();

            const finalCount = Number(finalParticleCount?.count) || 0;

            console.log(`[AdminRoutes] Nuke & rebore completed for project ${projectId}: ${deletedCount} deleted, ${finalCount} created`);

            res.json({
                success: true,
                message: 'Nuke & rebore completed successfully',
                projectId,
                statistics: {
                    particlesDeleted: deletedCount,
                    jsondocsProcessed: processedCount,
                    jsondocsSkipped: jsondocs.length - processedCount - errorCount,
                    particlesCreated: finalCount,
                    errors: errorCount
                },
                errors: errors.length > 0 ? errors : undefined,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('[AdminRoutes] Nuke & rebore failed:', error);
            res.status(500).json({
                error: 'Nuke & rebore failed',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    });

    // Debug health check for particle-based agent
    router.get('/particle-agent/health', async (req: Request, res: Response) => {
        try {
            const { AgentService } = await import('../transform-jsondoc-framework/AgentService.js');
            const agentService = new AgentService(transformRepo, jsondocRepo);
            const health = await agentService.checkParticleSearchHealth();
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                health
            });
        } catch (error) {
            console.error('[AdminRoutes] Particle agent health check failed:', error);
            res.status(500).json({
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Debug test for particle-based agent
    router.post('/particle-agent/test', authMiddleware.authenticate, async (req: Request, res: Response) => {
        try {
            const { userRequest, projectId } = req.body;
            const user = authMiddleware.getCurrentUser(req);

            if (!userRequest || typeof userRequest !== 'string') {
                res.status(400).json({ error: 'userRequest is required and must be a string' });
                return;
            }

            if (!projectId || typeof projectId !== 'string') {
                res.status(400).json({ error: 'projectId is required and must be a string' });
                return;
            }

            if (!user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            console.log(`[AdminRoutes] Testing particle-based agent for project: ${projectId}`);
            console.log(`[AdminRoutes] User request: "${userRequest}"`);

            const { AgentService } = await import('../transform-jsondoc-framework/AgentService.js');
            const agentService = new AgentService(transformRepo, jsondocRepo);

            // Use the regular agent service - it will automatically detect and use particle search when available
            await agentService.runGeneralAgent(
                projectId,
                user.id,
                {
                    userRequest,
                    projectId,
                    contextType: 'general'
                },
                {
                    createChatMessages: false, // Don't create chat messages for debug tests
                    enableCaching: false
                }
            );

            res.json({
                status: 'completed',
                timestamp: new Date().toISOString(),
                message: 'Particle-based agent test completed successfully. Check console logs for details.'
            });

        } catch (error) {
            console.error('[AdminRoutes] Particle-based agent test failed:', error);
            res.status(500).json({
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Get tool call conversations for a project (using raw messages grouped by tool call ID)
    router.get('/tool-conversations/:projectId', async (req: any, res: any) => {
        try {
            const { projectId } = req.params;

            // Create ChatMessageRepository instance and get raw messages
            const { db } = await import('../database/connection.js');
            const chatMessageRepo = new ChatMessageRepository(db);
            const rawMessages = await chatMessageRepo.getRawMessages(projectId);

            // Group messages by tool call ID
            const conversationGroups: Record<string, any[]> = {};

            for (const message of rawMessages) {
                let metadata;
                try {
                    metadata = typeof message.metadata === 'string'
                        ? JSON.parse(message.metadata)
                        : message.metadata;
                } catch {
                    metadata = {};
                }

                const toolCallId = metadata?.toolCallId || metadata?.tool_call_id;
                if (toolCallId && message.tool_name) {
                    if (!conversationGroups[toolCallId]) {
                        conversationGroups[toolCallId] = [];
                    }
                    conversationGroups[toolCallId].push({
                        ...message,
                        metadata
                    });
                }
            }

            // Convert to array format expected by frontend
            const conversations = Object.entries(conversationGroups).map(([toolCallId, messages]) => {
                const sortedMessages = messages.sort((a, b) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
                const firstMessage = sortedMessages[0];

                return {
                    id: toolCallId,
                    tool_name: firstMessage.tool_name,
                    tool_call_id: toolCallId,
                    messages: sortedMessages,
                    created_at: firstMessage.created_at,
                    updated_at: sortedMessages[sortedMessages.length - 1].created_at
                };
            }).sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            res.json({
                success: true,
                conversations
            });
        } catch (error: any) {
            console.error('Error fetching tool conversations:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Internal server error'
            });
        }
    });

    // Get raw messages for a project
    router.get('/raw-messages/:projectId', async (req: any, res: any) => {
        try {
            const { projectId } = req.params;

            // Create ChatMessageRepository instance and get raw messages
            const { db } = await import('../database/connection.js');
            const chatMessageRepo = new ChatMessageRepository(db);
            const messages = await chatMessageRepo.getRawMessages(projectId);

            res.json({
                success: true,
                messages
            });
        } catch (error: any) {
            console.error('Error fetching raw messages:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Internal server error'
            });
        }
    });

    return router;
} 