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

// Interface for prompt generation result
export interface PromptGenerationResult {
  success: true;
  tool: {
    name: string;
    description: string;
    templatePath: string;
  };
  input: {
    jsondocs?: any[];
    additionalParams?: any;
  };
  templateVariables: Record<string, string>;
  fieldTitles: Record<string, string>;
  prompt: string;
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

  async renderTemplate(template: LLMTemplate, context: TemplateContext): Promise<string> {
    let result = template.promptTemplate;

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
   * Generate prompt for debugging/admin purposes using the same logic as actual tools
   */
  async generatePromptForDebugging(
    toolName: string,
    templateName: string,
    input: {
      jsondocs?: any[];
      additionalParams?: any;
    }
  ): Promise<PromptGenerationResult> {
    const template = this.getTemplate(templateName);

    // Default schema-driven template variable extraction (same as tools use)
    const templateVariables: Record<string, string> = {};

    // Add params section - use YAML format like the actual tools
    if (input.additionalParams) {
      templateVariables['params'] = dump(input.additionalParams, {
        indent: 2,
        lineWidth: -1
      }).trim();
    } else {
      templateVariables['params'] = 'No additional parameters provided';
    }

    // Add jsondocs section - use YAML format like the actual tools  
    if (input.jsondocs && input.jsondocs.length > 0) {
      // For debugging, create a simplified representation of jsondocs
      const jsondocData = input.jsondocs.map((doc: any) => ({
        id: doc.id || doc.jsondocId,
        type: doc.schemaType || doc.schema_type,
        data: doc.data || `[Data for ${doc.schemaType || doc.schema_type}]`
      }));

      templateVariables['jsondocs'] = dump(jsondocData, {
        indent: 2,
        lineWidth: -1
      }).trim();
    } else {
      templateVariables['jsondocs'] = 'No jsondocs provided';
    }

    // Generate the final prompt using the same method as renderTemplate
    const finalPrompt = await this.renderTemplate(template, {
      params: input.additionalParams,
      jsondocs: input.jsondocs?.map((doc: any) => ({
        id: doc.id || doc.jsondocId,
        type: doc.schemaType || doc.schema_type,
        data: doc.data || `[Data for ${doc.schemaType || doc.schema_type}]`
      }))
    });

    return {
      success: true,
      tool: {
        name: toolName,
        description: `Debug prompt generation for ${toolName}`,
        templatePath: templateName
      },
      input,
      templateVariables,
      fieldTitles: {
        params: 'Input Parameters',
        jsondocs: 'Referenced Jsondocs'
      },
      prompt: finalPrompt
    };
  }
} 