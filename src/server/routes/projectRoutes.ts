import express from 'express';
import { ProjectService } from '../services/ProjectService';
import { AgentService, GeneralAgentRequestSchema } from '../transform-artifact-framework/AgentService';

export function createProjectRoutes(
    authMiddleware: any,
    projectService: ProjectService,
    agentService: AgentService
) {
    const router = express.Router();

    // GET /api/projects - List all projects for authenticated user
    router.get('/', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const projects = await projectService.listUserProjects(user.id);
            res.json(projects);
        } catch (error: any) {
            console.error('Error fetching projects:', error);
            res.status(500).json({
                error: 'Failed to fetch projects',
                details: error.message
            });
        }
    });

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

    // POST /api/projects/:id/agent - General agent endpoint for various tasks
    router.post('/:id/agent', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const projectId = req.params.id;

            // Verify user has access to this project
            const project = await projectService.getProject(projectId, user.id);
            if (!project) {
                return res.status(404).json({ error: "Project not found" });
            }

            const validation = GeneralAgentRequestSchema.safeParse({
                ...req.body,
                projectId // Add projectId to the request
            });
            if (!validation.success) {
                return res.status(400).json({
                    error: "Invalid request body",
                    details: validation.error.format(),
                });
            }
            const agentRequest = validation.data;

            // Start the general agent (this is async and won't be awaited)
            agentService.runGeneralAgent(projectId, user.id, agentRequest);

            // Return immediately
            res.status(202).json({
                projectId: projectId,
                message: "Agent request received and processing started."
            });

        } catch (error: any) {
            console.error('Error running general agent:', error);
            res.status(500).json({
                error: 'Failed to run general agent',
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

            // Expect the new format from the frontend: { platform, genrePaths, other_requirements, numberOfIdeas }
            const { platform, genrePaths, other_requirements, numberOfIdeas = 3 } = req.body;

            if (!platform || !genrePaths || !Array.isArray(genrePaths) || genrePaths.length === 0) {
                return res.status(400).json({
                    error: "Missing required fields: platform and genrePaths are required"
                });
            }

            // Validate numberOfIdeas
            if (numberOfIdeas && (typeof numberOfIdeas !== 'number' || numberOfIdeas < 1 || numberOfIdeas > 4)) {
                return res.status(400).json({
                    error: "numberOfIdeas must be a number between 1 and 4"
                });
            }

            // 1. Create the project
            const projectName = `头脑风暴项目 - ${new Date().toLocaleString()}`;
            const project = await projectService.createProject(user.id, projectName);

            // 2. Convert genre paths to readable format for AI
            const genreStrings = genrePaths.map((path: string[]) => path.join(' > '));
            const genreText = genreStrings.join(', ');

            // 3. Prepare the general agent request for brainstorming
            const brainstormMessage = `为${platform}平台生成创意故事想法。
故事类型：${genreText}
${other_requirements ? `其他要求：${other_requirements}` : ''}

请生成${numberOfIdeas}个有创意的故事想法。`;

            // 4. Start the general agent with brainstorm context (this is async and won't be awaited)
            agentService.runGeneralAgent(project.id, user.id, {
                userRequest: brainstormMessage,
                projectId: project.id,
                contextType: 'brainstorm'
            });

            // 5. Return project ID immediately
            res.status(202).json({
                id: project.id,
                name: project.name,
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

    // DELETE /api/projects/:id - Delete a project
    router.delete('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const projectId = req.params.id;
            const success = await projectService.deleteProject(projectId, user.id);

            if (success) {
                res.json({ message: "Project deleted successfully" });
            } else {
                res.status(404).json({ error: "Project not found" });
            }
        } catch (error: any) {
            console.error('Error deleting project:', error);
            res.status(500).json({
                error: 'Failed to delete project',
                details: error.message
            });
        }
    });

    return router;
} 