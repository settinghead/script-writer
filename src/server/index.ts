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

// Migration function to add user_id to existing tables
const migrateIdeationTables = async () => {
  return new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      // Check if user_id column exists in ideation_runs
      db.get("PRAGMA table_info(ideation_runs)", (err, result) => {
        if (err) {
          console.error('Error checking table schema:', err);
          reject(err);
          return;
        }

        // Get all columns
        db.all("PRAGMA table_info(ideation_runs)", (err, columns: any[]) => {
          if (err) {
            console.error('Error getting table info:', err);
            reject(err);
            return;
          }

          const hasUserId = columns.some(col => col.name === 'user_id');

          if (!hasUserId) {
            console.log('Migrating ideation_runs table to add user_id...');

            // Add user_id column with default value (assign to first test user)
            db.run("ALTER TABLE ideation_runs ADD COLUMN user_id TEXT DEFAULT 'test-user-xiyang'", (err) => {
              if (err) {
                console.error('Error adding user_id column:', err);
                reject(err);
                return;
              }

              // Update the column to be NOT NULL and add foreign key constraint
              // Note: SQLite doesn't support modifying constraints, so we accept the default for existing data
              console.log('Migration completed: Added user_id to ideation_runs');
              resolve();
            });
          } else {
            console.log('ideation_runs table already has user_id column');
            resolve();
          }
        });
      });
    });
  });
};

// Create tables if they don't exist
const initializeDatabase = async () => {
  db.serialize(() => {
    // Create ideation_runs table
    db.run(`
      CREATE TABLE IF NOT EXISTS ideation_runs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_input TEXT,
        selected_platform TEXT,
        genre_prompt_string TEXT,
        genre_paths_json TEXT,
        genre_proportions_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        media_type TEXT,
        platform_recommendation TEXT,
        plot_outline TEXT,
        analysis TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Create generated_initial_ideas table
    db.run(`
      CREATE TABLE IF NOT EXISTS generated_initial_ideas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT,
        idea_text TEXT,
        FOREIGN KEY (run_id) REFERENCES ideation_runs (id)
      )
    `);

    // Create scripts table
    db.run(`
      CREATE TABLE IF NOT EXISTS scripts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        room_id TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);
  });

  // Initialize authentication tables and test users
  try {
    await authDB.initializeAuthTables();
    await authDB.createTestUsers();
    console.log('Authentication system initialized');

    // Migrate existing ideation data to include user associations
    await migrateIdeationTables();
  } catch (error) {
    console.error('Error initializing authentication system:', error);
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

// Ideation management endpoints
app.post("/api/ideations/create_run_with_ideas", authMiddleware.authenticate, async (req: any, res: any) => {
  const {
    selectedPlatform,
    genrePaths,
    genreProportions,
    initialIdeas
  } = req.body;

  if (!initialIdeas || !Array.isArray(initialIdeas) || initialIdeas.length === 0) {
    return res.status(400).json({ error: "Missing or empty 'initialIdeas' in request body" });
  }

  const runId = uuidv4();
  const genrePathsJson = JSON.stringify(genrePaths || []);
  const genreProportionsJson = JSON.stringify(genreProportions || []);

  // Build genre string for the prompt
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

  const genrePromptString = buildGenrePromptString();

  // Get authenticated user
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    // Insert initial run data
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO ideation_runs (id, user_id, user_input, selected_platform, genre_prompt_string, genre_paths_json, genre_proportions_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [runId, user.id, '', selectedPlatform || '', genrePromptString, genrePathsJson, genreProportionsJson],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Insert initial ideas
    for (const idea of initialIdeas) {
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO generated_initial_ideas (run_id, idea_text) VALUES (?, ?)`,
          [runId, idea],
          function (err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Return the run ID
    res.json({ runId });

  } catch (error: any) {
    console.error('Error in create_run_with_ideas:', error);
    res.status(500).json({ error: "Failed to create ideation run", details: error.message });
  }
});

app.post("/api/ideations/create_run_and_generate_plot", authMiddleware.authenticate, async (req: any, res: any) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('Error: DEEPSEEK_API_KEY environment variable is not set.');
    return res.status(500).json({ error: "DEEPSEEK_API_KEY not configured" });
  }

  const {
    userInput,
    selectedPlatform,
    genrePaths,
    genreProportions,
    initialIdeas,
    ideationTemplate
  } = req.body;

  if (!userInput || !ideationTemplate) {
    return res.status(400).json({ error: "Missing 'userInput' or 'ideationTemplate' in request body" });
  }

  const runId = uuidv4();
  const genrePathsJson = JSON.stringify(genrePaths || []);
  const genreProportionsJson = JSON.stringify(genreProportions || []);

  // Build genre string for the prompt
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

  const genrePromptString = buildGenrePromptString();

  // Get authenticated user
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    // Insert initial run data
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO ideation_runs (id, user_id, user_input, selected_platform, genre_prompt_string, genre_paths_json, genre_proportions_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [runId, user.id, userInput, selectedPlatform || '', genrePromptString, genrePathsJson, genreProportionsJson],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Insert initial ideas if provided
    if (initialIdeas && initialIdeas.length > 0) {
      for (const idea of initialIdeas) {
        await new Promise<void>((resolve, reject) => {
          db.run(
            `INSERT INTO generated_initial_ideas (run_id, idea_text) VALUES (?, ?)`,
            [runId, idea],
            function (err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
    }

    // Generate plot using LLM
    const deepseekAI = createOpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.deepseek.com',
    });

    const fullPrompt = ideationTemplate
      .replace('{user_input}', userInput)
      .replace('{platform}', selectedPlatform || '未指定')
      .replace('{genre}', genrePromptString || '未指定');

    const result = await generateText({
      model: deepseekAI('deepseek-chat'),
      messages: [
        { role: 'user', content: fullPrompt }
      ]
    });

    // Parse the LLM response
    let llmResult: any = {};
    try {
      llmResult = JSON.parse(result.text);
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
      // Try with jsonrepair if available
      try {
        const { jsonrepair } = await import('jsonrepair');
        const repairedJson = jsonrepair(result.text);
        llmResult = JSON.parse(repairedJson);
      } catch (repairError) {
        console.error('Failed to repair JSON:', repairError);
        llmResult = { error: 'Failed to parse LLM response' };
      }
    }

    // Update the run with LLM results
    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE ideation_runs 
         SET media_type = ?, platform_recommendation = ?, plot_outline = ?, analysis = ?
         WHERE id = ?`,
        [
          llmResult.mediaType || '',
          llmResult.platform || '',
          llmResult.plotOutline || '',
          llmResult.analysis || '',
          runId
        ],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Return the run ID and LLM result
    res.json({
      runId,
      result: llmResult
    });

  } catch (error: any) {
    console.error('Error in create_run_and_generate_plot:', error);
    res.status(500).json({ error: "Failed to create ideation run", details: error.message });
  }
});

app.get("/api/ideations/:id", authMiddleware.authenticate, async (req: any, res: any) => {
  const { id } = req.params;

  // Get authenticated user
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    // Get the ideation run (filtered by user)
    const run = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT * FROM ideation_runs WHERE id = ? AND user_id = ?`,
        [id, user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!run) {
      return res.status(404).json({ error: "Ideation run not found" });
    }

    // Get the initial ideas
    const ideas = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT idea_text FROM generated_initial_ideas WHERE run_id = ? ORDER BY id`,
        [id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    // Parse JSON fields
    let genrePaths: string[][] = [];
    let genreProportions: number[] = [];

    try {
      genrePaths = JSON.parse(run.genre_paths_json || '[]');
      genreProportions = JSON.parse(run.genre_proportions_json || '[]');
    } catch (parseError) {
      console.error('Error parsing genre data:', parseError);
    }

    res.json({
      id: run.id,
      userInput: run.user_input,
      selectedPlatform: run.selected_platform,
      genrePaths,
      genreProportions,
      initialIdeas: ideas.map(idea => idea.idea_text),
      result: {
        mediaType: run.media_type,
        platform: run.platform_recommendation,
        plotOutline: run.plot_outline,
        analysis: run.analysis
      },
      createdAt: run.created_at
    });

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
    const runs = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT id, user_input, selected_platform, genre_prompt_string, genre_paths_json, genre_proportions_json, created_at FROM ideation_runs WHERE user_id = ? ORDER BY created_at DESC`,
        [user.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    // For each run, also get the initial ideas
    const runsWithIdeas = await Promise.all(runs.map(async (run) => {
      const ideas = await new Promise<any[]>((resolve, reject) => {
        db.all(
          `SELECT idea_text FROM generated_initial_ideas WHERE run_id = ? ORDER BY id LIMIT 3`,
          [run.id],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      // Parse JSON fields
      let genrePaths: string[][] = [];
      let genreProportions: number[] = [];

      try {
        genrePaths = JSON.parse(run.genre_paths_json || '[]');
        genreProportions = JSON.parse(run.genre_proportions_json || '[]');
      } catch (parseError) {
        console.error('Error parsing genre data:', parseError);
      }

      return {
        id: run.id,
        user_input: run.user_input,
        selected_platform: run.selected_platform,
        genre_prompt_string: run.genre_prompt_string,
        genre_paths: genrePaths,
        genre_proportions: genreProportions,
        initial_ideas: ideas.map(idea => idea.idea_text),
        created_at: run.created_at
      };
    }));

    res.json(runsWithIdeas);
  } catch (error: any) {
    console.error('Error fetching ideation runs:', error);
    res.status(500).json({ error: "Failed to fetch ideation runs", details: error.message });
  }
});

// Script document management endpoints
app.post("/api/scripts", authMiddleware.authenticate, async (req: any, res: any) => {
  const { name = 'Untitled Script' } = req.body;

  // Get authenticated user
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  const scriptId = uuidv4();
  const roomId = `script-${user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  try {
    // Store script in database
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO scripts (id, user_id, name, room_id) VALUES (?, ?, ?, ?)`,
        [scriptId, user.id, name, roomId],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Return the script info for collaborative editing
    res.json({
      id: scriptId,
      name,
      roomId,
      userId: user.id
    });

  } catch (error: any) {
    console.error('Error creating script:', error);
    res.status(500).json({ error: "Failed to create script", details: error.message });
  }
});

app.get("/api/scripts/:id", authMiddleware.authenticate, async (req: any, res: any) => {
  const { id } = req.params;

  // Get authenticated user
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    // Get the script (filtered by user)
    const script = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT * FROM scripts WHERE id = ? AND user_id = ?`,
        [id, user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!script) {
      return res.status(404).json({ error: "Script not found" });
    }

    res.json({
      id: script.id,
      name: script.name,
      roomId: script.room_id,
      userId: script.user_id,
      createdAt: script.created_at,
      updatedAt: script.updated_at
    });

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
    const scripts = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT id, name, room_id, created_at, updated_at FROM scripts WHERE user_id = ? ORDER BY updated_at DESC`,
        [user.id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    res.json(scripts.map(script => ({
      id: script.id,
      name: script.name,
      roomId: script.room_id,
      createdAt: script.created_at,
      updatedAt: script.updated_at
    })));

  } catch (error: any) {
    console.error('Error fetching scripts:', error);
    res.status(500).json({ error: "Failed to fetch scripts", details: error.message });
  }
});

app.put("/api/scripts/:id", authMiddleware.authenticate, async (req: any, res: any) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Missing 'name' in request body" });
  }

  // Get authenticated user
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    // Update the script (filtered by user)
    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE scripts SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
        [name, id, user.id],
        function (err) {
          if (err) reject(err);
          else if (this.changes === 0) reject(new Error('Script not found or unauthorized'));
          else resolve();
        }
      );
    });

    res.json({ success: true, message: "Script updated successfully" });

  } catch (error: any) {
    console.error('Error updating script:', error);
    if (error.message === 'Script not found or unauthorized') {
      res.status(404).json({ error: "Script not found" });
    } else {
      res.status(500).json({ error: "Failed to update script", details: error.message });
    }
  }
});

app.delete("/api/scripts/:id", authMiddleware.authenticate, async (req: any, res: any) => {
  const { id } = req.params;

  // Get authenticated user
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    // Delete the script (filtered by user)
    await new Promise<void>((resolve, reject) => {
      db.run(
        `DELETE FROM scripts WHERE id = ? AND user_id = ?`,
        [id, user.id],
        function (err) {
          if (err) reject(err);
          else if (this.changes === 0) reject(new Error('Script not found or unauthorized'));
          else resolve();
        }
      );
    });

    res.json({ success: true, message: "Script deleted successfully" });

  } catch (error: any) {
    console.error('Error deleting script:', error);
    if (error.message === 'Script not found or unauthorized') {
      res.status(404).json({ error: "Script not found" });
    } else {
      res.status(500).json({ error: "Failed to delete script", details: error.message });
    }
  }
});

// Handle client-side routing fallback
// This must be the last route to catch all unmatched routes
app.get(/(.*)/, (req, res, next) => {
  // Only handle routes that don't start with /api, /llm-api, or other API routes
  if (req.path.startsWith('/api') ||
    req.path.startsWith('/llm-api') ||
    req.path.startsWith('/yjs') ||
    req.path.includes('.')) { // Skip routes with file extensions (assets)
    return next();
  }

  // For all other routes, let ViteExpress handle the client-side routing
  // ViteExpress will serve the index.html and React Router will handle the rest
  next();
});

app.post("/api/ideations/:id/generate_plot", authMiddleware.authenticate, async (req: any, res: any) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('Error: DEEPSEEK_API_KEY environment variable is not set.');
    return res.status(500).json({ error: "DEEPSEEK_API_KEY not configured" });
  }

  const { id: runId } = req.params;
  const { userInput, ideationTemplate } = req.body;

  if (!userInput || !ideationTemplate) {
    return res.status(400).json({ error: "Missing 'userInput' or 'ideationTemplate' in request body" });
  }

  // Get authenticated user
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  try {
    // Get the existing run data (filtered by user)
    const run = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT * FROM ideation_runs WHERE id = ? AND user_id = ?`,
        [runId, user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!run) {
      return res.status(404).json({ error: "Ideation run not found" });
    }

    // Update the user input
    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE ideation_runs SET user_input = ? WHERE id = ?`,
        [userInput, runId],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Generate plot using LLM
    const deepseekAI = createOpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.deepseek.com',
    });

    const fullPrompt = ideationTemplate
      .replace('{user_input}', userInput)
      .replace('{platform}', run.selected_platform || '未指定')
      .replace('{genre}', run.genre_prompt_string || '未指定');

    const result = await generateText({
      model: deepseekAI('deepseek-chat'),
      messages: [
        { role: 'user', content: fullPrompt }
      ]
    });

    // Parse the LLM response
    let llmResult: any = {};
    try {
      llmResult = JSON.parse(result.text);
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
      // Try with jsonrepair if available
      try {
        const { jsonrepair } = await import('jsonrepair');
        const repairedJson = jsonrepair(result.text);
        llmResult = JSON.parse(repairedJson);
      } catch (repairError) {
        console.error('Failed to repair JSON:', repairError);
        llmResult = { error: 'Failed to parse LLM response' };
      }
    }

    // Update the run with LLM results
    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE ideation_runs 
         SET media_type = ?, platform_recommendation = ?, plot_outline = ?, analysis = ?
         WHERE id = ?`,
        [
          llmResult.mediaType || '',
          llmResult.platform || '',
          llmResult.plotOutline || '',
          llmResult.analysis || '',
          runId
        ],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Return the LLM result
    res.json({ result: llmResult });

  } catch (error: any) {
    console.error('Error in generate_plot:', error);
    res.status(500).json({ error: "Failed to generate plot", details: error.message });
  }
});
