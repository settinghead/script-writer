import express from 'express';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { generateAgentDebugData } from '../services/prompt-tools-gen';
import { GeneralAgentRequestSchema } from '../services/AgentService';

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

            // Generate debug data
            const debugData = await generateAgentDebugData(
                validation.data,
                projectId as string,
                userId as string,
                transformRepo,
                artifactRepo
            );

            // Return the raw data that would be passed to streamText
            res.json({
                success: true,
                data: debugData,
                metadata: {
                    timestamp: new Date().toISOString(),
                    projectId,
                    userId,
                    userRequest
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