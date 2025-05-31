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
3.  **目标受众 (target_audience)**: 
    *   **demographic**: [string] 主要受众群体（如"95-05年女性"、"18-35岁都市白领"、"大学生及刚毕业群体"）
    *   **core_themes**: [string[]] 核心主题，需精准触达目标受众痛点：
        - **情感共鸣类**: "青春怀旧"、"初恋回忆"、"校园时光"
        - **现实困境类**: "初入社会的烦恼"、"职场压力"、"经济焦虑"、"原生家庭问题"
        - **价值观念类**: "价值观冲突"、"理想与现实的差距"、"个人成长与蜕变"
        - **生活状态类**: "都市生存"、"租房生活"、"相亲压力"、"容貌焦虑"
4.  **产品卖点 (selling_points)**: 列出3-5个商业化推广的核心卖点，用于营销推广和产品定位。要求：
    *   **紧扣社会热点话题**: 如容貌焦虑、职场PUA、代际冲突、教育内卷等当下社会关注的议题
    *   **明确价值导向**: 体现正确的价值观，如真善美、努力奋斗、自我成长等正能量主题
    *   **贴合目标受众**: 针对特定人群的痛点和需求，如95-05年女性的情感困惑、职场焦虑等
    *   **具备传播性**: 容易形成话题讨论，能够引发观众共鸣和转发分享
    *   **商业价值明确**: 有利于品牌植入、广告投放或IP衍生开发
    
    示例格式："聚焦当代年轻人容貌焦虑问题，传递内在美胜过外在美的价值观念"、"探讨职场新人面临的道德选择，弘扬诚实守信的职业精神"
5.  **情感爽点 (satisfaction_points)**: 列出3-5个最能激发观众情绪、构成"爽点"的核心情节或元素。要求：
    *   **情绪爆点明确**: 每个爽点都要能瞬间引爆观众情绪，如愤怒、兴奋、感动、解气等
    *   **反转效果强烈**: 情节发展出人意料，形成强烈的心理落差和惊喜感
    *   **代入感强**: 观众容易将自己代入主角，体验到满足感和成就感
    *   **节奏把控精准**: 爽点出现的时机恰到好处，不拖沓不突兀
    
    常见爽点类型：
    - **身份反转类**: "被看不起的灰姑娘原来是隐藏的豪门千金"
    - **打脸复仇类**: "曾经嘲笑主角的恶人被主角的成功狠狠打脸"
    - **能力觉醒类**: "平凡女孩突然获得超能力，逆袭成为最强者"
    - **情感逆袭类**: "冷酷总裁为了女主主动放下身段，公开示爱"
    - **正义伸张类**: "坏人得到应有惩罚，好人获得圆满结局"
6.  **故事设定 (setting)**:
    *   **core_setting_summary**: [string] 一句话核心设定
    *   **key_scenes**: [string[]] 2-3个推动剧情发展的核心场景
7.  **人物角色 (characters)**: **完整的角色体系数组**，每个人物对象包含以下字段：
    *   **name**: [string] 人物姓名
    *   **type**: [string] 角色类型（"male_lead", "female_lead", "male_second", "female_second", "male_supporting", "female_supporting", "antagonist", "other"）
    *   **description**: [string] 人物的一句话性格特征及核心目标/困境
    *   **age**: [string] 年龄（如"25岁"、"30多岁"、"中年"等）
    *   **gender**: [string] 性别（"男"或"女"）
    *   **occupation**: [string] 职业（如"CEO"、"学生"、"医生"等）
    *   **personality_traits**: [string[]] 主要性格特点
    *   **character_arc**: [string] 人物成长轨迹
    *   **relationships**: {[key: string]: string} 与其他角色的关系
    *   **key_scenes**: [string[]] 该角色的重要戏份场景
8.  **分段故事梗概 (synopsis_stages)**: **总计约2000字的详细故事发展，分为5个阶段**：
    *   **第一阶段（约400字）**: 背景设定与人物介绍
        - 详细描述故事发生的时间、地点、社会背景
        - 介绍主要角色的身份、性格、目标和初始状态
        - 建立故事的基调和氛围
        - 埋下后续冲突的伏笔
    *   **第二阶段（约400字）**: 初始冲突与矛盾爆发
        - 引入核心矛盾和冲突点
        - 主角面临的第一个重大挑战或转折
        - 各方势力和利益关系的初步显现
        - 推动故事向前发展的关键事件
    *   **第三阶段（约400字）**: 情节发展与关系复杂化
        - 矛盾逐步升级，情节层层递进
        - 人物关系网络变得复杂，新的角色登场
        - 主角的成长和变化开始显现
        - 为高潮部分做铺垫和蓄力
    *   **第四阶段（约400字）**: 高潮对决与重大反转
        - 故事达到最紧张激烈的对决时刻
        - 出现意想不到的重大反转或真相揭露
        - 主角面临最严峻的考验和选择
        - 各个伏笔开始收尾，爽点集中爆发
    *   **第五阶段（约400字）**: 结局收尾与情感升华
        - 所有矛盾得到解决，善恶得到应有结果
        - 主角完成成长蜕变，实现目标或理想
        - 情感得到升华，传递正能量价值观
        - 给观众留下深刻印象和情感满足

**短剧创作核心要求 (非常重要！):**
-   **节奏极快**: 剧情推进迅速，不拖沓，每一分钟都要有信息量或情绪点。
-   **冲突强烈**: 核心矛盾要直接、尖锐，能迅速抓住观众。
-   **反转惊人**: 设计至少1-2个出人意料的情节反转。
-   **情绪到位**: 准确拿捏观众的情绪，如愤怒、喜悦、紧张、同情等，并快速给予满足（如"打脸"情节）。
-   **人物鲜明**: 主角和核心对手的人物性格和动机要清晰、极致。
-   **结局爽快**: 结局要干脆利落，给观众明确的情感释放。
-   **紧扣灵感**: 所有设计必须围绕原始故事灵感展开，并将其特点放大。
-   **避免"电影感"**: 不要追求复杂的叙事结构、过多的角色内心戏或宏大的世界观。专注于简单直接、冲击力强的单集故事。
-   **完整角色体系**: 必须包含男主、女主、男二、女二等完整的角色配置。
-   **详细梗概**: synopsis_stages总字数应达到约2000字，每个阶段都要详细描述。

请以JSON格式返回，字段如下：
{
  "title": "[string] 剧名",
  "genre": "[string] 题材类型",
  "target_audience": {
    "demographic": "[string] 主要受众群体",
    "core_themes": ["[string] 核心主题1", "[string] 核心主题2", "[string] 核心主题3"]
  },
  "selling_points": ["[string] 产品卖点1", "[string] 产品卖点2", "[string] 产品卖点3"],
  "satisfaction_points": ["[string] 情感爽点1", "[string] 情感爽点2", "[string] 情感爽点3"],
  "setting": {
    "core_setting_summary": "[string] 一句话核心设定",
    "key_scenes": ["[string] 关键场景1", "[string] 关键场景2"]
  },
  "characters": [
    { 
      "name": "[string] 人物姓名", 
      "type": "[string] 角色类型",
      "description": "[string] 人物描述",
      "age": "[string] 年龄",
      "gender": "[string] 性别", 
      "occupation": "[string] 职业",
      "personality_traits": ["[string] 性格特点1", "[string] 性格特点2"],
      "character_arc": "[string] 人物成长轨迹",
      "relationships": {
        "其他角色名": "关系描述"
      },
      "key_scenes": ["[string] 重要场景1", "[string] 重要场景2"]
    }
  ],
  "synopsis_stages": [
    "[string] 第一阶段：背景设定与人物介绍（约400字）",
    "[string] 第二阶段：初始冲突与矛盾爆发（约400字）",
    "[string] 第三阶段：情节发展与关系复杂化（约400字）",
    "[string] 第四阶段：高潮对决与重大反转（约400字）",
    "[string] 第五阶段：结局收尾与情感升华（约400字）"
  ]
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