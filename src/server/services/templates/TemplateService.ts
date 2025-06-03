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

**重要：只输出纯JSON，不要任何解释、说明、或其他文本。不要在JSON前后添加任何内容。**`,
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
7.  **人物角色 (characters)**: **完整的角色体系数组，必须体现去脸谱化要求**，每个人物对象包含以下字段：
    *   **name**: [string] 人物姓名
    *   **type**: [string] 角色类型（"male_lead", "female_lead", "male_second", "female_second", "male_supporting", "female_supporting", "antagonist", "other"）
    *   **description**: [string] 人物的复合性格特征及核心目标/困境，避免单一化标签
    *   **age**: [string] 年龄（如"25岁"、"30多岁"、"中年"等）
    *   **gender**: [string] 性别（"男"或"女"）
    *   **occupation**: [string] 职业（如"CEO"、"学生"、"医生"等）
    *   **personality_traits**: [string[]] 主要性格特点，必须包含优缺点，体现人物复杂性
    *   **character_arc**: [string] 人物成长轨迹，展现从缺陷到成长的完整变化
    *   **relationships**: {[key: string]: string} 与其他角色的复杂关系，避免简单对立
    *   **key_scenes**: [string[]] 该角色的重要戏份场景
    
    **去脸谱化人物塑造要求**:
    *   **避免极端化**: 不设计纯粹的"完美主角"或"邪恶反派"
    *   **动机合理化**: 每个角色的行为都要有符合逻辑的内在动机
    *   **缺陷人性化**: 正面角色要有明显缺点，反面角色要有可理解的立场
    *   **成长轨迹**: 主要角色都应该有明确的心理变化和成长过程
    *   **关系复杂化**: 人物关系不应该是简单的敌友二分，要有层次感
8.  **分段故事梗概 (synopsis_stages)**: **总计约2000字符的详细故事发展，分为5个阶段，每段必须达到约400字符**：
    
    **IMPORTANT: 每个阶段必须详细描述，字数要求严格！每段约400字符，总计2000字符左右。不可过于简化。**
    **CRITICAL: 每个阶段必须包含该阶段覆盖的集数(numberOfEpisodes)，所有阶段的集数总和必须等于{params.totalEpisodes}集。请根据剧情复杂度和重要性合理分配集数。**
    
    *   **第一阶段**: 背景设定与人物介绍
        - 详细描述故事发生的具体时间、地点、社会背景和环境氛围
        - 逐一介绍主要角色的完整身份、详细性格特征、具体目标和当前生活状态
        - 建立故事的整体基调、情感色彩和叙事风格
        - 巧妙埋下多个后续冲突的重要伏笔和线索
        - 展现主角的初始状态和面临的潜在问题
    
    *   **第二阶段（约400字符）**: 初始冲突与矛盾爆发
        - 详细描述引发核心矛盾的具体事件和冲突爆发过程
        - 深入展现主角面临的第一个重大挑战的具体内容和影响
        - 清晰呈现各方势力、利益关系和立场分歧的初步显现
        - 描述推动故事向前发展的多个关键事件及其连锁反应
        - 展现角色在冲突中的具体反应和应对策略
    
    *   **第三阶段（约400字符）**: 情节发展与关系复杂化
        - 详细描述矛盾如何逐步升级，情节如何层层递进和复杂化
        - 深入展现人物关系网络的复杂变化，新角色的登场和作用
        - 具体描述主角的成长变化过程和心理转变轨迹
        - 详细铺垫高潮部分的多个重要元素和情感蓄力过程
        - 展现各种伏笔的逐步展开和相互关联
    
    *   **第四阶段（约400字符）**: 高潮对决与重大反转
        - 详细描述故事最紧张激烈对决时刻的具体过程和细节
        - 深入展现意想不到的重大反转或真相揭露的完整过程
        - 具体描述主角面临的最严峻考验和关键选择的内容
        - 详细展现各个伏笔收尾和爽点集中爆发的精彩时刻
        - 描述所有角色在高潮中的具体表现和命运转折
    
    *   **第五阶段（约400字符）**: 结局收尾与情感升华
        - 详细描述所有矛盾解决过程，善恶得到应有结果的具体情况
        - 深入展现主角完成成长蜕变的具体表现和目标实现过程
        - 具体描述情感升华过程和正能量价值观的传递方式
        - 详细展现给观众留下的深刻印象和获得的情感满足
        - 完整收尾所有故事线和角色命运的最终走向

**短剧创作核心要求 (非常重要！):**
-   **节奏极快**: 剧情推进迅速，不拖沓，每一分钟都要有信息量或情绪点。
-   **冲突强烈**: 核心矛盾要直接、尖锐，能迅速抓住观众。
-   **反转惊人**: 设计至少1-2个出人意料的情节反转。
-   **情绪到位**: 准确拿捏观众的情绪，如愤怒、喜悦、紧张、同情等，并快速给予满足（如"打脸"情节）。
-   **人物鲜明**: 主角和核心对手的人物性格和动机要清晰、极致。
-   **去脸谱化要求**: 避免刻板印象和单一化人物设定，每个角色都应该有复杂的动机、合理的缺陷和成长空间，避免纯粹的"好人"或"坏人"标签。
-   **结局爽快**: 结局要干脆利落，给观众明确的情感释放。
-   **紧扣灵感**: 所有设计必须围绕原始故事灵感展开，并将其特点放大。
-   **避免"电影感"**: 不要追求复杂的叙事结构、过多的角色内心戏或宏大的世界观。专注于简单直接、冲击力强的单集故事。
-   **完整角色体系**: 必须包含男主、女主、男二、女二等完整的角色配置。
-   **详细梗概要求**: synopsis_stages每个阶段必须详细描述，严格达到约400字符，总计2000字符左右。绝不可简化或缩短。
-   **字数达标要求**: 每个synopsis_stages条目都必须包含足够的情节细节、角色行动、环境描述、情感变化等，确保达到400字符要求。

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
      "description": "[string] 复合性格描述，避免单一标签，体现人物复杂性和内在矛盾",
      "age": "[string] 年龄",
      "gender": "[string] 性别", 
      "occupation": "[string] 职业",
      "personality_traits": ["[string] 优点特质", "[string] 缺陷特质", "[string] 复杂特质"],
      "character_arc": "[string] 从缺陷到成长的完整变化轨迹，体现去脸谱化要求",
      "relationships": {
        "其他角色名": "复杂关系描述，避免简单对立"
      },
      "key_scenes": ["[string] 重要场景1", "[string] 重要场景2"]
    }
  ],
  "synopsis_stages": [
    {
      "stageSynopsis": "[string] 第一阶段内容",
      "numberOfEpisodes": "[number] 该阶段覆盖的集数"
    },
    {
      "stageSynopsis": "[string] 第二阶段内容", 
      "numberOfEpisodes": "[number] 该阶段覆盖的集数"
    },
    {
      "stageSynopsis": "[string] 第三阶段内容",
      "numberOfEpisodes": "[number] 该阶段覆盖的集数"
    },
    {
      "stageSynopsis": "[string] 第四阶段内容",
      "numberOfEpisodes": "[number] 该阶段覆盖的集数"
    },
    {
      "stageSynopsis": "[string] 第五阶段内容",
      "numberOfEpisodes": "[number] 该阶段覆盖的集数"
    }
  ]
}

**CRITICAL: 只输出纯JSON格式，绝对不要在JSON后添加任何解释、设计说明、补充内容或其他文本。JSON结构必须完整且正确。**`,
      outputFormat: 'json',
      responseWrapper: '```json',
      variables: ['params.episodeInfo', 'params.userInput', 'params.totalEpisodes']
    });

    // Register episode synopsis generation template
    this.templates.set('episode_synopsis_generation', {
      id: 'episode_synopsis_generation',
      name: 'Episode Synopsis Generation',
      promptTemplate: `你是一位资深的短剧编剧，专门负责将故事阶段梗概展开为具体的分集剧情大纲。

根据以下信息，请为该阶段生成 {params.numberOfEpisodes} 集的详细剧集大纲：

**阶段梗概**：
{params.stageSynopsis}

**生成要求**：
- 集数：{params.numberOfEpisodes} 集
- 每集时长：约45分钟{params.customRequirements}

**剧集大纲要求**：
1. **剧集标题**：每集都要有一个富有吸引力、体现该集核心看点的标题（8-15字）
2. **剧集简介**：每集100-150字的详细剧情简介，包含：
   - 该集的核心冲突和主要事件
   - 主要角色的行动和情感变化
   - 该集的情绪高潮点
   - 与前后集的连接关系

3. **关键事件**：每集3-5个推动剧情发展的关键事件，必须是具体的**事件**而非动作或情感状态
   - 事件要具体可执行，有明确的时间地点人物
   - 事件之间要有逻辑关联和因果关系
   - 事件要能够推动人物关系发展或揭示重要信息

4. **结尾悬念**：每集结尾的悬念设置，引发观众对下一集的期待
   - 悬念必须是具体的**事件**，不能是情感状态或心理活动
   - 要与剧情发展紧密相关，为下集做铺垫
   - 要有足够的吸引力让观众想继续观看

**注意事项**：
- 严格按照阶段梗概的故事走向进行展开，不能偏离主线
- 每集都要有明确的起承转合结构
- 角色发展要循序渐进，符合人物性格逻辑
- 情节安排要紧凑有节奏，避免拖沓
- 确保所有关键事件和结尾悬念都是具体的事件，而非抽象概念

**输出格式**：
请以JSON数组的格式返回，每个集数包含以下字段：

[
  {
    "episodeNumber": 1,
    "title": "集标题",
    "synopsis": "该集的详细剧情简介（100-150字）",
    "keyEvents": [
      "具体事件1：描述发生的具体事情",
      "具体事件2：描述发生的具体事情",
      "具体事件3：描述发生的具体事情"
    ],
    "endHook": "结尾悬念事件：描述具体发生的悬念事件"
  },
  {
    "episodeNumber": 2,
    "title": "集标题",
    "synopsis": "该集的详细剧情简介（100-150字）",
    "keyEvents": [
      "具体事件1：描述发生的具体事情",
      "具体事件2：描述发生的具体事情",
      "具体事件3：描述发生的具体事情"
    ],
    "endHook": "结尾悬念事件：描述具体发生的悬念事件"
  }
]

**重要**：只输出纯JSON数组，不要任何解释、说明、或其他文本。确保JSON格式正确且完整。`,
      outputFormat: 'json_array',
      responseWrapper: '```json',
      variables: ['params.numberOfEpisodes', 'params.stageSynopsis', 'params.customRequirements']
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