import express from "express";
import ViteExpress from "vite-express";
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import dotenv from 'dotenv';
import { setupYjsWebSocketServer, applyEditsToYDoc } from './yjs-server';
import { parseLLMResponse } from './llm-to-yjs';

dotenv.config();

const PORT = parseInt(process.env.PORT || "4600");
const app = express();

app.use(express.json()); // Middleware to parse JSON bodies

// Create the server with ViteExpress
const server = ViteExpress.listen(app, PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});

// Set up YJS WebSocket server
const yjs = setupYjsWebSocketServer(server);

// Original message endpoint
app.get("/message", (_req, res) => {
  res.send("Hello from Express!");
});

// Original chat completions endpoint
app.post("/llm-api/chat/completions", async (req: any, res: any) => {
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

      function pump() {
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

// New endpoint for script editing using LLM
app.post("/llm-api/script/edit", async (req: any, res: any) => {
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

    function pump() {
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

// Script document management endpoints
app.post("/api/scripts", (req, res) => {
  const { name = 'Untitled Script' } = req.body;
  const roomId = `script-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Return the room ID for collaborative editing
  res.json({ id: roomId, name });
});

app.get("/api/scripts/:id", (req, res) => {
  const { id } = req.params;

  // In a real implementation, you'd retrieve the script from a database
  // For now, just return a basic response
  res.json({ id, exists: true });
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
