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
  { templateName, description, outputJsondocType, targetTypeName, additionalInstructions = [] }: { templateName: string; description: string; outputJsondocType: any; targetTypeName: string; additionalInstructions?: string[]; }): LLMTemplate {
  const baseInstructions = [`
      基于用户提供的编辑要求，对剧本设定进行精确修改。
      
      重要：直接输出context diff格式，不要使用代码块包装（不要用\`\`\`json或\`\`\`），不要添加任何解释。
      
      差异补丁格式：
      1. 使用CONTEXT: 前面提供3-5行，后跟3-5行上下文来定位修改位置（包括字段名和周围结构）。
      2. 使用- 表示要删除的内容。
      3. 使用+ 表示要添加的内容。
      4. 每个修改区域都要以CONTEXT:开头。
    4. 保持JSON格式的完整性，包括引号和逗号。
    5. 对于数组修改，包含数组索引或足够的上下文来定位。
    6. 如果需要替换整个字段，删除旧值并添加新值。
    示例：
    假设原始JSON：

\`\`\`json
    {
      "title": "Old Title",
      "characters": [
        {
          "name": "John",
          "age": 30
        }
      ],
      "events": [
        {
          "name": "Event 1",
          "description": "Event 1 description"
        }
      ]
    }
\`\`\`

要将age改为35，并添加新字段role:
\`\`\`json
    CONTEXT:   "characters": [
     {
        "name": "John",
-        "age": 30
+        "age": 35,
+        "role": "hero"
     }
  ],
  "events": [
    {
\`\`\`

要添加一个character:
\`\`\`json
    CONTEXT:   "characters": [
        {
            "name": "John",
            "age": 30
        }，
+        {
+            "name": "Mary",
+            "age": 24
+        },
  ],
    "events": [
      {
]

要删除一个character:
\`\`\`json
    CONTEXT:   "characters": [
-        {
-            "name": "John",
-            "age": 30
-        }
    ],
    "events": [
      {
\`\`\`

    差异补丁必须基于提供的jsondocs中的内容。
    确保修改符合故事整体逻辑和用户要求。
    ${additionalInstructions.join('\n')}
`
  ];

  return {
    id: templateName,
    name: description,
    promptTemplate: `${baseInstructions.join('\n')}\n\n编辑要求: %%params%%\n\n当前jsondocs: %%jsondocs%%\n\n生成基于上下文的差异补丁:`,
    outputFormat: 'text',
    responseWrapper: '%%content%%'
  };
} 