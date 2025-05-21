import express from "express";
import ViteExpress from "vite-express";
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import dotenv from 'dotenv';
import http from 'http';
import { setupYjsWebSocketServer, applyEditsToYDoc } from './yjs-server';
import { parseLLMResponse } from './llm-to-yjs';

dotenv.config();

const PORT = parseInt(process.env.PORT || "4600");
const app = express();
const server = http.createServer(app);

app.use(express.json()); // Middleware to parse JSON bodies

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

  const { messages, model: modelName, ...restOfBody } = req.body;

  if (!messages || !modelName) {
    return res.status(400).json({ error: "Missing 'messages' or 'model' in request body" });
  }

  const deepseekAI = createOpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.deepseek.com',
  });

  try {
    const result = await streamText({
      model: deepseekAI(modelName),
      messages: messages,
      // You can pass other options from restOfBody if they are supported by streamText
      // e.g., temperature: restOfBody.temperature
      ...restOfBody // Pass through other options like response_format
    });

    // Manually pipe the ReadableStream (DataStream) to the Express response
    // The data stream is compatible with the Vercel AI SDK useChat hook
    res.setHeader('Content-Type', 'text/plain; charset=utf-8'); // Vercel AI SDK stream is typically text
    res.setHeader('Transfer-Encoding', 'chunked');

    const reader = result.toDataStream().getReader();

    function pump() {
      reader.read().then(({ done, value }) => {
        if (done) {
          res.end();
          return;
        }
        // value is a Uint8Array, convert to string before writing if it's text data
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
    // If headers sent, the manual pipe's error handling should manage it or we ensure it's ended.
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

// Use server instead of app for WebSocket support
ViteExpress.listen(server, PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});
