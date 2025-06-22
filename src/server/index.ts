import express from "express";
import ViteExpress from "vite-express";
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import * as dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { setupYjsWebSocketServer, applyEditsToYDoc } from './yjs-server';
import { parseLLMResponse } from './llm-to-yjs';
import { AuthDatabase } from './database/auth';
import { createAuthMiddleware } from './middleware/auth';
import { createAuthRoutes } from './routes/auth';
import { ArtifactRepository } from './repositories/ArtifactRepository';
import { TransformRepository } from './repositories/TransformRepository';
import { TransformExecutor } from './services/TransformExecutor';
import { OutlineService } from './services/OutlineService';
import { ScriptService } from './services/ScriptService';
import {
  validateIdeationCreate,
  validatePlotGeneration,
  validateScriptCreate,
  validateScriptUpdate
} from './middleware/validation';
import { ReplayService } from './services/ReplayService';
import { UnifiedStreamingService } from './services/UnifiedStreamingService';
import { db } from './database/connection';
// New streaming framework imports
import { TemplateService } from './services/templates/TemplateService';
import { createIdeationRoutes } from './routes/ideations';
import { BrainstormingJobParamsV1, OutlineJobParamsV1 } from './types/artifacts';
import { OutlineGenerateRequest, OutlineGenerateResponse } from '../common/streaming/types';
// Import and mount outline routes
import { createOutlineRoutes } from './routes/outlineRoutes';
// Import LLM configuration
import { getLLMCredentials } from './services/LLMConfig';
import { createScriptRoutes } from './routes/scriptRoutes.js';
import { createProjectRoutes } from './routes/projectRoutes.js';
import { ProjectService } from './services/ProjectService.js';
import { ProjectRepository } from './repositories/ProjectRepository.js';
import { AgentService } from './services/AgentService.js';
import { BrainstormService } from './services/BrainstormService';
import { LLMService } from './services/LLMService';
import { createBrainstormRoutes } from './routes/brainstormRoutes';


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

// Initialize unified streaming service
const unifiedStreamingService = new UnifiedStreamingService(artifactRepo, transformRepo);

// Initialize services with unified streaming
const transformExecutor = new TransformExecutor(artifactRepo, transformRepo, unifiedStreamingService);
const outlineService = new OutlineService(artifactRepo, transformRepo, unifiedStreamingService);
const scriptService = new ScriptService(artifactRepo, transformExecutor);
const replayService = new ReplayService(artifactRepo, transformRepo, transformExecutor);
const projectService = new ProjectService(projectRepo, artifactRepo, transformRepo);
const agentService = new AgentService(transformRepo, artifactRepo);

// Initialize new streaming framework services
const templateService = new TemplateService();

// Initialize new Electric-compatible services
const llmService = new LLMService();
const brainstormService = new BrainstormService(db, artifactRepo, transformRepo);

// Make services available to routes via app.locals
app.locals.transformRepo = transformRepo;
const server = app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server is listening at http://localhost:${PORT}...`)
);

ViteExpress.bind(app, server);

// Set up YJS WebSocket server
const yjs = setupYjsWebSocketServer(server, authDB);

// Mount authentication routes
app.use('/auth', createAuthRoutes(authDB, authMiddleware));

// Mount Electric proxy routes (BEFORE other routes to avoid conflicts)
import { createElectricProxyRoutes } from './routes/electricProxy';
app.use('/api/electric', createElectricProxyRoutes(authDB));

// Mount project routes
app.use('/api/projects', createProjectRoutes(authMiddleware, projectService, agentService));

// Mount new brainstorm routes (Electric-compatible)
app.use('/api/brainstorm', createBrainstormRoutes(authMiddleware, brainstormService));

// Mount ideation routes - now serving projects list
app.use('/api/ideations', createIdeationRoutes(authMiddleware, artifactRepo, transformRepo));

// Mount artifact routes
import { createArtifactRoutes } from './routes/artifactRoutes';
app.use('/api/artifacts', createArtifactRoutes(authMiddleware, artifactRepo, transformRepo));

// Attach authDB to all requests
app.use(authMiddleware.attachAuthDB);

// Original message endpoint
app.get("/message", (_req, res) => {
  res.send("Hello from Express!");
});

// Original chat completions endpoint - Protected by authentication
app.post("/llm-api/chat/completions", authMiddleware.authenticate, async (req: any, res: any) => {
  try {
    const { apiKey, baseUrl } = getLLMCredentials();

    const { messages, model: modelName, stream = true, ...restOfBody } = req.body;

    if (!messages || !modelName) {
      return res.status(400).json({ error: "Missing 'messages' or 'model' in request body" });
    }

    const llmAI = createOpenAI({
      apiKey: apiKey,
      baseURL: baseUrl,
    });

    if (stream === false) {
      // Non-streaming response
      const { generateText } = await import('ai');
      const result = await generateText({
        model: llmAI(modelName),
        messages: messages,
        ...restOfBody
      });

      // Return OpenAI-compatible response format
      res.json({
        choices: [{
          message: {
            role: 'assistant',
            content: result.text
          },
          finish_reason: 'stop',
          index: 0
        }],
        model: modelName,
        object: 'chat.completion',
        usage: result.usage ? {
          prompt_tokens: result.usage.promptTokens,
          completion_tokens: result.usage.completionTokens,
          total_tokens: result.usage.totalTokens
        } : undefined
      });
    } else {
      // Streaming response (original behavior)
      const result = await streamText({
        model: llmAI(modelName),
        messages: messages,
        ...restOfBody
      });

      // Manually pipe the ReadableStream (DataStream) to the Express response
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      const reader = result.toDataStream().getReader();

      const pump = () => {
        reader.read().then(({ done, value }) => {
          if (done) {
            res.end();
            return;
          }
          res.write(new TextDecoder().decode(value));
          pump();
        }).catch(err => {
          console.error("Error during stream pump:", err);
          if (!res.writableEnded) {
            res.status(500).end("Stream error");
          }
        });
      }
      pump();
    }
  } catch (error: any) {
    console.error('Error in /llm-api/chat/completions endpoint:', error);
    if (!res.headersSent) {
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      } else if (error.status && error.error) {
        return res.status(error.status).json(error.error);
      }
      return res.status(500).json({ error: "Failed to process AI request", details: error.message });
    }
    if (!res.writableEnded) {
      console.error("Headers sent, but error occurred. Ending response.");
      res.end();
    }
  }
});

// New endpoint for script editing using LLM - Protected by authentication
app.post("/llm-api/script/edit", authMiddleware.authenticate, async (req: any, res: any) => {
  const {
    messages,
    model: modelName,
    roomId,
    context,
    ...restOfBody
  } = req.body;

  if (!messages || !modelName || !roomId) {
    return res.status(400).json({
      error: "Missing 'messages', 'model', or 'roomId' in request body"
    });
  }

  try {
    const { apiKey, baseUrl } = getLLMCredentials();

    const llmAI = createOpenAI({
      apiKey: apiKey,
      baseURL: baseUrl,
    });

    // Add system message instructing the LLM how to format script editing responses
    const systemMessage = {
      role: 'system',
      content: `You are a script writing assistant. Your responses should be formatted for direct integration
                with a collaborative script editor. When making edits to the script, use the following format:
                
                {
                  "edits": [
                    { "position": 123, "insert": "Text to insert" },
                    { "position": 456, "delete": 10 }
                  ],
                  "explanation": "Why I made these changes"
                }
                
                You'll be provided with the current state of the script in the context field.`
    };

    // Modify messages to include system prompt and script context
    const enhancedMessages = [
      systemMessage,
      ...messages
    ];

    // If context is provided, add it to the last message
    if (context && enhancedMessages.length > 0) {
      const lastMessageIndex = enhancedMessages.length - 1;
      const lastMessage = enhancedMessages[lastMessageIndex];
      enhancedMessages[lastMessageIndex] = {
        ...lastMessage,
        content: `${lastMessage.content}\n\nCurrent script:\n${context}`
      };
    }

    // Request formatted specifically for script edits
    const result = await streamText({
      model: llmAI(modelName),
      messages: enhancedMessages,
      response_format: { type: "json_object" },
      ...restOfBody
    });

    // Set up headers for streaming response
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const reader = result.toDataStream().getReader();
    let fullResponse = '';

    const pump = () => {
      reader.read().then(({ done, value }) => {
        if (done) {
          // Process the complete response to extract edit commands
          try {
            const edits = parseLLMResponse(fullResponse);
            if (edits && edits.length > 0) {
              // Apply edits to the YJS document
              applyEditsToYDoc(roomId, edits);
            }
          } catch (err) {
            console.error('Error parsing or applying LLM edits:', err);
          }

          res.end();
          return;
        }

        const chunk = new TextDecoder().decode(value);
        fullResponse += chunk;
        res.write(chunk);
        pump();
      }).catch(err => {
        console.error("Error during stream pump:", err);
        if (!res.writableEnded) {
          res.status(500).end("Stream error");
        }
      });
    }

    pump();

  } catch (error: any) {
    console.error('Error in /llm-api/script/edit endpoint:', error);
    if (!res.headersSent) {
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      } else if (error.status && error.error) {
        return res.status(error.status).json(error.error);
      }
      return res.status(500).json({ error: "Failed to process script edit request", details: error.message });
    }

    if (!res.writableEnded) {
      console.error("Headers sent, but error occurred. Ending response.");
      res.end();
    }
  }
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
        }
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

app.put("/api/artifacts/:artifactId",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const { artifactId } = req.params;
    const { text, data } = req.body;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      // Get existing artifact first
      const existingArtifact = await artifactRepo.getArtifact(artifactId);
      if (!existingArtifact) {
        return res.status(404).json({ error: "Artifact not found" });
      }

      // Check if user has access to the project containing this artifact
      const hasAccess = await artifactRepo.userHasProjectAccess(user.id, existingArtifact.project_id);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied - user not member of project" });
      }

      let updatedData;

      if (existingArtifact.type === 'user_input') {
        // Validate required fields for user_input
        if (!text || typeof text !== 'string' || !text.trim()) {
          return res.status(400).json({
            error: "Missing or empty text",
            details: "text must be a non-empty string for user_input artifacts"
          });
        }

        // Update the artifact in place (for user_input artifacts)
        updatedData = {
          ...existingArtifact.data,
          text: text.trim()
        };
      } else if (existingArtifact.type === 'brainstorm_idea') {
        // Validate required fields for brainstorm_idea
        if (!data || typeof data !== 'object') {
          return res.status(400).json({
            error: "Missing or invalid data",
            details: "data must be an object for brainstorm_idea artifacts"
          });
        }

        // Update the artifact in place (for brainstorm_idea artifacts)
        updatedData = data;
      } else {
        return res.status(400).json({ error: `Cannot update artifacts of type: ${existingArtifact.type}` });
      }

      // Update the artifact directly in the database using Kysely
      await db
        .updateTable('artifacts')
        .set({
          data: JSON.stringify(updatedData),
          metadata: JSON.stringify(existingArtifact.metadata)
        })
        .where('id', '=', artifactId)
        .execute();

      // Return the updated artifact with the same ID
      const updatedArtifact = {
        ...existingArtifact,
        data: updatedData
      };

      res.json(updatedArtifact);

    } catch (error: any) {
      console.error('Error updating artifact:', error);
      res.status(500).json({
        error: "Failed to update artifact",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// ========== OUTLINE ENDPOINTS ==========

app.use('/api', createOutlineRoutes(authMiddleware, unifiedStreamingService, artifactRepo, transformRepo));

// Mount episode routes
import { createEpisodeRoutes } from './routes/episodes.js';
app.use('/api/episodes', createEpisodeRoutes(artifactRepo, transformRepo, authMiddleware));

// Mount script routes
app.use('/api/scripts', createScriptRoutes(artifactRepo, transformRepo, authMiddleware));

// Legacy streaming ideation routes removed as part of Electric Sync migration



// ========== REMOVED LEGACY SSE ENDPOINTS ==========
// Legacy SSE endpoints have been removed as part of Electric Sync migration.
// Use the new Electric-compatible /api/brainstorm endpoints instead.



// ========== SCRIPT ENDPOINTS (with validation) ==========

app.post("/api/scripts",
  authMiddleware.authenticate,
  validateScriptCreate,
  async (req: any, res: any) => {
    const { name = 'Untitled Script' } = req.body;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const script = await scriptService.createScript(user.id, name);
      res.json(script);

    } catch (error: any) {
      console.error('Error creating script:', error);
      res.status(500).json({
        error: "Failed to create script",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

app.get("/api/scripts/:id", authMiddleware.authenticate, async (req: any, res: any) => {
  const { id } = req.params;

  // Get authenticated user
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const script = await scriptService.getScript(user.id, id);

    if (!script) {
      return res.status(404).json({ error: "Script not found" });
    }

    res.json(script);

  } catch (error: any) {
    console.error('Error fetching script:', error);
    res.status(500).json({ error: "Failed to fetch script", details: error.message });
  }
});

app.get("/api/scripts", authMiddleware.authenticate, async (req: any, res: any) => {
  // Get authenticated user
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const scripts = await scriptService.listScripts(user.id);
    res.json(scripts);

  } catch (error: any) {
    console.error('Error fetching scripts:', error);
    res.status(500).json({ error: "Failed to fetch scripts", details: error.message });
  }
});

app.put("/api/scripts/:id",
  authMiddleware.authenticate,
  validateScriptUpdate,
  async (req: any, res: any) => {
    const { id } = req.params;
    const { name } = req.body;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const updated = await scriptService.updateScript(user.id, id, name);

      if (!updated) {
        return res.status(404).json({ error: "Script not found" });
      }

      res.json({ success: true, message: "Script updated successfully" });

    } catch (error: any) {
      console.error('Error updating script:', error);
      res.status(500).json({
        error: "Failed to update script",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

app.delete("/api/scripts/:id", authMiddleware.authenticate, async (req: any, res: any) => {
  const { id } = req.params;

  // Get authenticated user
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const deleted = await scriptService.deleteScript(user.id, id);

    if (!deleted) {
      return res.status(404).json({ error: "Script not found" });
    }

    res.json({ success: true, message: "Script deleted successfully" });

  } catch (error: any) {
    console.error('Error deleting script:', error);
    res.status(500).json({ error: "Failed to delete script", details: error.message });
  }
});

// ========== ENHANCED DEBUG/ADMIN ENDPOINTS ==========

// Replay a specific transform
app.post("/api/debug/replay/transform/:id", authMiddleware.authenticate, async (req: any, res: any) => {
  const { id } = req.params;
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const replayResult = await replayService.replayTransform(user.id, id);
    res.json(replayResult);

  } catch (error: any) {
    console.error('Error replaying transform:', error);
    res.status(500).json({
      error: "Failed to replay transform",
      details: error.message
    });
  }
});

// Replay an entire workflow
app.post("/api/debug/replay/workflow/:artifactId", authMiddleware.authenticate, async (req: any, res: any) => {
  const { artifactId } = req.params;
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const workflowResult = await replayService.replayWorkflow(user.id, artifactId);
    res.json(workflowResult);

  } catch (error: any) {
    console.error('Error replaying workflow:', error);
    res.status(500).json({
      error: "Failed to replay workflow",
      details: error.message
    });
  }
});

// Get transform execution statistics
app.get("/api/debug/stats/transforms", authMiddleware.authenticate, async (req: any, res: any) => {
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const stats = await replayService.getTransformStats(user.id);
    res.json(stats);

  } catch (error: any) {
    console.error('Error fetching transform stats:', error);
    res.status(500).json({
      error: "Failed to fetch transform stats",
      details: error.message
    });
  }
});

// Get streaming service status
app.get("/api/debug/streaming/status", authMiddleware.authenticate, async (req: any, res: any) => {
  try {
    res.json({
      status: 'active',
      message: 'Using database-backed streaming (no cache layer)',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching streaming status:', error);
    res.status(500).json({
      error: "Failed to fetch streaming status",
      details: error.message
    });
  }
});

// Advanced artifact search
app.get("/api/debug/search/artifacts", authMiddleware.authenticate, async (req: any, res: any) => {
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const {
      type,
      type_version,
      content_search,
      date_from,
      date_to,
      limit = 50
    } = req.query;

    let artifacts = await artifactRepo.getUserArtifacts(user.id);

    // Apply filters
    if (type) {
      artifacts = artifacts.filter(a => a.type === type);
    }

    if (type_version) {
      artifacts = artifacts.filter(a => a.type_version === type_version);
    }

    if (content_search) {
      const searchTerm = (content_search as string).toLowerCase();
      artifacts = artifacts.filter(a =>
        JSON.stringify(a.data).toLowerCase().includes(searchTerm)
      );
    }

    if (date_from) {
      const fromDate = new Date(date_from as string);
      artifacts = artifacts.filter(a => new Date(a.created_at) >= fromDate);
    }

    if (date_to) {
      const toDate = new Date(date_to as string);
      artifacts = artifacts.filter(a => new Date(a.created_at) <= toDate);
    }

    // Limit results
    artifacts = artifacts.slice(0, parseInt(limit as string));

    res.json({
      search_params: { type, type_version, content_search, date_from, date_to, limit },
      total_found: artifacts.length,
      artifacts: artifacts.map(artifact => ({
        ...artifact,
        data_preview: typeof artifact.data === 'object'
          ? JSON.stringify(artifact.data).substring(0, 200) + '...'
          : String(artifact.data).substring(0, 200) + '...'
      }))
    });

  } catch (error: any) {
    console.error('Error searching artifacts:', error);
    res.status(500).json({
      error: "Failed to search artifacts",
      details: error.message
    });
  }
});

// Database health check
app.get("/api/debug/health", authMiddleware.authenticate, async (req: any, res: any) => {
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    // Test database connectivity
    const artifacts = await artifactRepo.getUserArtifacts(user.id);
    const transforms = await transformRepo.getUserTransforms(user.id);

    // Basic health checks
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connectivity: 'ok',
        artifacts_accessible: artifacts.length >= 0,
        transforms_accessible: transforms.length >= 0
      },
      streaming: {
        status: 'ok',
        type: 'database-backed'
      },
      user: {
        id: user.id,
        username: user.username
      }
    };

    res.json(health);

  } catch (error: any) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Performance metrics
app.get("/api/debug/performance", authMiddleware.authenticate, async (req: any, res: any) => {
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const startTime = Date.now();

    // Test various operations
    const artifactFetchTime = Date.now();
    await artifactRepo.getUserArtifacts(user.id);
    const artifactTime = Date.now() - artifactFetchTime;

    const transformFetchTime = Date.now();
    await transformRepo.getUserTransforms(user.id);
    const transformTime = Date.now() - transformFetchTime;

    const streamingTestTime = Date.now();
    // Test streaming service (no operations needed - it's database-backed)
    const streamingTime = Date.now() - streamingTestTime;

    const totalTime = Date.now() - startTime;

    res.json({
      timestamp: new Date().toISOString(),
      total_response_time_ms: totalTime,
      breakdown: {
        artifact_fetch_ms: artifactTime,
        transform_fetch_ms: transformTime,
        streaming_test_ms: streamingTime
      },
      memory_usage: process.memoryUsage()
    });

  } catch (error: any) {
    console.error('Performance test failed:', error);
    res.status(500).json({
      error: "Failed to run performance test",
      details: error.message
    });
  }
});

// ========== JOB-BASED ENDPOINTS ==========

// Create brainstorming job
app.post("/api/projects/create-brainstorming-job",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const { platform, genrePaths, requirements } = req.body;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const jobParams: BrainstormingJobParamsV1 = {
        platform: platform || '通用短视频平台',
        genrePaths: genrePaths || [],
        requirements: requirements || '',
        requestedAt: new Date().toISOString()
      };

      // Legacy brainstorming endpoint removed - use /api/brainstorm/start instead
      return res.status(410).json({
        error: "This endpoint has been deprecated",
        message: "Use /api/brainstorm/start instead",
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Error in deprecated brainstorming endpoint:', error);
      res.status(500).json({
        error: "Endpoint deprecated",
        details: "Use /api/brainstorm/start instead",
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Legacy outline job endpoint - deprecated
app.post("/api/outlines/create-job",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    // Legacy outline endpoint removed as part of Electric Sync migration
    return res.status(410).json({
      error: "This endpoint has been deprecated",
      message: "Outline functionality will be migrated to Electric Sync in a future update",
      timestamp: new Date().toISOString()
    });
  }
);

// NEW: Streaming endpoint for outline generation (MIGRATED TO STREAMOBJECT)
app.post("/api/outline/generate/stream",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const { sourceArtifactId, totalEpisodes, episodeDuration, cascadedParams } = req.body;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate required fields
    if (!sourceArtifactId) {
      return res.status(400).json({
        error: "Missing sourceArtifactId",
        details: "sourceArtifactId is required"
      });
    }

    try {
      // StreamObjectService has been removed - return deprecated message
      return res.status(410).json({
        error: "This endpoint has been deprecated",
        message: "Streaming outline generation is no longer supported",
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Error in streaming outline generation:', error);
      if (!res.headersSent) {
        return res.status(500).json({
          error: "Failed to generate outline",
          details: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }
);

// NEW: Streaming endpoint for episode generation (MIGRATED TO STREAMOBJECT)
app.post("/api/episodes/generate/stream",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const { outlineSessionId, stageArtifactId, totalEpisodes, episodeDuration, customRequirements } = req.body;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate required fields
    if (!outlineSessionId || !stageArtifactId) {
      return res.status(400).json({
        error: "Missing required parameters",
        details: "outlineSessionId and stageArtifactId are required"
      });
    }

    try {
      // StreamObjectService has been removed - return deprecated message
      return res.status(410).json({
        error: "This endpoint has been deprecated",
        message: "Streaming episode generation is no longer supported",
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Error in streaming episode generation:', error);
      if (!res.headersSent) {
        return res.status(500).json({
          error: "Failed to generate episodes",
          details: error.message,
          timestamp: new Date().toISOString()
        });
      }
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
