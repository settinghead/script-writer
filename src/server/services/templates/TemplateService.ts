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

故事类型：{genre}
目标平台：{platform}
{requirementsSection}

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
            variables: ['genre', 'platform', 'requirementsSection']
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