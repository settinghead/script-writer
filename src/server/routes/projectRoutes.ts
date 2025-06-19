import express from 'express';
import { ProjectService } from '../services/ProjectService';
import { AgentService } from '../services/AgentService';
import { AgentBrainstormRequestSchema } from '../../common/types';

export function createProjectRoutes(
    authMiddleware: any,
    projectService: ProjectService,
    agentService: AgentService
) {
    const router = express.Router();

    // GET /api/projects/:id - Get a specific project
    router.get('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const projectId = req.params.id;
            const project = await projectService.getProject(projectId, user.id);
            
            if (!project) {
                return res.status(404).json({ error: "Project not found" });
            }

            res.json(project);
        } catch (error: any) {
            console.error('Error fetching project:', error);
            res.status(500).json({
                error: 'Failed to fetch project',
                details: error.message
            });
        }
    });

    router.post('/create-from-brainstorm', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const validation = AgentBrainstormRequestSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    error: "Invalid request body",
                    details: validation.error.format(),
                });
            }
            const brainstormRequest = validation.data;

            // 1. Create the project
            const projectName = `Brainstorming Project - ${new Date().toLocaleString()}`;
            const project = await projectService.createProject(user.id, projectName);

            // 2. Start the brainstorming agent (this is async and won't be awaited)
            agentService.runBrainstormAgent(project.id, user.id, brainstormRequest);

            // 3. Return project ID immediately
            res.status(202).json({
                projectId: project.id,
                message: "Project created and brainstorming started."
            });

        } catch (error: any) {
            console.error('Error creating project from brainstorm:', error);
            res.status(500).json({
                error: 'Failed to create project from brainstorm',
                details: error.message
            });
        }
    });

    return router;
} 