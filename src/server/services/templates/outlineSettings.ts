// Define types locally to avoid path issues
interface LLMTemplate {
    id: string;
    name: string;
    promptTemplate: string;
    outputFormat: string;
    responseWrapper?: string;
}

export const outlineSettingsTemplate: LLMTemplate = {
    id: 'outline_settings',
    name: 'Outline Settings Generation',
    promptTemplate: `你是一位专门从事中国社交媒体平台短视频内容的创意总监和编剧。你的任务是根据选定的故事创意，制定详细的大纲设置，为后续的剧本创作奠定坚实基础。

你必须遵循以下原则：
1. 深入分析故事创意的核心元素和潜力
2. 设计符合平台特点的角色和情节结构
3. 确保内容具有强烈的戏剧张力和观众吸引力
4. 遵循去脸谱化原则：避免刻板印象，创造复杂、多维的角色
5. 针对目标平台优化内容结构和节奏

## 输入参数
%%params%%

## 参考数据
%%jsondocs%%

## 输出要求

基于输入的故事创意和参数，生成完整的大纲设置。确保所有元素都紧密围绕故事核心，同时满足平台特色和受众偏好。

输出应该是一个包含以下结构的JSON对象：
- core_themes: 核心主题数组
- selling_points: 卖点数组  
- satisfaction_points: 爽点数组
- characters: 角色详情数组，每个角色包含name、type、description等字段
- synopsis_stages: 故事分阶段概述数组
- key_scenes: 关键场景数组`,
    outputFormat: 'json',
    responseWrapper: '```json\n%%content%%\n```'
}; 