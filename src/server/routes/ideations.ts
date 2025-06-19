import express from 'express';
import { StreamingTransformExecutor } from '../services/streaming/StreamingTransformExecutor';
import { BrainstormingJobParamsV1 } from '../types/artifacts';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { ProjectService } from '../services/ProjectService';
import { IdeationService } from '../services/IdeationService';
import { TransformExecutor } from '../services/TransformExecutor';
import { UnifiedStreamingService } from '../services/UnifiedStreamingService';

export function createIdeationRoutes(
    authMiddleware: any,
    artifactRepo: ArtifactRepository,
    transformRepo: TransformRepository,
    streamingExecutor: StreamingTransformExecutor
) {
    const router = express.Router();
    
    // Initialize project service - use the same db connection as other repos
    const db = (artifactRepo as any).db || (transformRepo as any).db;
    const projectRepo = new ProjectRepository(db);
    const projectService = new ProjectService(projectRepo, artifactRepo, transformRepo);

    // Initialize ideation service for backward compatibility
    const unifiedStreamingService = new UnifiedStreamingService(artifactRepo, transformRepo);
    const transformExecutor = new TransformExecutor(artifactRepo, transformRepo, unifiedStreamingService);
    const ideationService = new IdeationService(artifactRepo, transformRepo, transformExecutor, unifiedStreamingService);

    // ========== NEW PROJECT ENDPOINTS ==========

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

    // ========== PROJECT BRAINSTORMING ENDPOINT ==========

    // Start brainstorming for an existing project
    router.post('/:projectId/brainstorm', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const { projectId } = req.params;
            const { platform, genrePaths, requirements } = req.body;

            // Validate required fields
            if (!platform || !genrePaths) {
                return res.status(400).json({
                    error: "Missing required fields: platform, genrePaths"
                });
            }

            // Verify project access
            const hasAccess = await projectRepo.userHasAccess(projectId, user.id);
            if (!hasAccess) {
                return res.status(404).json({ error: "Project not found or access denied" });
            }

            // Create brainstorming job parameters
            const jobParams: BrainstormingJobParamsV1 = {
                platform,
                genrePaths,
                requirements: requirements || '',
                requestedAt: new Date().toISOString()
            };

            // Start brainstorming job for the project
            const { ideationRunId, transformId } = await streamingExecutor
                .startBrainstormingJobForProject(user.id, projectId, jobParams);

            console.log(`[IdeationRoutes] Started brainstorming job ${transformId} for project ${projectId}`);

            res.json({ 
                projectId,
                ideationRunId, 
                transformId
            });
        } catch (error: any) {
            console.error('Error starting brainstorming job:', error);
            res.status(500).json({
                error: 'Failed to start brainstorming job',
                details: error.message
            });
        }
    });

    // ========== LEGACY IDEATION ENDPOINTS (for backward compatibility) ==========

    // Create brainstorming job (immediate creation and redirect)
    router.post('/brainstorm/create', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const { platform, genrePaths, requirements } = req.body;

            // Validate required fields
            if (!platform || !genrePaths) {
                return res.status(400).json({
                    error: "Missing required fields: platform, genrePaths"
                });
            }

            const jobParams: BrainstormingJobParamsV1 = {
                platform,
                genrePaths,
                requirements: requirements || '',
                requestedAt: new Date().toISOString()
            };

            // Use the injected streaming executor
            const { ideationRunId, transformId } = await streamingExecutor
                .startBrainstormingJob(user.id, jobParams);

            console.log(`[IdeationRoutes] Created brainstorming job ${transformId}, waiting for client connection`);

            res.json({ ideationRunId, transformId });
        } catch (error: any) {
            console.error('Error creating brainstorming job:', error);
            res.status(500).json({
                error: 'Failed to create brainstorming job',
                details: error.message
            });
        }
    });

    // Check for active job for ideation run (legacy)
    router.get('/:id/active-job', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) {
                return res.status(401).json({ error: "User not authenticated" });
            }

            const ideationRunId = req.params.id;

            // Find the most recent running transform for this ideation run
            const activeTransform = await transformRepo.getActiveTransformForRun(
                user.id,
                ideationRunId
            );

            if (activeTransform && activeTransform.status === 'running') {
                res.json({
                    transformId: activeTransform.id,
                    status: activeTransform.status,
                    retryCount: activeTransform.retry_count
                });
            } else {
                res.status(404).json({ message: 'No active job' });
            }
        } catch (error: any) {
            console.error('Error checking active job:', error);
            res.status(500).json({
                error: 'Failed to check active job',
                details: error.message
            });
        }
    });

    return router;
}