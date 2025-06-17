import { AxAI, AxAIOpenAIModel } from '@ax-llm/ax';
import { MAX_TOKENS_GENERATION, MAX_TOKENS_EVALUATION } from './ax-brainstorm-types';
import { getLLMCredentials } from '../services/LLMConfig';

export function createGenerationAI(): AxAI {
    const credentials = getLLMCredentials();

    // For now, use a simple configuration - we may need to configure baseURL differently
    const ai = new AxAI({
        name: credentials.provider,
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
        name: credentials.provider,
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
        name: credentials.provider,
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