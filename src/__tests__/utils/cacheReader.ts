import fs from 'fs/promises';
import path from 'path';

// Legacy cache chunk interface for backward compatibility with tests
export interface CachedStreamChunk {
    index: number;
    content: string;
    timestamp: string;
    type: 'text' | 'tool_call' | 'tool_result' | 'error';
    metadata?: Record<string, any>;
}

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
     * 
     * NOTE: This is a legacy method for testing compatibility.
     * The new system uses database-based caching through ConversationManager.
     */
    async getCachedResponse(cacheKey: string): Promise<CachedResponse | null> {
        try {
            const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
            const cacheData = await fs.readFile(cacheFile, 'utf-8');
            return JSON.parse(cacheData);
        } catch (error) {
            // File not found or invalid format
            return null;
        }
    }

    /**
     * List all available cache files
     */
    async listCacheFiles(): Promise<string[]> {
        try {
            const files = await fs.readdir(this.cacheDir);
            return files.filter(file => file.endsWith('.json'));
        } catch (error) {
            return [];
        }
    }

    /**
     * Get all cached responses for testing
     */
    async getAllCachedResponses(): Promise<Record<string, CachedResponse>> {
        const responses: Record<string, CachedResponse> = {};
        const files = await this.listCacheFiles();

        for (const file of files) {
            const cacheKey = file.replace('.json', '');
            const response = await this.getCachedResponse(cacheKey);
            if (response) {
                responses[cacheKey] = response;
            }
        }

        return responses;
    }

    /**
     * Get random cached response for testing
     */
    async getRandomCachedResponse(): Promise<CachedResponse | null> {
        const files = await this.listCacheFiles();
        if (files.length === 0) {
            return null;
        }

        const randomFile = files[Math.floor(Math.random() * files.length)];
        const cacheKey = randomFile.replace('.json', '');
        return this.getCachedResponse(cacheKey);
    }

    /**
     * Create mock cached response for testing
     */
    static createMockCachedResponse(cacheKey: string, content: string): CachedResponse {
        return {
            metadata: {
                cacheKey,
                createdAt: new Date().toISOString(),
                totalChunks: 1,
                finalResult: content
            },
            chunks: [
                {
                    index: 0,
                    content,
                    timestamp: new Date().toISOString(),
                    type: 'text',
                    metadata: { mock: true }
                }
            ]
        };
    }

    /**
     * Check if cache directory exists and is accessible
     */
    async checkCacheDirectory(): Promise<boolean> {
        try {
            await fs.access(this.cacheDir);
            return true;
        } catch {
            return false;
        }
    }
} 