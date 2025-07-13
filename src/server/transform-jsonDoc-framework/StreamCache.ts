import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { generateCacheKey, generateSchemaHash, CacheKeyParams } from '../../common/transform-jsonDoc-framework/cacheKeyGenerator';



/**
 * Unified stream chunk format that works for both streamObject and streamText
 */
export interface CachedStreamChunk {
    type: 'object' | 'text-delta' | 'tool-call' | 'tool-result' | 'finish' | 'error';
    data: any;
    timestamp: number;
}

/**
 * Cache metadata for debugging and validation
 */
export interface CacheMetadata {
    cacheKey: string;
    createdAt: string;
    totalChunks: number;
    finalResult?: any;
}

/**
 * Core stream caching infrastructure
 */
export class StreamCache {
    private cacheDir: string;

    constructor(cacheDir: string = './cache/llm-streams') {
        this.cacheDir = cacheDir;
    }

    /**
     * Generate a deterministic cache key from parameters
     */
    generateCacheKey(params: CacheKeyParams): string {
        return generateCacheKey(params);
    }

    /**
     * Generate hash for Zod schema for cache invalidation
     */
    generateSchemaHash(schema: z.ZodSchema): string {
        return generateSchemaHash(schema);
    }

    /**
     * Get cached stream chunks if available
     */
    async getCachedStream(cacheKey: string): Promise<CachedStreamChunk[] | null> {
        try {
            await this.ensureCacheDir();
            const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);

            const cacheData = await fs.readFile(cacheFile, 'utf-8');
            const parsed = JSON.parse(cacheData);

            // Validate cache structure
            if (!Array.isArray(parsed.chunks)) {
                console.warn(`[StreamCache] Invalid cache format for key ${cacheKey}`);
                return null;
            }

            console.log(`[StreamCache] Cache HIT for key ${cacheKey.substring(0, 8)}... (${parsed.chunks.length} chunks)`);
            return parsed.chunks;

        } catch (error) {
            if ((error as any).code === 'ENOENT') {
                console.log(`[StreamCache] Cache MISS for key ${cacheKey.substring(0, 8)}...`);
            } else {
                console.warn(`[StreamCache] Cache read error for key ${cacheKey.substring(0, 8)}...:`, error);
            }
            return null;
        }
    }

    /**
     * Save stream progression to cache
     */
    async saveStreamToCache(cacheKey: string, chunks: CachedStreamChunk[]): Promise<void> {
        try {
            await this.ensureCacheDir();
            const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);

            const metadata: CacheMetadata = {
                cacheKey,
                createdAt: new Date().toISOString(),
                totalChunks: chunks.length,
                finalResult: chunks[chunks.length - 1]?.data
            };

            const cacheData = {
                metadata,
                chunks
            };

            await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
            console.log(`[StreamCache] Saved ${chunks.length} chunks to cache for key ${cacheKey.substring(0, 8)}...`);

        } catch (error) {
            console.warn(`[StreamCache] Failed to save cache for key ${cacheKey.substring(0, 8)}...:`, error);
        }
    }

    /**
     * Replay cached stream chunks as an async iterable
     */
    async* replayStream(chunks: CachedStreamChunk[]): AsyncIterable<any> {
        console.log(`[StreamCache] Replaying ${chunks.length} cached chunks...`);

        for (const chunk of chunks) {
            // Replay as fast as possible - no artificial delays
            yield chunk.data;
        }
    }

    /**
     * Create a cached version of an async iterable stream
     */
    async* createCachedStream<T>(
        cacheKey: string,
        streamGenerator: () => Promise<AsyncIterable<T>> | AsyncIterable<T>,
        chunkTransformer: (chunk: T) => CachedStreamChunk
    ): AsyncIterable<T> {
        // Try to get from cache first
        const cachedChunks = await this.getCachedStream(cacheKey);

        if (cachedChunks) {
            // Replay from cache
            for await (const data of this.replayStream(cachedChunks)) {
                yield data;
            }
            return;
        }

        // Not in cache - generate new stream and cache it
        const chunks: CachedStreamChunk[] = [];

        try {
            const streamResult = streamGenerator();
            const stream = streamResult instanceof Promise ? await streamResult : streamResult;

            for await (const chunk of stream) {
                const cachedChunk = chunkTransformer(chunk);
                chunks.push(cachedChunk);
                yield chunk;
            }

            // Save to cache after successful completion
            await this.saveStreamToCache(cacheKey, chunks);

        } catch (error) {
            console.warn(`[StreamCache] Stream generation failed, not caching:`, error);
            throw error;
        }
    }

    /**
     * Ensure cache directory exists
     */
    private async ensureCacheDir(): Promise<void> {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
        } catch (error) {
            // Directory might already exist, ignore EEXIST errors
            if ((error as any).code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * Clear all cached entries (for testing/debugging)
     */
    async clearCache(): Promise<void> {
        try {
            const files = await fs.readdir(this.cacheDir);
            await Promise.all(
                files.filter(f => f.endsWith('.json')).map(f =>
                    fs.unlink(path.join(this.cacheDir, f))
                )
            );
            console.log(`[StreamCache] Cleared ${files.length} cache entries`);
        } catch (error) {
            console.warn(`[StreamCache] Failed to clear cache:`, error);
        }
    }
}

// Global cache instance
let globalStreamCache: StreamCache | null = null;

/**
 * Get or create global cache instance
 */
export function getStreamCache(): StreamCache {
    if (!globalStreamCache) {
        globalStreamCache = new StreamCache();
    }
    return globalStreamCache;
} 