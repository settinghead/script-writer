import crypto from 'crypto';
import { z } from 'zod';

export interface CacheKeyParams {
    prompt: string;
    seed?: number;
    schemaHash?: string;
    modelName: string;
    provider?: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    mode?: 'object' | 'text';
    [key: string]: any;
}

export interface ModelInfo {
    name: string;
    provider: string;
    supportsReasoning: boolean;
}

/**
 * Generate deterministic cache key from parameters
 */
export function generateCacheKey(params: CacheKeyParams): string {
    const keyData = {
        prompt: params.prompt,
        seed: params.seed,
        schemaHash: params.schemaHash,
        modelName: params.modelName,
        provider: params.provider,
        temperature: params.temperature,
        topP: params.topP,
        maxTokens: params.maxTokens,
        mode: params.mode,
        // Include other parameters sorted
        ...Object.fromEntries(
            Object.entries(params)
                .filter(([key]) => !['prompt', 'seed', 'schemaHash', 'modelName', 'provider', 'temperature', 'topP', 'maxTokens', 'mode'].includes(key))
                .sort(([a], [b]) => a.localeCompare(b))
        )
    };

    const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
    return crypto.createHash('sha256').update(keyString).digest('hex');
}

/**
 * Generate hash for Zod schema
 */
export function generateSchemaHash(schema: z.ZodSchema): string {
    const schemaString = JSON.stringify(schema._def);
    return crypto.createHash('md5').update(schemaString).digest('hex');
}

/**
 * Extract model information from AI SDK model instance
 */
export function extractModelInfo(model: any): ModelInfo {
    const modelId = model.modelId || model.id || 'unknown';
    const provider = model.provider?.providerId || model.provider || 'unknown';

    return {
        name: modelId,
        provider: provider,
        supportsReasoning: modelId.includes('reasoning') || provider === 'deepseek'
    };
} 