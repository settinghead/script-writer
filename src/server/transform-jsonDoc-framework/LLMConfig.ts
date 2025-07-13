import { LanguageModelV1 } from 'ai';

export interface LLMCredentials {
    apiKey: string;
    baseUrl: string;
    modelName: string;
    provider: string;
}

export function getLLMCredentials(): LLMCredentials {
    const apiKey = process.env.LLM_API_KEY;
    const baseUrl = process.env.LLM_BASE_URL;
    const modelName = process.env.LLM_MODEL_NAME;
    const provider = process.env.LLM_PROVIDER;

    if (!apiKey) {
        throw new Error('LLM_API_KEY environment variable is not set');
    }

    if (!baseUrl) {
        throw new Error('LLM_BASE_URL environment variable is not set');
    }

    if (!modelName) {
        throw new Error('LLM_MODEL_NAME environment variable is not set');
    }

    if (!provider) {
        throw new Error('LLM_PROVIDER environment variable is not set');
    }

    return {
        apiKey,
        baseUrl,
        modelName,
        provider
    };
}

export async function getLLMModel({
    modelName,
    apiKey,
    baseUrl,
    provider,
}: Partial<LLMCredentials> = {}): Promise<LanguageModelV1> {
    const { apiKey: defaultApiKey, baseUrl: defaultBaseUrl, provider: defaultProvider, modelName: defaultModelName } = getLLMCredentials();
    const actualModelName = modelName || defaultModelName;
    const actualApiKey = apiKey || defaultApiKey;
    const actualBaseUrl = baseUrl || defaultBaseUrl;
    const actualProvider = provider || defaultProvider;

    if (actualProvider === 'openai' || actualProvider === 'qwen') {
        const { createOpenAI } = await import('@ai-sdk/openai');
        const openai = createOpenAI({
            apiKey: actualApiKey,
            baseURL: actualBaseUrl,
        });
        return openai(actualModelName);
    }
    //  else if (actualProvider === 'qwen') {
    //     const { createQwen } = await import('qwen-ai-provider');
    //     const qwen = createQwen({
    //         apiKey: actualApiKey,
    //         baseURL: actualBaseUrl,
    //     });
    //     return qwen(actualModelName);
    // } 
    else if (actualProvider === 'deepseek') {
        const { createDeepSeek } = await import('@ai-sdk/deepseek');
        const deepseek = createDeepSeek({
            apiKey: actualApiKey,
            baseURL: actualBaseUrl,
        });
        return deepseek(actualModelName);
    } else {
        throw new Error(`Unsupported provider: ${actualProvider}`);
    }
}