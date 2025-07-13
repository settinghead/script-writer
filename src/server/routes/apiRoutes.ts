import { Express } from 'express';
import { AuthDatabase } from '../database/auth';
import { createAuthMiddleware } from '../middleware/auth';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { ProjectRepository } from '../transform-jsondoc-framework/ProjectRepository';
import { ChatMessageRepository } from '../transform-jsondoc-framework/ChatMessageRepository';
import { ProjectService } from '../services/ProjectService';
import { AgentService } from '../transform-jsondoc-framework/AgentService';
import { ChatService } from '../transform-jsondoc-framework/ChatService';

// Import route creators
import { createElectricProxyRoutes } from '../transform-jsondoc-framework/electricProxy';
import { createProjectRoutes } from './projectRoutes';
import { createJsondocRoutes } from './jsondocRoutes';
import { createTransformRoutes } from './transformRoutes';
import { createChatRoutes } from './chatRoutes';
import { createAdminRoutes } from './adminRoutes';
import yjsRoutes from './yjsRoutes';

export function createAPIRoutes(
    app: Express,
    authDB: AuthDatabase,
    authMiddleware: ReturnType<typeof createAuthMiddleware>,
    jsondocRepo: JsondocRepository,
    transformRepo: TransformRepository,
    projectRepo: ProjectRepository,
    chatMessageRepo: ChatMessageRepository,
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

    // Mount chat routes
    app.use('/api/chat', createChatRoutes(authMiddleware, chatService));

    // Mount YJS routes
    app.use('/api/yjs', yjsRoutes);

    // Mount admin routes (dev-only)
    app.use('/api/admin', createAdminRoutes(transformRepo, jsondocRepo));

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