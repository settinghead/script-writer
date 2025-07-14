import { brainstormingTemplate } from './brainstorming.js';
import { brainstormEditTemplate } from './brainstormEdit.js';
import { outlineSettingsTemplate } from './outlineSettings.js';
import { chroniclesTemplate } from './chronicles.js';
import { episodeSynopsisGenerationTemplate } from './episodeSynopsisGeneration.js';
import { scriptGenerationTemplate } from './scriptGeneration.js';
import { dump } from 'js-yaml';

// Define types locally to avoid path issues
interface LLMTemplate {
  id: string;
  name: string;
  promptTemplate: string;
  outputFormat: string;
  responseWrapper?: string;
}

// Template context for the new generic format
interface TemplateContext {
  params?: any;
  jsondocs?: any;
}

// NEW: Particle context for particle resolution
interface ParticleContext {
  projectId: string;
  userId: string;
  particleService: any; // Will be properly typed when ParticleService is implemented
}

// NEW: Particle reference tracking
interface ParticleReference {
  originalMatch: string;
  particleId: string;
  referenceId: string;
  particle?: any; // The actual particle data
}

export class TemplateService {
  private templates: Map<string, LLMTemplate> = new Map();

  constructor() {
    // Register all templates
    this.registerTemplate(brainstormingTemplate);
    this.registerTemplate(brainstormEditTemplate);
    this.registerTemplate(outlineSettingsTemplate);
    this.registerTemplate(chroniclesTemplate);
    this.registerTemplate(episodeSynopsisGenerationTemplate);
    this.registerTemplate(scriptGenerationTemplate);
  }

  private registerTemplate(template: LLMTemplate) {
    this.templates.set(template.id, template);
  }

  getTemplate(templateId: string): LLMTemplate {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    return template;
  }

  async renderTemplate(
    template: LLMTemplate,
    context: TemplateContext,
    particleContext?: ParticleContext
  ): Promise<string> {
    let result = template.promptTemplate;

    // NEW: Particle resolution (must happen first to avoid conflicts)
    if (particleContext) {
      result = await this.resolveParticles(result, particleContext);
    }

    // Replace %%params%% with YAML-formatted parameters
    if (context.params) {
      const paramsYaml = dump(context.params, {
        indent: 2,
        lineWidth: -1 // Disable line wrapping
      }).trim();
      result = result.replace(/%%params%%/g, paramsYaml);
    }

    // Replace %%jsondocs%% with YAML-formatted jsondoc data
    if (context.jsondocs) {
      const jsondocsYaml = dump(context.jsondocs, {
        indent: 2,
        lineWidth: -1 // Disable line wrapping
      }).trim();
      result = result.replace(/%%jsondocs%%/g, jsondocsYaml);
    }

    return result;
  }

  /**
   * NEW: Resolve particle references and content expansion
   */
  private async resolveParticles(template: string, particleContext: ParticleContext): Promise<string> {
    // 1. Find all particle references
    const particleReferences = this.extractParticleReferences(template);

    // 2. Validate template structure
    this.validateParticleTemplate(template, particleReferences);

    // 3. Fetch particle data
    const resolvedReferences = await this.fetchParticleData(particleReferences, particleContext);

    // 4. Replace particle references with short references
    let result = this.replaceParticleReferences(template, resolvedReferences);

    // 5. Replace particle content list
    result = this.replaceParticleContentList(result, resolvedReferences);

    return result;
  }

  /**
   * Extract all %%@[particle:particle-id]%% patterns from template
   */
  private extractParticleReferences(template: string): ParticleReference[] {
    const particleRegex = /%%@\[particle:([^\]]+)\]%%/g;
    const references: ParticleReference[] = [];
    const referenceCounter = new Map<string, number>();

    let match;
    while ((match = particleRegex.exec(template)) !== null) {
      const particleId = match[1];
      const originalMatch = match[0];

      // Generate unique reference ID for this particle
      const count = referenceCounter.get(particleId) || 0;
      referenceCounter.set(particleId, count + 1);

      const referenceId = count === 0 ? particleId : `${particleId}-${count}`;

      references.push({
        originalMatch,
        particleId,
        referenceId
      });
    }

    return references;
  }

  /**
   * Validate template has required particle structure
   */
  private validateParticleTemplate(template: string, references: ParticleReference[]): void {
    const hasParticleReferences = references.length > 0;
    const hasParticleContentList = template.includes('%%list-of-particle-content%%');

    if (hasParticleReferences && !hasParticleContentList) {
      throw new Error(
        'Template contains particle references (%%@[particle:id]%%) but missing %%list-of-particle-content%% section. ' +
        'Both must be present together.'
      );
    }

    if (!hasParticleReferences && hasParticleContentList) {
      console.warn('Template contains %%list-of-particle-content%% but no particle references. Content list will be empty.');
    }
  }

  /**
   * Fetch actual particle data from the service
   */
  private async fetchParticleData(
    references: ParticleReference[],
    particleContext: ParticleContext
  ): Promise<ParticleReference[]> {
    const uniqueParticleIds = [...new Set(references.map(ref => ref.particleId))];

    // Fetch all unique particles
    const particleDataMap = new Map<string, any>();
    for (const particleId of uniqueParticleIds) {
      try {
        const particle = await particleContext.particleService.getParticle(
          particleId,
          particleContext.projectId,
          particleContext.userId
        );
        if (particle) {
          particleDataMap.set(particleId, particle);
        }
      } catch (error) {
        console.error(`Failed to fetch particle ${particleId}:`, error);
        // Continue with other particles
      }
    }

    // Attach particle data to references
    return references.map(ref => ({
      ...ref,
      particle: particleDataMap.get(ref.particleId)
    }));
  }

  /**
   * Replace particle references with short reference IDs
   */
  private replaceParticleReferences(template: string, references: ParticleReference[]): string {
    let result = template;

    for (const ref of references) {
      if (ref.particle) {
        // Create a short, descriptive reference
        const shortRef = this.generateShortReference(ref.particle, ref.referenceId);
        result = result.replace(ref.originalMatch, shortRef);
      } else {
        // Particle not found - replace with error indicator
        result = result.replace(ref.originalMatch, `[粒子未找到:${ref.particleId}]`);
      }
    }

    return result;
  }

  /**
   * Generate a short reference for a particle
   */
  private generateShortReference(particle: any, referenceId: string): string {
    // Use particle type and title for readable reference
    const type = particle.type || '内容';
    const title = particle.title || referenceId;

    // Keep it short but descriptive
    if (title.length > 10) {
      return `[${type}-${title.substring(0, 8)}...]`;
    }
    return `[${type}-${title}]`;
  }

  /**
   * Replace %%list-of-particle-content%% with structured content
   */
  private replaceParticleContentList(template: string, references: ParticleReference[]): string {
    if (!template.includes('%%list-of-particle-content%%')) {
      return template;
    }

    // Group particles by ID to avoid duplicates
    const uniqueParticles = new Map<string, any>();
    for (const ref of references) {
      if (ref.particle) {
        uniqueParticles.set(ref.particleId, ref.particle);
      }
    }

    // Generate structured content list
    const contentList = Array.from(uniqueParticles.values())
      .map(particle => this.formatParticleContent(particle))
      .join('\n\n');

    return template.replace('%%list-of-particle-content%%', contentList);
  }

  /**
   * Format individual particle content for the content list
   */
  private formatParticleContent(particle: any): string {
    const type = particle.type || '内容';
    const title = particle.title || '未命名';
    const content = particle.content_text || JSON.stringify(particle.content, null, 2);

    return `**${type}: ${title}**\n${content}`;
  }
} 