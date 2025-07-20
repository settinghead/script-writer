# Episode Synopsis System Design (Revised)

## Overview

The episode synopsis (每集大纲) system is the next phase after episode planning in the Chinese short drama workflow. It generates detailed plot summaries for individual episodes with 2-minute structures optimized for 抖音, 快手, and 小红书.

## Key Insights from Codebase Analysis

### 1. Streaming Preview Architecture
The system is designed for **instant streaming preview**:
- `StreamingTransformExecutor` creates initial jsondoc with `streaming_status: 'streaming'`
- Electric SQL immediately syncs this to frontend
- Display components show content **as soon as it appears in lineage** (not after completion)
- Updates happen every `updateIntervalChunks` (default: 3 chunks)

### 2. Minimal Phase-Specific Logic
Existing pattern: **generic canonical logic + minimal schema-specific additions**:
- `canonicalJsondocLogic.ts` handles all jsondoc types generically
- `actionComputation.ts` has minimal phase-specific logic
- New schema types integrate seamlessly without major architectural changes

### 3. Sequential Generation Pattern
Looking at existing tools (brainstorm → outline → chronicles → episode planning):
- Each phase waits for previous phase completion
- Actions appear when prerequisites exist and no active transforms
- No complex progress tracking - just "next step" detection

### 4. Agent Prompt Integration
**Modify existing examples in AgentRequestBuilder.ts** rather than adding new ones:
- Update multi-step editing examples (示例10, 示例11) to include episode synopsis generation
- Show episode synopsis as part of the natural workflow progression
- Keep total example count manageable while demonstrating the new capability

## Revised Architecture

### 1. Simple Schema Definition

**Minimal, focused schema**:
```typescript
// src/common/schemas/outlineSchemas.ts
export const EpisodeSynopsisSchema = z.object({
  episodeNumber: z.number(),
  title: z.string(),
  openingHook: z.string().describe('开场钩子 - 前3秒抓住观众'),
  mainPlot: z.string().describe('主要剧情发展'),
  emotionalClimax: z.string().describe('情感高潮点'),
  cliffhanger: z.string().describe('结尾悬念'),
  suspenseElements: z.array(z.string()).describe('悬念元素'),
  estimatedDuration: z.number().default(120).describe('预估时长(秒)')
});

export const EpisodeSynopsisGroupSchema = z.object({
  groupTitle: z.string(),
  episodeRange: z.string(), // "1-3"
  episodes: z.array(EpisodeSynopsisSchema)
});

export const EpisodeSynopsisInputSchema = BaseToolInputSchema.extend({
  groupTitle: z.string(),
  episodeRange: z.string(),
  episodes: z.array(z.number()) // [1, 2, 3]
});
```

### 2. Canonical Logic Integration

**Add to CanonicalJsondocContext** (minimal addition):
```typescript
// src/common/canonicalJsondocLogic.ts
export interface CanonicalJsondocContext {
  // ... existing fields
  canonicalEpisodeSynopsisList: ElectricJsondoc[]; // All episode synopsis jsondocs
}

export function computeCanonicalJsondocsFromLineage(...): CanonicalJsondocContext {
  // ... existing logic
  
  const canonicalEpisodeSynopsisList = jsondocs
    .filter(j => j.schema_type === 'episode_synopsis')
    .sort((a, b) => {
      // Sort by first episode number for consistent ordering
      const aData = JSON.parse(a.data);
      const bData = JSON.parse(b.data);
      const aFirstEpisode = aData.episodes?.[0]?.episodeNumber || 0;
      const bFirstEpisode = bData.episodes?.[0]?.episodeNumber || 0;
      return aFirstEpisode - bFirstEpisode;
    });

  return {
    // ... existing fields
    canonicalEpisodeSynopsisList
  };
}
```

### 3. Sequential Action Logic

**Simple next-group detection** (following existing patterns):
```typescript
// src/client/utils/lineageBasedActionComputation.ts

function generateActionsFromContext(context: LineageBasedActionContext): ActionItem[] {
  if (context.hasActiveTransforms) {
    return [];
  }

  const actions: ActionItem[] = [];
  
  // ... existing action logic

  // Episode synopsis generation - after episode planning, before script generation
  if (context.canonicalEpisodePlanning && context.canonicalEpisodeSynopsisList.length === 0) {
    // First group - get from episode planning
    const episodePlanningData = JSON.parse(context.canonicalEpisodePlanning.data);
    const firstGroup = episodePlanningData.episodeGroups?.[0];
    
    if (firstGroup) {
      actions.push({
        id: 'episode_synopsis_generation',
        type: 'button',
        title: `生成第${firstGroup.episodes}集每集大纲`,
        description: `生成"${firstGroup.groupTitle}"的详细每集大纲`,
        component: EpisodeSynopsisGenerationAction,
        props: {
          jsondocs: {
            brainstormIdea: context.canonicalBrainstormIdea,
            brainstormCollection: context.canonicalBrainstormCollection,
            outlineSettings: context.canonicalOutlineSettings,
            chronicles: context.canonicalChronicles,
            episodePlanning: context.canonicalEpisodePlanning,
            brainstormInput: context.canonicalBrainstormInput
          },
          nextGroup: {
            groupTitle: firstGroup.groupTitle,
            episodeRange: firstGroup.episodes,
            episodes: parseEpisodeRange(firstGroup.episodes) // "1-3" → [1,2,3]
          }
        },
        enabled: true,
        priority: 1
      });
    }
  } else if (context.canonicalEpisodePlanning && context.canonicalEpisodeSynopsisList.length > 0) {
    // Check if we need next group
    const episodePlanningData = JSON.parse(context.canonicalEpisodePlanning.data);
    const allGroups = episodePlanningData.episodeGroups || [];
    const completedRanges = new Set(context.canonicalEpisodeSynopsisList.map(synopsis => {
      const data = JSON.parse(synopsis.data);
      return data.episodeRange;
    }));
    
    const nextGroup = allGroups.find(group => !completedRanges.has(group.episodes));
    if (nextGroup) {
      actions.push({
        id: 'episode_synopsis_generation',
        type: 'button',
        title: `生成第${nextGroup.episodes}集每集大纲`,
        description: `生成"${nextGroup.groupTitle}"的详细每集大纲`,
        component: EpisodeSynopsisGenerationAction,
        props: {
          // ... same as above
          nextGroup: {
            groupTitle: nextGroup.groupTitle,
            episodeRange: nextGroup.episodes,
            episodes: parseEpisodeRange(nextGroup.episodes)
          }
        },
        enabled: true,
        priority: 1
      });
    }
  }

  return actions;
}
```

### 4. Display Component Integration

**Follow existing streaming pattern** - show as soon as detected:
```typescript
// src/client/utils/actionComputation.ts
function computeDisplayComponentsFromContext(context: UnifiedComputationContext): DisplayComponent[] {
  const components: DisplayComponent[] = [];
  
  const componentOrder: { [key: string]: number } = {
    'brainstorm-input-editor': 1,
    'idea-collection': 2,
    'single-idea-editor': 3,
    'outline-settings-display': 4,
    'chronicles-display': 5,
    'episode-planning-display': 6,
    'episode-synopsis-display': 7 // Add after episode planning
  };

  // ... existing component logic

  // Episode synopsis display - show immediately when any exist
  if (context.canonicalContext.canonicalEpisodeSynopsisList.length > 0) {
    components.push({
      id: 'episode-synopsis-display',
      component: getComponentById('episode-synopsis-display'),
      mode: 'readonly', // Keep simple - no editing for now
      props: {
        episodeSynopsisList: context.canonicalContext.canonicalEpisodeSynopsisList
      },
      priority: componentOrder['episode-synopsis-display']
    });
  }

  return components.sort((a, b) => a.priority - b.priority);
}
```

### 5. Component Registry Integration

**Add to existing registry**:
```typescript
// src/client/utils/componentRegistry.ts
export const componentRegistry: Record<ComponentId, React.ComponentType<any>> = {
  // ... existing components
  'episode-synopsis-display': EpisodeSynopsisDisplay
};
```

### 6. ProjectTreeView Integration

**Simple detection without progress tracking**:
```typescript
// src/client/components/ProjectTreeView.tsx
const jsondocChecks = useMemo(() => {
  // ... existing checks
  
  const hasEpisodeSynopsis = projectData.jsondocs.some(jsondoc =>
    jsondoc.schema_type === 'episode_synopsis'
  );

  return {
    // ... existing checks
    hasEpisodeSynopsis
  };
}, [projectData.jsondocs]);

// Add to sections after episode planning
if (jsondocChecks.hasEpisodeSynopsis) {
  const episodeSynopsisHighlighted = shouldHighlightNode('#episode-synopsis');
  
  sections.push({
    key: 'episode-synopsis-section',
    title: (
      <Space style={{ /* highlighted styling */ }}>
        <Text>每集大纲</Text>
        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '12px' }} />
      </Space>
    ),
    icon: <FileTextOutlined />,
    navigationTarget: '#episode-synopsis'
  });
}
```

## Backend Implementation

### 1. Tool Definition (Standard Pattern)

**Follow existing tool patterns**:
```typescript
// src/server/tools/EpisodeSynopsisTool.ts
export function createEpisodeSynopsisToolDefinition(
  transformRepo: TransformRepository,
  jsondocRepo: JsondocRepository,
  projectId: string,
  userId: string,
  cachingOptions?: CachingOptions
): StreamingToolDefinition<EpisodeSynopsisInput, EpisodeSynopsisToolResult> {
  return {
    name: 'generate_episode_synopsis',
    description: '生成指定剧集组的详细每集大纲，包含2分钟短剧结构、钩子设计、悬念元素等',
    inputSchema: EpisodeSynopsisInputSchema,
    outputSchema: EpisodeSynopsisToolResultSchema,
    execute: async (params: EpisodeSynopsisInput, { toolCallId }) => {
      // Standard streaming transform execution
      const config: StreamingTransformConfig<EpisodeSynopsisInput, EpisodeSynopsisOutput> = {
        templateName: 'episode_synopsis_generation',
        inputSchema: EpisodeSynopsisInputSchema,
        outputSchema: EpisodeSynopsisGroupSchema
        // No custom prepareTemplateVariables - use default schema-driven
      };
      
      const result = await executeStreamingTransform({
        config,
        input: params,
        projectId,
        userId,
        transformRepo,
        jsondocRepo,
        outputJsondocType: 'episode_synopsis',
        transformMetadata: {
          toolName: 'generate_episode_synopsis',
          target_group_title: params.groupTitle,
          target_episode_range: params.episodeRange
        },
        ...cachingOptions
      });
      
      return {
        outputJsondocId: result.outputJsondocId,
        finishReason: result.finishReason
      };
    }
  };
}
```

### 2. Template (Rich Context as Requested)

**Include all upstream context for reference**:
```typescript
// src/server/services/templates/episodeSynopsis.ts
export const episodeSynopsisTemplate: LLMTemplate = {
  id: 'episode_synopsis_generation',
  name: 'Episode Synopsis Generation',
  promptTemplate: `你是专业的中国短剧编剧，专门为抖音、快手、小红书等平台创作2分钟短剧内容。

## 任务
基于剧集框架，为指定剧集组生成详细的每集大纲。每集约2分钟，必须具有强烈的戏剧张力和平台优化的钩子设计。

## 项目背景信息（仅供参考）
%%jsondocs%%

## 生成参数
%%params%%

## 创作要求

### 重要：只为指定剧集组生成内容
- 只生成参数中指定的剧集组（如第1-3集）
- 其他背景信息仅供理解故事脉络，不要为其他集数生成内容

### 2分钟短剧结构
每集必须包含：
1. **开场钩子** (0-3秒) - 立即抓住观众注意力
2. **主要剧情** (3秒-1分30秒) - 核心故事发展
3. **情感高潮** (1分30秒-1分50秒) - 情感冲突达到顶点
4. **结尾悬念** (1分50秒-2分钟) - 强烈钩子引导下集

### 平台优化
- **抖音**: 快节奏、强视觉冲击、年轻化表达
- **快手**: 接地气、真实感、情感共鸣
- **小红书**: 精致美学、生活化场景、情感细腻

### 内容原则
- 遵循去脸谱化原则，避免刻板印象
- 每集必须有独立的情感弧线
- 角色关系发展要有层次感
- 悬念设计要环环相扣

## 输出格式
{
  "groupTitle": "组标题",
  "episodeRange": "集数范围",
  "episodes": [
    {
      "episodeNumber": 1,
      "title": "集标题",
      "openingHook": "开场钩子描述",
      "mainPlot": "主要剧情发展",
      "emotionalClimax": "情感高潮点",
      "cliffhanger": "结尾悬念",
      "suspenseElements": ["悬念元素1", "悬念元素2"],
      "estimatedDuration": 120
    }
  ]
}`,
  outputFormat: 'json'
};
```

### 3. Schema Registration

**Add to existing registries**:
```typescript
// src/common/schemas/jsondocs.ts
export const JsondocSchemaRegistry = {
  // ... existing schemas
  'episode_synopsis': EpisodeSynopsisGroupSchema,
  'episode_synopsis_input': EpisodeSynopsisInputSchema
} as const;

// src/common/types.ts
export type TypedJsondoc =
  // ... existing types
  | JsondocWithData<'episode_synopsis', 'v1', EpisodeSynopsisGroupV1>
  | JsondocWithData<'episode_synopsis_input', 'v1', EpisodeSynopsisInputV1>
```

### 4. Agent Service Integration

**Add to tool registration**:
```typescript
// src/server/services/AgentRequestBuilder.ts
const toolDefinitions: StreamingToolDefinition<any, any>[] = [
  // ... existing tools
  createEpisodeSynopsisToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions)
];
```

## UI Components

### 1. Action Component (Simple)

**Follow existing action patterns**:
```typescript
// src/client/components/actions/EpisodeSynopsisGenerationAction.tsx
const EpisodeSynopsisGenerationAction: React.FC<ActionComponentProps> = (props) => {
  const { projectId, onSuccess, onError, nextGroup } = props;
  const [isGenerating, setIsGenerating] = useState(false);

  const episodePlanning = 'jsondocs' in props ? props.jsondocs.episodePlanning : null;

  const handleGenerate = useCallback(async () => {
    if (!episodePlanning) {
      message.error('未找到剧集框架');
      return;
    }

    setIsGenerating(true);
    try {
      // Send chat message to trigger generation (following existing pattern)
      await apiService.sendChatMessage(projectId, 
        `生成第${nextGroup.episodeRange}集每集大纲：${nextGroup.groupTitle}`,
        {
          action: 'generate_episode_synopsis',
          episodePlanningId: episodePlanning.id,
          groupTitle: nextGroup.groupTitle,
          episodeRange: nextGroup.episodeRange,
          episodes: nextGroup.episodes
        }
      );
      
      message.success(`第${nextGroup.episodeRange}集大纲生成已启动`);
      onSuccess?.();
    } catch (error) {
      console.error('Error generating episode synopsis:', error);
      message.error(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
      onError?.(error instanceof Error ? error : new Error('生成失败'));
    } finally {
      setIsGenerating(false);
    }
  }, [episodePlanning, nextGroup, projectId, onSuccess, onError]);

  if (!episodePlanning) {
    return (
      <Alert message="需要先生成剧集框架" type="warning" showIcon />
    );
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <AIButton
        type="primary"
        size="large"
        loading={isGenerating}
        onClick={handleGenerate}
        style={{ fontSize: '16px' }}
      >
        {isGenerating ? '生成中...' : `生成第${nextGroup.episodeRange}集每集大纲`}
      </AIButton>
    </div>
  );
};
```

### 2. Display Component (Streaming-Aware)

**Handle streaming updates like other components**:
```typescript
// src/client/components/shared/EpisodeSynopsisDisplay.tsx
const EpisodeSynopsisDisplay: React.FC<{
  episodeSynopsisList: ElectricJsondoc[];
}> = ({ episodeSynopsisList }) => {
  
  // Flatten and sort all episodes from all groups
  const allEpisodes = useMemo(() => {
    const episodes = [];
    for (const synopsisJsondoc of episodeSynopsisList) {
      try {
        const data = JSON.parse(synopsisJsondoc.data);
        if (data.episodes && Array.isArray(data.episodes)) {
          episodes.push(...data.episodes);
        }
      } catch (error) {
        console.warn('Failed to parse episode synopsis data:', error);
      }
    }
    return episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
  }, [episodeSynopsisList]);

  return (
    <div id="episode-synopsis">
      <Title level={3}>每集大纲 ({allEpisodes.length}集)</Title>
      
      {allEpisodes.map(episode => (
        <Card key={episode.episodeNumber} style={{ marginBottom: 16 }}>
          <Title level={5}>第{episode.episodeNumber}集: {episode.title}</Title>
          
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="开场钩子">
              {episode.openingHook}
            </Descriptions.Item>
            <Descriptions.Item label="主要剧情">
              {episode.mainPlot}
            </Descriptions.Item>
            <Descriptions.Item label="情感高潮">
              {episode.emotionalClimax}
            </Descriptions.Item>
            <Descriptions.Item label="结尾悬念">
              {episode.cliffhanger}
            </Descriptions.Item>
          </Descriptions>
          
          {episode.suspenseElements && episode.suspenseElements.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Text strong>悬念元素:</Text>
              <ul style={{ marginTop: 4 }}>
                {episode.suspenseElements.map((element, idx) => (
                  <li key={idx}>{element}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};
```

## Key Simplifications Made

1. **No Complex Progress Tracking**: Just detect next group to generate, following existing sequential pattern
2. **Minimal Schema**: Focused on essential 短剧 fields, not over-engineered
3. **Standard Streaming**: Uses existing `StreamingTransformExecutor` patterns
4. **Generic Canonical Logic**: Minimal additions to `canonicalJsondocLogic.ts`
5. **Immediate Display**: Shows content as soon as it appears in Electric SQL, like other components
6. **No Custom Editing**: Keep readonly for now, can add editing later if needed
7. **Rich Context Template**: Include all upstream context (brainstorm + outline + chronicles + episode planning) for LLM reference, but instruct to generate only for specified group

This design integrates seamlessly with existing patterns while providing the episode synopsis functionality you requested. 