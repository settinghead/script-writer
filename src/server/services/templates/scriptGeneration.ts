/**
 * Generate episode-specific instructions for script generation
 * This reuses the same logic as episode synopsis generation but applied to script context
 */
export function generateScriptEpisodeSpecificInstructions(episodeNumber: number): string {
  // For script generation, we focus on the single episode being generated
  const instructions: string[] = [];

  // First episode special requirements for scripts
  if (episodeNumber === 1) {
      instructions.push(`
**📺 第1集剧本特殊要求**：
- **开场抓人**：前30秒的剧本内容必须有强烈的视觉冲击或戏剧冲突
- **人物介绍**：用对话和行动自然地展现主要角色的性格特点，避免直白的介绍
- **世界观建立**：通过场景描述和人物互动快速建立故事世界
- **节奏控制**：开场节奏要快，每个场景都要推进剧情
- **悬念设置**：在剧本中设置明确的悬念点，为后续剧集做铺垫`);
  }

  // Future: Add more conditional requirements for other episodes
  // Example: Mid-season episodes, finale episodes, etc.

  return instructions.length > 0 ? instructions.join('\n') : '';
}

export const scriptGenerationTemplate = {
  id: 'script_generation',
  name: 'Script Generation',
  promptTemplate: `# 短剧剧本生成 (Short Drama Script Generation)

你是专业的短剧编剧，擅长创作适合移动端观看的短剧剧本。请基于提供的分集简介生成完整的剧本内容。

## 创作要求

### 短剧特色（与电影、电视剧的区别）
- **快节奏叙事**：每分钟都要有明确的剧情推进和情绪爆点
- **垂直视频优化**：考虑手机竖屏观看体验，对话和表演要紧凑
- **爽点密集**：符合移动端用户碎片化观看习惯，持续制造爽点
- **去脸谱化**：避免刻板印象的人物和剧情，追求真实和新颖

=== 示范例子1 ===

第1集：

1-1场景：银行外 日 外

出场人物：王野（32岁，海市警局首席谈判专家）、林琛（35岁，特警队长）、警员若干

特写：银行监控屏幕闪烁雪花点，突然清晰显示——劫匪左手勒住女职员脖颈，右手持枪抵住其太阳穴。女职员睫毛颤动，泪痕反光。

劫匪（画外音，声线发颤）：我要见谈判专家！现在！

△镜头急速拉远，穿过防弹玻璃，掠过警车顶灯，（特写）一只推开车门的手上。骨节分明的手腕上，银色表盘折射冷光。

王野扯松藏蓝领带，嘴角痞笑。

王野：啧，又是临时工水平。

△特警队长林琛按住王野肩膀，耳麦线绷直。

林琛（沉声）：狙击手就位。这次别玩你那套，直接击毙！

王野（眯眼看向监控屏幕）：等等。人质瞳孔持续缩小，劫匪在撒谎！（夺过对讲机）给我接微表情专家组。

△警车后视镜映出他骤然锐利的眼神。

1-2：银行监控车 日 内

出场：宋诺诺（23岁，微表情专家，冷艳）、技术员

△宋诺诺黑色马尾甩过监控屏幕，指尖放大劫匪面部。

宋诺诺（冷冽）：右眉上扬0.3秒后强行下压，恐惧引发的微表情失控。（敲击键盘）鼻翼扩张频率与火药味刺激吻合，他在嗅火药味，不是职业劫匪。

△对讲机突然沙沙作响。

王野（带笑 vo）：听说宋专家能看穿活体测谎仪都辨不出的谎言？

宋诺诺（紧盯屏幕中王野模糊身影）：比不上王警官上次假投降时的演技。

△画面闪回：王野高举双手时对劫匪眨眼的特写。

△技术员突然指着热成像仪大喊，东南角有异常热源！

1-3场景：银行内 日 内

出场：王野、劫匪、人质

△王野高举双手缓步前进，皮鞋踩过碎玻璃。

王野（语调慵懒）：兄弟，虎口都磨出血了。缺钱我理解，我卡有八十万。（突然逼近）你每2.8秒看一次挂钟——在等什么？

△劫匪枪管微颤，汗珠滑过太阳穴疤痕。

劫匪（枪口晃动）：闭嘴！再过来我开枪了！

宋诺诺（画外音，急促）：他在拖延！炸弹可能……

△王野瞳孔骤缩，一个箭步扑倒劫匪！两人翻滚撞碎柜台玻璃。

△特写：劫匪手指扣向腰间引爆器。

△王野手肘猛击其喉结，反手夺枪。“咔嗒”一声，空膛声响。

王野（喘笑）：果然没子弹。

△爆炸声轰然响起！画面黑屏。

△烟雾中，王野扛着人质冲出，转身却见宋诺诺举枪对准他：王野，你刚才撒谎了。

剧情卡点，让悬念升级：观众会疑惑，为什么宋诺诺举枪对王野？王野是否另有身份？

=== 示范例子1 结束 ===

=== 示范例子2 ===

第5集

场景1：医院病房，内，日

人物：林飒、司睿轩、司宏才

林飒蹙眉看向司睿轩，对面前的人瞬间没了好感。

林飒：你到底谁啊？一上来就这么阴阳怪气的！

司睿轩瞬间一噎，脸皮尴尬地抽了抽。

司睿轩：我是你老公！我看你不是失忆了，而是失智了！

林飒：我……

林飒瞬间急眼了！扭了扭脖子瞅向司睿轩，眼神里释放出浓浓的危险气息！

司睿轩一惊，瞬间有些心慌，这他娘的还是第一次他被这个女人给吓到了！

司睿轩：看什么看？谁给你的狗胆敢这么看我？

林飒气得瞪大了眼！握起拳头就想呼他见太奶！下一秒，司睿轩的手机却响了起来，他拿起接听。

司睿轩：喂！爸。

司宏才：下午四点，你堂哥司墨南会抵达海城，你到时候派人去接他。

司睿轩惊讶：堂哥回海城了？

司宏才：是。

司睿轩：好，我知道了。

司睿轩挂了电话。

司睿轩收起手机，视线重新落到了林飒身上，他从口袋中掏出一部手机丢给了林飒。

司睿轩：你的手机在车祸里摔坏了，这是一部新的，拿好，等下就会有人接你出院！

司睿轩说完，转身就走。

林飒看着他一副冷漠无情的样子，气得咬牙切齿！

场景2：机场外，外，日

人物：司墨南、司睿轩助理、司机

司墨南站在机场外，一米八的大高个儿，面容俊朗帅气，浑身上下都散发着沉稳温润的气质。

出字幕：司墨南，司睿轩堂哥。

司睿轩的助理跟在司墨南旁边，手中还提着行李。

很快他们面前停下一辆豪车。

司睿轩的助理为司墨南打开了车门。

司睿轩的助理：墨南少爷，请上车！

司墨南迈开大长腿，跨上了后座。

司睿轩的助理将行李放进后备箱后，也立即上了车。

=== 示范例子2 结束 ===


### 平台特性
- 平台：%%params.platform%%
- 单集时长：%%params.episodeDuration%%分钟
- 类型比例：%%params.genre_paths%%

### 剧本格式要求
- 采用标准剧本格式
- 场景描述简洁明了
- 对话自然流畅，符合人物性格
- 动作指导清晰可执行
- 控制在合适的字数范围内

## 角色信息

%%params.characters_info%%

## 分集简介

%%params.episode_synopsis%%

## 用户附加要求

%%params.user_requirements%%

## 剧集特定指导

%%params.episodeSpecificInstructions%%

## 输出格式

请按以下JSON格式输出剧本：

\`\`\`json
{
  "episodeNumber": %%params.episode_number%%,
  "scriptContent": "完整剧本文本",
  "scenes": [
    {
      "sceneNumber": 1,
      "location": "场景地点",
      "timeOfDay": "时间",
      "characters": ["角色1", "角色2"],
      "action": "场景动作描述",
      "dialogue": [
        {
          "character": "角色名",
          "line": "台词内容",
          "direction": "表演指导（可选）"
        }
      ]
    }
  ],
  "wordCount": 字数统计,
  "estimatedDuration": 预估时长分钟数
}
\`\`\`

## 创作要点

1. **开场抓人**：前30秒必须建立冲突或悬念
2. **节奏控制**：每个场景都要推进剧情，避免拖沓
3. **情感爆点**：在关键节点制造强烈的情感反应
4. **视觉呈现**：考虑移动端观看特点，动作和表情要明确
5. **连续性**：确保与前后集的衔接自然
6. **平台适配**：符合目标平台的内容规范和用户喜好

开始创作！`,
  outputFormat: 'json',
  responseWrapper: '```json',
  variables: [
    'params.platform',
    'params.episodeDuration',
    'params.genre_paths',
    'params.characters_info',
    'params.episode_synopsis',
    'params.user_requirements',
    'params.episode_number',
    'params.episodeSpecificInstructions'
  ]
}; 