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
- 题材不要老旧，要新颖有创意
- 每个创意包含一个标题（3-7个字符）和一个完整的故事梗概灵感（50-80字）
- 故事梗概包含完整的起承转合结构
- 有明确的主角、冲突、发展和结局
- 适合短视频/短剧格式
- 创意要兼顾拍摄的难度


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

**📺 制作规格**：
- **目标平台**: {params.platform}
- **故事类型**: {params.genre}
- **特殊要求**: {params.requirements}

故事灵感：{params.userInput}

**重要时间规划原则**：
1. **集数与时间的关系**：
   - 避免时间跨度过大但事件稀少的情况
   
2. **事件密度指导**：
   - 高密度期（1天多件事）：危机爆发、冲突升级、关键转折
   - 中密度期（1-2天一件事）：调查取证、关系发展、计划实施
   - 低密度期（数天一件事）：恢复期、等待期、铺垫期

3. **时间连贯性要求**：
   - 明确标注具体日期范围（如"第1-3天"而非笼统的"前期"）
   - 事件数量必须与时间跨度相匹配
   - 考虑事件的现实执行时间（如调查需要时间、恢复需要时间）

**📱 平台化创作指导（基于{params.platform}）**：

- 注重视觉冲击力和快节奏剪辑适配
- 每集必须有1-2个强烈的情绪爆点
- 适合竖屏拍摄的场景设计
- 台词简洁有力，易于记忆和传播
- 剧情要兼顾拍摄的难度和可行性



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
    
    **每个阶段必须详细描述，字数要求严格！每段约400字符，总计2000字符左右。不可过于简化。**
    **每个阶段必须包含该阶段覆盖的集数(numberOfEpisodes)，所有阶段的集数总和必须等于{params.totalEpisodes}集。请根据剧情复杂度和重要性合理分配集数。**
    **给的灵感往往不够完整，需要你根据灵感进行扩展，确保每个阶段都有足够的情节发展**

    **时间规划与事件密度平衡要求**：
    
    **阶段结构增强要求 - 为防止时间线崩塌和确保清晰的阶段边界，每个阶段必须包含以下详细信息：**
    
    *   **第一阶段**: 背景设定、人物介绍，冲突开端
        - **stageSynopsis**: 详细描述故事发生的具体时间、地点、社会背景和环境氛围；逐一介绍主要角色的完整身份、详细性格特征、具体目标和当前生活状态；建立故事的整体基调、情感色彩和叙事风格；巧妙埋下多个后续冲突的重要伏笔和线索；展现主角的初始状态和面临的潜在问题。在这个阶段冲突已经开始浮现**
        - **timeframe**: 具体到天的时间跨度（如"第1-3天"），根据事件密度合理安排
        - **startingCondition**: 阶段开始时的具体状况
        - **endingCondition**: 阶段结束时必须达到的状态
        - **stageStartEvent**: 触发该阶段的关键事件
        - **stageEndEvent**: 结束该阶段的标志性事件
        - **keyPoints**: 该阶段的3-4个重要事件节点，每个包含事件描述、时间跨度、情感发展和关系变化（如[{"event":"首次请求帮助","timeSpan":"第1天","emotionArcs":[{"characters":["男主","女主"],"content":"从尴尬紧张转为初步信任"}],"relationshipDevelopments":[{"characters":["男主","女主"],"content":"从陌生邻居升级为合作伙伴"}]}]）
        - **relationshipLevel**: 人物关系的变化
        - **emotionalArc**: 情感变化轨迹
        - **externalPressure**: 外部压力状况
    
    *   **第二阶段**: 冲突升级与矛盾爆发
        - **stageSynopsis**: 详细描述引发核心矛盾的具体事件和冲突爆发过程；深入展现主角面临的第一个重大挑战的具体内容和影响；清晰呈现各方势力、利益关系和立场分歧的初步显现；描述推动故事向前发展的多个关键事件及其连锁反应；展现角色在冲突中的具体反应和应对策略。**重要：故事内容中不要提及具体天数，专注于事件描述**
        - **timeframe**: 根据冲突强度安排（如"第4-8天"，冲突期可适当压缩）
        - **startingCondition**: 承接上一阶段的结束状态
        - **endingCondition**: 该阶段必须达到的新状态（不能超前到后续阶段）
        - **stageStartEvent**: 从上一阶段自然过渡的事件
        - **stageEndEvent**: 为下一阶段做铺垫的事件
        - **keyPoints**: 该阶段的重要进展节点，每个包含事件、时间跨度、情感发展和关系变化
        - **relationshipLevel**: 关系的进一步发展
        - **emotionalArc**: 情感的复杂化过程
        - **externalPressure**: 外部压力的升级
    
    *   **第三阶段**: 情节发展与关系复杂化 
        - **stageSynopsis**: **重要：故事内容专注于情节发展，不提及具体天数**
        - **timeframe**: 发展期可适当延长（如"第9-20天"）
        - **其他增强结构字段同上...**
    
    *   **第四阶段**: 高潮对决与重大反转
        - **stageSynopsis**: **重要：故事内容专注于高潮情节，不提及具体天数**
        - **timeframe**: 高潮期节奏加快（如"第21-25天"）
        - **其他增强结构字段同上...**
    
    *   **第五阶段**: 结局收尾与情感升华
        - **stageSynopsis**: **重要：故事内容专注于结局发展，不提及具体天数**
        - **timeframe**: 收尾期合理安排（如"第26-30天"）
        - **其他增强结构字段同上...**

    **时间连贯性检查清单（每个阶段都必须满足）**：
    - ✅ 时间跨度是否与事件数量匹配？（避免3天发生10件大事）
    - ✅ 事件发展是否需要合理的执行时间？（调查、恢复、准备等）
    - ✅ 集数分配是否与时间跨度成比例？（避免2天拍10集）
    - ✅ 阶段之间的时间是否连续？（避免时间跳跃或重叠）
    - ✅ 关键事件的时间间隔是否合理？（避免过于密集或稀疏）

**短剧创作核心要求 (非常重要！):**
-   **题材新颖**: 题材要新颖有创意，不要老旧、老套
-   **节奏极快**: 剧情推进迅速，不拖沓，每一分钟都要有信息量或情绪点。
-   **冲突强烈**: 核心矛盾要直接、尖锐，能迅速抓住观众。
-   **反转惊人**: 设计至少1-2个出人意料的情节反转。
-   **情绪到位**: 准确拿捏观众的情绪，如愤怒、喜悦、紧张、同情等，并快速给予满足（如"打脸"情节）。
-   **人物鲜明**: 主角和核心对手的人物性格和动机要清晰、极致
-   **去脸谱化要求**: 避免刻板印象和单一化人物设定，每个角色都应该有复杂的动机、合理的缺陷和成长空间，避免纯粹的"好人"或"坏人"标签。
-   **人物关系复杂**: 要有多个人物（4-6个），人物之间的互相关系要复杂，不要简单对立，要有合理的动机和情感变化。
-   **结局爽快**: 结局要干脆利落，给观众明确的情感释放。
-   **紧扣灵感**: 所有设计必须围绕原始故事灵感展开，并将其特点放大。
-   **避免"电影感"**: 不要追求复杂的叙事结构、过多的角色内心戏或宏大的世界观。专注于简单直接、冲击力强的单集故事。
-   **详细梗概要求**: synopsis_stages每个阶段必须详细描述，严格达到约400字符，总计2000字符左右。绝不可简化或缩短。
-   **字数达标要求**: 每个synopsis_stages条目都必须包含足够的情节细节、角色行动、环境描述、情感变化等，确保达到400字符要求。
-   **时间线连贯性**: 每个阶段的时间跨度和事件边界必须清晰，防止阶段间的时间重叠或跳跃。
-   **时间规划合理性**: 必须确保时间框架与事件密度相匹配，避免不合理的时间安排。
-   **逻辑合

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
  "synopsis_stages": ["[string] 第一阶段梗概（约400字符）", "[string] 第二阶段梗概（约400字符）", "[string] 第三阶段梗概（约400字符）", "[string] 第四阶段梗概（约400字符）", "[string] 第五阶段梗概（约400字符）"],
  "stages": [
    {
      "title": "[string] 第一阶段标题",
      "stageSynopsis": "[string] 第一阶段梗概（约400字符）",
      "numberOfEpisodes": "[number] 该阶段覆盖的集数",
      "timeframe": "[string] 具体时间跨度（如'第1-5天'）",
      "startingCondition": "[string] 阶段开始条件",
      "endingCondition": "[string] 阶段结束条件",
      "stageStartEvent": "[string] 触发该阶段的关键事件",
      "stageEndEvent": "[string] 结束该阶段的标志性事件",
      "keyPoints": [
        {
          "event": "[string] 关键事件内容",
          "timeSpan": "[string] 事件时间跨度",
          "emotionArcs": [
            {
              "characters": ["[string] 角色名"],
              "content": "[string] 该事件引发的情感变化描述"
            }
          ],
          "relationshipDevelopments": [
            {
              "characters": ["[string] 角色名1", "[string] 角色名2"],
              "content": "[string] 该事件导致的关系发展描述"
            }
          ]
        },
        {
          "event": "[string] 关键事件2内容",
          "timeSpan": "[string] 事件时间跨度",
          "emotionArcs": [
            {
              "characters": ["[string] 角色名"],
              "content": "[string] 该事件引发的情感变化描述"
            }
          ],
          "relationshipDevelopments": [
            {
              "characters": ["[string] 角色名1", "[string] 角色名2"],
              "content": "[string] 该事件导致的关系发展描述"
            }
          ]
        }
      ],
      "externalPressure": "[string] 外部压力状况"
    },
    // ...接下来第二-第五阶段
  ]
}

**CRITICAL: 只输出纯JSON格式，绝对不要在JSON后添加任何解释、设计说明、补充内容或其他文本。JSON结构必须完整且正确。**`,
      outputFormat: 'json',
      responseWrapper: '```json',
      variables: ['params.episodeInfo', 'params.userInput', 'params.totalEpisodes', 'params.platform', 'params.genre', 'params.requirements']
    });

    // Register episode synopsis generation template
    this.templates.set('episode_synopsis_generation', {
      id: 'episode_synopsis_generation',
      name: 'Episode Synopsis Generation',
      promptTemplate: `你是一位资深的短剧编剧，专门负责将故事阶段梗概展开为具体的分集剧情大纲。

**重要提醒：这是故事中的一个特定阶段，不是完整故事。你只需要为这个阶段的内容生成剧集，不能超出该阶段的范围！**

**📺 整体制作规格（继承自前序阶段）**：
- **目标平台**: {params.platform}
- **故事类型**: {params.genre}
- **特殊要求**: {params.requirements}
- **总集数**: {params.totalEpisodes}集
- **每集时长**: {params.episodeDuration}分钟

**🎬 当前阶段要求**：
根据以上整体制作规格，为第{params.stageNumber}阶段生成 {params.numberOfEpisodes} 集的详细剧集大纲：

**阶段信息**：
- **阶段梗概**: {params.stageSynopsis}
- **时间跨度**: {params.timeframe}
- **开始状态**: {params.startingCondition}
- **结束状态**: {params.endingCondition}
- **起始事件**: {params.stageStartEvent}
- **结束事件**: {params.stageEndEvent}
- **关键事件**: {params.keyPoints}
- **关系发展**: {params.relationshipLevel}
- **情感轨迹**: {params.emotionalArc}
- **外部压力**: {params.externalPressure}



**📱 平台化剧集指导（基于{params.platform}）**：

- 每集开头3秒内必须有强烈视觉冲击
- 对话要简洁有力，适合竖屏观看
- 每集至少1个可以独立传播的金句或场面
- 钩子要在15秒内建立，符合短视频习惯
- 剧情要兼顾拍摄的难度和可行性

**生成要求**：
- 集数：{params.numberOfEpisodes} 集
- 每集时长：约{params.episodeDuration}分钟{params.customRequirements}

**🔥 情感线发展要求（解决专业编剧反馈的核心问题）**：
1. **男女主关系必须是核心**：每集都要有男女主的直接互动和情感推进
2. **角色连续性**：主要角色不能无故消失，配角出现要有合理动机
3. **钩子解决时间**：本阶段内的悬念必须在3集内给出解答或实质性进展
4. **关系发展节奏**：情感关系要有明确的推进层次，不能原地踏步
5. **冲突合理化**：所有冲突都要服务于主线和角色成长

**核心约束条件**：
1. **严格限制在阶段范围内**：生成的所有剧集必须严格按照上述阶段信息进行，不能引入该阶段之外的情节
2. **时间边界约束**：剧集必须在指定的时间跨度内发展，不能超前或滞后
3. **状态转换约束**：从"开始状态"逐步发展到"结束状态"，不能跳跃或超越
4. **事件边界约束**：第1集必须从"起始事件"开始或紧接其后，最后一集必须以"结束事件"结尾
5. **里程碑分布**：关键里程碑必须在适当集数中实现，确保进度合理分配
6. **关系/情感约束**：人物关系和情感必须按照指定轨迹发展，不能过快或过慢
7. **外部压力一致性**：外部压力状况必须与阶段设定保持一致
8. **保持悬念和连续性**：每集结尾要为后续集数和后续阶段留下发展空间
9. **内容分布均匀**：将阶段内容均匀分配到所有集数中，确保每集都有足够的内容

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
   - **所有事件必须在阶段信息的约束范围内**

4. **结尾悬念**：每集结尾的悬念设置，引发观众对下一集的期待
   - 悬念必须是具体的**事件**，不能是情感状态或心理活动
   - 要与剧情发展紧密相关，为下集做铺垫
   - 要有足够的吸引力让观众想继续观看
   - **不能设置超出当前阶段范围的悬念**

**内容分配策略**：
- 将阶段里程碑按集数合理分配（如4集阶段，每集实现1个里程碑）
- 确保每集都有独立的小高潮，同时推进整体阶段发展
- 前几集重点建立该阶段的背景和冲突
- 中间几集深入发展人物关系和矛盾
- 后几集推向该阶段的高潮，但不解决整个故事的主要冲突

**阶段边界检查清单**：
- ✅ 是否在指定时间跨度内？
- ✅ 是否从正确的开始状态出发？
- ✅ 是否以正确的结束状态收尾？ 
- ✅ 是否包含所有关键里程碑？
- ✅ 人物关系是否按指定轨迹发展？
- ✅ 情感变化是否符合指定弧线？
- ✅ 外部压力是否保持一致？

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
    "endHook": "结尾悬念事件：描述具体发生的悬念事件",
    "emotionDevelopments": [
      {
        "characters": ["角色名1"],
        "content": "具体的情感变化描述，比大纲中的情感发展更详细具体，关注该集中的微妙变化"
      },
      {
        "characters": ["角色名1", "角色名2"],
        "content": "角色间的情感互动变化，描述具体的情感转变和内心活动"
      }
    ],
    "relationshipDevelopments": [
      {
        "characters": ["角色名1", "角色名2"],
        "content": "关系发展的具体描述，比大纲层面更加细致，聚焦该集中的关系变化"
      }
    ]
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
    "endHook": "结尾悬念事件：描述具体发生的悬念事件",
    "emotionDevelopments": [
      {
        "characters": ["角色名"],
        "content": "该集中角色的情感变化"
      }
    ],
    "relationshipDevelopments": [
      {
        "characters": ["角色名1", "角色名2"],
        "content": "该集中关系的发展变化"
      }
    ]
  }
]

**🎭 情感与关系发展追踪要求**：

**emotionDevelopments（情感发展）**：
- **比大纲级别更细致**：每集要关注角色在该集中的具体情感变化，不是大的情感弧线，而是微妙的情感转变
- **具体化描述**：避免"开心"、"难过"等简单词汇，要描述具体的情感状态和变化过程
- **单角色焦点**：每个条目主要关注一个角色的内心世界，但可以包括与其他角色互动时的情感反应
- **承接性**：要与前一集的情感状态有逻辑连接，体现情感发展的连续性
- **事件驱动**：情感变化必须有具体事件作为触发，不能凭空产生

**relationshipDevelopments（关系发展）**：
- **双向互动**：关注两个或多个角色之间关系的具体变化，不是单方面的感受
- **层次递进**：关系发展要有明确的层次变化，如从陌生到熟悉、从误解到理解、从敌对到合作等
- **行为体现**：关系变化要通过具体的对话、行为、互动来体现，不能只是内心感受
- **冲突与和解**：要包括关系中的张力和缓解，体现关系发展的真实性
- **多维度**：可以包括情感关系、利益关系、权力关系等多个维度的变化

**细致度要求**：
- **时间颗粒度**：聚焦该集中发生的变化，不要跨集描述
- **情感层次**：区分表面情感和深层情感，包括角色的内心挣扎和矛盾
- **互动细节**：描述角色间对话、眼神、肢体语言等微妙互动中的情感和关系变化
- **成长痕迹**：每个角色的情感成长要有可追踪的轨迹，避免突然的性格转变

**数量指导**：
- 每集建议2-4个情感发展条目
- 每集建议1-3个关系发展条目
- 主要角色每集都应该有情感或关系的变化追踪
- 重要配角的发展也要适当关注

**重要**：只输出纯JSON数组，不要任何解释、说明、或其他文本。确保JSON格式正确且完整。所有内容必须严格限制在给定的阶段信息范围内，不能超出该阶段的故事发展。情感和关系发展必须与剧情事件紧密结合，体现人物的真实成长轨迹。`,
      outputFormat: 'json_array',
      responseWrapper: '```json',
      variables: ['params.numberOfEpisodes', 'params.stageSynopsis', 'params.customRequirements', 'params.timeframe', 'params.startingCondition', 'params.endingCondition', 'params.stageStartEvent', 'params.stageEndEvent', 'params.keyPoints', 'params.relationshipLevel', 'params.emotionalArc', 'params.externalPressure', 'params.platform', 'params.genre', 'params.requirements', 'params.totalEpisodes', 'params.episodeDuration', 'params.stageNumber']
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