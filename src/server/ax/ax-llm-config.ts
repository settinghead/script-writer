import { AxAI, AxAIOpenAIModel } from '@ax-llm/ax';
import { MAX_TOKENS_GENERATION, MAX_TOKENS_EVALUATION } from './ax-brainstorm-types';

// Environment variables loaded by run-ts

export interface LLMCredentials {
    apiKey: string;
    baseUrl: string;
    modelName: string;
}

export function getLLMCredentials(): LLMCredentials {
    const apiKey = process.env.LLM_API_KEY;
    const baseUrl = process.env.LLM_BASE_URL;
    const modelName = process.env.LLM_MODEL_NAME;

    if (!apiKey) {
        throw new Error('LLM_API_KEY environment variable is not set');
    }

    if (!baseUrl) {
        throw new Error('LLM_BASE_URL environment variable is not set');
    }

    if (!modelName) {
        throw new Error('LLM_MODEL_NAME environment variable is not set');
    }

    return {
        apiKey,
        baseUrl,
        modelName
    };
}

export function createGenerationAI(): AxAI {
    const credentials = getLLMCredentials();

    // For now, use a simple configuration - we may need to configure baseURL differently
    const ai = new AxAI({
        name: 'openai',
        apiKey: credentials.apiKey,
        apiURL: credentials.baseUrl,
        config: {
            model: credentials.modelName as AxAIOpenAIModel,
            maxTokens: MAX_TOKENS_GENERATION,
            temperature: 1.7, // Higher temperature for creative brainstorming
        }
    });

    return ai;
}

export function createEvaluationAI(): AxAI {
    const credentials = getLLMCredentials();

    const ai = new AxAI({
        name: 'openai',
        apiKey: credentials.apiKey,
        apiURL: credentials.baseUrl,
        config: {
            model: credentials.modelName as AxAIOpenAIModel,
            maxTokens: MAX_TOKENS_EVALUATION,
            temperature: 0.3, // Lower temperature for consistent evaluation
        }
    });

    return ai;
}

export function createBalancedAI(): AxAI {
    const credentials = getLLMCredentials();

    const ai = new AxAI({
        name: 'openai',
        apiKey: credentials.apiKey,
        apiURL: credentials.baseUrl,
        config: {
            model: credentials.modelName as AxAIOpenAIModel,
            maxTokens: MAX_TOKENS_GENERATION,
            temperature: 1.0, // Balanced temperature
        }
    });

    return ai;
} 