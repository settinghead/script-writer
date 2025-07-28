import express from "express";
import ViteExpress from "vite-express";
import * as dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { AuthDatabase } from './database/auth';
import { createAuthMiddleware } from './middleware/auth';
import { createAuthRoutes } from './routes/auth';
import yjsRoutes from './routes/yjsRoutes';
import { TransformJsondocRepository } from './transform-jsondoc-framework/TransformJsondocRepository.js';

import { db } from './database/connection';

import { ProjectService } from './services/ProjectService.js';
import { ProjectRepository } from './transform-jsondoc-framework/ProjectRepository.js';
import { AgentService } from './transform-jsondoc-framework/AgentService.js';
import { ChatService } from './transform-jsondoc-framework/ChatService.js';


dotenv.config();

if (!process.env.PORT) {
  throw new Error('PORT is not set');
}

if (!process.env.HTTPS_PORT) {
  throw new Error('HTTPS_PORT is not set');
}


const PORT = parseInt(process.env.PORT);
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT);
const app = express();

// Configure body parser with increased size limits for large jsondoc data
app.use(express.json({ limit: '50mb' })); // Increase JSON body size limit
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Also increase URL-encoded body limit
app.use(cookieParser()); // Middleware to parse cookies

// Initialize authentication system
const authDB = new AuthDatabase(db);
const authMiddleware = createAuthMiddleware(authDB);

// Test users can be seeded manually with: npm run seed

// Initialize repositories
const jsondocRepo = new TransformJsondocRepository(db);
const transformRepo = new TransformJsondocRepository(db);
const projectRepo = new ProjectRepository(db);


// Initialize services with unified streaming
const projectService = new ProjectService(db);
const agentService = new AgentService(transformRepo, jsondocRepo);

// Initialize chat services
const chatService = new ChatService(null, agentService, jsondocRepo); // chatRepo is deprecated but required for compatibility

// Note: AgentService now uses conversation system directly, no need for ChatMessageRepository injection

// Initialize particle system asynchronously
let particleSystemInitialized = false;
(async () => {
  try {
    const { initializeParticleSystem } = await import('./transform-jsondoc-framework/particles/ParticleSystemInitializer.js');
    await initializeParticleSystem(db);
    particleSystemInitialized = true;
    console.log('🎯 Particle system initialized successfully');
  } catch (error) {
    console.warn('⚠️ Particle system initialization failed (this is expected if embedding env vars are not set):', error instanceof Error ? error.message : error);
    // gracefully exit
    process.exit(1);
  }
})();

// Make services available to routes via app.locals
app.locals.transformRepo = transformRepo;
const server = app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server is listening at https://localhost:${HTTPS_PORT}...`)
);

// Only bind ViteExpress in development - nginx handles static files in production
if (process.env.NODE_ENV !== 'production') {
  ViteExpress.bind(app, server);
}


// Mount authentication routes
app.use('/auth', createAuthRoutes(authDB, authMiddleware));
app.use('/api/yjs', yjsRoutes);

// Mount particle routes BEFORE other API routes to avoid catch-all
import particleRoutes from './routes/particleRoutes.js';
app.use('/api/particles', particleRoutes);

// Mount all API routes
import { createAPIRoutes } from './routes/apiRoutes';
createAPIRoutes(
  app,
  authDB,
  authMiddleware,
  jsondocRepo,
  transformRepo,
  projectRepo,
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
      const hasAccess = await jsondocRepo.userHasProjectAccess(user.id, transform.project_id);
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

// Helper function to find brainstorm_input_params in jsondoc lineage
async function findBrainstormParamsInLineage(userId: string, sourceJsondocId: string) {
  const userTransforms = await transformRepo.getUserTransforms(userId);
  const visitedJsondocs = new Set<string>();
  const jsondocsToCheck = [sourceJsondocId];
  const brainstormParams: any[] = [];

  while (jsondocsToCheck.length > 0) {
    const currentJsondocId = jsondocsToCheck.shift()!;

    if (visitedJsondocs.has(currentJsondocId)) {
      continue;
    }
    visitedJsondocs.add(currentJsondocId);

    const jsondoc = await jsondocRepo.getJsondoc(currentJsondocId);
    if (jsondoc) {
      // Verify user has access to this jsondoc's project
      const hasAccess = await jsondocRepo.userHasProjectAccess(userId, jsondoc.project_id);
      if (!hasAccess) {
        continue; // Skip jsondocs user doesn't have access to
      }
      if (jsondoc.schema_type === 'brainstorm_input_params') {
        brainstormParams.push(jsondoc);
      }
    }

    // Find transforms that have this jsondoc as output (going backwards in lineage)
    for (const transform of userTransforms) {
      const outputs = await transformRepo.getTransformOutputs(transform.id);
      if (outputs.some(output => output.jsondoc_id === currentJsondocId)) {
        // This transform produced the current jsondoc, check its inputs
        const inputs = await transformRepo.getTransformInputs(transform.id);
        for (const input of inputs) {
          if (!visitedJsondocs.has(input.jsondoc_id)) {
            jsondocsToCheck.push(input.jsondoc_id);
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

  const relatedJsondocIds = new Set<string>();

  // Collect all input and output jsondocs from session transforms
  for (const transform of sessionTransforms) {
    const inputs = await transformRepo.getTransformInputs(transform.id);
    const outputs = await transformRepo.getTransformOutputs(transform.id);

    inputs.forEach(i => relatedJsondocIds.add(i.jsondoc_id));
    outputs.forEach(o => relatedJsondocIds.add(o.jsondoc_id));
  }

  // Now find brainstorm_input_params in the lineage of these jsondocs
  const brainstormParams: any[] = [];

  for (const jsondocId of relatedJsondocIds) {
    const lineageBrainstormParams = await findBrainstormParamsInLineage(userId, jsondocId);
    for (const param of lineageBrainstormParams) {
      if (!brainstormParams.some(existing => existing.id === param.id)) {
        brainstormParams.push(param);
      }
    }
  }

  return brainstormParams;
}

// Get jsondocs with optional filtering and workflow lineage support
app.get("/api/jsondocs",
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
        sourceJsondocId,
        sessionId
      } = req.query;

      let jsondocs: any[] = [];

      if (type === 'brainstorm_input_params') {
        // Special handling for brainstorm_input_params with lineage tracing
        if (sourceJsondocId) {
          // Find brainstorm_input_params in the lineage of this source jsondoc
          jsondocs = await findBrainstormParamsInLineage(user.id, sourceJsondocId);
        } else if (sessionId) {
          // Find brainstorm_input_params for a specific session (outline or episode)
          jsondocs = await findBrainstormParamsForSession(user.id, sessionId);
        } else {
          // Fallback to all brainstorm_input_params for the user
          jsondocs = await jsondocRepo.getUserJsondocs(user.id);
          jsondocs = jsondocs.filter(a => a.schema_type === type);
        }
      } else {
        // Regular jsondoc fetching
        jsondocs = await jsondocRepo.getUserJsondocs(user.id);

        // Apply filters
        if (type) {
          jsondocs = jsondocs.filter(a => a.schema_type === type);
        }
      }

      if (type_version) {
        jsondocs = jsondocs.filter(a => a.schema_version === type_version);
      }

      // Sort by created_at descending (most recent first)
      jsondocs = jsondocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Limit results
      jsondocs = jsondocs.slice(0, parseInt(limit as string));

      res.json(jsondocs);

    } catch (error: any) {
      console.error('Error fetching jsondocs:', error);
      res.status(500).json({
        error: "Failed to fetch jsondocs",
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
