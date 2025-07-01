import express from "express";
import ViteExpress from "vite-express";
import * as dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { AuthDatabase } from './database/auth';
import { createAuthMiddleware } from './middleware/auth';
import { createAuthRoutes } from './routes/auth';
import { ArtifactRepository } from './transform-artifact-framework/ArtifactRepository.js';
import { TransformRepository } from './transform-artifact-framework/TransformRepository.js';

import { db } from './database/connection';

import { ProjectService } from './services/ProjectService.js';
import { ProjectRepository } from './transform-artifact-framework/ProjectRepository.js';
import { AgentService } from './transform-artifact-framework/AgentService.js';
import { ChatMessageRepository } from './transform-artifact-framework/ChatMessageRepository.js';
import { ChatService } from './transform-artifact-framework/ChatService.js';


dotenv.config();

const PORT = parseInt(process.env.PORT || "4600");
const app = express();

app.use(express.json()); // Middleware to parse JSON bodies
app.use(cookieParser()); // Middleware to parse cookies

// Initialize authentication system
const authDB = new AuthDatabase(db);
const authMiddleware = createAuthMiddleware(authDB);

// Test users can be seeded manually with: npm run seed

// Initialize repositories
const artifactRepo = new ArtifactRepository(db);
const transformRepo = new TransformRepository(db);
const projectRepo = new ProjectRepository(db);


// Initialize services with unified streaming
const projectService = new ProjectService(db);
const agentService = new AgentService(transformRepo, artifactRepo);

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

ViteExpress.bind(app, server);


// Mount authentication routes
app.use('/auth', createAuthRoutes(authDB, authMiddleware));

// Mount all API routes
import { createAPIRoutes } from './routes/apiRoutes';
createAPIRoutes(
  app,
  authDB,
  authMiddleware,
  artifactRepo,
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
      const hasAccess = await artifactRepo.userHasProjectAccess(user.id, transform.project_id);
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

// ========== ARTIFACT ENDPOINTS ==========

// Helper function to find brainstorm_params in artifact lineage
async function findBrainstormParamsInLineage(userId: string, sourceArtifactId: string) {
  const userTransforms = await transformRepo.getUserTransforms(userId);
  const visitedArtifacts = new Set<string>();
  const artifactsToCheck = [sourceArtifactId];
  const brainstormParams: any[] = [];

  while (artifactsToCheck.length > 0) {
    const currentArtifactId = artifactsToCheck.shift()!;

    if (visitedArtifacts.has(currentArtifactId)) {
      continue;
    }
    visitedArtifacts.add(currentArtifactId);

    // Check if this artifact is brainstorm_params or brainstorming_job_params (which contains the same data)
    const artifact = await artifactRepo.getArtifact(currentArtifactId);
    if (artifact) {
      // Verify user has access to this artifact's project
      const hasAccess = await artifactRepo.userHasProjectAccess(userId, artifact.project_id);
      if (!hasAccess) {
        continue; // Skip artifacts user doesn't have access to
      }
      if (artifact.type === 'brainstorm_params') {
        brainstormParams.push(artifact);
      } else if (artifact.type === 'brainstorming_job_params') {
        // Convert brainstorming_job_params to brainstorm_params format
        const convertedParams = {
          ...artifact,
          type: 'brainstorm_params',
          data: {
            platform: artifact.data.platform,
            genre_paths: artifact.data.genrePaths,
            requirements: artifact.data.requirements
          }
        };
        brainstormParams.push(convertedParams);
      }
    }

    // Find transforms that have this artifact as output (going backwards in lineage)
    for (const transform of userTransforms) {
      const outputs = await transformRepo.getTransformOutputs(transform.id);
      if (outputs.some(output => output.artifact_id === currentArtifactId)) {
        // This transform produced the current artifact, check its inputs
        const inputs = await transformRepo.getTransformInputs(transform.id);
        for (const input of inputs) {
          if (!visitedArtifacts.has(input.artifact_id)) {
            artifactsToCheck.push(input.artifact_id);
          }
        }
      }
    }
  }

  return brainstormParams;
}

// Helper function to find brainstorm_params for a session (outline or episode)
async function findBrainstormParamsForSession(userId: string, sessionId: string) {
  const userTransforms = await transformRepo.getUserTransforms(userId);

  // Find transforms related to this session
  const sessionTransforms = userTransforms.filter(t =>
    t.execution_context?.outline_session_id === sessionId ||
    t.execution_context?.episode_session_id === sessionId
  );

  const relatedArtifactIds = new Set<string>();

  // Collect all input and output artifacts from session transforms
  for (const transform of sessionTransforms) {
    const inputs = await transformRepo.getTransformInputs(transform.id);
    const outputs = await transformRepo.getTransformOutputs(transform.id);

    inputs.forEach(i => relatedArtifactIds.add(i.artifact_id));
    outputs.forEach(o => relatedArtifactIds.add(o.artifact_id));
  }

  // Now find brainstorm_params in the lineage of these artifacts
  const brainstormParams: any[] = [];

  for (const artifactId of relatedArtifactIds) {
    const lineageBrainstormParams = await findBrainstormParamsInLineage(userId, artifactId);
    for (const param of lineageBrainstormParams) {
      if (!brainstormParams.some(existing => existing.id === param.id)) {
        brainstormParams.push(param);
      }
    }
  }

  return brainstormParams;
}

// Get artifacts with optional filtering and workflow lineage support
app.get("/api/artifacts",
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
        sourceArtifactId,
        sessionId
      } = req.query;

      let artifacts: any[] = [];

      if (type === 'brainstorm_params') {
        // Special handling for brainstorm_params with lineage tracing
        if (sourceArtifactId) {
          // Find brainstorm_params in the lineage of this source artifact
          artifacts = await findBrainstormParamsInLineage(user.id, sourceArtifactId);
        } else if (sessionId) {
          // Find brainstorm_params for a specific session (outline or episode)
          artifacts = await findBrainstormParamsForSession(user.id, sessionId);
        } else {
          // Fallback to all brainstorm_params for the user
          artifacts = await artifactRepo.getUserArtifacts(user.id);
          artifacts = artifacts.filter(a => a.type === type);
        }
      } else {
        // Regular artifact fetching
        artifacts = await artifactRepo.getUserArtifacts(user.id);

        // Apply filters
        if (type) {
          artifacts = artifacts.filter(a => a.type === type);
        }
      }

      if (type_version) {
        artifacts = artifacts.filter(a => a.type_version === type_version);
      }

      // Sort by created_at descending (most recent first)
      artifacts = artifacts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Limit results
      artifacts = artifacts.slice(0, parseInt(limit as string));

      res.json(artifacts);

    } catch (error: any) {
      console.error('Error fetching artifacts:', error);
      res.status(500).json({
        error: "Failed to fetch artifacts",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);



app.post("/api/artifacts/user-input",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const { text, title, sourceArtifactId } = req.body;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate required fields
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        error: "Missing or empty text",
        details: "text must be a non-empty string"
      });
    }

    try {
      const artifact = await artifactRepo.createArtifact(
        user.id,
        'user_input',
        {
          text: text.trim(),
          title: title?.trim() || undefined,
          source: sourceArtifactId ? 'modified_brainstorm' : 'manual',
          source_artifact_id: sourceArtifactId
        },
        'v1', // typeVersion
        undefined, // metadata
        'completed', // streamingStatus
        'user_input' // originType - this is user-created content
      );

      res.json(artifact);

    } catch (error: any) {
      console.error('Error creating user input artifact:', error);
      res.status(500).json({
        error: "Failed to create user input artifact",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);





// ========== ARTIFACT ENDPOINTS ===========

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
