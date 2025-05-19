import express from "express";
import ViteExpress from "vite-express";
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env.PORT || "4600");
const app = express();

app.use(express.json()); // Middleware to parse JSON bodies

app.get("/message", (_req, res) => {
  res.send("Hello from Express!");
});

// Updated endpoint for AI chat completions using Vercel AI SDK
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

ViteExpress.listen(app, PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});
