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