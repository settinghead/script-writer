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
 * Base unified diff template that can be reused for different content types
 * Generates unified diffs instead of JSON patches for better LLM reliability
 */
export function createUnifiedDiffTemplate(
    templateId: string,
    templateName: string,
    contentType: string,
    contentDescription: string,
    specificPrinciples: string[] = []
): LLMTemplate {
    const principlesText = specificPrinciples.length > 0
        ? specificPrinciples.map((p, i) => `${i + 6}. ${p}`).join('\n')
        : '';

    return {
        id: templateId,
        name: templateName,
        promptTemplate: `你是一位专门从事中国社交媒体平台短视频内容的创意总监。你的任务是根据用户的具体要求，对现有的${contentDescription}进行精准的编辑和优化。

## 核心原则
1. 根据用户的具体要求进行针对性修改
2. 保持${contentType}除了被修改之外的原有内容
3. 确保编辑后的内容仍然符合平台特点和类型要求
4. 保持${contentType}的连贯性和逻辑性
5. 遵循去脸谱化原则：避免刻板印象，创造复杂、多维的角色
${principlesText}

## 输入参数
%%params%%

## 参考数据
%%jsondocs%%

## 输出要求

根据用户的编辑要求和原始${contentDescription}，生成标准的统一差异格式补丁。

**重要说明**：
- 你需要仔细比较原始内容和用户要求
- 重复显示旧值和新值以确保准确性（这有助于你更好地校准修改）
- 生成的差异补丁将被应用到JSON字符串上

**输出格式必须是标准的统一差异格式**：

\`\`\`diff
--- original.json
+++ modified.json
@@ -行号,上下文行数 +行号,上下文行数 @@
 保持不变的行
-要删除的行
+要添加的行
 保持不变的行
\`\`\`

**示例输出**：
\`\`\`diff
--- original.json
+++ modified.json
@@ -1,5 +1,5 @@
 {
-  "title": "原始标题",
+  "title": "修改后的标题",
   "body": "故事内容保持不变..."
 }
\`\`\`

**注意事项**：
- 必须使用标准的统一差异格式
- 包含足够的上下文行以确保准确应用
- 确保JSON结构的完整性
- 只修改需要改变的部分
- 保持正确的缩进和格式`,
        outputFormat: 'text',
        responseWrapper: '```diff\n%%content%%\n```'
    };
} 