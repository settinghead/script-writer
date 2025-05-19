import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  // It'''s recommended to use an environment variable for your API key
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('Error: DEEPSEEK_API_KEY environment variable is not set.');
    process.exit(1);
  }

  const model = process.env.DEEPSEEK_MODEL_NAME;
  if (!model) {
    console.error('Error: DEEPSEEK_MODEL_NAME environment variable is not set.');
    process.exit(1);
  }

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.deepseek.com',
  });

  // Modified prompt to request JSON output
  const userPrompt = "Translate the following English text to French and provide the result as a JSON object with a key 'translation'. Text: 'Hello, world!'";

  try {
    console.log(`Sending prompt to Deepseek: "${userPrompt}"`);
    const stream = await openai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful assistant designed to output JSON.' }, // System message to guide model behavior
        { role: 'user', content: userPrompt }
      ],
      model: model,
      response_format: { type: "json_object" }, // Request JSON response format
      stream: true,
    });

    console.log('Deepseek Response (Streaming JSON):');
    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
      process.stdout.write(content);
    }
    process.stdout.write('\n'); // Add a newline at the end of the stream

    // Optionally, parse and print the full JSON object at the end
    try {
      const parsedJson = JSON.parse(fullResponse);
      console.log('\nParsed JSON object:');
      console.log(JSON.stringify(parsedJson, null, 2));
    } catch (e) {
      console.error('\nFailed to parse streamed response as JSON:', e);
      console.log('Raw response accumulated:', fullResponse);
    }

  } catch (error) {
    console.error('Error calling Deepseek API:', error);
  }
}

main(); 