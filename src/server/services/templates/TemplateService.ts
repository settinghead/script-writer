import { brainstormingTemplate } from './brainstorming.js';
import { brainstormEditPatchTemplate } from './brainstormEditPatch.js';
import { outlineSettingsTemplate } from './outlineSettings.js';
import { outlineSettingsEditPatchTemplate } from './outlineSettingsEditPatch.js';
import { chroniclesTemplate } from './chronicles.js';
import { chroniclesEditPatchTemplate } from './chroniclesEditPatch.js';
import { episodePlanningTemplate } from './episodePlanning.js';
import { episodePlanningEditPatchTemplate } from './episodePlanningEditPatch.js';
import { episodeSynopsisTemplate } from './episodeSynopsis.js';
import { episodeScriptTemplate } from './episodeScript.js';
import { ParticleTemplateProcessor } from '../ParticleTemplateProcessor';
import { dump } from 'js-yaml';
import { formatJsonWithLineNumbers } from '../../../common/jsonFormatting';

// Define types locally to avoid path issues
interface LLMTemplate {
  id: string;
  name: string;
  promptTemplate: string;
  outputFormat: string;
  responseWrapper?: string;
}

/**
 * Extract field paths from a JSON object for debugging
 */
function extractFieldPaths(obj: any, prefix = ''): string[] {
  const paths: string[] = [];

  if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      paths.push(currentPath);

      if (Array.isArray(value)) {
        paths.push(`${currentPath}[*]`);
        if (value.length > 0 && typeof value[0] === 'object') {
          const subPaths = extractFieldPaths(value[0], `${currentPath}[*]`);
          paths.push(...subPaths);
        }
      } else if (typeof value === 'object' && value !== null) {
        const subPaths = extractFieldPaths(value, currentPath);
        paths.push(...subPaths);
      }
    }
  }

  return paths;
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

/**
 * Check if a template is a unified diff template
 */
function isUnifiedDiffTemplate(templateId: string): boolean {
  return templateId.includes('_edit_diff') || templateId.includes('_diff');
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
    this.registerTemplate(episodeSynopsisTemplate);
    this.registerTemplate(episodeScriptTemplate);
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
        lineWidth: -1,
        noRefs: true
      });
      result = result.replace(/%%params%%/g, paramsYaml.trim());
    }

    // Replace %%jsondocs%% with enhanced format for JSON patch templates
    if (context.jsondocs) {
      const isJsonPatch = isJsonPatchTemplate(template.id);
      const isUnifiedDiff = isUnifiedDiffTemplate(template.id);
      let jsondocsOutput = '';

      // Handle case where jsondocs might be a YAML string instead of an object
      let jsondocsObject = context.jsondocs;
      if (typeof context.jsondocs === 'string') {
        console.log(`[TemplateService] WARNING: jsondocs is a string, this should be an object:`, {
          jsondocs_preview: context.jsondocs.substring(0, 200) + '...'
        });
        // If it's a YAML string, we should not process it as individual jsondocs
        // Instead, replace %%jsondocs%% directly with the YAML content

        // For unified diff templates, add line numbers to the string content
        if (isUnifiedDiff) {
          // Import addLineNumbers from the new location
          const { addLineNumbers } = await import('../../../common/jsonFormatting.js');
          const numberedContent = addLineNumbers(context.jsondocs);
          result = result.replace(/%%jsondocs%%/g, numberedContent);
        } else {
          result = result.replace(/%%jsondocs%%/g, context.jsondocs);
        }
        return result;
      }

      for (const [key, jsondoc] of Object.entries(jsondocsObject)) {
        // Create a more descriptive label based on schema type
        const schemaTypeLabels: Record<string, string> = {
          'brainstorm_idea_collection': '故事创意集合',
          'outline_settings': '剧本设定',
          'chronicles': '时间顺序大纲',
          'episode_planning': '分集结构',
          '单集大纲': '剧集梗概',
          'script': '剧本',
          'user_input': '用户输入'
        };

        const jsondocData = (jsondoc as any)?.data || jsondoc;
        const schemaType = (jsondoc as any)?.schema_type || 'unknown';
        const label = schemaTypeLabels[schemaType] || schemaType;

        if (isJsonPatch) {
          // For JSON patch templates, include the raw JSON with field path annotations
          jsondocsOutput += `=== ${label} ===\n`;

          // Convert to JSON with proper formatting
          const jsonString = JSON.stringify(jsondocData, null, 2);
          jsondocsOutput += jsonString;
          jsondocsOutput += '\n\n';

          // Add field path annotations for complex objects
          if (typeof jsondocData === 'object' && jsondocData !== null) {
            const fieldPaths = extractFieldPaths(jsondocData);
            if (fieldPaths.length > 0) {
              jsondocsOutput += `字段路径说明:\n`;
              for (const path of fieldPaths) {
                jsondocsOutput += `  ${path}\n`;
              }
              jsondocsOutput += '\n';
            }
          }
        } else if (isUnifiedDiff) {
          // For unified diff templates, add line numbers to JSON content
          jsondocsOutput += `=== ${label} ===\n`;

          // Use consistent JSON formatting with line numbers
          const numberedJson = formatJsonWithLineNumbers(jsondocData);
          jsondocsOutput += numberedJson;
          jsondocsOutput += '\n\n';
        } else {
          // For other templates, use YAML format
          jsondocsOutput += `=== ${label} ===\n`;

          // Process each field in the jsondoc
          for (const [field, value] of Object.entries(jsondocData)) {
            if (Array.isArray(value)) {
              // For arrays, provide detailed annotations
              jsondocsOutput += `  ${field}:\n`;
              for (let i = 0; i < value.length; i++) {
                const item = value[i];
                if (typeof item === 'object' && item !== null) {
                  // For object arrays, provide structured annotations
                  jsondocsOutput += `    - # ${field}[${i}]\n`;
                  for (const [subField, subValue] of Object.entries(item)) {
                    jsondocsOutput += `      ${subField}: ${typeof subValue === 'string' ? `"${subValue}"` : subValue}\n`;
                  }
                } else {
                  jsondocsOutput += `    - "${item}" # ${field}[${i}]\n`;
                }
              }
            } else if (typeof value === 'object' && value !== null) {
              // For nested objects, provide path annotations
              jsondocsOutput += `  ${field}: # Object with fields: ${Object.keys(value).join(', ')}\n`;
              const arrayAnnotations = dump(value, {
                indent: 2,
                lineWidth: -1,
                noRefs: true
              });
              if (arrayAnnotations) {
                const indentedAnnotations = arrayAnnotations.split('\n').map(line =>
                  line ? `    ${line}` : ''
                ).join('\n');
                jsondocsOutput += `${indentedAnnotations}\n`;
              }
            } else {
              // For other fields, use regular YAML formatting
              jsondocsOutput += `  ${field}: ${value}\n`;
            }
          }
        }
        jsondocsOutput += '\n'; // Add spacing between jsondocs
      }

      result = result.replace(/%%jsondocs%%/g, jsondocsOutput.trim());
    }

    return result;
  }
} 