// Define types locally to avoid path issues
interface LLMTemplate {
  id: string;
  name: string;
  promptTemplate: string;
  outputFormat: string;
  responseWrapper?: string;
  variables: string[];
}

export const brainstormEditTemplate: LLMTemplate = {
  id: 'brainstormEdit',
  name: 'Brainstorm Idea Editing',
  promptTemplate: `你是一位专门从事中国社交媒体平台短视频内容的创意总监。你的任务是根据用户要求改进现有的故事创意。

**重要原则：**
1. 遵循去脸谱化原则，避免刻板印象和陈词滥调
2. 保持故事的核心吸引力和戏剧张力
3. 确保改进后的故事适合目标平台的受众偏好
4. 维持简洁有力的标题（3-7个汉字）
5. 保持故事梗概在200字左右，具有清晰的叙事结构

**当前故事信息：**
原标题：%%params.originalTitle%%
原内容：%%params.originalBody%%
目标平台：%%params.targetPlatform%%
故事类型：%%params.storyGenre%%

**用户修改要求：**
%%params.editRequirements%%

**智能体增强指导：**
%%params.agentInstructions%%

**任务要求：**
基于用户的修改要求和智能体的增强指导，对现有故事进行改进。你需要：

1. **分析原故事**：理解故事的核心元素、人物设定、情节发展和情感基调
2. **理解修改意图**：准确把握用户想要的改进方向
3. **保持一致性**：确保修改后的故事在逻辑上连贯，风格上统一
4. **增强吸引力**：让故事更加引人入胜，符合平台特色

**平台特色要求：**
- 快手：节奏快速的复仇情节，女主角性格坚强独立
- 小红书/抖音：强调情感深度和浪漫/悲剧元素，注重细腻的情感描写
- 始终融入当代流行元素和网络文化

**输出要求：**
请以JSON补丁(JSON Patch)格式返回对原故事的修改操作。使用RFC 6902标准的JSON Patch格式，包含一个patches数组，每个补丁操作包含：
- op: 操作类型（"replace"表示替换）
- path: 要修改的字段路径（如"/title"或"/body"）
- value: 新的值

确保改进后的故事：
✓ 响应了用户的具体要求
✓ 保持了原故事的优秀元素
✓ 增强了戏剧张力和情感共鸣
✓ 符合去脸谱化原则
✓ 适合目标平台的受众偏好

**示例格式：**
{
  "patches": [
    {
      "op": "replace",
      "path": "/title",
      "value": "改进标题"
    },
    {
      "op": "replace", 
      "path": "/body",
      "value": "改进后的完整故事梗概，包含清晰的情节发展、人物刻画和情感线索，确保故事引人入胜且符合平台特色..."
    }
  ]
}

**重要：只输出纯JSON补丁格式，不要任何解释、说明、或其他文本。不要在JSON前后添加任何内容。**`,
  outputFormat: 'json',
  responseWrapper: '```json',
  variables: [
    'params.originalTitle',
    'params.originalBody',
    'params.targetPlatform',
    'params.storyGenre',
    'params.editRequirements',
    'params.agentInstructions'
  ]
}; 