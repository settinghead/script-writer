import { brainstormingTemplate } from './brainstorming.js';
import { brainstormEditPatchTemplate } from './brainstormEditPatch.js';
import { outlineSettingsTemplate } from './outlineSettings.js';
import { chroniclesTemplate } from './chronicles.js';
import { episodeSynopsisGenerationTemplate } from './episodeSynopsisGeneration.js';
import { scriptGenerationTemplate } from './scriptGeneration.js';
import { ParticleTemplateProcessor } from '../ParticleTemplateProcessor';
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



export class TemplateService {
  private templates: Map<string, LLMTemplate> = new Map();
  private particleProcessor?: ParticleTemplateProcessor;

  constructor(particleProcessor?: ParticleTemplateProcessor) {
    this.particleProcessor = particleProcessor;

    // Register all templates
    this.registerTemplate(brainstormingTemplate);
    this.registerTemplate(brainstormEditPatchTemplate);
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
    particleContext?: { projectId: string, userId: string }
  ): Promise<string> {
    let result = template.promptTemplate;

    // NEW: Process particles first (before other replacements)
    if (this.particleProcessor && particleContext) {
      result = await this.particleProcessor.processTemplate(
        result,
        particleContext.projectId,
        particleContext.userId
      );
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


} 