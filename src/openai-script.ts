import OpenAI from 'openai';

async function main() {
  // It'''s recommended to use an environment variable for your API key
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is not set.');
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

  const userPrompt = "Translate the following English text to French: 'Hello, world!'";

  try {
    console.log(`Sending prompt to Deepseek: "${userPrompt}"`);
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: userPrompt }],
      model: model, // Or any other model you prefer
    });

    const result = completion.choices[0]?.message?.content;
    if (result) {
      console.log('OpenAI Response:');
      console.log(result);
    } else {
      console.log('No response content received from OpenAI.');
    }
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
  }
}

main(); 