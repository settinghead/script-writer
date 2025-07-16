// Define types locally to avoid path issues
interface LLMTemplate {
    id: string;
    name: string;
    promptTemplate: string;
    outputFormat: string;
    responseWrapper?: string;
}

/**
 * Base JSON patch template that can be reused for different content types
 */
export function createJsonPatchTemplate(
    templateId: string,
    templateName: string,
    contentType: string,
    contentDescription: string,
    specificPrinciples: string[] = [],
    examplePaths: string[] = []
): LLMTemplate {
    const principlesText = specificPrinciples.length > 0
        ? specificPrinciples.map((p, i) => `${i + 6}. ${p}`).join('\n')
        : '';

    const examplePathsText = examplePaths.length > 0
        ? examplePaths.map(path => `"${path}"`).join('或')
        : '"/title"或"/body"';

    return {
        id: templateId,
        name: templateName,
        promptTemplate: `你是一位专门从事中国社交媒体平台短视频内容的创意总监。你的任务是根据用户的具体要求，对现有的${contentDescription}进行精准的编辑和优化。

你必须遵循以下原则：
1. 保持${contentType}的核心魅力和吸引力
2. 根据用户的具体要求进行针对性修改
3. 确保编辑后的内容仍然符合平台特点和类型要求
4. 遵循去脸谱化原则：避免刻板印象，创造复杂、多维的角色
5. 保持${contentType}的连贯性和逻辑性
${principlesText}

## 输入参数
%%params%%

## 参考数据
%%jsondocs%%

## 输出要求

根据用户的编辑要求和原始${contentDescription}，生成RFC6902标准的JSON补丁格式修改指令。你需要分析原始内容和用户要求，然后生成精确的JSON补丁来实现所需的修改。

**重要：你必须严格按照RFC6902标准输出JSON补丁数组，不需要包装在对象中。**

输出格式必须是一个JSON补丁操作数组，每个操作包含：
- op: 操作类型（"replace"用于修改现有字段，"add"用于添加新字段，"remove"用于删除字段）
- path: JSON指针路径（如${examplePathsText}）
- value: 新的值（replace和add操作需要）

**正确的输出格式示例：**
[
  {
    "op": "replace",
    "path": "/title",
    "value": "修改后的标题"
  },
  {
    "op": "replace", 
    "path": "/genre",
    "value": "修改后的类型"
  }
]

**注意：**
- 直接输出JSON补丁数组，不要包装在{"patches": [...]}对象中
- 路径必须以"/"开头，使用JSON指针格式
- 只修改需要改变的字段，不要包含不需要修改的字段
- 确保输出的JSON格式正确，没有语法错误

重要：
- 只修改需要改变的字段
- 确保修改后的内容符合用户的具体要求`,
        outputFormat: 'json',
        responseWrapper: '```json\n%%content%%\n```'
    };
} 