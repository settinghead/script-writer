import { brainstormingTemplate } from './brainstorming.js';
import { brainstormEditPatchTemplate } from './brainstormEditPatch.js';
import { outlineSettingsTemplate } from './outlineSettings.js';
import { outlineSettingsEditPatchTemplate } from './outlineSettingsEditPatch.js';
import { chroniclesTemplate } from './chronicles.js';
import { chroniclesEditPatchTemplate } from './chroniclesEditPatch.js';
import { episodePlanningTemplate } from './episodePlanning.js';
import { episodePlanningEditPatchTemplate } from './episodePlanningEditPatch.js';
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
    this.registerTemplate(outlineSettingsEditPatchTemplate);
    this.registerTemplate(chroniclesTemplate);
    this.registerTemplate(chroniclesEditPatchTemplate);
    this.registerTemplate(episodePlanningTemplate);
    this.registerTemplate(episodePlanningEditPatchTemplate);
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

    // Replace %%jsondocs%% with custom flat YAML-like format
    if (context.jsondocs) {
      let jsondocsOutput = '';

      for (const [key, jsondoc] of Object.entries(context.jsondocs)) {
        jsondocsOutput += `${key}:\n`;

        // Handle each field in the jsondoc
        for (const [field, value] of Object.entries(jsondoc as any)) {
          if (field === 'data') {
            // For data field, output the JSON string with proper indentation
            jsondocsOutput += `  ${field}: |\n`;
            // Handle both string and object data types
            const jsonString = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
            // Indent each line of the JSON string
            const indentedJson = jsonString.split('\n').map(line => `    ${line}`).join('\n');
            jsondocsOutput += `${indentedJson}\n`;
          } else {
            // For other fields, use regular YAML formatting
            jsondocsOutput += `  ${field}: ${value}\n`;
          }
        }
        jsondocsOutput += '\n'; // Add spacing between jsondocs
      }

      result = result.replace(/%%jsondocs%%/g, jsondocsOutput.trim());
    }

    return result;
  }


} 