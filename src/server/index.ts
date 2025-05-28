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
import { CacheService } from './services/CacheService';
import { db, initializeDatabase } from './database/connection';
import { StreamingTransformExecutor } from './services/StreamingTransformExecutor';

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

// Initialize cache service
const cacheService = new CacheService();

// Initialize services with caching
const transformExecutor = new TransformExecutor(artifactRepo, transformRepo);
const streamingTransformExecutor = new StreamingTransformExecutor(artifactRepo, transformRepo);
const ideationService = new IdeationService(artifactRepo, transformRepo, transformExecutor, cacheService);
const outlineService = new OutlineService(artifactRepo, transformExecutor, cacheService);
const scriptService = new ScriptService(artifactRepo, transformExecutor);
const replayService = new ReplayService(artifactRepo, transformRepo, transformExecutor);

// Database initialization is now handled by migrations and seeds

// Create the server with ViteExpress
const server = ViteExpress.listen(app, PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});

// Set up YJS WebSocket server
const yjs = setupYjsWebSocketServer(server, authDB);

// Mount authentication routes
app.use('/auth', createAuthRoutes(authDB, authMiddleware));

// Attach authDB to all requests
app.use(authMiddleware.attachAuthDB);

// Original message endpoint
app.get("/message", (_req, res) => {
  res.send("Hello from Express!");
});

// Original chat completions endpoint - Protected by authentication
app.post("/llm-api/chat/completions", authMiddleware.authenticate, async (req: any, res: any) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('Error: DEEPSEEK_API_KEY environment variable is not set.');
    return res.status(500).json({ error: "DEEPSEEK_API_KEY not configured" });
  }

  const { messages, model: modelName, stream = true, ...restOfBody } = req.body;

  if (!messages || !modelName) {
    return res.status(400).json({ error: "Missing 'messages' or 'model' in request body" });
  }

  const deepseekAI = createOpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.deepseek.com',
  });

  try {
    if (stream === false) {
      // Non-streaming response
      const { generateText } = await import('ai');
      const result = await generateText({
        model: deepseekAI(modelName),
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
        model: deepseekAI(modelName),
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
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('Error: DEEPSEEK_API_KEY environment variable is not set.');
    return res.status(500).json({ error: "DEEPSEEK_API_KEY not configured" });
  }

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

  const deepseekAI = createOpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.deepseek.com',
  });

  try {
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
      model: deepseekAI(modelName),
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

// ========== ARTIFACT ENDPOINTS ==========

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
    const { text, sourceArtifactId } = req.body;

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

app.post("/api/outlines/from-artifact/:artifactId",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const { artifactId } = req.params;
    const { totalEpisodes, episodeDuration } = req.body;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const result = await outlineService.generateOutlineFromArtifact(
        user.id,
        artifactId,
        totalEpisodes,
        episodeDuration
      );

      res.json(result);

    } catch (error: any) {
      console.error('Error generating outline:', error);

      if (error.message.includes('not found or access denied')) {
        return res.status(404).json({ error: "Source artifact not found" });
      }

      res.status(500).json({
        error: "Failed to generate outline",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

app.get("/api/outlines/:outlineId", authMiddleware.authenticate, async (req: any, res: any) => {
  const { outlineId } = req.params;

  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const outlineSession = await outlineService.getOutlineSession(user.id, outlineId);

    if (!outlineSession) {
      return res.status(404).json({ error: "Outline session not found" });
    }

    res.json(outlineSession);

  } catch (error: any) {
    console.error('Error fetching outline session:', error);
    res.status(500).json({
      error: "Failed to fetch outline session",
      details: error.message
    });
  }
});

app.get("/api/outlines", authMiddleware.authenticate, async (req: any, res: any) => {
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    const outlineSessions = await outlineService.listOutlineSessions(user.id);
    res.json(outlineSessions);

  } catch (error: any) {
    console.error('Error fetching outline sessions:', error);
    res.status(500).json({
      error: "Failed to fetch outline sessions",
      details: error.message
    });
  }
});

app.delete("/api/outlines/:outlineId", authMiddleware.authenticate, async (req: any, res: any) => {
  const { outlineId } = req.params;

  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    // For now, we'll implement a simple deletion by removing the outline session
    // In a production system, we might want to mark as deleted rather than actually delete
    const sessionArtifacts = await artifactRepo.getArtifactsByTypeForSession(
      user.id,
      'outline_session',
      outlineId
    );

    if (sessionArtifacts.length === 0) {
      return res.status(404).json({ error: "Outline session not found" });
    }

    // Delete the latest session artifact
    const latestSession = sessionArtifacts[0];
    const deleted = await artifactRepo.deleteArtifact(latestSession.id, user.id);

    if (!deleted) {
      return res.status(404).json({ error: "Outline session not found" });
    }

    res.json({ success: true, message: "Outline session deleted successfully" });

  } catch (error: any) {
    console.error('Error deleting outline session:', error);
    res.status(500).json({
      error: "Failed to delete outline session",
      details: error.message
    });
  }
});

// ========== UPDATED SCRIPT ENDPOINTS (with validation) ==========

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
app.post("/debug/replay/transform/:id", authMiddleware.authenticate, async (req: any, res: any) => {
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
app.post("/debug/replay/workflow/:artifactId", authMiddleware.authenticate, async (req: any, res: any) => {
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
app.get("/debug/stats/transforms", authMiddleware.authenticate, async (req: any, res: any) => {
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

// Get cache statistics
app.get("/debug/cache/stats", authMiddleware.authenticate, async (req: any, res: any) => {
  try {
    const stats = cacheService.getStats();
    res.json(stats);

  } catch (error: any) {
    console.error('Error fetching cache stats:', error);
    res.status(500).json({
      error: "Failed to fetch cache stats",
      details: error.message
    });
  }
});

// Clear cache
app.post("/debug/cache/clear", authMiddleware.authenticate, async (req: any, res: any) => {
  try {
    cacheService.clear();
    res.json({ success: true, message: "Cache cleared successfully" });

  } catch (error: any) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      error: "Failed to clear cache",
      details: error.message
    });
  }
});

// Advanced artifact search
app.get("/debug/search/artifacts", authMiddleware.authenticate, async (req: any, res: any) => {
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
app.get("/debug/health", authMiddleware.authenticate, async (req: any, res: any) => {
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    // Test database connectivity
    const artifacts = await artifactRepo.getUserArtifacts(user.id, 1);
    const transforms = await transformRepo.getUserTransforms(user.id, 1);

    // Check cache health
    const cacheStats = cacheService.getStats();

    // Basic health checks
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connectivity: 'ok',
        artifacts_accessible: artifacts.length >= 0,
        transforms_accessible: transforms.length >= 0
      },
      cache: {
        status: 'ok',
        ...cacheStats
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
app.get("/debug/performance", authMiddleware.authenticate, async (req: any, res: any) => {
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

    const cacheTestTime = Date.now();
    cacheService.set('test_key', { test: 'data' });
    cacheService.get('test_key');
    cacheService.delete('test_key');
    const cacheTime = Date.now() - cacheTestTime;

    const totalTime = Date.now() - startTime;

    res.json({
      timestamp: new Date().toISOString(),
      total_response_time_ms: totalTime,
      breakdown: {
        artifact_fetch_ms: artifactTime,
        transform_fetch_ms: transformTime,
        cache_operations_ms: cacheTime
      },
      cache_stats: cacheService.getStats(),
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

// ========== STREAMING ENDPOINTS ==========

// Streaming brainstorm idea generation
app.post("/api/streaming/brainstorm",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const {
      selectedPlatform,
      genrePaths,
      genreProportions,
      requirements,
      ideationTemplate
    } = req.body;

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    try {
      // Create brainstorm parameters artifact
      const paramsArtifact = await artifactRepo.createArtifact(
        user.id,
        'brainstorm_params',
        {
          platform: selectedPlatform,
          genre_paths: genrePaths,
          genre_proportions: genreProportions,
          requirements
        }
      );

      // Build genre string for prompt
      const buildGenrePromptString = (): string => {
        if (!genrePaths || genrePaths.length === 0) return '未指定';
        return genrePaths.map((path: string[], index: number) => {
          const proportion = genreProportions && genreProportions[index] !== undefined
            ? genreProportions[index]
            : (100 / genrePaths.length);
          const pathString = path.join(' > ');
          return genrePaths.length > 1
            ? `${pathString} (${proportion.toFixed(0)}%)`
            : pathString;
        }).join(', ');
      };

      const genreString = buildGenrePromptString();
      const requirementsSection = requirements.trim()
        ? `特殊要求：${requirements.trim()}`
        : '';

      const prompt = ideationTemplate
        .replace('{genre}', genreString)
        .replace('{platform}', selectedPlatform || '通用短视频平台')
        .replace('{requirementsSection}', requirementsSection);

      // Execute streaming transform
      const result = await streamingTransformExecutor.executeStreamingLLMTransform(
        user.id,
        [paramsArtifact],
        prompt,
        {
          genre: genreString,
          platform: selectedPlatform || '通用短视频平台',
          requirements: requirements || ''
        },
        'brainstorm_idea',
        (update) => {
          // Send update to client via SSE
          res.write(`data: ${JSON.stringify(update)}\n\n`);
        }
      );

      // Send final result
      res.write(`data: ${JSON.stringify({
        type: 'final_result',
        transformId: result.transformId,
        artifactIds: result.outputArtifacts.map(a => a.id)
      })}\n\n`);

      res.end();

    } catch (error: any) {
      console.error('Error in streaming brainstorm:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message || 'Unknown error occurred'
      })}\n\n`);
      res.end();
    }
  }
);

// Streaming outline generation
app.post("/api/streaming/outlines/from-artifact/:artifactId",
  authMiddleware.authenticate,
  async (req: any, res: any) => {
    const { artifactId } = req.params;
    const { totalEpisodes, episodeDuration } = req.body;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    try {
      // Get and validate source artifact
      const sourceArtifact = await artifactRepo.getArtifact(artifactId, user.id);
      if (!sourceArtifact) {
        throw new Error('Source artifact not found or access denied');
      }

      if (!['brainstorm_idea', 'user_input'].includes(sourceArtifact.type)) {
        throw new Error('Invalid source artifact type. Must be brainstorm_idea or user_input');
      }

      // Extract user input text from artifact
      const userInput = sourceArtifact.data.text || sourceArtifact.data.idea_text;
      if (!userInput || !userInput.trim()) {
        throw new Error('Source artifact contains no text content');
      }

      // Create outline session
      const outlineSessionId = uuidv4();
      const outlineSessionArtifact = await artifactRepo.createArtifact(
        user.id,
        'outline_session',
        {
          id: outlineSessionId,
          ideation_session_id: 'artifact-based',
          status: 'active',
          created_at: new Date().toISOString()
        }
      );

      // Build outline prompt
      const episodeInfo = (totalEpisodes && episodeDuration)
        ? `\n\n剧集信息：\n- 总集数：${totalEpisodes}集\n- 每集时长：约${episodeDuration}分钟`
        : '';

      const outlinePrompt = `你是一位深耕短剧创作的资深编剧，尤其擅长创作引人入胜、节奏明快、反转强烈的爆款短剧。
根据用户提供的故事灵感，请创作一个**单集完结**的短剧大纲。${episodeInfo}

故事灵感：${userInput}

请严格按照以下要求和JSON格式输出：

1.  **剧名 (title)**: 一个极具吸引力、能瞬间抓住眼球的短剧标题，精准概括核心看点。
2.  **题材类型 (genre)**: 明确的短剧类型（例如：都市爽文、逆袭复仇、甜宠虐恋、战神归来、古装宫斗等常见短剧热门题材）。
3.  **核心看点/爽点 (selling_points)**: 列出3-5个最能激发观众情绪、构成"爽点"的核心情节或元素。例如：身份反转、打脸虐渣、绝境逢生、意外获得超能力、关键时刻英雄救美/美救英雄等。
4.  **故事设定 (setting)**:
    *   **一句话核心设定**: 用一句话概括故事发生的核心背景和主要人物关系。
    *   **关键场景**: 2-3个推动剧情发展的核心场景。
5.  **主要人物 (main_characters)**: **一个包含主要人物的数组**，每个人物对象包含以下字段：
    *   **name**: [string] 人物姓名
    *   **description**: [string] 人物的一句话性格特征及核心目标/困境
6.  **完整故事梗概 (synopsis)**: **一个详细且连贯的故事梗概**，描述主要情节、关键事件、核心冲突的发展，以及故事的最终结局。请用自然流畅的段落撰写，体现故事的吸引力。

**短剧创作核心要求 (非常重要！):**
-   **节奏极快**: 剧情推进迅速，不拖沓，每一分钟都要有信息量或情绪点。
-   **冲突强烈**: 核心矛盾要直接、尖锐，能迅速抓住观众。
-   **反转惊人**: 设计至少1-2个出人意料的情节反转。
-   **情绪到位**: 准确拿捏观众的情绪，如愤怒、喜悦、紧张、同情等，并快速给予满足（如"打脸"情节）。
-   **人物鲜明**: 主角和核心对手的人物性格和动机要清晰、极致。
-   **结局爽快**: 结局要干脆利落，给观众明确的情感释放。
-   **紧扣灵感**: 所有设计必须围绕原始故事灵感展开，并将其特点放大。
-   **避免"电影感"**: 不要追求复杂的叙事结构、过多的角色内心戏或宏大的世界观。专注于简单直接、冲击力强的单集故事。

请以JSON格式返回，字段如下：
{
  "title": "[string] 剧名",
  "genre": "[string] 题材类型",
  "selling_points": ["[string] 核心看点1", "[string] 核心看点2", "[string] 核心看点3"],
  "setting": {
    "core_setting_summary": "[string] 一句话核心设定",
    "key_scenes": ["[string] 关键场景1", "[string] 关键场景2"]
  },
  "main_characters": [
    { "name": "[string] 人物1姓名", "description": "[string] 人物1描述..." },
    { "name": "[string] 人物2姓名", "description": "[string] 人物2描述..." }
  ],
  "synopsis": "[string] 详细的、包含主要情节/关键事件/核心冲突发展和结局的故事梗概。"
}`;

      // Execute streaming transform
      const result = await streamingTransformExecutor.executeStreamingLLMTransform(
        user.id,
        [outlineSessionArtifact, sourceArtifact],
        outlinePrompt,
        {
          user_input: userInput,
          source_artifact_id: artifactId
        },
        'outline_components',
        (update) => {
          // Send update to client via SSE
          res.write(`data: ${JSON.stringify(update)}\n\n`);
        }
      );

      // Update outline session status to completed
      await artifactRepo.createArtifact(
        user.id,
        'outline_session',
        {
          id: outlineSessionId,
          ideation_session_id: 'artifact-based',
          status: 'completed',
          created_at: new Date().toISOString()
        }
      );

      // Send final result
      res.write(`data: ${JSON.stringify({
        type: 'final_result',
        transformId: result.transformId,
        outlineSessionId,
        artifactIds: result.outputArtifacts.map(a => a.id)
      })}\n\n`);

      res.end();

    } catch (error: any) {
      console.error('Error in streaming outline generation:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message || 'Unknown error occurred'
      })}\n\n`);
      res.end();
    }
  }
);

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
