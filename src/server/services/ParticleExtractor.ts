import { EmbeddingService } from './EmbeddingService';
import { TypedJsondoc } from '../../common/jsondocs.js';
import { dump } from 'js-yaml';
import { createHash } from 'crypto';

export interface ParticleData {
    id: string;
    path: string;
    type: string;
    title: string;
    content: any;
    content_text: string;
    content_hash: string; // New field
    embedding: number[];
}

type ParticleExtractorFunction = (jsondoc: TypedJsondoc) => Promise<ParticleData[]>;
type EmbeddingContentExtractor = (content: any, jsondoc: TypedJsondoc) => string;

/**
 * Extract particles from jsondocs based on schema type
 */
export class ParticleExtractor {
    private extractors: Map<string, ParticleExtractorFunction> = new Map();
    private embeddingContentExtractors: Map<string, EmbeddingContentExtractor> = new Map();

    constructor(private embeddingService: EmbeddingService) {
        this.registerExtractors();
        this.registerEmbeddingContentExtractors();
    }

    private registerExtractors() {
        this.extractors.set('brainstorm_collection', this.extractBrainstormParticles.bind(this));
        this.extractors.set('brainstorm_input_params', this.extractBrainstormInputParticles.bind(this));
        this.extractors.set('剧本设定', this.extractOutlineParticles.bind(this));
        this.extractors.set('chronicles', this.extractChroniclesParticles.bind(this));
        this.extractors.set('brainstorm_idea', this.extractBrainstormIdeaParticles.bind(this));
        this.extractors.set('episode_planning', this.extractEpisodePlanningParticles.bind(this));
        this.extractors.set('episode_synopsis', this.extractEpisodeSynopsisParticles.bind(this));
    }

    private registerEmbeddingContentExtractors() {
        // Keep this method for future extensibility, but start with no special cases
        // The default YAML format with metadata context should handle most cases well
    }

    async extractParticles(jsondoc: TypedJsondoc): Promise<ParticleData[]> {
        const extractor = this.extractors.get(jsondoc.schema_type);
        if (!extractor) {
            console.log(`No particle extractor found for schema type: ${jsondoc.schema_type}`);
            return [];
        }

        return await extractor(jsondoc);
    }

    /**
     * Generate embedding content for a particle.
     * Uses custom extractor if available, otherwise defaults to YAML format.
     * NEW: Includes metadata context for better search relevance.
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
            // Examples: 
            // "$.characters[0]" -> "characters, 0"
            // "$.selling_points[1]" -> "selling_points, 1" 
            // "$.setting.key_scenes[2]" -> "setting, key_scenes, 2"
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

    private async extractBrainstormParticles(jsondoc: TypedJsondoc): Promise<ParticleData[]> {
        const data = jsondoc.data as any; // Use any for flexible access to data properties
        const particles: ParticleData[] = [];

        if (data.ideas && Array.isArray(data.ideas)) {
            for (let i = 0; i < data.ideas.length; i++) {
                const idea = data.ideas[i];
                if (!idea.title && !idea.body) continue; // Skip empty ideas

                const title = idea.title || `创意 ${i + 1}`;
                const content = { title: idea.title, body: idea.body };
                const contentText = this.generateEmbeddingContent('idea', content, jsondoc, `$.ideas[${i}]`);

                if (contentText) {
                    const embedding = await this.embeddingService.generateEmbedding(contentText);

                    particles.push({
                        id: this.generateParticleId(jsondoc, `$.ideas[${i}]`, '创意', content),
                        path: `$.ideas[${i}]`,
                        type: '创意',
                        title,
                        content,
                        content_text: contentText,
                        content_hash: this.generateContentHash(idea, contentText), // Add content hash
                        embedding
                    });
                }
            }
        }

        return particles;
    }

    private async extractBrainstormInputParticles(jsondoc: TypedJsondoc): Promise<ParticleData[]> {
        const data = jsondoc.data as any;
        const particles: ParticleData[] = [];

        // Create a single particle from the brainstorm input parameters
        const platform = data.platform || '';
        const genre = data.genre || '';

        // Build meaningful title
        const title = `头脑风暴参数: ${platform}${genre ? ` - ${genre}` : ''}`;

        // Generate embedding content using the registered extractor or default YAML
        const contentText = this.generateEmbeddingContent('brainstorm_input_params', data, jsondoc, '$');

        if (contentText.trim()) {
            const embedding = await this.embeddingService.generateEmbedding(contentText);

            particles.push({
                id: this.generateParticleId(jsondoc, '$', '头脑风暴参数', data),
                path: '$',
                type: '头脑风暴参数',
                title,
                content: data,
                content_text: contentText,
                content_hash: this.generateContentHash(data, contentText), // Add content hash
                embedding
            });
        }

        return particles;
    }

    private async extractBrainstormIdeaParticles(jsondoc: TypedJsondoc): Promise<ParticleData[]> {
        const data = jsondoc.data as any; // Use any for flexible access to data properties
        const particles: ParticleData[] = [];

        // Extract single brainstorm idea
        if (data.title || data.body) {
            const title = data.title || '创意';
            const content = { title: data.title, body: data.body };
            const contentText = this.generateEmbeddingContent('idea', content, jsondoc, '$');

            if (contentText) {
                const embedding = await this.embeddingService.generateEmbedding(contentText);

                particles.push({
                    id: this.generateParticleId(jsondoc, '$', '创意', content),
                    path: '$',
                    type: '创意',
                    title,
                    content,
                    content_text: contentText,
                    content_hash: this.generateContentHash(content, contentText), // Add content hash
                    embedding
                });
            }
        }

        return particles;
    }

    private async extractOutlineParticles(jsondoc: TypedJsondoc): Promise<ParticleData[]> {
        const data = jsondoc.data as any; // Use any for flexible access to data properties
        const particles: ParticleData[] = [];

        // Extract characters
        if (data.characters && Array.isArray(data.characters)) {
            for (let i = 0; i < data.characters.length; i++) {
                const character = data.characters[i];
                if (!character.name && !character.description) continue;

                const title = character.name || `角色 ${i + 1}`;
                const contentText = this.generateEmbeddingContent('character', character, jsondoc, `$.characters[${i}]`);

                if (contentText) {
                    const embedding = await this.embeddingService.generateEmbedding(contentText);

                    particles.push({
                        id: this.generateParticleId(jsondoc, `$.characters[${i}]`, '人物', character),
                        path: `$.characters[${i}]`,
                        type: '人物',
                        title,
                        content: character,
                        content_text: contentText,
                        content_hash: this.generateContentHash(character, contentText), // Add content hash
                        embedding
                    });
                }
            }
        }

        // Extract selling points
        if (data.selling_points && Array.isArray(data.selling_points)) {
            for (let i = 0; i < data.selling_points.length; i++) {
                const point = data.selling_points[i];
                if (!point || typeof point !== 'string') continue;

                const title = point.length > 20 ? point.substring(0, 20) + '...' : point;
                const content = { text: point };
                const contentText = this.generateEmbeddingContent('selling_point', content, jsondoc, `$.selling_points[${i}]`);

                particles.push({
                    id: this.generateParticleId(jsondoc, `$.selling_points[${i}]`, '卖点', content),
                    path: `$.selling_points[${i}]`,
                    type: '卖点',
                    title,
                    content,
                    content_text: contentText,
                    content_hash: this.generateContentHash(content, contentText), // Add content hash
                    embedding: await this.embeddingService.generateEmbedding(contentText)
                });
            }
        }

        // Extract satisfaction points
        if (data.satisfaction_points && Array.isArray(data.satisfaction_points)) {
            for (let i = 0; i < data.satisfaction_points.length; i++) {
                const point = data.satisfaction_points[i];
                if (!point || typeof point !== 'string') continue;

                const title = point.length > 20 ? point.substring(0, 20) + '...' : point;
                const content = { text: point };
                const contentText = this.generateEmbeddingContent('satisfaction_point', content, jsondoc, `$.satisfaction_points[${i}]`);

                particles.push({
                    id: this.generateParticleId(jsondoc, `$.satisfaction_points[${i}]`, '爽点', content),
                    path: `$.satisfaction_points[${i}]`,
                    type: '爽点',
                    title,
                    content,
                    content_text: contentText,
                    content_hash: this.generateContentHash(content, contentText), // Add content hash
                    embedding: await this.embeddingService.generateEmbedding(contentText)
                });
            }
        }

        // Extract key scenes from setting.key_scenes
        if (data.setting && data.setting.key_scenes && Array.isArray(data.setting.key_scenes)) {
            for (let i = 0; i < data.setting.key_scenes.length; i++) {
                const scene = data.setting.key_scenes[i];
                if (!scene || typeof scene !== 'string') continue;

                const title = scene.length > 20 ? scene.substring(0, 20) + '...' : scene;
                const content = { text: scene };
                const contentText = this.generateEmbeddingContent('scene', content, jsondoc, `$.setting.key_scenes[${i}]`);
                const embedding = await this.embeddingService.generateEmbedding(contentText);

                particles.push({
                    id: this.generateParticleId(jsondoc, `$.setting.key_scenes[${i}]`, '场景', content),
                    path: `$.setting.key_scenes[${i}]`,
                    type: '场景',
                    title,
                    content,
                    content_text: contentText,
                    content_hash: this.generateContentHash(content, contentText), // Add content hash
                    embedding
                });
            }
        }

        return particles;
    }

    private async extractChroniclesParticles(jsondoc: TypedJsondoc): Promise<ParticleData[]> {
        const data = jsondoc.data as any;
        const particles: ParticleData[] = [];

        if (data.stages && Array.isArray(data.stages)) {
            for (let i = 0; i < data.stages.length; i++) {
                const stage = data.stages[i];
                if (!stage.title && !stage.stageSynopsis) continue;

                const title = stage.title || `阶段 ${i + 1}`;
                const content = {
                    title: stage.title,
                    stageSynopsis: stage.stageSynopsis,
                    event: stage.event,
                    numberOfEpisodes: stage.numberOfEpisodes
                };

                const contentText = this.generateEmbeddingContent('stage', content, jsondoc, `$.stages[${i}]`);

                if (contentText) {
                    const embedding = await this.embeddingService.generateEmbedding(contentText);

                    particles.push({
                        id: this.generateParticleId(jsondoc, `$.stages[${i}]`, '阶段', content),
                        path: `$.stages[${i}]`,
                        type: '阶段',
                        title,
                        content,
                        content_text: contentText,
                        content_hash: this.generateContentHash(content, contentText), // Add content hash
                        embedding
                    });
                }
            }
        }

        return particles;
    }

    private async extractEpisodePlanningParticles(jsondoc: TypedJsondoc): Promise<ParticleData[]> {
        const data = jsondoc.data as any;
        const particles: ParticleData[] = [];

        if (data.episodeGroups && Array.isArray(data.episodeGroups)) {
            for (let i = 0; i < data.episodeGroups.length; i++) {
                const group = data.episodeGroups[i];
                if (!group.groupTitle) continue;

                const title = group.groupTitle;
                const content = {
                    groupTitle: group.groupTitle,
                    episodes: group.episodes,
                    keyEvents: group.keyEvents,
                    hooks: group.hooks,
                    emotionalBeats: group.emotionalBeats
                };

                const contentText = this.generateEmbeddingContent('episode_group', content, jsondoc, `$.episodeGroups[${i}]`);

                if (contentText) {
                    const embedding = await this.embeddingService.generateEmbedding(contentText);

                    particles.push({
                        id: this.generateParticleId(jsondoc, `$.episodeGroups[${i}]`, '剧集组', content),
                        path: `$.episodeGroups[${i}]`,
                        type: '剧集组',
                        title,
                        content,
                        content_text: contentText,
                        content_hash: this.generateContentHash(content, contentText), // Add content hash
                        embedding
                    });
                }
            }
        }

        return particles;
    }

    private async extractEpisodeSynopsisParticles(jsondoc: TypedJsondoc): Promise<ParticleData[]> {
        const data = jsondoc.data as any;
        const particles: ParticleData[] = [];

        if (data.episodes && Array.isArray(data.episodes)) {
            for (let i = 0; i < data.episodes.length; i++) {
                const episode = data.episodes[i];
                if (!episode.title) continue;

                const title = `第${episode.episodeNumber}集: ${episode.title}`;
                const content = {
                    episodeNumber: episode.episodeNumber,
                    title: episode.title,
                    openingHook: episode.openingHook,
                    mainPlot: episode.mainPlot,
                    emotionalClimax: episode.emotionalClimax,
                    cliffhanger: episode.cliffhanger,
                    suspenseElements: episode.suspenseElements
                };

                const contentText = this.generateEmbeddingContent('episode', content, jsondoc, `$.episodes[${i}]`);

                if (contentText) {
                    const embedding = await this.embeddingService.generateEmbedding(contentText);

                    particles.push({
                        id: this.generateParticleId(jsondoc, `$.episodes[${i}]`, '每集大纲', content),
                        path: `$.episodes[${i}]`,
                        type: '每集大纲',
                        title,
                        content,
                        content_text: contentText,
                        content_hash: this.generateContentHash(content, contentText), // Add content hash
                        embedding
                    });
                }
            }
        }

        return particles;
    }
} 