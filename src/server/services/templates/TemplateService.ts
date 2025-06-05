import { brainstormingTemplate } from './brainstorming.js';
import { outlineTemplate } from './outline.js';
import { episodeSynopsisGenerationTemplate } from './episodeSynopsisGeneration.js';
import { scriptGenerationTemplate } from './scriptGeneration.js';

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

    // Register outline template
    this.templates.set('outline', outlineTemplate);

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
    const instructions: string[] = [];

    // First episode special requirements
    if (startingEpisode === 1) {
      instructions.push(`
**📺 第1集特殊要求**：
- **开篇吸引力**：第一集的开头必须用吸引人的方式，快速把主要人物的背景、剧中的初始关系都交代清楚
- **人物碰撞设计**：开头场景选择一些人物短期快速能碰撞的场景，制造戏剧冲突和张力
- **叙事技巧运用**：如果有交代的空缺，可以利用flashback（闪回）、倒序等手法来补充背景信息
- **信息密度控制**：在保持节奏紧凑的同时，确保观众能快速理解人物关系和故事背景
- **钩子前置**：开场3分钟内必须建立核心矛盾或悬念，抓住观众注意力`);
    }

    // Future: Add more conditional requirements here
    // Example: Mid-season episodes, finale episodes, etc.
    /*
    if (endingEpisode >= 10 && endingEpisode <= 15) {
      instructions.push(`
**🔥 中期剧集要求**：
- **情感深化**：深入挖掘人物内心世界和复杂情感
- **关系转折**：准备重大关系转变的铺垫`);
    }

    if (endingEpisode >= 20) {
      instructions.push(`
**🎬 高潮剧集要求**：
- **冲突激化**：将所有积累的矛盾推向高潮
- **角色成长**：展现角色的重大成长和转变`);
    }
    */

    // If no special instructions, return empty string
    return instructions.length > 0 ? instructions.join('\n') : '';
  }
} 