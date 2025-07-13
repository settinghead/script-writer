import { z } from 'zod';
import { LLMService, LLMModelInfo } from './LLMService';
import { StreamCache, getStreamCache, CachedStreamChunk } from './StreamCache';
import { generateCacheKey, generateSchemaHash, extractModelInfo, CacheKeyParams } from '../../common/transform-jsonDoc-framework/cacheKeyGenerator';

/**
 * Options for streamObject with caching support
 */
export interface CachedStreamObjectOptions<T extends z.ZodSchema> {
    model: any; // AI SDK model instance
    prompt: string;
    schema: T;
    seed?: number;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    onReasoningStart?: (phase: string) => void;
    onReasoningEnd?: (phase: string) => void;
}

/**
 * Options for streamText with caching support  
 */
export interface CachedStreamTextOptions {
    model: any; // AI SDK model instance
    prompt: string;
    seed?: number;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    onReasoningStart?: (phase: string) => void;
    onReasoningEnd?: (phase: string) => void;
}

/**
 * Cached LLM service that provides transparent caching with explicit model parameters
 * Uses the same interface as AI SDK but with built-in caching
 */
export class CachedLLMService {
    private llmService: LLMService;
    private streamCache: StreamCache;
    private enableCaching: boolean;

    constructor(enableCaching: boolean = true) {
        this.llmService = new LLMService();
        this.streamCache = getStreamCache();
        this.enableCaching = enableCaching;
    }

    /**
     * Extract model information from AI SDK model instance
     */
    private extractModelInfo(model: any): LLMModelInfo {
        const modelInfo = extractModelInfo(model);

        return {
            name: modelInfo.name,
            provider: modelInfo.provider,
            supportsReasoning: this.llmService.isReasoningModel(modelInfo.name)
        };
    }

    /**
     * Generate cache key from model and parameters
     */
    private generateCacheKey(
        model: any,
        prompt: string,
        schema?: z.ZodSchema,
        options: {
            seed?: number;
            temperature?: number;
            topP?: number;
            maxTokens?: number;
            mode: 'object' | 'text';
        } = { mode: 'text' }
    ): string {
        const modelInfo = this.extractModelInfo(model);

        const cacheKeyParams: CacheKeyParams = {
            prompt,
            seed: options.seed,
            schemaHash: schema ? generateSchemaHash(schema) : undefined,
            modelName: modelInfo.name,
            provider: modelInfo.provider,
            temperature: options.temperature,
            topP: options.topP,
            maxTokens: options.maxTokens,
            mode: options.mode
        };

        return generateCacheKey(cacheKeyParams);
    }

    /**
     * Clear caches (both LLM service and stream cache)
     */
    async clearCache(): Promise<void> {
        this.llmService.clearCache();
        await this.streamCache.clearCache();
    }

    /**
     * Stream a structured object with transparent caching
     */
    async streamObject<T extends z.ZodSchema<any>>(
        options: CachedStreamObjectOptions<T>
    ): Promise<AsyncIterable<any>> {
        const {
            model,
            prompt,
            schema,
            onReasoningStart,
            onReasoningEnd,
            seed,
            temperature,
            topP,
            maxTokens
        } = options;

        // If caching is disabled, use original service directly
        if (!this.enableCaching) {
            const stream = await this.llmService.streamObject({
                prompt,
                schema,
                onReasoningStart,
                onReasoningEnd
            });
            return stream;
        }

        // Generate cache key including model information
        const cacheKey = this.generateCacheKey(model, prompt, schema, {
            seed,
            temperature,
            topP,
            maxTokens,
            mode: 'object'
        });

        // Use cached stream wrapper
        return this.streamCache.createCachedStream(
            cacheKey,
            // Stream generator function
            async (): Promise<AsyncIterable<any>> => {
                return await this.llmService.streamObject({
                    prompt,
                    schema,
                    onReasoningStart,
                    onReasoningEnd
                });
            },
            // Chunk transformer for caching
            (partialObject: any): CachedStreamChunk => ({
                type: 'object',
                data: partialObject,
                timestamp: Date.now()
            })
        );
    }

    /**
 * Stream text with transparent caching
 */
    async streamText(options: CachedStreamTextOptions) {
        const {
            model,
            prompt,
            onReasoningStart,
            onReasoningEnd,
            seed,
            temperature,
            topP,
            maxTokens
        } = options;

        // If caching is disabled, use original service directly
        if (!this.enableCaching) {
            return this.llmService.streamText(prompt, onReasoningStart, onReasoningEnd);
        }

        // Generate cache key including model information
        const cacheKey = this.generateCacheKey(model, prompt, undefined, {
            seed,
            temperature,
            topP,
            maxTokens,
            mode: 'text'
        });

        // For streamText, we need to handle the more complex return structure
        const cachedChunks = await this.streamCache.getCachedStream(cacheKey);

        if (cachedChunks) {
            // Replay from cache

            const textStream = this.streamCache.replayStream(cachedChunks);

            return {
                textStream,
                // Mock other properties that might be used
                finishReason: Promise.resolve('stop'),
                usage: Promise.resolve({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }),
                // Add other properties as needed
            };
        }

        // Not in cache - generate new stream and cache it

        const originalResult = await this.llmService.streamText(prompt, onReasoningStart, onReasoningEnd);
        const chunks: CachedStreamChunk[] = [];

        // Wrap the original textStream to cache chunks
        const streamCache = this.streamCache;
        const cachedTextStream = (async function* () {
            try {
                for await (const textChunk of originalResult.textStream) {
                    const cachedChunk: CachedStreamChunk = {
                        type: 'text-delta',
                        data: textChunk,
                        timestamp: Date.now()
                    };
                    chunks.push(cachedChunk);
                    yield textChunk;
                }

                // Save to cache after successful completion
                await streamCache.saveStreamToCache(cacheKey, chunks);

            } catch (error) {
                console.warn(`[CachedLLMService] StreamText failed, not caching:`, error);
                throw error;
            }
        })();

        return {
            ...originalResult,
            textStream: cachedTextStream
        };
    }

    /**
     * Create a cached service instance with caching enabled
     */
    static withCaching(enableCaching: boolean = true): CachedLLMService {
        return new CachedLLMService(enableCaching);
    }

    /**
     * Create a cached service instance with caching disabled (passthrough mode)
     */
    static withoutCaching(): CachedLLMService {
        return new CachedLLMService(false);
    }
}

// Global cached service instance
let globalCachedLLMService: CachedLLMService | null = null;

/**
 * Get or create global cached LLM service instance
 */
export function getCachedLLMService(): CachedLLMService {
    if (!globalCachedLLMService) {
        globalCachedLLMService = new CachedLLMService();
    }
    return globalCachedLLMService;
} 