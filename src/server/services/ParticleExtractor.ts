import { EmbeddingService } from './EmbeddingService';
import { TypedJsondoc } from '../../common/jsondocs.js';

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

/**
 * Extract particles from jsondocs based on schema type
 */
export class ParticleExtractor {
    private extractors: Map<string, ParticleExtractorFunction> = new Map();

    constructor(private embeddingService: EmbeddingService) {
        this.registerExtractors();
    }

    private registerExtractors() {
        this.extractors.set('brainstorm_collection', this.extractBrainstormParticles.bind(this));
        this.extractors.set('outline_settings', this.extractOutlineParticles.bind(this));
        this.extractors.set('chronicles', this.extractChroniclesParticles.bind(this));
        this.extractors.set('brainstorm_idea', this.extractBrainstormIdeaParticles.bind(this));
    }

    async extractParticles(jsondoc: TypedJsondoc): Promise<ParticleData[]> {
        const extractor = this.extractors.get(jsondoc.schema_type);
        if (!extractor) {
            console.log(`No particle extractor found for schema type: ${jsondoc.schema_type}`);
            return [];
        }

        return await extractor(jsondoc);
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
                const contentText = `${idea.title || ''}\n${idea.body || ''}`.trim();

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

    private async extractBrainstormIdeaParticles(jsondoc: TypedJsondoc): Promise<ParticleData[]> {
        const data = jsondoc.data as any; // Use any for flexible access to data properties
        const particles: ParticleData[] = [];

        // Extract single brainstorm idea
        if (data.title || data.body) {
            const title = data.title || '创意';
            const content = { title: data.title, body: data.body };
            const contentText = `${data.title || ''}\n${data.body || ''}`.trim();

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
                const contentText = `${character.name || ''} - ${character.description || ''}`.trim();

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
                const embedding = await this.embeddingService.generateEmbedding(point);

                particles.push({
                    id: `${jsondoc.id}_selling_point_${i}`,
                    path: `$.selling_points[${i}]`,
                    type: '卖点',
                    title,
                    content: { text: point },
                    content_text: point,
                    embedding
                });
            }
        }

        // Extract satisfaction points
        if (data.satisfaction_points && Array.isArray(data.satisfaction_points)) {
            for (let i = 0; i < data.satisfaction_points.length; i++) {
                const point = data.satisfaction_points[i];
                if (!point || typeof point !== 'string') continue;

                const title = point.length > 20 ? point.substring(0, 20) + '...' : point;
                const embedding = await this.embeddingService.generateEmbedding(point);

                particles.push({
                    id: `${jsondoc.id}_satisfaction_point_${i}`,
                    path: `$.satisfaction_points[${i}]`,
                    type: '爽点',
                    title,
                    content: { text: point },
                    content_text: point,
                    embedding
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
                const contentText = `${stage.title || ''}\n${stage.stageSynopsis || ''}`.trim();

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