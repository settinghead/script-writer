export class StreamingCache {
    private static instance: StreamingCache;
    private cache = new Map<string, {
        chunks: string[];
        isComplete: boolean;
        results: any[];
    }>();

    private constructor() { }

    static getInstance(): StreamingCache {
        if (!StreamingCache.instance) {
            StreamingCache.instance = new StreamingCache();
        }
        return StreamingCache.instance;
    }

    initializeTransform(transformId: string): void {
        if (!this.cache.has(transformId)) {
            this.cache.set(transformId, {
                chunks: [],
                isComplete: false,
                results: []
            });
        }
    }

    addChunk(transformId: string, chunk: string): void {
        const data = this.cache.get(transformId);
        if (data) {
            data.chunks.push(chunk);
        }
    }

    getChunks(transformId: string): string[] {
        const data = this.cache.get(transformId);
        return data ? data.chunks : [];
    }

    setResults(transformId: string, results: any[]): void {
        const data = this.cache.get(transformId);
        if (data) {
            data.results = results;
        }
    }

    getResults(transformId: string): any[] {
        const data = this.cache.get(transformId);
        return data ? data.results : [];
    }

    markComplete(transformId: string): void {
        const data = this.cache.get(transformId);
        if (data) {
            data.isComplete = true;
        }
    }

    isComplete(transformId: string): boolean {
        const data = this.cache.get(transformId);
        return data ? data.isComplete : false;
    }

    clear(transformId: string): void {
        this.cache.delete(transformId);
    }

    // Get accumulated content from chunks
    getAccumulatedContent(transformId: string): string {
        const chunks = this.getChunks(transformId);
        return chunks
            .map(chunk => {
                // Extract text from streaming format "0:..."
                if (chunk.startsWith('0:')) {
                    try {
                        return JSON.parse(chunk.substring(2));
                    } catch {
                        return '';
                    }
                }
                return '';
            })
            .join('');
    }
} 