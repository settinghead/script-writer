import { ConversationId, MessageId, getConversationMessages, ConversationMessage } from './ConversationManager.js';
import { calculateContentHash, type LLMParameters } from './ContentHasher.js';

// Cache lookup types
export interface CacheQuery {
    contentHash?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    promptPrefix?: string;
    conversationContext?: ConversationMessage[];
    projectId?: string;
    maxAgeMs?: number;
}

export interface CachedResponse {
    messageId: MessageId;
    conversationId: ConversationId;
    content: string;
    contentHash: string;
    model: string;
    temperature: number;
    cachedTokens: number;
    hitCount: number;
    createdAt: Date;
    lastAccessedAt: Date;
    metadata: Record<string, any>;
}

export interface CacheHitResult {
    found: boolean;
    response?: CachedResponse;
    similarResponses?: CachedResponse[];
    cacheStats: CacheStats;
}

export interface CacheStats {
    totalCacheEntries: number;
    hitRate: number;
    avgResponseTime: number;
}

export interface CacheMetrics {
    totalLookups: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
    avgLookupTimeMs: number;
    totalCachedTokens: number;
    tokensSavedFromCache: number;
    costSavingsUSD: number;
}

// In-memory cache statistics (in production, this would be in database)
let cacheMetrics: CacheMetrics = {
    totalLookups: 0,
    cacheHits: 0,
    cacheMisses: 0,
    hitRate: 0,
    avgLookupTimeMs: 0,
    totalCachedTokens: 0,
    tokensSavedFromCache: 0,
    costSavingsUSD: 0
};

// Cache configuration
export interface CacheConfig {
    enabled: boolean;
    maxCacheAgeMs: number;
    maxCacheSize: number;
    similarityThreshold: number; // 0-1, for fuzzy matching
    tokenCostPerThousand: number; // Cost in USD
    enableSimilaritySearch: boolean;
    enableMetricsTracking: boolean;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
    enabled: true,
    maxCacheAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxCacheSize: 10000,
    similarityThreshold: 0.85,
    tokenCostPerThousand: 0.002, // Example: $0.002 per 1K tokens
    enableSimilaritySearch: true,
    enableMetricsTracking: true
};

let globalCacheConfig: CacheConfig = { ...DEFAULT_CACHE_CONFIG };

/**
 * Update cache configuration
 */
export function updateCacheConfig(config: Partial<CacheConfig>): void {
    globalCacheConfig = { ...globalCacheConfig, ...config };
    console.log('[DB Cache] Configuration updated:', globalCacheConfig);
}

/**
 * Get current cache configuration
 */
export function getCacheConfig(): CacheConfig {
    return { ...globalCacheConfig };
}

/**
 * Look up cached response by content hash
 */
export async function lookupCacheByHash(
    contentHash: string,
    config: CacheConfig = globalCacheConfig
): Promise<CacheHitResult> {
    const startTime = Date.now();

    try {
        if (!config.enabled) {
            return createCacheMissResult();
        }

        // In a real implementation, this would query the database
        // For now, we'll simulate the database lookup
        console.log(`[DB Cache] Looking up cache by hash: ${contentHash.substring(0, 8)}...`);

        // Simulate database query
        const cachedResponse = await simulateDatabaseLookup(contentHash, config);

        const lookupTime = Date.now() - startTime;

        if (cachedResponse) {
            // Cache hit
            await updateCacheMetrics(true, lookupTime, cachedResponse.cachedTokens);

            // Update last accessed time (in real implementation)
            await updateLastAccessTime(cachedResponse.messageId);

            console.log(`[DB Cache] CACHE HIT for hash ${contentHash.substring(0, 8)}... (${cachedResponse.cachedTokens} tokens)`);

            return {
                found: true,
                response: cachedResponse,
                cacheStats: await getCacheStats()
            };
        } else {
            // Cache miss
            await updateCacheMetrics(false, lookupTime, 0);

            console.log(`[DB Cache] CACHE MISS for hash ${contentHash.substring(0, 8)}...`);

            return createCacheMissResult();
        }

    } catch (error) {
        console.error('[DB Cache] Error during cache lookup:', error);
        await updateCacheMetrics(false, Date.now() - startTime, 0);
        return createCacheMissResult();
    }
}

/**
 * Look up cached response with fuzzy matching
 */
export async function lookupCacheWithSimilarity(
    query: CacheQuery,
    config: CacheConfig = globalCacheConfig
): Promise<CacheHitResult> {
    const startTime = Date.now();

    try {
        if (!config.enabled || !config.enableSimilaritySearch) {
            return createCacheMissResult();
        }

        console.log('[DB Cache] Performing similarity-based cache lookup');

        // Find similar cached responses
        const similarResponses = await findSimilarCachedResponses(query, config);

        const lookupTime = Date.now() - startTime;

        if (similarResponses.length > 0) {
            const bestMatch = similarResponses[0];

            // Check if the best match meets similarity threshold
            const similarity = calculateQuerySimilarity(query, bestMatch);

            if (similarity >= config.similarityThreshold) {
                await updateCacheMetrics(true, lookupTime, bestMatch.cachedTokens);

                console.log(`[DB Cache] SIMILARITY HIT with ${(similarity * 100).toFixed(1)}% match (${bestMatch.cachedTokens} tokens)`);

                return {
                    found: true,
                    response: bestMatch,
                    similarResponses: similarResponses.slice(1, 5), // Additional similar responses
                    cacheStats: await getCacheStats()
                };
            }
        }

        await updateCacheMetrics(false, lookupTime, 0);

        console.log('[DB Cache] No similar cache entries found above threshold');

        return {
            found: false,
            similarResponses,
            cacheStats: await getCacheStats()
        };

    } catch (error) {
        console.error('[DB Cache] Error during similarity lookup:', error);
        await updateCacheMetrics(false, Date.now() - startTime, 0);
        return createCacheMissResult();
    }
}

/**
 * Store response in cache
 */
export async function storeCacheEntry(
    conversationId: ConversationId,
    messageId: MessageId,
    content: string,
    llmParameters: LLMParameters,
    cachedTokens: number,
    metadata: Record<string, any> = {}
): Promise<boolean> {
    try {
        if (!globalCacheConfig.enabled) {
            return false;
        }

        const contentHash = calculateContentHash([], llmParameters);

        console.log(`[DB Cache] Storing cache entry for hash ${contentHash.substring(0, 8)}... (${cachedTokens} tokens)`);

        // In real implementation, this would insert into database
        // For now, we'll simulate the storage
        await simulateDatabaseStore({
            messageId,
            conversationId,
            content,
            contentHash,
            model: llmParameters.modelName || 'unknown',
            temperature: llmParameters.temperature || 0.7,
            cachedTokens,
            hitCount: 0,
            createdAt: new Date(),
            lastAccessedAt: new Date(),
            metadata: {
                ...metadata,
                storedAt: new Date().toISOString(),
                llmParameters
            }
        });

        // Update metrics
        cacheMetrics.totalCachedTokens += cachedTokens;

        return true;

    } catch (error) {
        console.error('[DB Cache] Error storing cache entry:', error);
        return false;
    }
}

/**
 * Clean up old cache entries
 */
export async function cleanupExpiredCache(
    config: CacheConfig = globalCacheConfig
): Promise<{ deletedEntries: number; freedBytes: number }> {
    console.log('[DB Cache] Starting cache cleanup...');

    const cutoffTime = new Date(Date.now() - config.maxCacheAgeMs);

    // In real implementation, this would delete from database
    const result = await simulateDatabaseCleanup(cutoffTime, config.maxCacheSize);

    console.log(`[DB Cache] Cleanup completed: deleted ${result.deletedEntries} entries, freed ${Math.round(result.freedBytes / 1024)}KB`);

    return result;
}

/**
 * Get cache effectiveness statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
    return {
        totalCacheEntries: await getTotalCacheEntries(),
        hitRate: cacheMetrics.hitRate,
        avgResponseTime: cacheMetrics.avgLookupTimeMs
    };
}

/**
 * Get comprehensive cache metrics
 */
export function getCacheMetrics(): CacheMetrics {
    return { ...cacheMetrics };
}

/**
 * Reset cache metrics
 */
export function resetCacheMetrics(): void {
    cacheMetrics = {
        totalLookups: 0,
        cacheHits: 0,
        cacheMisses: 0,
        hitRate: 0,
        avgLookupTimeMs: 0,
        totalCachedTokens: 0,
        tokensSavedFromCache: 0,
        costSavingsUSD: 0
    };

    console.log('[DB Cache] Cache metrics reset');
}

/**
 * Generate cache performance report
 */
export async function generateCacheReport(
    timeRangeMs: number = 24 * 60 * 60 * 1000 // Last 24 hours
): Promise<string> {
    const metrics = getCacheMetrics();
    const stats = await getCacheStats();

    const costSavings = metrics.tokensSavedFromCache * (globalCacheConfig.tokenCostPerThousand / 1000);

    const report = `
# Database Cache Performance Report
Generated: ${new Date().toISOString()}

## Cache Statistics
- **Total Cache Entries**: ${stats.totalCacheEntries}
- **Hit Rate**: ${(metrics.hitRate * 100).toFixed(1)}%
- **Total Lookups**: ${metrics.totalLookups}
- **Cache Hits**: ${metrics.cacheHits}
- **Cache Misses**: ${metrics.cacheMisses}
- **Average Lookup Time**: ${metrics.avgLookupTimeMs.toFixed(2)}ms

## Token & Cost Savings
- **Total Cached Tokens**: ${metrics.totalCachedTokens.toLocaleString()}
- **Tokens Saved from Cache**: ${metrics.tokensSavedFromCache.toLocaleString()}
- **Estimated Cost Savings**: $${costSavings.toFixed(4)}

## Performance Insights
${metrics.hitRate > 0.8
            ? '✅ Excellent cache performance - high hit rate indicates effective caching strategy'
            : metrics.hitRate > 0.5
                ? '⚠️ Moderate cache performance - consider optimizing cache strategy or increasing cache size'
                : '❌ Poor cache performance - review caching configuration and usage patterns'
        }

## Recommendations
${generateCacheRecommendations(metrics, stats)}
    `.trim();

    return report;
}

// Helper functions

function createCacheMissResult(): CacheHitResult {
    return {
        found: false,
        cacheStats: {
            totalCacheEntries: 0,
            hitRate: cacheMetrics.hitRate,
            avgResponseTime: cacheMetrics.avgLookupTimeMs
        }
    };
}

async function updateCacheMetrics(isHit: boolean, lookupTimeMs: number, tokensFromCache: number): Promise<void> {
    if (!globalCacheConfig.enableMetricsTracking) {
        return;
    }

    cacheMetrics.totalLookups++;

    if (isHit) {
        cacheMetrics.cacheHits++;
        cacheMetrics.tokensSavedFromCache += tokensFromCache;
    } else {
        cacheMetrics.cacheMisses++;
    }

    // Update running averages
    cacheMetrics.hitRate = cacheMetrics.cacheHits / cacheMetrics.totalLookups;
    cacheMetrics.avgLookupTimeMs = (cacheMetrics.avgLookupTimeMs * (cacheMetrics.totalLookups - 1) + lookupTimeMs) / cacheMetrics.totalLookups;
    cacheMetrics.costSavingsUSD = cacheMetrics.tokensSavedFromCache * (globalCacheConfig.tokenCostPerThousand / 1000);
}

// Simulation functions (replace with real database queries in production)

async function simulateDatabaseLookup(contentHash: string, config: CacheConfig): Promise<CachedResponse | null> {
    // Simulate database query delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5));

    // For demonstration, return null (cache miss) most of the time
    if (Math.random() < 0.2) { // 20% cache hit rate for simulation
        return {
            messageId: `cached-msg-${Date.now()}`,
            conversationId: `cached-conv-${Date.now()}`,
            content: `[DB CACHE] Simulated cached response for hash ${contentHash.substring(0, 8)}...`,
            contentHash,
            model: 'gpt-4',
            temperature: 0.7,
            cachedTokens: Math.floor(Math.random() * 1000) + 100,
            hitCount: Math.floor(Math.random() * 10) + 1,
            createdAt: new Date(Date.now() - Math.random() * config.maxCacheAgeMs),
            lastAccessedAt: new Date(),
            metadata: { simulated: true }
        };
    }

    return null;
}

async function findSimilarCachedResponses(query: CacheQuery, config: CacheConfig): Promise<CachedResponse[]> {
    // Simulate finding similar responses
    await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 10));

    // Return empty array for now (no similar responses found)
    return [];
}

function calculateQuerySimilarity(query: CacheQuery, cachedResponse: CachedResponse): number {
    // Simple similarity calculation based on model and temperature
    let similarity = 0;

    if (query.model === cachedResponse.model) {
        similarity += 0.5;
    }

    if (query.temperature && Math.abs(query.temperature - cachedResponse.temperature) < 0.1) {
        similarity += 0.3;
    }

    // Add more sophisticated similarity logic here
    return Math.min(similarity, 1.0);
}

async function updateLastAccessTime(messageId: MessageId): Promise<void> {
    // In real implementation, update the last_accessed_at timestamp
    console.log(`[DB Cache] Updated last access time for message ${messageId}`);
}

async function simulateDatabaseStore(cachedResponse: CachedResponse): Promise<void> {
    // Simulate database insert delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 15 + 5));
    console.log(`[DB Cache] Stored cache entry for message ${cachedResponse.messageId}`);
}

async function simulateDatabaseCleanup(cutoffTime: Date, maxCacheSize: number): Promise<{ deletedEntries: number; freedBytes: number }> {
    // Simulate cleanup delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

    const deletedEntries = Math.floor(Math.random() * 20);
    const freedBytes = deletedEntries * 1024; // Assume 1KB per entry

    return { deletedEntries, freedBytes };
}

async function getTotalCacheEntries(): Promise<number> {
    // In real implementation, query database for count
    return Math.floor(Math.random() * 1000) + 100;
}

function generateCacheRecommendations(metrics: CacheMetrics, stats: CacheStats): string {
    const recommendations = [];

    if (metrics.hitRate < 0.3) {
        recommendations.push('- Consider increasing cache retention time to improve hit rates');
        recommendations.push('- Review cache key generation to ensure consistent hashing');
    }

    if (metrics.avgLookupTimeMs > 50) {
        recommendations.push('- Database cache lookups are slow - consider adding indexes or optimizing queries');
    }

    if (stats.totalCacheEntries > 5000) {
        recommendations.push('- Large cache size detected - consider implementing cache eviction policies');
    }

    if (metrics.tokensSavedFromCache < 1000) {
        recommendations.push('- Low token savings - ensure cache is being populated correctly');
    }

    if (recommendations.length === 0) {
        recommendations.push('- No specific recommendations - cache performance is optimal');
    }

    return recommendations.join('\n');
}

/**
 * Database-specific cache queries (for production implementation)
 */
export const DatabaseCacheQueries = {
    /**
     * Find cached message by content hash
     */
    async findByContentHash(contentHash: string): Promise<ConversationMessage | null> {
        // In production, implement SQL query:
        // SELECT * FROM conversation_messages WHERE content_hash = ? AND cache_hit = true
        console.log(`[DB Cache] Would query database for content_hash: ${contentHash}`);
        return null;
    },

    /**
     * Find similar cached messages
     */
    async findSimilarMessages(
        model: string,
        temperature: number,
        maxResults: number = 10
    ): Promise<ConversationMessage[]> {
        // In production, implement similarity query with fuzzy matching
        console.log(`[DB Cache] Would query similar messages for model: ${model}, temp: ${temperature}`);
        return [];
    },

    /**
     * Update cache hit count
     */
    async incrementHitCount(messageId: MessageId): Promise<void> {
        // In production, implement:
        // UPDATE conversation_messages SET cached_tokens = cached_tokens + 1 WHERE id = ?
        console.log(`[DB Cache] Would increment hit count for message: ${messageId}`);
    },

    /**
     * Clean up expired cache entries
     */
    async cleanupExpired(maxAgeMs: number): Promise<number> {
        // In production, implement:
        // DELETE FROM conversation_messages WHERE cache_hit = true AND created_at < NOW() - INTERVAL ? MILLISECOND
        console.log(`[DB Cache] Would cleanup entries older than ${maxAgeMs}ms`);
        return 0;
    }
}; 