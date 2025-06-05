export const episodeSynopsisGenerationTemplate = {
    id: 'episode_synopsis_generation',
    name: 'Episode Synopsis Generation',
    promptTemplate: `你是一位资深的短剧编剧，专门负责将故事阶段梗概展开为具体的分集剧情大纲。

**重要提醒：这是故事中的一个特定阶段，不是完整故事。你只需要为这个阶段的内容生成剧集，不能超出该阶段的范围！**

**📺 整体制作规格（继承自前序阶段）**：
- **目标平台**: %%params.platform%%
- **故事类型**: %%params.genre%%
- **特殊要求**: %%params.requirements%%
- **总集数**: %%params.totalEpisodes%%集
- **每集时长**: %%params.episodeDuration%%分钟

**🎬 当前阶段要求**：
根据以上整体制作规格，为第%%params.stageNumber%%阶段生成 %%params.numberOfEpisodes%% 集的详细剧集大纲：

**阶段信息**：
- **阶段梗概**: %%params.stageSynopsis%%
- **时间跨度**: %%params.timeframe%%
- **开始状态**: %%params.startingCondition%%
- **结束状态**: %%params.endingCondition%%
- **起始事件**: %%params.stageStartEvent%%
- **结束事件**: %%params.stageEndEvent%%
- **关键事件**: %%params.keyPoints%%
- **关系发展**: %%params.relationshipLevel%%
- **情感轨迹**: %%params.emotionalArc%%
- **外部压力**: %%params.externalPressure%%



**📱 平台化剧集指导（基于%%params.platform%%）**：

- 每集开头3秒内必须有强烈视觉冲击
- 对话要简洁有力，适合竖屏观看
- 每集至少1个可以独立传播的金句或场面
- 钩子要在15秒内建立，符合短视频习惯
- 剧情要兼顾拍摄的难度和可行性

**🚨 生成要求（必须严格遵守）**：
- **必须生成完整的 %%params.numberOfEpisodes%% 集**：不能少于 %%params.numberOfEpisodes%% 集，也不能多于 %%params.numberOfEpisodes%% 集
- 每集时长：约%%params.episodeDuration%%分钟%%params.customRequirements%%

**⚠️ 重要：请确保输出的JSON数组包含exactly %%params.numberOfEpisodes%% 个完整的episode对象，从第%%params.startingEpisode%%集到第%%params.endingEpisode%%集，缺一不可！**


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

%%params.episodeSpecificInstructions%%


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
请以JSON数组的格式返回，**必须包含完整的%%params.numberOfEpisodes%%集**，每个集数包含以下字段：

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

**🔥 最终检查提醒**：
1. **集数确认**：输出的JSON数组必须包含**完整的%%params.numberOfEpisodes%%个episode对象**
2. **编号检查**：episodeNumber从1到%%params.numberOfEpisodes%%，连续无遗漏
3. **格式要求**：只输出纯JSON数组，不要任何解释、说明、或其他文本
4. **完整性要求**：确保JSON格式正确且完整，所有字段都要填写
5. **内容约束**：所有内容必须严格限制在给定的阶段信息范围内，不能超出该阶段的故事发展
6. **质量要求**：情感和关系发展必须与剧情事件紧密结合，体现人物的真实成长轨迹

**再次强调：必须生成%%params.numberOfEpisodes%%集完整内容！**`,
    outputFormat: 'json_array',
    responseWrapper: '```json',
    variables: [
        'params.numberOfEpisodes',
        'params.stageSynopsis',
        'params.customRequirements',
        'params.timeframe',
        'params.startingCondition',
        'params.endingCondition',
        'params.stageStartEvent',
        'params.stageEndEvent',
        'params.keyPoints',
        'params.relationshipLevel',
        'params.emotionalArc',
        'params.externalPressure',
        'params.platform',
        'params.genre',
        'params.requirements',
        'params.totalEpisodes',
        'params.episodeDuration',
        'params.stageNumber',
        'params.startingEpisode',
        'params.endingEpisode',
        'params.episodeSpecificInstructions'
    ]
}; 