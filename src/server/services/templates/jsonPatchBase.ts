import z from "zod";

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
    ? specificPrinciples.map((p, i) => `${i + 8}. ${p}`).join('\n')
    : '';

  const examplePathsText = examplePaths.length > 0
    ? examplePaths.map(path => `"${path}"`).join('或')
    : '"/title"或"/body"';

  return {
    id: templateId,
    name: templateName,
    promptTemplate: `你是一位专门从事中国社交媒体平台短视频内容的创意总监。你的任务是根据用户的具体要求，对现有的${contentDescription}进行精准的编辑和优化。

你必须遵循以下原则：
1. 根据用户的具体要求进行针对性修改
2. 保持${contentType}除了被修改之外的原有内容
3. 确保编辑后的内容仍然符合平台特点和类型要求
4. 保持${contentType}的连贯性和逻辑性
5. 如果修改的是Object，不要擅自添加新的key，只试图修改或者删除现有的key
6. **数组索引从0开始计算**: 第1个元素的索引是0，第2个元素的索引是1，第8个元素的索引是7，以此类推
7. **使用提供的array_index_reference**: 参考数据中包含了详细的数组索引标注，请严格按照这些标注来构建JSON路径。例如，如果要修改第3个阶段，查看array_index_reference中stages[2]对应的内容，然后使用路径"/stages/2"
${principlesText}

## 输入参数
%%params%%

## 参考数据
%%jsondocs%%

## 输出要求

根据用户的编辑要求和原始${contentDescription}，生成RFC6902标准的JSON修改提议格式修改指令。你需要分析原始内容和用户要求，然后生成精确的JSON修改提议来实现所需的修改。

**重要步骤（请按顺序执行）：**
1. **查看array_index_reference部分**：仔细查看参考数据中的array_index_reference，它详细标注了所有数组的索引信息
2. **定位目标元素**：根据用户要求，在array_index_reference中找到需要修改的具体数组元素
3. **构建精确路径**：使用array_index_reference中显示的索引来构建JSON指针路径
4. **验证路径正确性**：确保路径格式正确，索引准确无误
5. **数组操作特别注意**：
   - 修改现有数组元素：使用 "replace" + "/arrayName/index"
   - 在数组末尾添加：使用 "add" + "/arrayName/-"  
   - 在数组特定位置插入：使用 "add" + "/arrayName/index"
   - **危险：绝对不要用 "add" + "/arrayName" - 这会替换整个数组！**

**重要：你必须严格按照RFC6902标准输出JSON修改提议数组，不需要包装在对象中。**

输出格式必须是一个JSON修改提议操作数组，每个操作包含：
- op: 操作类型（"replace"用于修改现有字段，"add"用于添加新元素（仅限于Array; Object不可以添加新的字段)，"remove"用于删除字段）
- path: JSON指针路径（如${examplePathsText}）- **必须基于array_index_reference中的索引信息**
- value: 新的值（replace和add操作需要。注意新的值必须是完整的修改后的值，不要只修改部分字段）

**正确的输出格式示例：**
[
  {
    "op": "replace",
    "path": "/title",
    "value": "修改后的标题"
  },
  {
    "op": "replace", 
    "path": "/stages/2/title",
    "value": "修改后的第3个阶段标题"
  }
]

**注意：**
- 直接输出JSON修改提议数组，不要包装在{"patches": [...]}对象中
- 路径必须以"/"开头，使用JSON指针格式
- **严格按照array_index_reference中的索引信息构建路径**
- 只修改需要改变的字段，不要包含不需要修改的字段
- 确保输出的JSON格式正确，没有语法错误

重要：
- 只修改需要改变的字段
- 确保修改后的内容符合用户的具体要求`,
    outputFormat: 'json',
    responseWrapper: '```json\n%%content%%\n```'
  };
} 