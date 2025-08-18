import { LanguageModelV1 } from 'ai';

export interface LLMCredentials {
    apiKey: string;
    baseUrl: string;
    modelName: string;
    provider: string;
}

export interface EmbeddingCredentials {
    apiKey: string;
    baseUrl: string;
    modelName: string;
    provider: string;
    dimensions: number;
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

export function getEmbeddingCredentials(): EmbeddingCredentials {
    if (!process.env.EMBEDDING_API_KEY) {
        throw new Error('EMBEDDING_API_KEY environment variable is not set');
    }

    if (!process.env.EMBEDDING_BASE_URL) {
        throw new Error('EMBEDDING_BASE_URL environment variable is not set');
    }

    if (!process.env.EMBEDDING_MODEL_NAME) {
        throw new Error('EMBEDDING_MODEL_NAME environment variable is not set');
    }

    if (!process.env.EMBEDDING_PROVIDER) {
        throw new Error('EMBEDDING_PROVIDER environment variable is not set');
    }

    const apiKey = process.env.EMBEDDING_API_KEY;
    const baseUrl = process.env.EMBEDDING_BASE_URL;
    const modelName = process.env.EMBEDDING_MODEL_NAME;
    const provider = process.env.EMBEDDING_PROVIDER;

    if (!apiKey) {
        throw new Error('EMBEDDING_API_KEY environment variable is not set');
    }

    if (!baseUrl) {
        throw new Error('EMBEDDING_BASE_URL environment variable is not set');
    }

    if (!modelName) {
        throw new Error('EMBEDDING_MODEL_NAME environment variable is not set');
    }

    if (!provider) {
        throw new Error('EMBEDDING_PROVIDER environment variable is not set');
    }

    if (!process.env.EMBEDDING_DIMENSIONS) {
        throw new Error('EMBEDDING_DIMENSIONS environment variable is not set');
    }

    const dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS);

    return {
        apiKey,
        baseUrl,
        modelName,
        provider,
        dimensions
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

    if (actualProvider === 'openai') {
        const { createOpenAI } = await import('@ai-sdk/openai');
        const openai = createOpenAI({
            apiKey: actualApiKey,
            baseURL: actualBaseUrl,
        });
        return openai(actualModelName);
    }
    else if (actualProvider === 'qwen') {
        const { createQwen } = await import('qwen-ai-provider');
        const qwen = createQwen({
            apiKey: actualApiKey,
            baseURL: actualBaseUrl,
        });
        return qwen(actualModelName);
    }
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

export function getEmbeddingModel({
    modelName,
    apiKey,
    baseUrl,
    provider,
}: Partial<EmbeddingCredentials> = {}): any {
    const { apiKey: defaultApiKey, baseUrl: defaultBaseUrl, provider: defaultProvider, modelName: defaultModelName } = getEmbeddingCredentials();
    const actualModelName = modelName || defaultModelName;
    const actualApiKey = apiKey || defaultApiKey;
    const actualBaseUrl = baseUrl || defaultBaseUrl;
    const actualProvider = provider || defaultProvider;

    if (actualProvider === 'openai') {
        const { createOpenAI } = require('@ai-sdk/openai');
        const openai = createOpenAI({
            apiKey: actualApiKey,
            baseURL: actualBaseUrl,
        });
        return openai.embedding(actualModelName);
    } else if (actualProvider === 'qwen') {
        const { createQwen } = require('qwen-ai-provider');
        const qwen = createQwen({
            apiKey: actualApiKey,
            baseURL: actualBaseUrl,
        });
        return qwen.textEmbeddingModel(actualModelName);
    }
    else if (actualProvider === 'deepseek') {
        const { createDeepSeek } = require('@ai-sdk/deepseek');
        const deepseek = createDeepSeek({
            apiKey: actualApiKey,
            baseURL: actualBaseUrl,
        });
        return deepseek.textEmbeddingModel(actualModelName);
    } else {
        throw new Error(`Unsupported provider: ${actualProvider}`);
    }
}