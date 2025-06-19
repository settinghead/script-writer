import express from 'express';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { ProjectService } from '../services/ProjectService';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';

export function createProjectRoutes(
    authMiddleware: any,
    artifactRepo: ArtifactRepository,
    transformRepo: TransformRepository
) {
    const router = express.Router();
    
    // Initialize project service
    const db = (artifactRepo as any).db || (transformRepo as any).db;
    const projectRepo = new ProjectRepository(db);
    const projectService = new ProjectService(projectRepo, artifactRepo, transformRepo);

    // Create new project
    router.post('/create', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const { name, description, projectType = 'script' } = req.body;

            if (!name || !name.trim()) {
                return res.status(400).json({
                    error: "Project name is required"
                });
            }

            const project = await projectService.createProject(
                user.id,
                name.trim(),
                description?.trim(),
                projectType
            );

            res.json(project);
        } catch (error: any) {
            console.error('Error creating project:', error);
            res.status(500).json({
                error: 'Failed to create project',
                details: error.message
            });
        }
    });

    // Create project with auto-generated name from brainstorming parameters
    router.post('/create-for-brainstorm', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const { platform, genrePaths } = req.body;

            // Generate project title from genres
            const generateProjectTitle = (genrePaths: string[][]): string => {
                if (!genrePaths || genrePaths.length === 0) {
                    return '未命名项目';
                }

                // Extract the last part of each genre path (the most specific genre)
                const genres = genrePaths
                    .map(path => path[path.length - 1])
                    .filter(genre => genre && genre !== 'disabled')
                    .slice(0, 3); // Limit to 3 genres for readability

                if (genres.length === 0) {
                    return '未命名项目';
                }

                return `[${genres.join('+')}] 未命名`;
            };

            const projectTitle = generateProjectTitle(genrePaths);

            const project = await projectService.createProject(
                user.id,
                projectTitle,
                `${platform} 项目`, // Description with platform info
                'script'
            );

            res.json(project);
        } catch (error: any) {
            console.error('Error creating project for brainstorm:', error);
            res.status(500).json({
                error: 'Failed to create project',
                details: error.message
            });
        }
    });

    // Update project
    router.put('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const { id } = req.params;
            const { name, description } = req.body;

            const updates: any = {};
            if (name !== undefined) updates.name = name.trim();
            if (description !== undefined) updates.description = description?.trim();

            await projectService.updateProject(id, user.id, updates);
            res.json({ success: true });
        } catch (error: any) {
            console.error('Error updating project:', error);
            if (error.message.includes('not found') || error.message.includes('access denied')) {
                return res.status(404).json({ error: error.message });
            }
            res.status(500).json({
                error: 'Failed to update project',
                details: error.message
            });
        }
    });

    // Delete project
    router.delete('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const { id } = req.params;
            const deleted = await projectService.deleteProject(id, user.id);

            if (!deleted) {
                return res.status(404).json({ error: "Project not found" });
            }

            res.json({ success: true, message: "Project deleted successfully" });
        } catch (error: any) {
            console.error('Error deleting project:', error);
            if (error.message.includes('owners')) {
                return res.status(403).json({ error: error.message });
            }
            res.status(500).json({
                error: 'Failed to delete project',
                details: error.message
            });
        }
    });

    return router;
} 