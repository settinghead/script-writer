import express from "express";
import ViteExpress from "vite-express";
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import cookieParser from 'cookie-parser';
import { setupYjsWebSocketServer, applyEditsToYDoc } from './yjs-server';
import { parseLLMResponse } from './llm-to-yjs';
import { AuthDatabase } from './database/auth';
import { createAuthMiddleware } from './middleware/auth';
import { createAuthRoutes } from './routes/auth';
import { ArtifactRepository } from './repositories/ArtifactRepository';
import { TransformRepository } from './repositories/TransformRepository';
import { TransformExecutor } from './services/TransformExecutor';
import { IdeationService } from './services/IdeationService';
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
import { db, initializeDatabase } from './database/connection';
// New streaming framework imports
import { TemplateService } from './services/templates/TemplateService';
import { StreamingTransformExecutor } from './services/streaming/StreamingTransformExecutor';
import { createIdeationRoutes } from './routes/ideations';
import { BrainstormingJobParamsV1, OutlineJobParamsV1 } from './types/artifacts';
import { OutlineGenerateRequest, OutlineGenerateResponse } from '../common/streaming/types';
// Import and mount outline routes
import { createOutlineRoutes } from './routes/outlineRoutes';
// Import LLM configuration
import { getLLMCredentials } from './services/LLMConfig';

dotenv.config();

const PORT = parseInt(process.env.PORT || "4600");
const app = express();

app.use(express.json()); // Middleware to parse JSON bodies
app.use(cookieParser()); // Middleware to parse cookies

// Initialize database with Knex
initializeDatabase().catch(console.error);

// Initialize authentication system
const authDB = new AuthDatabase(db);
const authMiddleware = createAuthMiddleware(authDB);

// Initialize repositories
const artifactRepo = new ArtifactRepository(db);
const transformRepo = new TransformRepository(db);

// Initialize unified streaming service
const unifiedStreamingService = new UnifiedStreamingService(artifactRepo, transformRepo);

// Initialize services with unified streaming
const transformExecutor = new TransformExecutor(artifactRepo, transformRepo);
const ideationService = new IdeationService(artifactRepo, transformRepo, transformExecutor, unifiedStreamingService);
const outlineService = new OutlineService(artifactRepo, transformRepo, unifiedStreamingService);
const scriptService = new ScriptService(artifactRepo, transformExecutor);
const replayService = new ReplayService(artifactRepo, transformRepo, transformExecutor);

// Initialize new streaming framework services
const templateService = new TemplateService();
const streamingTransformExecutor = new StreamingTransformExecutor(
  artifactRepo,
  transformRepo,
  templateService,
  ideationService  // Add ideation service for job creation
);

// Make services available to routes via app.locals
app.locals.streamingExecutor = streamingTransformExecutor;
app.locals.transformRepo = transformRepo;
const server = app.listen(PORT, "0.0.0.0", () =>
  console.log("Server is listening...")
);

ViteExpress.bind(app, server);

// Set up YJS WebSocket server
const yjs = setupYjsWebSocketServer(server, authDB);

// Mount authentication routes
app.use('/auth', createAuthRoutes(authDB, authMiddleware));

// Mount ideation routes
app.use('/api/ideations', createIdeationRoutes(authMiddleware, artifactRepo, transformRepo, streamingTransformExecutor));

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

// ========== UPDATED IDEATION ENDPOINTS (with validation) ==========

app.post("/api/ideations/create_run_with_ideas",
  authMiddleware.authenticate,
  validateIdeationCreate,
  async (req: any, res: any) => {
    const {
      selectedPlatform,
      genrePaths,
      genreProportions,
      initialIdeas,
      initialIdeaTitles,
      requirements
    } = req.body;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const result = await ideationService.createRunWithIdeas(
        user.id,
        selectedPlatform || '',
        genrePaths || [],
        genreProportions || [],
        initialIdeas,
        initialIdeaTitles || [],
        requirements || ''
      );

      res.json(result);

    } catch (error: any) {
      console.error('Error in create_run_with_ideas:', error);
      res.status(500).json({
        error: "Failed to create ideation run",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

app.post("/api/ideations/create_run_and_generate_plot",
  authMiddleware.authenticate,
  validatePlotGeneration,
  async (req: any, res: any) => {
    const {
      userInput,
      selectedPlatform,
      genrePaths,
      genreProportions,
      initialIdeas,
      ideationTemplate,
      requirements
    } = req.body;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const result = await ideationService.createRunAndGeneratePlot(
        user.id,
        userInput,
        selectedPlatform || '',
        genrePaths || [],
        genreProportions || [],
        initialIdeas || [],
        requirements || '',
        ideationTemplate
      );

      res.json(result);

    } catch (error: any) {
      console.error('Error in create_run_and_generate_plot:', error);
      res.status(500).json({
        error: "Failed to create ideation run",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

app.get("/api/ideations/:id", authMiddleware.authenticate, async (req: any, res: any) => {
  const { id } = req.params;

  // Get authenticated user
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const ideationRun = await ideationService.getIdeationRun(user.id, id);

    if (!ideationRun) {
      return res.status(404).json({ error: "Ideation run not found" });
    }

    res.json(ideationRun);

  } catch (error: any) {
    console.error('Error fetching ideation run:', error);
    res.status(500).json({ error: "Failed to fetch ideation run", details: error.message });
  }
});

app.get("/api/ideations", authMiddleware.authenticate, async (req: any, res: any) => {
  // Get authenticated user
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const ideationRuns = await ideationService.listIdeationRuns(user.id);
    res.json(ideationRuns);

  } catch (error: any) {
    console.error('Error fetching ideation runs:', error);
    res.status(500).json({ error: "Failed to fetch ideation runs", details: error.message });
  }
});

app.delete("/api/ideations/:id", authMiddleware.authenticate, async (req: any, res: any) => {
  const { id } = req.params;

  // Get authenticated user
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const deleted = await ideationService.deleteIdeationRun(user.id, id);

    if (!deleted) {
      return res.status(404).json({ error: "Ideation run not found" });
    }

    res.json({ success: true, message: "Ideation deleted successfully" });

  } catch (error: any) {
    console.error('Error deleting ideation:', error);
    res.status(500).json({ error: "Failed to delete ideation", details: error.message });
  }
});

app.post("/api/ideations/:id/generate_plot",
  authMiddleware.authenticate,
  validatePlotGeneration,
  async (req: any, res: any) => {
    const { id: runId } = req.params;
    const { userInput, ideationTemplate } = req.body;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const result = await ideationService.generatePlotForRun(
        user.id,
        runId,
        userInput,
        ideationTemplate
      );

      res.json(result);

    } catch (error: any) {
      console.error('Error in generate_plot:', error);

      // Handle specific error types
      if (error.message.includes('not found or not accessible')) {
        return res.status(404).json({ error: "Ideation run not found" });
      }
      if (error.message.includes('cannot be empty')) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({
        error: "Failed to generate plot",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

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
      // Verify transform ownership
      const transform = await transformRepo.getTransform(transformId, user.id);
      if (!transform) {
        return res.status(404).json({ error: "Transform not found or access denied" });
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
    const artifact = await artifactRepo.getArtifact(currentArtifactId, userId);
    if (artifact) {
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
            genre_proportions: artifact.data.genreProportions,
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

app.get("/api/artifacts/:artifactId",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const { artifactId } = req.params;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const artifact = await artifactRepo.getArtifact(artifactId, user.id);

      if (!artifact) {
        return res.status(404).json({ error: "Artifact not found" });
      }

      res.json(artifact);

    } catch (error: any) {
      console.error('Error fetching artifact:', error);
      res.status(500).json({
        error: "Failed to fetch artifact",
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
    const { text } = req.body;

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
      // Get existing artifact to validate ownership and type
      const existingArtifact = await artifactRepo.getArtifact(artifactId, user.id);
      if (!existingArtifact) {
        return res.status(404).json({ error: "Artifact not found" });
      }

      if (existingArtifact.type !== 'user_input') {
        return res.status(400).json({ error: "Can only update user_input artifacts" });
      }

      // Update the artifact in place (for user_input artifacts only)
      const updatedData = {
        ...existingArtifact.data,
        text: text.trim()
      };

      // Update the artifact directly in the database
      await db('artifacts')
        .where('id', artifactId)
        .where('user_id', user.id)
        .update({
          data: JSON.stringify(updatedData),
          metadata: JSON.stringify(existingArtifact.metadata)
        });

      // Return the updated artifact with the same ID
      const updatedArtifact = {
        ...existingArtifact,
        data: updatedData
      };

      res.json(updatedArtifact);

    } catch (error: any) {
      console.error('Error updating user input artifact:', error);
      res.status(500).json({
        error: "Failed to update user input artifact",
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
import { createScriptRoutes } from './routes/scriptRoutes.js';
app.use('/api/scripts', createScriptRoutes(artifactRepo, transformRepo, authMiddleware));

// ========== STREAMING ENDPOINTS ==========

// Streaming endpoint for plot generation
app.post("/api/ideations/:id/generate_plot/stream",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const { id: runId } = req.params;
    const { userInput, ideationTemplate } = req.body;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const streamResponse = await ideationService.generatePlotForRunStream(
        user.id,
        runId,
        userInput,
        ideationTemplate
      );

      // Return the streaming response directly
      return streamResponse;

    } catch (error: any) {
      console.error('Error in streaming plot generation:', error);

      // Handle specific error types
      if (error.message.includes('not found or not accessible')) {
        return res.status(404).json({ error: "Ideation run not found" });
      }
      if (error.message.includes('cannot be empty')) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(500).json({
        error: "Failed to generate plot",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Streaming endpoint for brainstorming/idea generation
app.post("/api/brainstorm/generate/stream",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const {
      selectedPlatform,
      selectedGenrePaths,
      genreProportions,
      requirements,
      prompt
    } = req.body;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const { apiKey, baseUrl, modelName } = getLLMCredentials();

      const llmAI = createOpenAI({
        apiKey,
        baseURL: baseUrl,
      });

      const result = await streamText({
        model: llmAI(modelName),
        messages: [{ role: 'user', content: prompt }]
      });

      // Set up streaming response
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
          console.error("Error during brainstorm stream pump:", err);
          if (!res.writableEnded) {
            res.status(500).end("Stream error");
          }
        });
      }
      pump();

    } catch (error: any) {
      console.error('Error in streaming brainstorm generation:', error);
      if (!res.headersSent) {
        return res.status(500).json({
          error: "Failed to generate ideas",
          details: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }
);

// New generic streaming LLM endpoint using the RxJS framework
app.post("/api/streaming/llm",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      await streamingTransformExecutor.executeStreamingTransform(
        user.id,
        req.body,
        res
      );
    } catch (error: any) {
      console.error('Error in generic streaming LLM endpoint:', error);
      if (!res.headersSent) {
        return res.status(500).json({
          error: "Failed to execute streaming transform",
          details: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }
);

// Transform-based streaming endpoint (for resumable jobs)
app.get("/api/streaming/transform/:transformId", authMiddleware.authenticate, async (req: any, res: any) => {
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    console.log(`[SSE Endpoint] User not authenticated for transform request`);
    return res.status(401).json({ error: "User not authenticated" });
  }

  const { transformId } = req.params;

  try {
    // Import services
    const { JobBroadcaster } = await import('./services/streaming/JobBroadcaster');
    const broadcaster = JobBroadcaster.getInstance();

    // Verify ownership
    const transform = await transformRepo.getTransform(transformId, user.id);

    if (!transform) {
      return res.status(403).json({ error: 'Transform not found or unauthorized' });
    }

    // If job is already completed, send database chunks in SSE format
    if (transform.status === 'completed') {
      // Setup SSE connection even for completed jobs
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial status
      res.write(`data: ${JSON.stringify({ status: 'connected', transformId })}\n\n`);

      // Send completed data from database
      const chunks = await transformRepo.getTransformChunks(transformId);
      if (chunks.length > 0) {
        // Send all chunks with proper SSE formatting
        for (const chunk of chunks) {
          res.write(`data: ${chunk}\n\n`);
        }
      }

      // Send completion events
      res.write(`data: e:${JSON.stringify({ finishReason: 'stop' })}\n\n`);
      res.write(`data: d:${JSON.stringify({ finishReason: 'stop' })}\n\n`);
      res.end();
      return;
    }

    // If job is running, connect to stream
    if (transform.status === 'running') {
      // Setup SSE connection
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Register this client with the broadcaster
      broadcaster.addClient(transformId, user.id, res);

      // Send initial status
      res.write(`data: ${JSON.stringify({ status: 'connected', transformId })}\n\n`);

      // Send any existing chunks from database
      const chunks = await transformRepo.getTransformChunks(transformId);
      if (chunks.length > 0) {
        // Send all existing chunks with proper SSE formatting
        for (const chunk of chunks) {
          res.write(`data: ${chunk}\n\n`);
        }
      }

      console.log(`[Streaming] Client connected to transform ${transformId}, streaming job should be running or will start shortly`);

    } else {
      // Job failed or cancelled - send error in SSE format
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      res.write(`data: ${JSON.stringify({ status: 'connected', transformId })}\n\n`);
      res.write(`data: error:${JSON.stringify({ error: `Job not active, status: ${transform.status}` })}\n\n`);
      res.end();
    }
  } catch (error: any) {
    console.error('Error in transform streaming endpoint:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Failed to connect to transform stream",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
});

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
    const artifacts = await artifactRepo.getUserArtifacts(user.id, 1);
    const transforms = await transformRepo.getUserTransforms(user.id, 1);

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
    await artifactRepo.getUserArtifacts(user.id, 10);
    const artifactTime = Date.now() - artifactFetchTime;

    const transformFetchTime = Date.now();
    await transformRepo.getUserTransforms(user.id, 10);
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
app.post("/api/ideations/create-brainstorming-job",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const { platform, genrePaths, genreProportions, requirements } = req.body;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const jobParams: BrainstormingJobParamsV1 = {
        platform: platform || '通用短视频平台',
        genrePaths: genrePaths || [],
        genreProportions: genreProportions || [],
        requirements: requirements || '',
        requestedAt: new Date().toISOString()
      };

      const result = await streamingTransformExecutor.startBrainstormingJob(
        user.id,
        jobParams
      );

      res.json(result);

    } catch (error: any) {
      console.error('Error creating brainstorming job:', error);
      res.status(500).json({
        error: "Failed to create brainstorming job",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Create outline job
app.post("/api/outlines/create-job",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const { sourceArtifactId, totalEpisodes, episodeDuration }: OutlineGenerateRequest = req.body;

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
      const jobParams: OutlineJobParamsV1 = {
        sourceArtifactId,
        totalEpisodes: totalEpisodes || undefined,
        episodeDuration: episodeDuration || undefined,
        requestedAt: new Date().toISOString()
      };

      const result = await streamingTransformExecutor.startOutlineJob(
        user.id,
        jobParams
      );

      // Return response that matches the common interface
      const response: OutlineGenerateResponse = {
        sessionId: result.outlineSessionId,  // Map outlineSessionId to sessionId
        transformId: result.transformId
      };

      res.json(response);

    } catch (error: any) {
      console.error('Error creating outline job:', error);

      if (error.message.includes('not found or access denied')) {
        return res.status(404).json({ error: "Source artifact not found" });
      }

      res.status(500).json({
        error: "Failed to create outline job",
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

// Check for active ideation job
app.get("/api/ideations/:id/active-job",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const ideationRunId = req.params.id;

    try {
      // Find the most recent running transform for this ideation run
      const transforms = await transformRepo.getUserTransforms(user.id);
      const activeTransform = transforms.find(t =>
        t.execution_context?.ideation_run_id === ideationRunId &&
        t.status === 'running'
      );

      if (activeTransform) {
        res.json({
          transformId: activeTransform.id,
          status: activeTransform.status,
          retryCount: activeTransform.retry_count || 0
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
  }
);
