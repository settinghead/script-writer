import { EmbeddingService } from './EmbeddingService';
import { TypedJsondoc } from '../../common/jsondocs.js';
import { dump } from 'js-yaml';

export interface ParticleData {
    id: string;
    path: string;
    type: string;
    title: string;
    content: any;
    content_text: string;
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
        this.extractors.set('outline_settings', this.extractOutlineParticles.bind(this));
        this.extractors.set('chronicles', this.extractChroniclesParticles.bind(this));
        this.extractors.set('brainstorm_idea', this.extractBrainstormIdeaParticles.bind(this));
    }

    private registerEmbeddingContentExtractors() {
        // Register custom embedding content extractors for specific particle types
        // For brainstorm ideas, use title + body instead of YAML
        this.embeddingContentExtractors.set('brainstorm_idea', (content: any) => {
            return `${content.title || ''}\n${content.body || ''}`.trim();
        });

        // For characters, use name + description instead of YAML
        this.embeddingContentExtractors.set('character', (content: any) => {
            return `${content.name || ''} - ${content.description || ''}`.trim();
        });

        // For brainstorm input params, use structured text instead of YAML
        this.embeddingContentExtractors.set('brainstorm_input_params', (content: any) => {
            const parts = [];
            if (content.platform) parts.push(`平台: ${content.platform}`);
            if (content.genre) parts.push(`类型: ${content.genre}`);
            if (content.other_requirements) parts.push(`需求: ${content.other_requirements}`);
            if (content.numberOfIdeas) parts.push(`创意数量: ${content.numberOfIdeas}`);
            return parts.join('\n');
        });

        // For stages, use title + synopsis instead of YAML
        this.embeddingContentExtractors.set('stage', (content: any) => {
            return `${content.title || ''}\n${content.stageSynopsis || ''}`.trim();
        });
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
     */
    private generateEmbeddingContent(particleType: string, content: any, jsondoc: TypedJsondoc): string {
        const customExtractor = this.embeddingContentExtractors.get(particleType);
        if (customExtractor) {
            return customExtractor(content, jsondoc);
        }

        // Default: use YAML format for the underlying content
        try {
            return dump(content, {
                indent: 2,
                lineWidth: 120,
                noRefs: true,
                sortKeys: false
            }).trim();
        } catch (error) {
            console.warn(`Failed to format content as YAML for particle type ${particleType}, falling back to JSON:`, error);
            return JSON.stringify(content, null, 2);
        }
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
                const contentText = this.generateEmbeddingContent('brainstorm_idea', content, jsondoc);

                if (contentText) {
                    const embedding = await this.embeddingService.generateEmbedding(contentText);

                    particles.push({
                        id: `${jsondoc.id}_idea_${i}`,
                        path: `$.ideas[${i}]`,
                        type: '创意',
                        title,
                        content,
                        content_text: contentText,
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
        const contentText = this.generateEmbeddingContent('brainstorm_input_params', data, jsondoc);

        if (contentText.trim()) {
            const embedding = await this.embeddingService.generateEmbedding(contentText);

            particles.push({
                id: `${jsondoc.id}_input_params`,
                path: '$',
                type: '头脑风暴参数',
                title,
                content: data,
                content_text: contentText,
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
            const contentText = this.generateEmbeddingContent('brainstorm_idea', content, jsondoc);

            if (contentText) {
                const embedding = await this.embeddingService.generateEmbedding(contentText);

                particles.push({
                    id: `${jsondoc.id}_idea`,
                    path: '$',
                    type: '创意',
                    title,
                    content,
                    content_text: contentText,
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
                const contentText = this.generateEmbeddingContent('character', character, jsondoc);

                if (contentText) {
                    const embedding = await this.embeddingService.generateEmbedding(contentText);

                    particles.push({
                        id: `${jsondoc.id}_character_${i}`,
                        path: `$.characters[${i}]`,
                        type: '人物',
                        title,
                        content: character,
                        content_text: contentText,
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
                const contentText = this.generateEmbeddingContent('selling_point', content, jsondoc);

                particles.push({
                    id: `${jsondoc.id}_selling_point_${i}`,
                    path: `$.selling_points[${i}]`,
                    type: '卖点',
                    title,
                    content,
                    content_text: contentText,
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
                const contentText = this.generateEmbeddingContent('satisfaction_point', content, jsondoc);

                particles.push({
                    id: `${jsondoc.id}_satisfaction_point_${i}`,
                    path: `$.satisfaction_points[${i}]`,
                    type: '爽点',
                    title,
                    content,
                    content_text: contentText,
                    embedding: await this.embeddingService.generateEmbedding(contentText)
                });
            }
        }

        // Extract key scenes
        if (data.key_scenes && Array.isArray(data.key_scenes)) {
            for (let i = 0; i < data.key_scenes.length; i++) {
                const scene = data.key_scenes[i];
                if (!scene || typeof scene !== 'string') continue;

                const title = scene.length > 20 ? scene.substring(0, 20) + '...' : scene;
                const embedding = await this.embeddingService.generateEmbedding(scene);

                particles.push({
                    id: `${jsondoc.id}_key_scene_${i}`,
                    path: `$.key_scenes[${i}]`,
                    type: '场景',
                    title,
                    content: { text: scene },
                    content_text: scene,
                    embedding
                });
            }
        }

        return particles;
    }

    private async extractChroniclesParticles(jsondoc: TypedJsondoc): Promise<ParticleData[]> {
        const data = jsondoc.data as any; // Use any for flexible access to data properties
        const particles: ParticleData[] = [];

        if (data.stages && Array.isArray(data.stages)) {
            for (let i = 0; i < data.stages.length; i++) {
                const stage = data.stages[i];
                if (!stage.title && !stage.stageSynopsis) continue;

                const title = stage.title || `阶段 ${i + 1}`;
                const contentText = this.generateEmbeddingContent('stage', stage, jsondoc);

                if (contentText) {
                    const embedding = await this.embeddingService.generateEmbedding(contentText);

                    particles.push({
                        id: `${jsondoc.id}_stage_${i}`,
                        path: `$.stages[${i}]`,
                        type: '阶段',
                        title,
                        content: stage,
                        content_text: contentText,
                        embedding
                    });
                }
            }
        }

        return particles;
    }
} 