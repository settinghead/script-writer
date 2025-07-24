import z from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

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
 * Generates standard unified diffs optimized for jsdiff library
 */
export function createUnifiedDiffTemplate(
  {
    templateName,
    description,
    outputJsondocType,
    targetTypeName,
    schema,
    additionalInstructions = []
  }: {
    templateName: string;
    description: string;
    outputJsondocType: any;
    targetTypeName: string;
    schema: z.ZodSchema<any>;
    additionalInstructions?: string[];
  }): LLMTemplate {

  // Convert Zod schema to JSON schema for LLM consumption
  const jsonSchema = zodToJsonSchema(schema, {
    name: `${targetTypeName}Schema`,
    target: "openApi3"
  });

  const baseInstructions = [`基于用户提供的编辑要求，对${targetTypeName}进行精确修改。

**重要：所有修改必须严格遵循以下数据结构规范：**

\`\`\`json
${JSON.stringify(jsonSchema, null, 2)}
\`\`\`

**数据结构验证要求：**
- 所有字段必须符合上述JSON Schema定义的类型和格式要求
- 不能添加Schema中未定义的字段
- 不能删除Schema中标记为required的字段
- 数组字段必须包含正确类型的元素
- 枚举字段只能使用Schema中定义的值
- 字符串字段必须满足任何长度或格式限制

重要：直接输出标准unified diff格式，不要使用代码块包装（不要用\`\`\`json或\`\`\`），不要添加任何解释。

输入JSON已添加行号以帮助定位。生成diff时请忽略行号，只处理实际的JSON内容。

标准unified diff格式：
1. 文件头：--- a/file.json 和 +++ b/file.json
2. 区块头：@@ -起始行,行数 +起始行,行数 @@
3. 使用 - 表示要删除的行
4. 使用 + 表示要添加的行  
5. 使用空格表示上下文行（不变的行）
6. 提供足够的上下文行（前后各3-5行）

示例：
假设要将title从"旧标题"改为"新标题"：

--- a/file.json
+++ b/file.json
@@ -1,5 +1,5 @@
  {
-  "title": "旧标题",
+  "title": "新标题",
    "genre": "都市奇幻爽文",
    "platform": "抖音"
  }

对于数组修改，替换整个数组：

--- a/file.json
+++ b/file.json
@@ -5,8 +5,8 @@
      "name": "张三",
-    "personality_traits": [
-      "冷漠自私",
-      "嘴硬心软"
-    ]
+    "personality_traits": [
      "聪明机智"
    ]
    }

注意：
- 只修改需要改变的内容
- 保持JSON格式完整性
- 提供足够的上下文定位
- 行号仅用于理解位置，diff中不包含行号
- **确保所有修改后的数据都符合上述Schema定义**
`];

  const allInstructions = [...baseInstructions, ...additionalInstructions].join('\n');

  return {
    id: templateName,
    name: description,
    promptTemplate: `
${allInstructions}

**编辑要求：**
%%params%%

**当前${targetTypeName}设定（带行号）：**
%%jsondocs%%
`,
    outputFormat: "unified_diff",
    responseWrapper: "直接输出unified diff，无需包装"
  };
} 