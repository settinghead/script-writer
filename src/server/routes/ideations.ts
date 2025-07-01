import express from 'express';
import { TransformRepository } from '../transform-artifact-framework/TransformRepository';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';
import { ProjectService } from '../services/ProjectService';

export function createIdeationRoutes(
    authMiddleware: any,
    artifactRepo: ArtifactRepository,
    transformRepo: TransformRepository
) {
    const router = express.Router();

    // Initialize project service - use the same db connection as other repos
    const db = (artifactRepo as any).db || (transformRepo as any).db;
    const projectService = new ProjectService(db);



    // List projects (replaces GET /api/ideations)
    router.get('/', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const projects = await projectService.listUserProjects(user.id);
            res.json(projects);
        } catch (error: any) {
            console.error('Error listing projects:', error);
            res.status(500).json({
                error: 'Failed to list projects',
                details: error.message
            });
        }
    });

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

    // Get specific project
    router.get('/:id', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const { id } = req.params;
            const project = await projectService.getProject(id, user.id);

            if (!project) {
                return res.status(404).json({ error: "Project not found" });
            }

            res.json(project);
        } catch (error: any) {
            console.error('Error getting project:', error);
            res.status(500).json({
                error: 'Failed to get project',
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

    // ========== REMOVED LEGACY BRAINSTORMING ENDPOINTS ==========
    // Legacy brainstorming endpoints have been removed as part of Electric Sync migration.
    // Use the new /api/brainstorm endpoints instead.

    return router;
}