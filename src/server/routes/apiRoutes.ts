import { Express } from 'express';
import { AuthDatabase } from '../database/auth';
import { createAuthMiddleware } from '../middleware/auth';
import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository';
import { ProjectRepository } from '../transform-jsondoc-framework/ProjectRepository';
import { ProjectService } from '../services/ProjectService';
import { AgentService } from '../transform-jsondoc-framework/AgentService';
import { ChatService } from '../transform-jsondoc-framework/ChatService';

// Import route creators
import { createElectricProxyRoutes } from '../transform-jsondoc-framework/electricProxy';
import { createProjectRoutes } from './projectRoutes';
import { createJsondocRoutes } from './jsondocRoutes';
import { createTransformRoutes } from './transformRoutes';
import { createPatchRoutes } from './patchRoutes';
import { createChatRoutes } from './chatRoutes';
import { createAdminRoutes } from './adminRoutes';
import { createExportRoutes } from './exportRoutes';
import yjsRoutes from './yjsRoutes';
import { Router } from 'express';
import { BatchAutoFixService } from '../services/BatchAutoFixService';

export function createAPIRoutes(
    app: Express,
    authDB: AuthDatabase,
    authMiddleware: ReturnType<typeof createAuthMiddleware>,
    jsondocRepo: TransformJsondocRepository,
    transformRepo: TransformJsondocRepository,
    projectRepo: ProjectRepository,
    projectService: ProjectService,
    agentService: AgentService,
    chatService: ChatService
) {
    // Mount Electric proxy routes (BEFORE other routes to avoid conflicts)
    app.use('/api/electric', createElectricProxyRoutes(authDB, jsondocRepo));

    // Mount project routes
    app.use('/api/projects', createProjectRoutes(authMiddleware, projectService, agentService));

    // Mount jsondoc routes
    app.use('/api/jsondocs', createJsondocRoutes(authMiddleware, jsondocRepo, transformRepo));

    // Mount transform routes
    app.use('/api/transforms', createTransformRoutes(authMiddleware, jsondocRepo, transformRepo));

    // Mount patch routes
    app.use('/api/patches', createPatchRoutes(authMiddleware, jsondocRepo, transformRepo));

    // Mount chat routes
    app.use('/api/chat', createChatRoutes(authMiddleware, chatService));

    // Mount YJS routes
    app.use('/api/yjs', yjsRoutes);

    // Mount admin routes (dev-only)
    app.use('/api/admin', createAdminRoutes(jsondocRepo, authMiddleware, transformRepo, projectRepo));

    // Mount export routes
    app.use('/api/export', createExportRoutes(authMiddleware));

    // Auto-fix route (batch processing)
    const autoFixRouter = Router();
    autoFixRouter.post('/run', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            if (!user) return res.status(401).json({ error: 'User not authenticated' });
            const { projectId, items } = req.body || {};
            if (!projectId || !Array.isArray(items)) return res.status(400).json({ error: 'projectId and items are required' });

            // Access control
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, projectId);
            if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

            const service = new BatchAutoFixService(projectId, user.id, jsondocRepo, transformRepo);
            const result = await service.run(items);
            res.json({ success: true, ...result });
        } catch (e: any) {
            console.error('Auto-fix error:', e);
            res.status(500).json({ error: 'Auto-fix failed', details: e?.message || e });
        }
    });
    app.use('/api/auto-fix', autoFixRouter);

    // Auto-fix SSE progress stream
    app.get('/api/auto-fix/stream/:projectId', authMiddleware.authenticate, async (req: any, res: any) => {
        try {
            const user = authMiddleware.getCurrentUser(req);
            const { projectId } = req.params;
            if (!user) return res.status(401).end();
            const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, projectId);
            if (!hasAccess) return res.status(403).end();

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders?.();

            const { BatchAutoFixService } = await import('../services/BatchAutoFixService.js');
            const emitter = BatchAutoFixService.getEmitter(projectId);

            const onMessage = (payload: any) => {
                res.write(`data: ${JSON.stringify(payload)}\n\n`);
            };
            emitter.on('message', onMessage);

            req.on('close', () => {
                emitter.off('message', onMessage);
                res.end();
            });
        } catch (e) {
            res.status(500).end();
        }
    });

    // Catch-all for unmatched API routes - return 404 instead of falling through to ViteExpress
    app.use(/^\/api\/.*$/, (req, res) => {
        res.status(404).json({
            error: 'API endpoint not found',
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
        });
    });
} 