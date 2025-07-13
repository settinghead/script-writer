/**
 * Generate episode-specific instructions for script generation
 * This reuses the same logic as episode synopsis generation but applied to script context
 */
// Define types locally to avoid path issues
interface LLMTemplate {
  id: string;
  name: string;
  promptTemplate: string;
  outputFormat: string;
  responseWrapper?: string;
}

export const scriptGenerationTemplate: LLMTemplate = {
  id: 'script_generation',
  name: 'Script Generation',
  promptTemplate: `你是一位专门从事中国社交媒体平台短视频内容的专业编剧。你的任务是根据分集梗概和具体要求，创作完整的剧本，为拍摄制作提供详细的执行方案。

你必须遵循以下原则：
1. 基于分集梗概创作完整的对话和场景描述
2. 确保每个场景都有明确的视觉呈现和情感表达
3. 优化对话内容，适合短视频平台的观看特点
4. 体现角色个性和情感变化的细腻刻画
5. 设置适合拍摄的场景和动作指导

## 输入参数
%%params%%

## 参考数据
%%jsondocs%%

## 输出要求

基于分集梗概和制作要求，生成完整的剧本内容。确保剧本格式标准，内容丰富，能够直接用于拍摄制作。

输出应该是一个包含以下结构的JSON对象：
- scenes: 场景数组，每个场景包含场景描述、对话、动作指导等
- character_notes: 角色表演指导
- production_notes: 制作注意事项
- technical_requirements: 技术要求说明`,
  outputFormat: 'json',
  responseWrapper: '```json\n%%content%%\n```'
};

// Legacy function for backward compatibility
export function generateScriptEpisodeSpecificInstructions(episodeNumber: number, totalEpisodes: number): string {
  return `为第${episodeNumber}集（共${totalEpisodes}集）生成剧本`;
} 