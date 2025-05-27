interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

export class CacheService {
    private cache = new Map<string, CacheEntry<any>>();
    private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

    // Set cache entry
    set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });

        // Clean up expired entries periodically
        if (this.cache.size % 100 === 0) {
            this.cleanup();
        }
    }

    // Get cache entry
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    // Remove cache entry
    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    // Clear all cache
    clear(): void {
        this.cache.clear();
    }

    // Clean up expired entries
    cleanup(): void {
        const now = Date.now();
        const keysToDelete: string[] = [];

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));
    }

    // Get cache statistics
    getStats(): any {
        const now = Date.now();
        let validEntries = 0;
        let expiredEntries = 0;

        for (const entry of this.cache.values()) {
            if (now - entry.timestamp > entry.ttl) {
                expiredEntries++;
            } else {
                validEntries++;
            }
        }

        return {
            total_entries: this.cache.size,
            valid_entries: validEntries,
            expired_entries: expiredEntries,
            memory_usage_estimate: this.cache.size * 1024 // Rough estimate
        };
    }

    // Cache key generators for common patterns
    static userArtifactsKey(userId: string, type?: string): string {
        return `user:${userId}:artifacts${type ? `:${type}` : ''}`;
    }

    static userTransformsKey(userId: string): string {
        return `user:${userId}:transforms`;
    }

    static ideationRunKey(userId: string, sessionId: string): string {
        return `ideation:${userId}:${sessionId}`;
    }

    static transformDetailsKey(transformId: string): string {
        return `transform:${transformId}:details`;
    }
} 