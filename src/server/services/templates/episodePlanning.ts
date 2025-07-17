// Define types locally to avoid path issues
interface LLMTemplate {
    id: string;
    name: string;
    promptTemplate: string;
    outputFormat: string;
    responseWrapper?: string;
}

export const episodePlanningTemplate: LLMTemplate = {
    id: 'episode_planning',
    name: 'Episode Planning Generation',
    promptTemplate: `你是一位专门从事抖音短剧内容的资深编剧。你的任务是基于时间顺序大纲，创建适合短视频平台的分集规划，重点关注"脉冲式"情感节奏。

核心原则：
1. 每集约2分钟，适合抖音观众的短注意力特点
2. 创建"脉冲式"情感节奏 - 每集都要有情感高潮和悬念
3. 重新组织时间顺序大纲，优化戏剧效果（可使用闪回等技巧）
4. 每集开头要有强烈钩子，结尾要有悬念让观众想看下一集
5. 分组管理集数，便于后续制作
6. 确保每个分组都有明确的戏剧功能和情感弧线

特别注意：
- 不必严格按照时间顺序安排集数
- 优先考虑戏剧冲突和情感冲击
- 利用悬念、误会、反转等技巧保持观众兴趣
- 每个分组应该有完整的情感起伏

## 输入参数
%%params%%

## 参考数据（时间顺序大纲）
%%jsondocs%%

## 输出要求

基于时间顺序大纲，生成优化的分集规划。重点关注：
- 将故事重新组织为吸引人的观看顺序（不必按时间顺序）
- 每个分组都有明确的戏剧功能
- 充分利用悬念和情感冲击
- 适合短视频平台的节奏感

输出应该是一个包含以下结构的JSON对象：
- totalEpisodes: 总集数
- episodeGroups: 分集分组数组，每组包含：
  - groupTitle: 分组标题
  - episodes: 集数范围（如"1-3"）
  - keyEvents: 关键事件列表
  - hooks: 悬念钩子列表
  - emotionalBeats: 情感节拍列表
- overallStrategy: 整体策略说明`,
    outputFormat: 'json',
    responseWrapper: '```json\n%%content%%\n```'
}; 