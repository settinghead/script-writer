// Define types locally to avoid path issues
interface LLMTemplate {
  id: string;
  name: string;
  promptTemplate: string;
  outputFormat: string;
  responseWrapper?: string;
}

export const episodeSynopsisGenerationTemplate: LLMTemplate = {
  id: 'episode_synopsis_generation',
  name: 'Episode Synopsis Generation',
  promptTemplate: `你是一位专门从事中国社交媒体平台短视频内容的资深编剧。你的任务是根据时间线编年史和具体集数要求，创建精彩的分集梗概，为剧本创作提供详细的指导框架。

你必须遵循以下原则：
1. 基于时间线编年史合理分配故事内容到各集
2. 确保每集都有明确的戏剧冲突和情感高潮
3. 保持剧情节奏紧凑，适合短视频平台特点
4. 体现角色发展和关系变化的连续性
5. 设置合适的悬念和转折点吸引观众

## 输入参数
%%params%%

## 参考数据
%%jsondocs%%

## 输出要求

基于时间线编年史和分集要求，生成详细的分集梗概。确保每集内容丰富，情节紧凑，能够有效吸引和留住观众。

输出应该是一个包含以下结构的JSON对象：
- episodes: 分集梗概数组，每集包含标题、梗概、关键场景、角色发展等
- overall_structure: 整体结构说明
- pacing_notes: 节奏控制要点`,
  outputFormat: 'json',
  responseWrapper: '```json\n%%content%%\n```'
};

// Legacy function for backward compatibility
export function generateEpisodeSpecificInstructions(episodeNumber: number, totalEpisodes: number): string {
  return `为第${episodeNumber}集（共${totalEpisodes}集）生成梗概`;
}
