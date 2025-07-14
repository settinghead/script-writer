import { ParticleService } from './ParticleService';
import { dump } from 'js-yaml';

export interface ParticleReference {
    particleId: string;
    alphanumericRef: string;
    type: string;
    title: string;
    content: string;
}

export class ParticleTemplateProcessor {
    private particleService: ParticleService;
    private typeToPrefix: Map<string, string> = new Map([
        ['角色', 'A'], ['创意', 'B'], ['卖点', 'C'], ['阶段', 'D'],
        ['人物', 'A'], ['情节', 'B'], ['爽点', 'C'], ['场景', 'D'],
        ['character', 'A'], ['idea', 'B'], ['selling_point', 'C'], ['stage', 'D']
    ]);

    constructor(particleService: ParticleService) {
        this.particleService = particleService;
    }

    /**
     * Process template with particle references
     * @param template Template string with @particle:id references
     * @param projectId Project ID for particle access control
     * @param userId User ID for particle access control
     * @returns Processed template with alphanumeric references and content section
     */
    async processTemplate(
        template: string,
        projectId: string,
        userId: string
    ): Promise<string> {
        // 1. Extract particle references
        const particleRefs = this.extractParticleReferences(template);

        if (particleRefs.length === 0) {
            return template; // No particles to process
        }

        // 2. Validate template structure
        this.validateTemplate(template, particleRefs);

        // 3. Resolve particles and build reference map
        const { referenceMap, contentSection } = await this.buildParticleReferences(
            particleRefs,
            projectId,
            userId
        );

        // 4. Replace inline references
        let result = this.replaceInlineReferences(template, referenceMap);

        // 5. Replace content section
        result = result.replace(/%%particle-content%%/g, contentSection);

        return result;
    }

    /**
     * Extract all @particle:id references from template
     */
    private extractParticleReferences(template: string): string[] {
        const regex = /@particle:([a-zA-Z0-9_-]+)/g;
        const matches = [];
        let match;

        while ((match = regex.exec(template)) !== null) {
            matches.push(match[1]); // Extract particle ID
        }

        return [...new Set(matches)]; // Remove duplicates
    }

    /**
     * Validate template structure - if particles exist, content section must exist
     */
    private validateTemplate(template: string, particleRefs: string[]): void {
        if (particleRefs.length > 0 && !template.includes('%%particle-content%%')) {
            throw new Error(
                `Template contains particle references (${particleRefs.join(', ')}) but missing %%particle-content%% section`
            );
        }
    }

    /**
     * Build particle references and content section
     */
    private async buildParticleReferences(
        particleIds: string[],
        projectId: string,
        userId: string
    ): Promise<{ referenceMap: Map<string, string>, contentSection: string }> {
        const referenceMap = new Map<string, string>();
        const contentItems: Array<{ ref: string, type: string, title: string, content: string }> = [];
        const typeCounters = new Map<string, number>();

        // Resolve all particles
        for (const particleId of particleIds) {
            try {
                const particle = await this.particleService.getParticle(particleId, projectId, userId);

                if (!particle) {
                    referenceMap.set(particleId, `[MISSING:${particleId}]`);
                    continue;
                }

                // Generate alphanumeric reference
                const prefix = this.typeToPrefix.get(particle.type) || 'Z';
                const count = (typeCounters.get(prefix) || 0) + 1;
                typeCounters.set(prefix, count);
                const reference = `[${prefix}${count}]`;

                referenceMap.set(particleId, reference);
                contentItems.push({
                    ref: reference,
                    type: particle.type,
                    title: particle.title,
                    content: particle.content_text
                });

            } catch (error) {
                console.error(`Failed to resolve particle ${particleId}:`, error);
                referenceMap.set(particleId, `[ERROR:${particleId}]`);
            }
        }

        // Build content section
        const contentSection = this.buildContentSection(contentItems);

        return { referenceMap, contentSection };
    }

    /**
     * Replace inline @particle:id references with alphanumeric references
     */
    private replaceInlineReferences(template: string, referenceMap: Map<string, string>): string {
        let result = template;

        for (const [particleId, reference] of referenceMap) {
            const regex = new RegExp(`@particle:${particleId}`, 'g');
            result = result.replace(regex, reference);
        }

        return result;
    }

    /**
     * Build YAML content section with particle details
     */
    private buildContentSection(contentItems: Array<{ ref: string, type: string, title: string, content: string }>): string {
        if (contentItems.length === 0) {
            return '';
        }

        const yamlContent = contentItems.reduce((acc, item) => {
            acc[item.ref.slice(1, -1)] = { // Remove [ and ]
                type: item.type,
                title: item.title,
                content: item.content
            };
            return acc;
        }, {} as any);

        return `## 引用内容\n\n\`\`\`yaml\n${dump(yamlContent, { indent: 2, lineWidth: -1 }).trim()}\n\`\`\``;
    }
} 