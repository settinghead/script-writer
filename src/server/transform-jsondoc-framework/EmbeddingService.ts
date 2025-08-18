import { embed, embedMany } from 'ai';
import { createHash } from 'crypto';
import { getEmbeddingCredentials, getEmbeddingModel } from './LLMConfig';
import { db } from '../database/connection';

export interface EmbeddingResult {
    embedding: number[];
    usage?: {
        tokens: number;
    };
}

export interface EmbeddingCredentials {
    apiKey: string;
    baseUrl: string;
    modelName: string;
    provider: string;
    dimensions: number;
}


export class EmbeddingService {
    private model: Promise<any>;
    private credentials: EmbeddingCredentials;

    constructor() {
        this.credentials = getEmbeddingCredentials();
        this.model = getEmbeddingModel({
            modelName: this.credentials.modelName,
            apiKey: this.credentials.apiKey,
            baseUrl: this.credentials.baseUrl,
            provider: this.credentials.provider
        });
    }



    /**
     * Generate embedding for a single text
     */
    async generateEmbedding(text: string, options: { cache?: boolean } = {}): Promise<number[]> {
        const { cache = true } = options;

        try {
            // Generate content hash for caching
            const contentHash = this.generateContentHash(text);

            // Try to get from cache if caching is enabled
            if (cache) {
                const cachedEmbedding = await this.getCachedEmbedding(contentHash);
                if (cachedEmbedding) {
                    // Update access statistics
                    await this.updateCacheAccess(contentHash);
                    return cachedEmbedding;
                }
            }

            // Generate new embedding
            const model = await this.model;
            const result = await embed({
                model: model,
                value: text
            });

            // Cache the result if caching is enabled
            if (cache) {
                await this.cacheEmbedding(contentHash, text, result.embedding);
            }

            return result.embedding;
        } catch (error) {
            console.error('Failed to generate embedding:', error);
            throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generate embeddings for multiple texts using batch API (cost-optimized)
     */
    async generateEmbeddingsBatch(texts: string[], options: { cache?: boolean } = {}): Promise<EmbeddingResult[]> {
        const { cache = true } = options;

        try {
            // Check cache for all texts first
            const cacheResults: Array<{ embedding: number[] | null; hash: string }> = [];
            const uncachedTexts: string[] = [];
            const uncachedIndices: number[] = [];

            if (cache) {
                for (let i = 0; i < texts.length; i++) {
                    const text = texts[i];
                    const contentHash = this.generateContentHash(text);
                    const cachedEmbedding = await this.getCachedEmbedding(contentHash);

                    cacheResults.push({ embedding: cachedEmbedding, hash: contentHash });

                    if (!cachedEmbedding) {
                        uncachedTexts.push(text);
                        uncachedIndices.push(i);
                    } else {
                        // Update access statistics for cached items
                        await this.updateCacheAccess(contentHash);
                    }
                }
            } else {
                // If caching is disabled, all texts need to be processed
                for (let i = 0; i < texts.length; i++) {
                    const text = texts[i];
                    const contentHash = this.generateContentHash(text);
                    cacheResults.push({ embedding: null, hash: contentHash });
                    uncachedTexts.push(text);
                    uncachedIndices.push(i);
                }
            }

            // Generate embeddings for uncached texts
            let batchEmbeddings: number[][] = [];
            if (uncachedTexts.length > 0) {
                const model = await this.model;

                // Use batch API only if we have between 2 and 10 texts, otherwise use individual calls
                if (uncachedTexts.length >= 2 && uncachedTexts.length <= 10) {
                    const result = await embedMany({
                        model: model,
                        values: uncachedTexts
                    });
                    batchEmbeddings = result.embeddings;
                } else if (uncachedTexts.length === 1) {
                    // Use individual embedding call for single text
                    const result = await embed({
                        model: model,
                        value: uncachedTexts[0]
                    });
                    batchEmbeddings = [result.embedding];
                } else {
                    // Use individual embedding calls for other cases
                    batchEmbeddings = [];
                    for (const text of uncachedTexts) {
                        const result = await embed({
                            model: model,
                            value: text
                        });
                        batchEmbeddings.push(result.embedding);
                    }
                }

                // Cache the new embeddings if caching is enabled
                if (cache) {
                    for (let i = 0; i < uncachedTexts.length; i++) {
                        const text = uncachedTexts[i];
                        const embedding = batchEmbeddings[i];
                        const originalIndex = uncachedIndices[i];
                        const contentHash = cacheResults[originalIndex].hash;

                        await this.cacheEmbedding(contentHash, text, embedding);
                    }
                }
            }

            // Combine cached and newly generated embeddings in correct order
            const results: EmbeddingResult[] = [];
            let batchIndex = 0;

            for (let i = 0; i < texts.length; i++) {
                const cached = cacheResults[i];
                let embedding: number[];

                if (cached.embedding) {
                    embedding = cached.embedding;
                } else {
                    embedding = batchEmbeddings[batchIndex++];
                    if (!embedding) {
                        throw new Error(`Missing embedding at batch index ${batchIndex - 1} for text ${i}`);
                    }
                }

                results.push({
                    embedding,
                    usage: { tokens: texts[i].length } // Rough approximation
                });
            }

            return results;
        } catch (error) {
            console.error('Failed to generate batch embeddings:', error);
            throw new Error(`Batch embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generate embeddings for multiple texts in batch (backward compatible)
     */
    async generateEmbeddings(texts: string[], options: { cache?: boolean } = {}): Promise<EmbeddingResult[]> {
        // Use the new batch method for better performance and cost efficiency
        return this.generateEmbeddingsBatch(texts, options);
    }

    /**
     * Calculate cosine similarity between two embeddings
     */
    calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
        if (embedding1.length !== embedding2.length) {
            throw new Error('Embeddings must have the same length');
        }

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }

    /**
     * Convert embedding array to PostgreSQL vector format
     */
    embeddingToVector(embedding: number[]): string {
        return `[${embedding.join(',')}]`;
    }

    /**
     * Convert PostgreSQL vector format back to embedding array
     */
    vectorToEmbedding(vector: string): number[] {
        // Remove brackets and split by comma
        const cleaned = vector.replace(/^\[|\]$/g, '');
        return cleaned.split(',').map(Number);
    }

    /**
     * Validate embedding dimensions
     */
    validateEmbedding(embedding: number[]): boolean {
        const expectedDimensions = this.credentials.dimensions;
        return embedding.length === expectedDimensions && embedding.every(val => typeof val === 'number' && !isNaN(val));
    }

    /**
     * Get expected embedding dimensions for this service
     */
    getEmbeddingDimensions(): number {
        return this.credentials.dimensions || 1536;
    }

    /**
     * Generate SHA-256 hash for content caching
     */
    private generateContentHash(text: string): string {
        return createHash('sha256').update(text).digest('hex');
    }

    /**
     * Get cached embedding from database
     */
    private async getCachedEmbedding(contentHash: string): Promise<number[] | null> {
        try {
            const result = await db
                .selectFrom('embedding_cache')
                .select('embedding')
                .where('content_hash', '=', contentHash)
                .where('model_name', '=', this.credentials.modelName)
                .where('provider', '=', this.credentials.provider)
                .executeTakeFirst();

            if (result) {
                return this.vectorToEmbedding(result.embedding);
            }
            return null;
        } catch (error) {
            console.error('Failed to get cached embedding:', error);
            return null; // Fail gracefully, generate new embedding
        }
    }

    /**
     * Cache embedding in database
     */
    private async cacheEmbedding(contentHash: string, text: string, embedding: number[]): Promise<void> {
        try {
            await db
                .insertInto('embedding_cache')
                .values({
                    content_hash: contentHash,
                    content_text: text,
                    embedding: this.embeddingToVector(embedding),
                    model_name: this.credentials.modelName,
                    provider: this.credentials.provider,
                    dimensions: embedding.length,
                })
                .onConflict((oc) => oc
                    .column('content_hash')
                    .doUpdateSet((eb) => ({
                        accessed_at: new Date(),
                        access_count: eb('embedding_cache.access_count', '+', 1)
                    }))
                )
                .execute();
        } catch (error) {
            console.error('Failed to cache embedding:', error);
            // Don't throw - caching failure shouldn't break embedding generation
        }
    }

    /**
     * Update cache access statistics
     */
    private async updateCacheAccess(contentHash: string): Promise<void> {
        try {
            await db
                .updateTable('embedding_cache')
                .set((eb) => ({
                    accessed_at: new Date(),
                    access_count: eb('embedding_cache.access_count', '+', 1)
                }))
                .where('content_hash', '=', contentHash)
                .execute();
        } catch (error) {
            console.error('Failed to update cache access:', error);
        }
    }
} 