import { Router } from 'express';
import { z } from 'zod';
import { runStreamingAgent, getResultById } from '../services/StreamingAgentFramework';
import { createBrainstormToolDefinition } from '../tools/BrainstormTool';
import { createAuthMiddleware } from '../middleware/auth';
import { AuthDatabase } from '../database/auth';

// Input schema for the agent-based ideation request
const AgentIdeationRequestSchema = z.object({
    userRequest: z.string().min(1, 'User request cannot be empty'),
    platform: z.string().optional(),
    genre: z.string().optional(),
    other_requirements: z.string().optional(),
});

type AgentIdeationRequest = z.infer<typeof AgentIdeationRequestSchema>;

export function createStreamingIdeationRoutes(authDB: AuthDatabase) {
    const router = Router();
    const authMiddleware = createAuthMiddleware(authDB);

    // Agent-based streaming ideation endpoint
    router.post('/agent/stream', authMiddleware.authenticate, async (req: any, res: any) => {
        const user = authMiddleware.getCurrentUser(req);
        if (!user) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        try {
            // Validate input
            const validatedInput = AgentIdeationRequestSchema.parse(req.body);

            // Set up SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });

            // Send initial connection confirmation
            res.write(`data: ${JSON.stringify({ status: 'connected', message: 'Starting agent...' })}\n\n`);

            // Create brainstorm tool definition
            const brainstormToolDef = createBrainstormToolDefinition();

            // Collect result IDs as they come in
            const resultIds: string[] = [];

            // Run the streaming agent
            const result = await runStreamingAgent({
                userRequest: validatedInput.userRequest,
                toolDefinitions: [brainstormToolDef],
                maxSteps: 3,
                onStreamChunk: ({ chunk }: { chunk: any }) => {
                    // Send streaming chunks to client
                    res.write(`data: ${JSON.stringify({ type: 'chunk', data: chunk })}\n\n`);
                },
                onResultId: (resultId: string) => {
                    resultIds.push(resultId);
                    // Send result ID to client
                    res.write(`data: ${JSON.stringify({ type: 'resultId', resultId })}\n\n`);
                }
            });

            // Send final results
            const finalResults = resultIds.map(id => getResultById(id)).filter(Boolean);
            res.write(`data: ${JSON.stringify({ type: 'complete', results: finalResults, resultIds })}\n\n`);

            // Send completion event
            res.write(`event: done\ndata: ${JSON.stringify({ status: 'completed', resultIds })}\n\n`);

            res.end();

        } catch (error: any) {
            console.error('Error in agent streaming ideation:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: "Failed to start agent ideation stream",
                    details: error.message
                });
            } else {
                // If headers are sent, send error through SSE
                res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
                res.end();
            }
        }
    });

    // Get results by ID endpoint
    router.get('/results/:resultId', authMiddleware.authenticate, async (req: any, res: any) => {
        const user = authMiddleware.getCurrentUser(req);
        if (!user) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        try {
            const { resultId } = req.params;
            const result = getResultById(resultId);

            if (!result) {
                return res.status(404).json({ error: "Result not found" });
            }

            res.json({ resultId, data: result });

        } catch (error: any) {
            console.error('Error retrieving result:', error);
            res.status(500).json({
                error: "Failed to retrieve result",
                details: error.message
            });
        }
    });

    return router;
} 