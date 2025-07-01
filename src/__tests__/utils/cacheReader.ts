import fs from 'fs/promises';
import path from 'path';
import { CachedStreamChunk } from '../../server/transform-artifact-framework/StreamCache';

export interface CachedResponse {
    metadata: {
        cacheKey: string;
        createdAt: string;
        totalChunks: number;
        finalResult?: any;
    };
    chunks: CachedStreamChunk[];
}

export class CacheReader {
    private cacheDir: string;

    constructor(cacheDir: string = './cache/llm-streams') {
        this.cacheDir = cacheDir;
    }

    /**
     * Read cached response by cache key
     */
    async getCachedResponse(cacheKey: string): Promise<CachedResponse | null> {
        try {
            const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
            const cacheData = await fs.readFile(cacheFile, 'utf-8');
            return JSON.parse(cacheData);
        } catch (error) {
            return null;
        }
    }

    /**
     * List all available cache files
     */
    async listCacheFiles(): Promise<string[]> {
        try {
            const files = await fs.readdir(this.cacheDir);
            return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
        } catch (error) {
            return [];
        }
    }

    /**
     * Find cache entries by pattern (for test data discovery)
     */
    async findCachesByPattern(pattern: RegExp): Promise<CachedResponse[]> {
        const files = await this.listCacheFiles();
        const matches: CachedResponse[] = [];

        for (const file of files) {
            const response = await this.getCachedResponse(file);
            if (response && pattern.test(JSON.stringify(response.metadata))) {
                matches.push(response);
            }
        }

        return matches;
    }

    /**
     * Get random cached response (for test data)
     */
    async getRandomCachedResponse(): Promise<CachedResponse | null> {
        const files = await this.listCacheFiles();
        if (files.length === 0) return null;

        const randomFile = files[Math.floor(Math.random() * files.length)];
        return this.getCachedResponse(randomFile);
    }
} 