export class StreamingCache {
    private static instance: StreamingCache;
    private cache = new Map<string, {
        chunks: string[];
        isComplete: boolean;
        results: any[];
        createdAt: number;
    }>();
    
    // Track active streaming jobs to prevent concurrent executions
    private activeStreams = new Set<string>();
    
    // Cache expiry time: 1 hour
    private readonly CACHE_TTL = 60 * 60 * 1000;

    private constructor() {
        // Auto-cleanup expired entries every 10 minutes
        setInterval(() => {
            this.cleanupExpired();
        }, 10 * 60 * 1000);
    }

    static getInstance(): StreamingCache {
        if (!StreamingCache.instance) {
            StreamingCache.instance = new StreamingCache();
        }
        return StreamingCache.instance;
    }

    initializeTransform(transformId: string): void {
        // Check if streaming is already active - don't interfere with running jobs
        if (this.isStreamingActive(transformId)) {
            console.log(`[StreamingCache] Streaming already active for transform ${transformId}, skipping initialization`);
            return;
        }
        
        // Always clear existing cache for this transform to prevent contamination
        this.clear(transformId);
        
        this.cache.set(transformId, {
            chunks: [],
            isComplete: false,
            results: [],
            createdAt: Date.now()
        });
        
        console.log(`[StreamingCache] Initialized clean cache for transform ${transformId}`);
    }

    addChunk(transformId: string, chunk: string): void {
        const data = this.cache.get(transformId);
        if (data) {
            data.chunks.push(chunk);
        }
    }

    getChunks(transformId: string): string[] {
        const data = this.cache.get(transformId);
        if (!data) {
            console.log(`[StreamingCache] No cache found for transform ${transformId}`);
            return [];
        }
        
        // Check if cache is expired
        if (Date.now() - data.createdAt > this.CACHE_TTL) {
            console.log(`[StreamingCache] Cache expired for transform ${transformId}, clearing...`);
            this.clear(transformId);
            return [];
        }
        
        console.log(`[StreamingCache] Retrieved ${data.chunks.length} chunks for transform ${transformId}`);
        return data.chunks;
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
        // Also clear streaming state
        this.activeStreams.delete(transformId);
    }

    // Streaming activity tracking methods
    markStreamingActive(transformId: string): void {
        this.activeStreams.add(transformId);
        console.log(`[StreamingCache] Marked streaming as active for transform ${transformId}`);
    }

    markStreamingInactive(transformId: string): void {
        this.activeStreams.delete(transformId);
        console.log(`[StreamingCache] Marked streaming as inactive for transform ${transformId}`);
    }

    isStreamingActive(transformId: string): boolean {
        return this.activeStreams.has(transformId);
    }

    // Get accumulated content from chunks
    getAccumulatedContent(transformId: string): string {
        const chunks = this.getChunks(transformId);
        const content = chunks
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

        console.log(`[StreamingCache] Raw accumulated content for ${transformId} (length: ${content.length}):`, 
            content.substring(0, 200) + (content.length > 200 ? '...' : ''));

        // Try to ensure the content is valid JSON for parsing
        if (content.trim()) {
            // If content doesn't start with '{', try to find the beginning of a JSON object
            let cleanContent = content.trim();
            
            // Find the first '{' to start from a valid JSON object
            const jsonStart = cleanContent.indexOf('{');
            if (jsonStart > 0) {
                console.log(`[StreamingCache] Trimming content from position ${jsonStart} to start with JSON object`);
                cleanContent = cleanContent.substring(jsonStart);
            }
            
            // If content doesn't end with '}', try to make it parseable
            if (!cleanContent.endsWith('}')) {
                console.log(`[StreamingCache] Content doesn't end with '}', attempting to close JSON structure`);
                
                // Try to close unclosed structures for partial parsing
                // Count open/close braces to determine if we need to close
                let openBraces = 0;
                let openBrackets = 0;
                let inString = false;
                let escapeNext = false;
                
                for (let i = 0; i < cleanContent.length; i++) {
                    const char = cleanContent[i];
                    
                    if (escapeNext) {
                        escapeNext = false;
                        continue;
                    }
                    
                    if (char === '\\') {
                        escapeNext = true;
                        continue;
                    }
                    
                    if (char === '"') {
                        inString = !inString;
                        continue;
                    }
                    
                    if (!inString) {
                        if (char === '{') openBraces++;
                        else if (char === '}') openBraces--;
                        else if (char === '[') openBrackets++;
                        else if (char === ']') openBrackets--;
                    }
                }
                
                // Close unclosed structures
                while (openBrackets > 0) {
                    cleanContent += ']';
                    openBrackets--;
                }
                while (openBraces > 0) {
                    cleanContent += '}';
                    openBraces--;
                }
                
                console.log(`[StreamingCache] Added ${openBrackets} closing brackets and ${openBraces} closing braces`);
            }
            
            console.log(`[StreamingCache] Final cleaned content for ${transformId} (length: ${cleanContent.length}):`, 
                cleanContent.substring(0, 200) + (cleanContent.length > 200 ? '...' : ''));
            
            return cleanContent;
        }
        
        return content;
    }

    // Cleanup expired cache entries
    private cleanupExpired(): void {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [transformId, data] of this.cache.entries()) {
            if (now - data.createdAt > this.CACHE_TTL) {
                this.cache.delete(transformId);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`[StreamingCache] Cleaned up ${cleanedCount} expired cache entries`);
        }
    }
} 