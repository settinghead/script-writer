import { Express } from 'express';
import { AuthDatabase } from '../database/auth';
import { createAuthMiddleware } from '../middleware/auth';
import { ArtifactRepository } from '../transform-artifact-framework/ArtifactRepository';
import { TransformRepository } from '../transform-artifact-framework/TransformRepository';
import { ProjectRepository } from '../transform-artifact-framework/ProjectRepository';
import { ChatMessageRepository } from '../transform-artifact-framework/ChatMessageRepository';
import { ProjectService } from '../services/ProjectService';
import { AgentService } from '../transform-artifact-framework/AgentService';
import { ChatService } from '../transform-artifact-framework/ChatService';

// Import route creators
import { createElectricProxyRoutes } from './electricProxy';
import { createProjectRoutes } from './projectRoutes';
import { createArtifactRoutes } from './artifactRoutes';
import { createChatRoutes } from './chatRoutes';
import { createAdminRoutes } from './adminRoutes';

export function createAPIRoutes(
    app: Express,
    authDB: AuthDatabase,
    authMiddleware: ReturnType<typeof createAuthMiddleware>,
    artifactRepo: ArtifactRepository,
    transformRepo: TransformRepository,
    projectRepo: ProjectRepository,
    chatMessageRepo: ChatMessageRepository,
    projectService: ProjectService,
    agentService: AgentService,
    chatService: ChatService
) {
    // Mount Electric proxy routes (BEFORE other routes to avoid conflicts)
    app.use('/api/electric', createElectricProxyRoutes(authDB));

    // Mount project routes
    app.use('/api/projects', createProjectRoutes(authMiddleware, projectService, agentService));

    // Mount artifact routes
    app.use('/api/artifacts', createArtifactRoutes(authMiddleware, artifactRepo, transformRepo));

    // Mount chat routes
    app.use('/api/chat', createChatRoutes(authMiddleware, chatService));

    // Mount admin routes (dev-only)
    app.use('/api/admin', createAdminRoutes(transformRepo, artifactRepo));

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