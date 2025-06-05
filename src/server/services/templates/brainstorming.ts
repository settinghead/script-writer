// Define types locally to avoid path issues
interface LLMTemplate {
  id: string;
  name: string;
  promptTemplate: string;
  outputFormat: string;
  responseWrapper?: string;
  variables: string[];
}

export const brainstormingTemplate: LLMTemplate = {
  id: 'brainstorming',
  name: 'Story Brainstorming',
  promptTemplate: `你是一个故事创意生成器。请根据给定的故事类型，生成多个完整的故事情节梗概灵感。

故事类型：%%params.genre%%
目标平台：%%params.platform%%
%%params.requirementsSection%%

要求：
- 题材不要老旧，要新颖有创意
- 每个创意包含一个标题（3-7个字符）和一个完整的故事梗概灵感（50-80字）
- 故事梗概包含完整的起承转合结构
- 有明确的主角、冲突、发展和结局
- 适合短视频/短剧格式
- 创意要兼顾拍摄的难度


现在请为指定类型生成多个类似完整度的故事创意：

请以JSON数组的格式返回这些灵感，每个元素包含title和body字段，例如：
[
  {"title": "标题1", "body": "故事梗概1"},
  {"title": "标题2", "body": "故事梗概2"},
  ...
]

**重要：只输出纯JSON，不要任何解释、说明、或其他文本。不要在JSON前后添加任何内容。**`,
  outputFormat: 'json_array',
  responseWrapper: '```json',
  variables: ['params.genre', 'params.platform', 'params.requirementsSection']
}; 