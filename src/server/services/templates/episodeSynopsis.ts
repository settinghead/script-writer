import type { LLMTemplate } from '../../../common/llm/types';

export const episodeSynopsisTemplate: LLMTemplate = {
    id: 'episode_synopsis_generation',
    name: 'Episode Synopsis Generation',
    promptTemplate: `你是专业的中国短剧编剧，专门为抖音、快手、小红书等平台创作2分钟短剧内容。

## 任务
基于剧集框架，为指定剧集组生成详细的每集大纲。每集约2分钟，必须具有强烈的戏剧张力和平台优化的钩子设计。

## 项目背景信息（仅供参考）
%%jsondocs%%

## 生成参数
%%params%%

## 创作要求

### 重要：只为指定剧集组生成内容
- 只生成参数中指定的剧集组（如第1-3集）
- 其他背景信息仅供理解故事脉络，不要为其他集数生成内容

### 2分钟短剧结构
每集必须包含：
1. **开场钩子** (0-3秒) - 立即抓住观众注意力
2. **主要剧情** (3秒-1分30秒) - 核心故事发展
3. **情感高潮** (1分30秒-1分50秒) - 情感冲突达到顶点
4. **结尾悬念** (1分50秒-2分钟) - 强烈钩子引导下集

### 平台优化
- **抖音**: 快节奏、强视觉冲击、年轻化表达
- **快手**: 接地气、真实感、情感共鸣
- **小红书**: 精致美学、生活化场景、情感细腻

### 内容原则
- 遵循去脸谱化原则，避免刻板印象
- 每集必须有独立的情感弧线
- 角色关系发展要有层次感
- 悬念设计要环环相扣

## 输出格式
{
  "groupTitle": "组标题",
  "episodeRange": "集数范围",
  "episodes": [
    {
      "episodeNumber": 1,
      "title": "集标题",
      "openingHook": "开场钩子描述",
      "mainPlot": "主要剧情发展",
      "emotionalClimax": "情感高潮点",
      "cliffhanger": "结尾悬念",
      "suspenseElements": ["悬念元素1", "悬念元素2"],
      "estimatedDuration": 120
    }
  ]
}`,
    outputFormat: 'json',
    variables: ['jsondocs', 'params']
}; 