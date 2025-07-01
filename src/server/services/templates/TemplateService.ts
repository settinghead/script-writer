import { brainstormingTemplate } from './brainstorming.js';
import { brainstormEditTemplate } from './brainstormEdit.js';
import { outlineSettingsTemplate } from './outlineSettings.js';
import { chroniclesTemplate } from './chronicles.js';
import { generateEpisodeSpecificInstructions, episodeSynopsisGenerationTemplate } from './episodeSynopsisGeneration.js';
import { scriptGenerationTemplate, generateScriptEpisodeSpecificInstructions } from './scriptGeneration.js';

// Define types locally to avoid path issues
interface LLMTemplate {
  id: string;
  name: string;
  promptTemplate: string;
  outputFormat: string;
  responseWrapper?: string;
  variables: string[];
}

interface TemplateContext {
  artifacts?: Record<string, any>;
  params?: Record<string, any>;
}

export class TemplateService {
  private templates = new Map<string, LLMTemplate>();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates() {
    // Register brainstorming template
    this.templates.set('brainstorming', brainstormingTemplate);

    // Register brainstorm edit template
    this.templates.set('brainstorm_edit', brainstormEditTemplate);

    // Legacy outline template removed - now using split outline settings + chronicles

    // NEW: Register split outline templates
    this.templates.set('outline_settings', outlineSettingsTemplate);
    this.templates.set('chronicles', chroniclesTemplate);

    // Register episode synopsis generation template
    this.templates.set('episode_synopsis_generation', episodeSynopsisGenerationTemplate);

    // Register script generation template
    this.templates.set('script_generation', scriptGenerationTemplate);
  }

  getTemplate(templateId: string): LLMTemplate | undefined {
    return this.templates.get(templateId);
  }

  async renderTemplate(
    template: LLMTemplate,
    context: TemplateContext
  ): Promise<string> {
    let prompt = template.promptTemplate;

    // Replace variables with context values using %% delimiters
    for (const variable of template.variables) {
      const value = this.resolveVariable(variable, context);
      // Use global replace to replace all occurrences
      prompt = prompt.split(`%%${variable}%%`).join(value);
    }

    // 🔥 VALIDATION: Check for any unresolved template variables
    // Only check for %%params.*%% and %%artifacts.*%% patterns
    const unresolvedMatches = prompt.match(/%%((params|artifacts)\.[^%]+)%%/g);
    if (unresolvedMatches) {
      throw new Error(`Template contains unresolved variables: ${unresolvedMatches.join(', ')}`);
    }

    return prompt;
  }

  private resolveVariable(path: string, context: TemplateContext): string {
    // Handle nested paths like "artifacts.brainstorm_params.genre"
    const parts = path.split('.');
    let value: any = context;

    for (const part of parts) {
      value = value?.[part];
    }

    // 🔥 FIXED: Don't return empty string for missing values - throw error instead
    if (value === undefined || value === null) {
      throw new Error(`Required template variable '${path}' is missing or null in context`);
    }

    return value.toString();
  }

  async renderPromptTemplates(messages: Array<{ role: string; content: string }>): Promise<Array<{ role: string; content: string }>> {
    // For now, just return messages as-is since we don't have complex template rendering
    return messages;
  }

  /**
   * Generate episode-specific instructions based on the episode range being generated
   * This is extensible for future special episode requirements
   */
  generateEpisodeSpecificInstructions(startingEpisode: number, endingEpisode: number): string {
    return generateEpisodeSpecificInstructions(startingEpisode, endingEpisode);
  }

  /**
   * Generate script-specific instructions for individual episode script generation
   * This provides episode-specific guidance for script writing
   */
  generateScriptEpisodeSpecificInstructions(episodeNumber: number): string {
    return generateScriptEpisodeSpecificInstructions(episodeNumber);
  }
} 