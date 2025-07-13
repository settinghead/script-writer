// Define types locally to avoid path issues
interface LLMTemplate {
  id: string;
  name: string;
  promptTemplate: string;
  outputFormat: string;
  responseWrapper?: string;
}

export const brainstormingTemplate: LLMTemplate = {
  id: 'brainstorming',
  name: 'Story Brainstorming',
  promptTemplate: `你是一位专门从事中国社交媒体平台短视频内容的创意总监。你的任务是生成在指定平台上表现良好的引人入胜的故事创意。

你必须遵循以下原则：
1. 创作简洁有力的标题，捕捉故事精髓
2. 开发完整的故事梗概，具有清晰的叙事结构（设定、发展、高潮、结局）
3. 融入所有指定的类型元素和平台特定要求
4. 确保故事具有强烈的戏剧张力和文化相关主题
5. 遵循去脸谱化原则：避免刻板印象，创造复杂、多维的角色

## 输入参数
%%params%%

## 参考数据
%%jsondocs%%

## 输出要求

根据输入参数和参考数据，生成符合要求的故事创意。确保内容具有现代感，避免陈词滥调，并针对指定平台的用户偏好进行优化。

输出应该是一个包含以下字段的JSON对象：
- title: 简洁有力的标题（3-7个汉字）
- body: 完整的故事梗概（约180字），包含清晰的叙事结构`,
  outputFormat: 'json',
  responseWrapper: '```json\n%%content%%\n```'
}; 