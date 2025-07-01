import express from 'express';
import { TransformRepository } from '../transform-artifact-framework/TransformRepository';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';
import { buildAgentConfiguration } from '../services/AgentRequestBuilder';
import { GeneralAgentRequestSchema } from '../transform-artifact-framework/AgentService';

// Dev-only middleware - simple check for development environment
function devOnly(req: any, res: any, next: any) {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    next();
}

export function createAdminRoutes(
    transformRepo: TransformRepository,
    artifactRepo: ArtifactRepository
) {
    const router = express.Router();

    /**
 * GET /api/admin/agent-debug
 * Returns the complete agent debug data including prompt, tools, and context
 * Query params: projectId, userId, userRequest
 */
    router.get('/agent-debug', devOnly, async (req: any, res: any) => {
        try {
            const { projectId, userId, userRequest } = req.query;

            if (!projectId || !userId || !userRequest) {
                return res.status(400).json({
                    error: 'Missing required parameters: projectId, userId, userRequest'
                });
            }

            // Create request object
            const request = {
                userRequest: userRequest as string,
                projectId: projectId as string,
                contextType: 'general' as const
            };

            // Validate request
            const validation = GeneralAgentRequestSchema.safeParse(request);
            if (!validation.success) {
                return res.status(400).json({
                    error: 'Invalid request parameters',
                    details: validation.error.issues
                });
            }

            // Generate agent configuration using new abstraction
            const agentConfig = await buildAgentConfiguration(
                validation.data,
                projectId as string,
                transformRepo,
                artifactRepo,
                userId as string
            );

            // Convert tools to debug format for display
            const tools = agentConfig.tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
                outputSchema: tool.outputSchema
            }));

            // Structure debug data for client
            const debugData = {
                prompt: agentConfig.prompt,
                tools,
                contextData: {
                    context: agentConfig.context,
                    requestType: agentConfig.requestType
                }
            };

            // Return the raw data that would be passed to streamText
            res.json({
                success: true,
                data: debugData,
                metadata: {
                    timestamp: new Date().toISOString(),
                    projectId,
                    userId,
                    userRequest,
                    requestType: agentConfig.requestType
                }
            });

        } catch (error: any) {
            console.error('[AdminRoutes] Error generating agent debug data:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error)
            });
        }
    });

    return router;
} 