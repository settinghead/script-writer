import { Express } from 'express';
import { AuthDatabase } from '../database/auth';
import { createAuthMiddleware } from '../middleware/auth';
import { JsonDocRepository } from '../transform-jsonDoc-framework/JsonDocRepository';
import { TransformRepository } from '../transform-jsonDoc-framework/TransformRepository';
import { ProjectRepository } from '../transform-jsonDoc-framework/ProjectRepository';
import { ChatMessageRepository } from '../transform-jsonDoc-framework/ChatMessageRepository';
import { ProjectService } from '../services/ProjectService';
import { AgentService } from '../transform-jsonDoc-framework/AgentService';
import { ChatService } from '../transform-jsonDoc-framework/ChatService';

// Import route creators
import { createElectricProxyRoutes } from '../transform-jsonDoc-framework/electricProxy';
import { createProjectRoutes } from './projectRoutes';
import { createJsonDocRoutes } from './jsonDocRoutes';
import { createTransformRoutes } from './transformRoutes';
import { createChatRoutes } from './chatRoutes';
import { createAdminRoutes } from './adminRoutes';
import yjsRoutes from './yjsRoutes';

export function createAPIRoutes(
    app: Express,
    authDB: AuthDatabase,
    authMiddleware: ReturnType<typeof createAuthMiddleware>,
    jsonDocRepo: JsonDocRepository,
    transformRepo: TransformRepository,
    projectRepo: ProjectRepository,
    chatMessageRepo: ChatMessageRepository,
    projectService: ProjectService,
    agentService: AgentService,
    chatService: ChatService
) {
    // Mount Electric proxy routes (BEFORE other routes to avoid conflicts)
    app.use('/api/electric', createElectricProxyRoutes(authDB, jsonDocRepo));

    // Mount project routes
    app.use('/api/projects', createProjectRoutes(authMiddleware, projectService, agentService));

    // Mount jsonDoc routes
    app.use('/api/jsonDocs', createJsonDocRoutes(authMiddleware, jsonDocRepo, transformRepo));

    // Mount transform routes
    app.use('/api/transforms', createTransformRoutes(authMiddleware, jsonDocRepo, transformRepo));

    // Mount chat routes
    app.use('/api/chat', createChatRoutes(authMiddleware, chatService));

    // Mount YJS routes
    app.use('/api/yjs', yjsRoutes);

    // Mount admin routes (dev-only)
    app.use('/api/admin', createAdminRoutes(transformRepo, jsonDocRepo));

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