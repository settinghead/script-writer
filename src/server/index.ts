import express from "express";
import ViteExpress from "vite-express";
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import * as dotenv from 'dotenv';
import * as sqlite3 from 'sqlite3';
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

dotenv.config();

const PORT = parseInt(process.env.PORT || "4600");
const app = express();

app.use(express.json()); // Middleware to parse JSON bodies
app.use(cookieParser()); // Middleware to parse cookies

// Initialize SQLite database
const db = new sqlite3.Database('./ideations.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

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
const ideationService = new IdeationService(artifactRepo, transformRepo, transformExecutor, cacheService);
const outlineService = new OutlineService(artifactRepo, transformExecutor, cacheService);
const scriptService = new ScriptService(artifactRepo, transformExecutor);
const replayService = new ReplayService(artifactRepo, transformRepo, transformExecutor);

// Create tables if they don't exist
const initializeDatabase = async () => {
  db.serialize(() => {
    // ========== ARTIFACTS/TRANSFORMS TABLES ==========

    // Immutable artifacts (all data entities)
    db.run(`
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        type_version TEXT NOT NULL DEFAULT 'v1',
        data TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Operations that transform artifacts
    db.run(`
      CREATE TABLE IF NOT EXISTS transforms (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        type_version TEXT NOT NULL DEFAULT 'v1',
        status TEXT DEFAULT 'completed',
        execution_context TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Many-to-many: transform inputs
    db.run(`
      CREATE TABLE IF NOT EXISTS transform_inputs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transform_id TEXT NOT NULL,
        artifact_id TEXT NOT NULL,
        input_role TEXT,
        FOREIGN KEY (transform_id) REFERENCES transforms (id) ON DELETE CASCADE,
        FOREIGN KEY (artifact_id) REFERENCES artifacts (id),
        UNIQUE(transform_id, artifact_id, input_role)
      )
    `);

    // Many-to-many: transform outputs
    db.run(`
      CREATE TABLE IF NOT EXISTS transform_outputs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transform_id TEXT NOT NULL,
        artifact_id TEXT NOT NULL,
        output_role TEXT,
        FOREIGN KEY (transform_id) REFERENCES transforms (id) ON DELETE CASCADE,
        FOREIGN KEY (artifact_id) REFERENCES artifacts (id),
        UNIQUE(transform_id, artifact_id, output_role)
      )
    `);

    // LLM prompts (separate due to size)
    db.run(`
      CREATE TABLE IF NOT EXISTS llm_prompts (
        id TEXT PRIMARY KEY,
        transform_id TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        prompt_role TEXT DEFAULT 'primary',
        FOREIGN KEY (transform_id) REFERENCES transforms (id) ON DELETE CASCADE
      )
    `);

    // LLM-specific transform metadata
    db.run(`
      CREATE TABLE IF NOT EXISTS llm_transforms (
        transform_id TEXT PRIMARY KEY,
        model_name TEXT NOT NULL,
        model_parameters TEXT,
        raw_response TEXT,
        token_usage TEXT,
        FOREIGN KEY (transform_id) REFERENCES transforms (id) ON DELETE CASCADE
      )
    `);

    // Human-specific transform metadata
    db.run(`
      CREATE TABLE IF NOT EXISTS human_transforms (
        transform_id TEXT PRIMARY KEY,
        action_type TEXT NOT NULL,
        interface_context TEXT,
        change_description TEXT,
        FOREIGN KEY (transform_id) REFERENCES transforms (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_artifacts_user_type ON artifacts (user_id, type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_artifacts_user_created ON artifacts (user_id, created_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_transforms_user_created ON transforms (user_id, created_at)`);
  });

  // Initialize authentication tables and test users
  try {
    await authDB.initializeAuthTables();
    await authDB.createTestUsers();
    console.log('Authentication system initialized');
    console.log('Artifacts/Transforms database schema initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

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
      requirements
    } = req.body;

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const runId = await ideationService.createRunWithIdeas(
        user.id,
        selectedPlatform || '',
        genrePaths || [],
        genreProportions || [],
        initialIdeas,
        requirements || ''
      );

      res.json({ runId });

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

      // Update the artifact
      const updatedData = {
        ...existingArtifact.data,
        text: text.trim()
      };

      const updatedArtifact = await artifactRepo.createArtifact(
        user.id,
        'user_input',
        updatedData
      );

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

    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const result = await outlineService.generateOutlineFromArtifact(
        user.id,
        artifactId
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
