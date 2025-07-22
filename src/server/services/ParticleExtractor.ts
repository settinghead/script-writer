import { EmbeddingService } from './EmbeddingService';
import { TypedJsondoc } from '../../common/jsondocs.js';
import { dump } from 'js-yaml';
import { createHash } from 'crypto';
import { JSONPath } from 'jsonpath-plus';
import { getParticlePathsForSchemaType, ParticlePathDefinition } from './particleRegistry';

export interface ParticleData {
    id: string;
    path: string;
    type: string;
    title: string;
    content: any;
    content_text: string;
    content_hash: string;
    embedding: number[];
}

/**
 * Extract particles from jsondocs using JSONPath-based registry
 */
export class ParticleExtractor {
    private embeddingContentExtractors: Map<string, EmbeddingContentExtractor> = new Map();

    constructor(private embeddingService: EmbeddingService) {
        this.registerEmbeddingContentExtractors();
    }

    private registerEmbeddingContentExtractors() {
        // Keep this method for future extensibility, but start with no special cases
        // The default YAML format with metadata context should handle most cases well
    }

    /**
     * Extract particles from a jsondoc using registry-based JSONPath queries
     */
    async extractParticles(jsondoc: TypedJsondoc): Promise<ParticleData[]> {
        const pathDefinitions = getParticlePathsForSchemaType(jsondoc.schema_type);
        if (pathDefinitions.length === 0) {
            return [];
        }

        const particles: ParticleData[] = [];
        const seenIds = new Set<string>(); // Deduplication

        // First pass: collect all particle data without embeddings
        const particleDataList: Array<{
            id: string;
            path: string;
            type: string;
            title: string;
            content: any;
            content_text: string;
            content_hash: string;
        }> = [];

        for (const definition of pathDefinitions) {
            try {
                const matches = JSONPath({
                    path: definition.path,
                    json: jsondoc.data,
                    resultType: 'all'
                });

                for (let i = 0; i < matches.length; i++) {
                    const match = matches[i];
                    const content = match.value;
                    const actualPath = this.normalizeJsonPath(match.path);

                    // Skip null/undefined content
                    if (content === null || content === undefined) {
                        continue;
                    }

                    // Generate title
                    const title = this.extractTitle(content, definition, i);

                    // Generate embedding content
                    const contentText = this.generateEmbeddingContent(
                        definition.type,
                        content,
                        jsondoc,
                        actualPath
                    );

                    if (!contentText.trim()) {
                        continue; // Skip empty content
                    }

                    // Generate stable ID
                    const particleId = this.generateParticleId(jsondoc, actualPath, definition.type, content);

                    // Skip duplicates
                    if (seenIds.has(particleId)) {
                        continue;
                    }
                    seenIds.add(particleId);

                    // Generate content hash
                    const contentHash = this.generateContentHash(content, contentText);

                    particleDataList.push({
                        id: particleId,
                        path: actualPath,
                        type: definition.type,
                        title,
                        content,
                        content_text: contentText,
                        content_hash: contentHash
                    });
                }
            } catch (error) {
                console.error(`[ParticleExtractor] Failed to process path ${definition.path} for schema ${jsondoc.schema_type}:`, error);
                // Continue with other paths
            }
        }

        // Second pass: generate all embeddings in batch for cost optimization
        if (particleDataList.length > 0) {
            const contentTexts = particleDataList.map(p => p.content_text);
            const embeddingResults = await this.embeddingService.generateEmbeddingsBatch(contentTexts);

            // Combine particle data with embeddings
            for (let i = 0; i < particleDataList.length; i++) {
                const particleData = particleDataList[i];
                const embeddingResult = embeddingResults[i];

                particles.push({
                    ...particleData,
                    embedding: embeddingResult.embedding
                });
            }
        }

        return particles;
    }

    /**
     * Extract title from content using definition
     */
    private extractTitle(content: any, definition: ParticlePathDefinition, index: number): string {
        // Try to extract title using titlePath
        if (definition.titlePath && content && typeof content === 'object') {
            try {
                const titleMatches = JSONPath({
                    path: definition.titlePath,
                    json: content,
                    wrap: false
                });

                if (titleMatches && typeof titleMatches === 'string' && titleMatches.trim()) {
                    return titleMatches.trim();
                }
            } catch (error) {
                // Fallback to default
            }
        }

        // For string content, use truncated version as title
        if (typeof content === 'string') {
            const truncated = content.length > 20 ? content.substring(0, 20) + '...' : content;
            return truncated || definition.titleDefault || `${definition.type} ${index + 1}`;
        }

        // Use default title with index
        return definition.titleDefault ? `${definition.titleDefault} ${index + 1}` : `${definition.type} ${index + 1}`;
    }

    /**
     * Normalize JSONPath format for consistency
     */
    private normalizeJsonPath(path: string | string[]): string {
        if (Array.isArray(path)) {
            // Convert array path to string format
            let result = '$';
            for (let i = 1; i < path.length; i++) {
                const segment = path[i];
                if (typeof segment === 'number') {
                    result += `[${segment}]`;
                } else {
                    result += `['${segment}']`;
                }
            }
            return result;
        }
        return path;
    }

    /**
     * Generate embedding content for a particle.
     * Uses custom extractor if available, otherwise defaults to YAML format.
     * Includes metadata context for better search relevance.
     */
    private generateEmbeddingContent(particleType: string, content: any, jsondoc: TypedJsondoc, particlePath?: string): string {
        // Generate the base content using custom extractor or YAML
        let baseContent: string;
        const customExtractor = this.embeddingContentExtractors.get(particleType);
        if (customExtractor) {
            baseContent = customExtractor(content, jsondoc);
        } else {
            // Default: use YAML format for the underlying content
            try {
                baseContent = dump(content, {
                    indent: 2,
                    lineWidth: 120,
                    noRefs: true,
                    sortKeys: false
                }).trim();
            } catch (error) {
                console.warn(`Failed to format content as YAML for particle type ${particleType}, falling back to JSON:`, error);
                baseContent = JSON.stringify(content, null, 2);
            }
        }

        // Build minimal metadata context: [schema_type], [comma-separated-path-components]
        let contextPrefix = '';

        if (jsondoc.schema_type) {
            contextPrefix = jsondoc.schema_type;
        }

        // Extract path components from particlePath (e.g., "$.characters[7]" -> "characters, 7")
        if (particlePath && particlePath !== '$') {
            const pathComponents: string[] = [];

            // Parse JSONPath to extract meaningful components
            const pathMatch = particlePath.match(/^\$\.(.+)$/);
            if (pathMatch) {
                const pathPart = pathMatch[1];
                // Split by dots and extract array indices
                const parts = pathPart.split('.');
                for (const part of parts) {
                    const arrayMatch = part.match(/^([^[]+)\[(\d+)\]$/);
                    if (arrayMatch) {
                        pathComponents.push(arrayMatch[1], arrayMatch[2]);
                    } else {
                        pathComponents.push(part);
                    }
                }
            }

            if (pathComponents.length > 0) {
                contextPrefix += ', ' + pathComponents.join(', ');
            }
        }

        // Combine context and content
        if (contextPrefix) {
            return `${contextPrefix}\n\n${baseContent}`;
        } else {
            return baseContent;
        }
    }

    /**
     * Generate a deterministic hash-based ID for a particle
     * Uses only stable identifiers (jsondoc_id + path + type) to ensure particles 
     * are unique by (jsondoc, path) and don't change when content is updated
     */
    private generateParticleId(jsondoc: TypedJsondoc, path: string, type: string, content: any): string {
        // Use only stable identifiers that don't change when content is updated
        const stableInput = `${jsondoc.id}|${path}|${type}`;

        // Create a deterministic hash from the stable input
        const hash = createHash('sha256').update(stableInput).digest('hex');
        const particleId = hash.substring(0, 16); // Use first 16 chars for readability

        return particleId;
    }

    /**
     * Generate a content hash for a particle
     */
    private generateContentHash(content: any, content_text: string): string {
        const input = JSON.stringify(content) + '|' + content_text;
        return createHash('sha256').update(input).digest('hex');
    }
}

type EmbeddingContentExtractor = (content: any, jsondoc: TypedJsondoc) => string; 