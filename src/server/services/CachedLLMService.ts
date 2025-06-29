import { z } from 'zod';
import { LLMService, LLMModelInfo, ReasoningResult } from './LLMService';
import { StreamCache, getStreamCache, CacheKeyParams, CachedStreamChunk } from './StreamCache';
import { getLLMCredentials } from './LLMConfig';

/**
 * Options for cached streaming operations
 */
export interface CachedStreamingOptions {
    enableCaching?: boolean;
    seed?: number;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
}

/**
 * Cached wrapper around LLMService that provides caching for streaming operations
 */
export class CachedLLMService {
    private llmService: LLMService;
    private streamCache: StreamCache;

    constructor() {
        this.llmService = new LLMService();
        this.streamCache = getStreamCache();
    }

    /**
     * Get model information (passthrough to underlying service)
     */
    getModelInfo(modelName?: string): LLMModelInfo {
        return this.llmService.getModelInfo(modelName);
    }

    /**
     * Generate text (passthrough to underlying service)
     */
    async generateText(prompt: string, modelName?: string): Promise<ReasoningResult> {
        return this.llmService.generateText(prompt, modelName);
    }

    /**
     * Clear caches (both LLM service and stream cache)
     */
    clearCache(): void {
        this.llmService.clearCache();
        // Note: StreamCache doesn't have sync clearCache, but we could add it if needed
    }

    /**
     * Stream a structured object with caching support
     */
    async streamObject<T extends z.ZodSchema<any>>(
        options: {
            prompt: string;
            schema: T;
            modelName?: string;
            onReasoningStart?: (phase: string) => void;
            onReasoningEnd?: (phase: string) => void;
        } & CachedStreamingOptions
    ): Promise<AsyncIterable<any>> {
        const {
            prompt,
            schema,
            modelName,
            onReasoningStart,
            onReasoningEnd,
            enableCaching = false,
            seed,
            temperature,
            topP,
            maxTokens
        } = options;

        // If caching is disabled, use original service directly
        if (!enableCaching) {
            return this.llmService.streamObject({
                prompt,
                schema,
                modelName,
                onReasoningStart,
                onReasoningEnd
            });
        }

        // Generate cache key
        const modelInfo = this.getModelInfo(modelName);
        const schemaHash = this.streamCache.generateSchemaHash(schema);

        const cacheKeyParams: CacheKeyParams = {
            prompt,
            seed,
            schemaHash,
            modelName: modelInfo.name,
            temperature,
            topP,
            maxTokens,
            mode: 'object'
        };

        const cacheKey = this.streamCache.generateCacheKey(cacheKeyParams);

        // Use cached stream wrapper
        return this.streamCache.createCachedStream(
            cacheKey,
            // Stream generator function
            async (): Promise<AsyncIterable<any>> => {
                return await this.llmService.streamObject({
                    prompt,
                    schema,
                    modelName,
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
     * Stream text with caching support
     */
    async streamText(
        prompt: string,
        options?: {
            onReasoningStart?: (phase: string) => void;
            onReasoningEnd?: (phase: string) => void;
            modelName?: string;
        } & CachedStreamingOptions
    ) {
        const {
            onReasoningStart,
            onReasoningEnd,
            modelName,
            enableCaching = false,
            seed,
            temperature,
            topP,
            maxTokens
        } = options || {};

        // If caching is disabled, use original service directly
        if (!enableCaching) {
            return this.llmService.streamText(prompt, onReasoningStart, onReasoningEnd, modelName);
        }

        // Generate cache key
        const modelInfo = this.getModelInfo(modelName);

        const cacheKeyParams: CacheKeyParams = {
            prompt,
            seed,
            modelName: modelInfo.name,
            temperature,
            topP,
            maxTokens,
            mode: 'text'
        };

        const cacheKey = this.streamCache.generateCacheKey(cacheKeyParams);

        // For streamText, we need to handle the more complex return structure
        const cachedChunks = await this.streamCache.getCachedStream(cacheKey);

        if (cachedChunks) {
            // Replay from cache
            console.log(`[CachedLLMService] Replaying cached streamText for key ${cacheKey.substring(0, 8)}...`);

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
        console.log(`[CachedLLMService] Cache miss for streamText, calling LLM...`);

        const originalResult = await this.llmService.streamText(prompt, onReasoningStart, onReasoningEnd, modelName);
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
     * Cached version of streamObject specifically for AI SDK compatibility
     * This version adds seed parameter support and caching
     */
    async createCachedStreamObject<T extends z.ZodSchema<any>>(
        options: {
            prompt: string;
            schema: T;
            modelName?: string;
            onReasoningStart?: (phase: string) => void;
            onReasoningEnd?: (phase: string) => void;
        } & CachedStreamingOptions
    ): Promise<AsyncIterable<any>> {
        // If seed is provided but caching is disabled, we still want to pass the seed to the underlying call
        if (options.seed && !options.enableCaching) {
            // TODO: When we integrate seed support into the base LLMService, pass it through here
            console.warn('[CachedLLMService] Seed parameter provided but caching disabled - seed will be ignored');
        }

        return this.streamObject(options);
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