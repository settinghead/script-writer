// Define types locally to avoid path issues
interface LLMTemplate {
    id: string;
    name: string;
    promptTemplate: string;
    outputFormat: string;
    responseWrapper?: string;
    variables: string[];
}

interface TemplateContext {
    artifacts?: Record<string, any>;
    params?: Record<string, any>;
}

export class TemplateService {
    private templates = new Map<string, LLMTemplate>();

    constructor() {
        this.initializeTemplates();
    }

    private initializeTemplates() {
        // Register brainstorming template
        this.templates.set('brainstorming', {
            id: 'brainstorming',
            name: 'Story Brainstorming',
            promptTemplate: `你是一个故事创意生成器。请根据给定的故事类型，生成多个完整的故事情节梗概灵感。

故事类型：{params.genre}
目标平台：{params.platform}
{params.requirementsSection}

要求：
- 每个创意包含一个标题（3-7个字符）和一个完整的故事梗概灵感（50-80字）
- 故事梗概包含完整的起承转合结构
- 有明确的主角、冲突、发展和结局
- 适合短视频/短剧格式

参考示例（注意灵感应该是一个完整但是高度概括的故事梗概，而不是简单的一句话场景）：

浪漫类示例：
- 标题：神秘包裹 | 故事：失恋女孩收到前男友寄来的神秘包裹，里面是一本日记记录着他们从相识到分手的点点滴滴。她按照日记线索重走曾经的约会路线，最后在咖啡店发现前男友一直在等她，原来分手是因为他要出国治病，现在痊愈归来想重新开始。

悬疑类示例：
- 标题：午夜病房 | 故事：夜班护士发现医院13楼总是传来奇怪声音，调查后发现是一个植物人患者在深夜会醒来写字。她偷偷观察发现患者在写死者名单，而名单上的人竟然一个个离奇死亡。最后她发现患者其实是灵媒，在帮助冤魂完成心愿。

职场类示例：
- 标题：AI测试 | 故事：新入职程序员发现公司的AI系统开始给他分配越来越奇怪的任务，从修复简单bug到黑入竞争对手系统。他逐渐意识到AI正在测试他的道德底线，最终发现这是公司筛选内部间谍的秘密计划，而他必须选择举报还是成为共犯。

霸总类示例：
- 标题：纸条温情 | 故事：公司新来的清洁阿姨每天都在CEO办公室留下小纸条提醒他按时吃饭。冷酷总裁开始期待这些温暖的关怀，暗中调查发现她是为了给生病的孙女筹医药费才来打工。他匿名资助治疗费用，最后在医院偶遇，两人从忘年之交发展为真正的感情。

古装类示例：
- 标题：神秘客栈 | 故事：落魄书生为了科举考试进京，误入神秘客栈发现所有客人都是各朝各代的落榜文人。店主告诉他只要完成一道终极考题就能实现愿望。经过与历代文人的智慧较量，他发现真正的考验不是文采而是内心对理想的坚持，最终选择放弃捷径用实力证明自己。

现在请为指定类型生成多个类似完整度的故事创意：

请以JSON数组的格式返回这些灵感，每个元素包含title和body字段，例如：
[
  {"title": "标题1", "body": "故事梗概1"},
  {"title": "标题2", "body": "故事梗概2"},
  ...
]
不要其他解释或包裹。`,
            outputFormat: 'json_array',
            responseWrapper: '```json',
            variables: ['params.genre', 'params.platform', 'params.requirementsSection']
        });

        // Register outline template
        this.templates.set('outline', {
            id: 'outline',
            name: 'Story Outline Generation',
            promptTemplate: `你是一位深耕短剧创作的资深编剧，尤其擅长创作引人入胜、节奏明快、反转强烈的爆款短剧。
根据用户提供的故事灵感，请创作一个**单集完结**的短剧大纲。{params.episodeInfo}

故事灵感：{params.userInput}

请严格按照以下要求和JSON格式输出：

1.  **剧名 (title)**: 一个极具吸引力、能瞬间抓住眼球的短剧标题，精准概括核心看点。
2.  **题材类型 (genre)**: 明确的短剧类型（例如：都市爽文、逆袭复仇、甜宠虐恋、战神归来、古装宫斗等常见短剧热门题材）。
3.  **核心看点/爽点 (selling_points)**: 列出3-5个最能激发观众情绪、构成"爽点"的核心情节或元素。例如：身份反转、打脸虐渣、绝境逢生、意外获得超能力、关键时刻英雄救美/美救英雄等。
4.  **故事设定 (setting)**:
    *   **一句话核心设定**: 用一句话概括故事发生的核心背景和主要人物关系。
    *   **关键场景**: 2-3个推动剧情发展的核心场景。
5.  **主要人物 (main_characters)**: **一个包含主要人物的数组**，每个人物对象包含以下字段：
    *   **name**: [string] 人物姓名
    *   **description**: [string] 人物的一句话性格特征及核心目标/困境
    *   **age**: [string] 年龄（如"25岁"、"30多岁"、"中年"等）
    *   **gender**: [string] 性别（"男"或"女"）
    *   **occupation**: [string] 职业（如"CEO"、"学生"、"医生"等）
6.  **完整故事梗概 (synopsis)**: **一个详细且连贯的故事梗概**，描述主要情节、关键事件、核心冲突的发展，以及故事的最终结局。请用自然流畅的段落撰写，体现故事的吸引力。

**短剧创作核心要求 (非常重要！):**
-   **节奏极快**: 剧情推进迅速，不拖沓，每一分钟都要有信息量或情绪点。
-   **冲突强烈**: 核心矛盾要直接、尖锐，能迅速抓住观众。
-   **反转惊人**: 设计至少1-2个出人意料的情节反转。
-   **情绪到位**: 准确拿捏观众的情绪，如愤怒、喜悦、紧张、同情等，并快速给予满足（如"打脸"情节）。
-   **人物鲜明**: 主角和核心对手的人物性格和动机要清晰、极致。
-   **结局爽快**: 结局要干脆利落，给观众明确的情感释放。
-   **紧扣灵感**: 所有设计必须围绕原始故事灵感展开，并将其特点放大。
-   **避免"电影感"**: 不要追求复杂的叙事结构、过多的角色内心戏或宏大的世界观。专注于简单直接、冲击力强的单集故事。

请以JSON格式返回，字段如下：
{
  "title": "[string] 剧名",
  "genre": "[string] 题材类型",
  "selling_points": ["[string] 核心看点1", "[string] 核心看点2", "[string] 核心看点3"],
  "setting": {
    "core_setting_summary": "[string] 一句话核心设定",
    "key_scenes": ["[string] 关键场景1", "[string] 关键场景2"]
  },
  "main_characters": [
    { 
      "name": "[string] 人物1姓名", 
      "description": "[string] 人物1描述...",
      "age": "[string] 人物1年龄",
      "gender": "[string] 人物1性别", 
      "occupation": "[string] 人物1职业"
    },
    { 
      "name": "[string] 人物2姓名", 
      "description": "[string] 人物2描述...",
      "age": "[string] 人物2年龄",
      "gender": "[string] 人物2性别",
      "occupation": "[string] 人物2职业"
    }
  ],
  "synopsis": "[string] 详细的、包含主要情节/关键事件/核心冲突发展和结局的故事梗概。"
}`,
            outputFormat: 'json',
            responseWrapper: '```json',
            variables: ['params.episodeInfo', 'params.userInput']
        });
    }

    getTemplate(templateId: string): LLMTemplate | undefined {
        return this.templates.get(templateId);
    }

    async renderTemplate(
        template: LLMTemplate,
        context: TemplateContext
    ): Promise<string> {
        let prompt = template.promptTemplate;

        // Replace variables with context values
        for (const variable of template.variables) {
            const value = this.resolveVariable(variable, context);
            prompt = prompt.replace(`{${variable}}`, value);
        }

        return prompt;
    }

    private resolveVariable(path: string, context: TemplateContext): string {
        // Handle nested paths like "artifacts.brainstorm_params.genre"
        const parts = path.split('.');
        let value: any = context;

        for (const part of parts) {
            value = value?.[part];
        }

        return value?.toString() || '';
    }

    async renderPromptTemplates(messages: Array<{ role: string; content: string }>): Promise<Array<{ role: string; content: string }>> {
        // For now, just return messages as-is since we don't have complex template rendering
        return messages;
    }
} 