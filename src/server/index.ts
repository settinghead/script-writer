import express from "express";
import ViteExpress from "vite-express";
import * as dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { AuthDatabase } from './database/auth';
import { createAuthMiddleware } from './middleware/auth';
import { createAuthRoutes } from './routes/auth';
import yjsRoutes from './routes/yjsRoutes';
import { JsonDocRepository } from './transform-jsonDoc-framework/JsonDocRepository.js';
import { TransformRepository } from './transform-jsonDoc-framework/TransformRepository.js';

import { db } from './database/connection';

import { ProjectService } from './services/ProjectService.js';
import { ProjectRepository } from './transform-jsonDoc-framework/ProjectRepository.js';
import { AgentService } from './transform-jsonDoc-framework/AgentService.js';
import { ChatMessageRepository } from './transform-jsonDoc-framework/ChatMessageRepository.js';
import { ChatService } from './transform-jsonDoc-framework/ChatService.js';


dotenv.config();

const PORT = parseInt(process.env.PORT || "4600");
const app = express();

// Configure body parser with increased size limits for large jsonDoc data
app.use(express.json({ limit: '50mb' })); // Increase JSON body size limit
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Also increase URL-encoded body limit
app.use(cookieParser()); // Middleware to parse cookies

// Initialize authentication system
const authDB = new AuthDatabase(db);
const authMiddleware = createAuthMiddleware(authDB);

// Test users can be seeded manually with: npm run seed

// Initialize repositories
const jsonDocRepo = new JsonDocRepository(db);
const transformRepo = new TransformRepository(db);
const projectRepo = new ProjectRepository(db);


// Initialize services with unified streaming
const projectService = new ProjectService(db);
const agentService = new AgentService(transformRepo, jsonDocRepo);

// Initialize chat services
const chatMessageRepo = new ChatMessageRepository(db);
const chatService = new ChatService(chatMessageRepo, agentService);

// Inject dependencies to avoid circular dependency issues
agentService.setChatMessageRepository(chatMessageRepo);

// Make services available to routes via app.locals
app.locals.transformRepo = transformRepo;
const server = app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server is listening at http://localhost:${PORT}...`)
);

// Only bind ViteExpress in development - nginx handles static files in production
if (process.env.NODE_ENV !== 'production') {
  ViteExpress.bind(app, server);
}


// Mount authentication routes
app.use('/auth', createAuthRoutes(authDB, authMiddleware));
app.use('/api/yjs', yjsRoutes);

// Mount all API routes
import { createAPIRoutes } from './routes/apiRoutes';
createAPIRoutes(
  app,
  authDB,
  authMiddleware,
  jsonDocRepo,
  transformRepo,
  projectRepo,
  chatMessageRepo,
  projectService,
  agentService,
  chatService
);

// Attach authDB to all requests
app.use(authMiddleware.attachAuthDB);

// Original message endpoint
app.get("/message", (_req, res) => {
  res.send("Hello from Express!");
});







// ========== TRANSFORM ENDPOINTS ==========

// Stop streaming transform
app.post("/api/transforms/:transformId/stop",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const { transformId } = req.params;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      // Get transform first
      const transform = await transformRepo.getTransform(transformId);
      if (!transform) {
        return res.status(404).json({ error: "Transform not found" });
      }

      // Check if user has access to the project containing this transform
      const hasAccess = await jsonDocRepo.userHasProjectAccess(user.id, transform.project_id);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied - user not member of project" });
      }

      // Check if transform is actually running
      if (transform.status !== 'running') {
        return res.status(400).json({
          error: "Transform is not running",
          status: transform.status
        });
      }

      // Stop the transform by updating its status
      await transformRepo.updateTransformStatus(transformId, 'cancelled');

      res.json({
        message: "Transform stopped",
        transformId: transformId,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Error stopping transform:', error);
      res.status(500).json({
        error: "Failed to stop transform",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// ========== JSONDOC ENDPOINTS ==========

// Helper function to find brainstorm_input_params in jsonDoc lineage
async function findBrainstormParamsInLineage(userId: string, sourceJsonDocId: string) {
  const userTransforms = await transformRepo.getUserTransforms(userId);
  const visitedJsonDocs = new Set<string>();
  const jsonDocsToCheck = [sourceJsonDocId];
  const brainstormParams: any[] = [];

  while (jsonDocsToCheck.length > 0) {
    const currentJsonDocId = jsonDocsToCheck.shift()!;

    if (visitedJsonDocs.has(currentJsonDocId)) {
      continue;
    }
    visitedJsonDocs.add(currentJsonDocId);

    const jsonDoc = await jsonDocRepo.getJsonDoc(currentJsonDocId);
    if (jsonDoc) {
      // Verify user has access to this jsonDoc's project
      const hasAccess = await jsonDocRepo.userHasProjectAccess(userId, jsonDoc.project_id);
      if (!hasAccess) {
        continue; // Skip jsonDocs user doesn't have access to
      }
      if (jsonDoc.schema_type === 'brainstorm_input_params') {
        brainstormParams.push(jsonDoc);
      }
    }

    // Find transforms that have this jsonDoc as output (going backwards in lineage)
    for (const transform of userTransforms) {
      const outputs = await transformRepo.getTransformOutputs(transform.id);
      if (outputs.some(output => output.jsonDoc_id === currentJsonDocId)) {
        // This transform produced the current jsonDoc, check its inputs
        const inputs = await transformRepo.getTransformInputs(transform.id);
        for (const input of inputs) {
          if (!visitedJsonDocs.has(input.jsonDoc_id)) {
            jsonDocsToCheck.push(input.jsonDoc_id);
          }
        }
      }
    }
  }

  return brainstormParams;
}

// Helper function to find brainstorm_input_params for a session (outline or episode)
async function findBrainstormParamsForSession(userId: string, sessionId: string) {
  const userTransforms = await transformRepo.getUserTransforms(userId);

  // Find transforms related to this session
  const sessionTransforms = userTransforms.filter(t =>
    t.execution_context?.outline_session_id === sessionId ||
    t.execution_context?.episode_session_id === sessionId
  );

  const relatedJsonDocIds = new Set<string>();

  // Collect all input and output jsonDocs from session transforms
  for (const transform of sessionTransforms) {
    const inputs = await transformRepo.getTransformInputs(transform.id);
    const outputs = await transformRepo.getTransformOutputs(transform.id);

    inputs.forEach(i => relatedJsonDocIds.add(i.jsonDoc_id));
    outputs.forEach(o => relatedJsonDocIds.add(o.jsonDoc_id));
  }

  // Now find brainstorm_input_params in the lineage of these jsonDocs
  const brainstormParams: any[] = [];

  for (const jsonDocId of relatedJsonDocIds) {
    const lineageBrainstormParams = await findBrainstormParamsInLineage(userId, jsonDocId);
    for (const param of lineageBrainstormParams) {
      if (!brainstormParams.some(existing => existing.id === param.id)) {
        brainstormParams.push(param);
      }
    }
  }

  return brainstormParams;
}

// Get jsonDocs with optional filtering and workflow lineage support
app.get("/api/jsonDocs",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const {
        type,
        type_version,
        limit = 50,
        sourceJsonDocId,
        sessionId
      } = req.query;

      let jsonDocs: any[] = [];

      if (type === 'brainstorm_input_params') {
        // Special handling for brainstorm_input_params with lineage tracing
        if (sourceJsonDocId) {
          // Find brainstorm_input_params in the lineage of this source jsonDoc
          jsonDocs = await findBrainstormParamsInLineage(user.id, sourceJsonDocId);
        } else if (sessionId) {
          // Find brainstorm_input_params for a specific session (outline or episode)
          jsonDocs = await findBrainstormParamsForSession(user.id, sessionId);
        } else {
          // Fallback to all brainstorm_input_params for the user
          jsonDocs = await jsonDocRepo.getUserJsonDocs(user.id);
          jsonDocs = jsonDocs.filter(a => a.schema_type === type);
        }
      } else {
        // Regular jsonDoc fetching
        jsonDocs = await jsonDocRepo.getUserJsonDocs(user.id);

        // Apply filters
        if (type) {
          jsonDocs = jsonDocs.filter(a => a.schema_type === type);
        }
      }

      if (type_version) {
        jsonDocs = jsonDocs.filter(a => a.schema_version === type_version);
      }

      // Sort by created_at descending (most recent first)
      jsonDocs = jsonDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Limit results
      jsonDocs = jsonDocs.slice(0, parseInt(limit as string));

      res.json(jsonDocs);

    } catch (error: any) {
      console.error('Error fetching jsonDocs:', error);
      res.status(500).json({
        error: "Failed to fetch jsonDocs",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);







// ========== JSONDOC ENDPOINTS ===========

// Handle client-side routing fallback
// This must be the last route to catch all unmatched routes
app.get(/(.*)/, (req, res, next) => {
  // Only handle routes that don't start with /api, /llm-api, or other API routes
  if (req.path.startsWith('/api') ||
    req.path.startsWith('/llm-api') ||
    req.path.startsWith('/debug') ||
    req.path.startsWith('/yjs') ||
    req.path.includes('.')) { // Skip routes with file extensions (assets)
    return next();
  }

  // For all other routes, let ViteExpress handle the client-side routing
  // ViteExpress will serve the index.html and React Router will handle the rest
  next();
});
