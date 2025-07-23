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
 * Generates standard unified diffs optimized for jsdiff library
 */
export function createUnifiedDiffTemplate(
  { templateName, description, outputJsondocType, targetTypeName, additionalInstructions = [] }: { templateName: string; description: string; outputJsondocType: any; targetTypeName: string; additionalInstructions?: string[]; }): LLMTemplate {
  const baseInstructions = [`
      基于用户提供的编辑要求，对剧本设定进行精确修改。
      
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
      +      "温柔善良", 
      +      "聪明机智"
      +    ]
         }
      
      注意：
      - 只修改需要改变的内容
      - 保持JSON格式完整性
      - 提供足够的上下文定位
      - 行号仅用于理解位置，diff中不包含行号
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