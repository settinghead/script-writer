import { brainstormingTemplate } from './brainstorming.js';
import { brainstormEditPatchTemplate } from './brainstormEditPatch.js';
import { outlineSettingsTemplate } from './outlineSettings.js';
import { outlineSettingsEditPatchTemplate } from './outlineSettingsEditPatch.js';
import { chroniclesTemplate } from './chronicles.js';
import { chroniclesEditPatchTemplate } from './chroniclesEditPatch.js';
import { episodePlanningTemplate } from './episodePlanning.js';
import { episodePlanningEditPatchTemplate } from './episodePlanningEditPatch.js';
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

/**
 * Recursively annotate arrays in a JSON object with explicit 0-based indices
 * This helps LLMs accurately reference array elements in JSON patch operations
 */
function annotateArraysWithIndices(obj: any, path: string = '', depth: number = 0): string {
  if (depth > 10) { // Prevent infinite recursion
    return `${path}: [MAX_DEPTH_REACHED]`;
  }

  let result = '';

  if (Array.isArray(obj)) {
    result += `${path} (Array with ${obj.length} items, 0-based indexing):\n`;
    obj.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      if (typeof item === 'object' && item !== null) {
        // For objects in arrays, show a compact summary first
        if (item.title || item.name || item.type) {
          const summary = item.title || item.name || item.type || 'object';
          result += `  [${index}]: ${summary}\n`;
        } else {
          result += `  [${index}]: {object}\n`;
        }
        // Then show full nested structure
        const nested = annotateArraysWithIndices(item, itemPath, depth + 1);
        if (nested.trim()) {
          result += nested.split('\n').map(line => `    ${line}`).join('\n') + '\n';
        }
      } else {
        result += `  [${index}]: ${JSON.stringify(item)}\n`;
      }
    });
    result += '\n';
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const newPath = path ? `${path}.${key}` : key;
      if (Array.isArray(value)) {
        result += annotateArraysWithIndices(value, newPath, depth + 1);
      } else if (typeof value === 'object' && value !== null) {
        const nested = annotateArraysWithIndices(value, newPath, depth + 1);
        if (nested.trim()) {
          result += nested;
        }
      }
    }
  }

  return result;
}

/**
 * Check if a template is a JSON patch template based on its ID
 */
function isJsonPatchTemplate(templateId: string): boolean {
  return templateId.includes('_edit_patch');
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

    // Replace %%jsondocs%% with enhanced format for JSON patch templates
    if (context.jsondocs) {
      const isJsonPatch = isJsonPatchTemplate(template.id);
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

            // For JSON patch templates, add array index annotations
            if (isJsonPatch && typeof value === 'object' && value !== null) {
              const arrayAnnotations = annotateArraysWithIndices(value);
              if (arrayAnnotations.trim()) {
                jsondocsOutput += `\n  array_index_reference (for accurate JSON patch paths):\n`;
                const indentedAnnotations = arrayAnnotations.split('\n').map(line =>
                  line ? `    ${line}` : ''
                ).join('\n');
                jsondocsOutput += `${indentedAnnotations}\n`;
              }
            }
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