# Episode Script Generation Implementation Plan

## Overview

Based on codebase analysis and user clarifications, this plan implements episode script generation that follows the existing patterns in the script-writer project. The key insights:

1. **Agent-Based Actions**: All actions send chat messages to `AgentService` which routes to appropriate tools
2. **Sequential Generation**: Only the "next" episode can be generated (no dropdown needed)
3. **Streaming Architecture**: Uses `StreamingTransformExecutor` for real-time preview
4. **Canonical Logic**: Follows same patterns as episode synopsis for data management
5. **Single Text Format**: Episode scripts stored as one large text field, not granular scenes

## Architecture Analysis

### Current Flow
```
Action Button → sendChatMessage() → ChatService → AgentService → Tool Selection → StreamingTransformExecutor → Database → Electric SQL → Frontend Update
```

### Key Components
- **AgentRequestBuilder.ts**: Determines available tools based on workflow state
- **StreamingTransformExecutor.ts**: Handles streaming generation with real-time updates
- **CanonicalJsondocLogic.ts**: Manages canonical state across all content types
- **LineageBasedActionComputation.ts**: Determines when actions should appear

## Implementation Plan

### Phase 1: Data Layer & Schemas

#### 1.1 Define Episode Script Schemas
**File**: `src/common/schemas/outlineSchemas.ts`

```typescript
// Episode Script Schemas
export const EpisodeScriptSchema = z.object({
    episodeNumber: z.number(),
    title: z.string(),
    scriptContent: z.string().describe('完整剧本内容 - 包含场景、对话、动作指导'),
    wordCount: z.number().optional(),
    estimatedDuration: z.number().describe('预估时长(分钟)').default(2),
    episodeSynopsisJsondocId: z.string().describe('对应的分集大纲ID')
});

export const EpisodeScriptInputSchema = BaseToolInputSchema.extend({
    episodeNumber: z.number(),
    episodeSynopsisJsondocId: z.string(),
    userRequirements: z.string().optional().describe('用户额外要求')
});
```

#### 1.2 Update Schema Registry
**File**: `src/common/schemas/jsondocs.ts`

```typescript
export const JsondocSchemaRegistry = {
    // ... existing schemas
    'episode_script_input': EpisodeScriptInputSchema,
    'episode_script': EpisodeScriptSchema,
} as const;
```

#### 1.3 Update Canonical Logic
**File**: `src/common/canonicalJsondocLogic.ts`

```typescript
export interface CanonicalJsondocContext {
    // ... existing fields
    canonicalEpisodeScriptsList: ElectricJsondoc[];
}

// Add new function
function findCanonicalEpisodeScriptsByEpisode(
    lineageGraph: LineageGraph,
    jsondocs: ElectricJsondoc[]
): ElectricJsondoc[] {
    const episodeScriptJsondocs = jsondocs.filter(j => j.schema_type === 'episode_script');
    
    // Group by episode number and find canonical for each
    const episodeGroups = new Map<number, ElectricJsondoc[]>();
    
    for (const jsondoc of episodeScriptJsondocs) {
        try {
            const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
            const episodeNumber = data.episodeNumber || 0;
            
            if (!episodeGroups.has(episodeNumber)) {
                episodeGroups.set(episodeNumber, []);
            }
            episodeGroups.get(episodeNumber)!.push(jsondoc);
        } catch (error) {
            console.warn('Failed to parse episode script data for grouping:', error);
        }
    }
    
    // Find canonical for each episode
    const canonicalEpisodes: ElectricJsondoc[] = [];
    for (const [episodeNumber, candidates] of episodeGroups.entries()) {
        const canonical = findBestJsondocByPriority(candidates, lineageGraph);
        if (canonical) {
            canonicalEpisodes.push(canonical);
        }
    }
    
    // Sort by episode number
    canonicalEpisodes.sort((a, b) => {
        try {
            const aData = typeof a.data === 'string' ? JSON.parse(a.data) : a.data;
            const bData = typeof b.data === 'string' ? JSON.parse(b.data) : b.data;
            return (aData.episodeNumber || 0) - (bData.episodeNumber || 0);
        } catch {
            return 0;
        }
    });
    
    return canonicalEpisodes;
}

// Update main function
export function computeCanonicalJsondocsFromLineage(...): CanonicalJsondocContext {
    // ... existing logic
    const canonicalEpisodeScriptsList = findCanonicalEpisodeScriptsByEpisode(lineageGraph, jsondocs);
    
    return {
        // ... existing fields
        canonicalEpisodeScriptsList
    };
}
```

### Phase 2: Server-Side Generation

#### 2.1 Create Episode Script Template
**File**: `src/server/services/templates/episodeScript.ts`

```typescript
import type { LLMTemplate } from '../../../common/llm/types';

export const episodeScriptTemplate: LLMTemplate = {
    id: 'episode_script_generation',
    name: 'Episode Script Generation',
    promptTemplate: `你是专业的中国短剧编剧，专门为抖音、快手、小红书等平台创作2分钟短剧剧本。

## 参考资料

以下是生成剧本的参考资料：

**主要内容来源：**
- **[jsondoc] 分集大纲** - 这是你创作剧本的主要依据，包含开场钩子、主要剧情、情感高潮和结尾悬念
- **[jsondoc] 剧本设定** - 提供角色设定、世界观、商业定位等框架信息
- **[jsondoc] 前集剧本** - 提供前面已生成的剧本，确保连贯性和一致性（如果存在）

%%jsondocs%%

## 创作要求

### 2分钟短剧特色
- **快节奏叙事**：每分钟都要有明确的剧情推进和情绪爆点
- **垂直视频优化**：考虑手机竖屏观看体验，对话和表演要紧凑
- **爽点密集**：符合移动端用户碎片化观看习惯，持续制造爽点
- **去脸谱化**：避免刻板印象的人物和剧情，追求真实和新颖

### 剧本格式要求
- 采用标准剧本格式
- 场景描述简洁明了
- 对话自然流畅，符合人物性格
- 动作指导清晰可执行
- 控制在适合2分钟播放的字数范围内

### 结构要求
1. **开场钩子** (0-15秒) - 立即抓住观众注意力
2. **主要剧情** (15秒-1分30秒) - 核心故事发展
3. **情感高潮** (1分30秒-1分50秒) - 情感冲突达到顶点
4. **结尾悬念** (1分50秒-2分钟) - 强烈钩子引导下集

### 输出格式要求
生成的内容必须严格按照以下JSON格式：
{
  "episodeNumber": 集数,
  "title": "集标题",
  "scriptContent": "完整的剧本内容，包含场景描述、人物对话、动作指导等",
  "wordCount": 字数统计,
  "estimatedDuration": 预估时长分钟数,
  "episodeSynopsisJsondocId": "对应的分集大纲ID"
}

### 重要：确保剧情连贯性
- 与前面已生成的剧本保持剧情连贯
- 承接前集的结尾悬念（如果存在）
- 为后续集数埋下伏笔
- 在整体故事弧线中找准当前集的定位

## 生成参数
%%params%%`,
    outputFormat: 'json',
    variables: ['jsondocs', 'params']
};
```

#### 2.2 Create Episode Script Tool
**File**: `src/server/tools/EpisodeScriptTool.ts`

```typescript
import { z } from 'zod';
import { TransformRepository } from '../transform-jsondoc-framework/TransformRepository';
import { JsondocRepository } from '../transform-jsondoc-framework/JsondocRepository';
import { executeStreamingTransform } from '../transform-jsondoc-framework/StreamingTransformExecutor';
import { EpisodeScriptInputSchema, EpisodeScriptSchema } from '../../common/schemas/outlineSchemas';
import { episodeScriptTemplate } from '../services/templates/episodeScript';
import { createJsondocProcessor } from '../tools/shared/JsondocProcessor';
import type { StreamingToolDefinition } from '../transform-jsondoc-framework/StreamingAgentFramework';

export type EpisodeScriptInput = z.infer<typeof EpisodeScriptInputSchema>;
export type EpisodeScriptV1 = z.infer<typeof EpisodeScriptSchema>;

export function createEpisodeScriptToolDefinition(
    transformRepo: TransformRepository,
    jsondocRepo: JsondocRepository,
    projectId: string,
    userId: string,
    cachingOptions?: {
        enableCaching?: boolean;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }
): StreamingToolDefinition<EpisodeScriptInput, EpisodeScriptV1> {
    return {
        name: 'generate_episode_script',
        description: '为指定集数生成完整的剧本内容，包含对话、动作指导和场景描述',
        inputSchema: EpisodeScriptInputSchema,
        outputSchema: EpisodeScriptSchema,

        execute: async (params: EpisodeScriptInput, { toolCallId }) => {
            console.log(`[EpisodeScriptTool] Generating script for episode ${params.episodeNumber}`);

            // Use shared jsondoc processor to get context
            const jsondocProcessor = createJsondocProcessor(jsondocRepo, userId);
            const { jsondocData, processedCount } = await jsondocProcessor.processJsondocs(params.jsondocs);

            console.log(`[EpisodeScriptTool] Processed ${processedCount} context jsondocs`);

            // Custom template variables for episode script generation
            const prepareTemplateVariables = async (input: EpisodeScriptInput) => {
                const params_data = {
                    episodeNumber: input.episodeNumber,
                    episodeSynopsisJsondocId: input.episodeSynopsisJsondocId,
                    userRequirements: input.userRequirements || ''
                };

                return {
                    params: params_data,
                    jsondocs: jsondocData
                };
            };

            // Transform LLM output to final format
            const transformLLMOutput = (llmOutput: EpisodeScriptV1, input: EpisodeScriptInput): EpisodeScriptV1 => {
                return {
                    ...llmOutput,
                    episodeNumber: input.episodeNumber,
                    episodeSynopsisJsondocId: input.episodeSynopsisJsondocId,
                    wordCount: llmOutput.scriptContent?.length || 0,
                    estimatedDuration: llmOutput.estimatedDuration || 2
                };
            };

            // Execute streaming transform
            const result = await executeStreamingTransform({
                config: {
                    templateName: episodeScriptTemplate.id,
                    inputSchema: EpisodeScriptInputSchema,
                    outputSchema: EpisodeScriptSchema,
                    prepareTemplateVariables,
                    transformLLMOutput
                },
                input: params,
                projectId,
                userId,
                transformRepo,
                jsondocRepo,
                outputJsondocType: 'episode_script',
                transformMetadata: {
                    episode_number: params.episodeNumber,
                    episode_synopsis_id: params.episodeSynopsisJsondocId,
                    tool_call_id: toolCallId
                },
                updateIntervalChunks: 3,
                executionMode: { mode: 'full-object' },
                toolCallId,
                ...cachingOptions
            });

            return {
                outputJsondocId: result.outputJsondocId,
                episodeNumber: params.episodeNumber,
                message: `第${params.episodeNumber}集剧本生成完成`
            };
        }
    };
}
```

#### 2.3 Register Template
**File**: `src/server/services/templates/TemplateService.ts`

```typescript
// Add import
import { episodeScriptTemplate } from './episodeScript';

// Add to template registry
private templates: Map<string, LLMTemplate> = new Map([
    // ... existing templates
    [episodeScriptTemplate.id, episodeScriptTemplate],
]);
```

### Phase 3: Agent Integration

#### 3.1 Update Agent Tool Registry
**File**: `src/server/services/AgentRequestBuilder.ts`

```typescript
// Add import
import { createEpisodeScriptToolDefinition } from '../tools/EpisodeScriptTool';

// Update computeAvailableToolsFromCanonicalContext function
export function computeAvailableToolsFromCanonicalContext(...) {
    // ... existing logic
    
    // Add episode script generation tool
    const hasEpisodeScripts = context.canonicalEpisodeScriptsList.length > 0;
    
    workflowToolNames.forEach(toolName => {
        switch (toolName) {
            // ... existing cases
            case 'generate_episode_script':
                addTool(() => createEpisodeScriptToolDefinition(transformRepo, jsondocRepo, projectId, userId, cachingOptions));
                break;
        }
    });
}
```

#### 3.2 Update Workflow Tools Logic
**File**: `src/common/schemas/tools.ts`

```typescript
export function getWorkflowTools(stage: WorkflowStage): string[] {
    const tools: string[] = [];
    
    // ... existing logic
    
    // Episode script generation - after episode synopsis exists
    if (stage.hasEpisodeSynopsis) {
        tools.push('generate_episode_script');
    }
    
    return tools;
}

// Update WorkflowStage interface
export interface WorkflowStage {
    // ... existing fields
    hasEpisodeSynopsis?: boolean;
}
```

### Phase 4: Frontend Actions & Display

#### 4.1 Update Action Computation Logic
**File**: `src/client/utils/lineageBasedActionComputation.ts`

```typescript
// Add import
import EpisodeScriptGenerationAction from '../components/actions/EpisodeScriptGenerationAction';

function generateActionsFromContext(context: LineageBasedActionContext): ActionItem[] {
    // ... existing logic
    
    // Episode script generation - sequential, next episode only
    if (context.canonicalEpisodeSynopsisList.length > 0) {
        // Find next episode that needs script generation
        const existingScriptEpisodes = new Set(
            context.canonicalEpisodeScriptsList.map(script => {
                try {
                    const data = typeof script.data === 'string' ? JSON.parse(script.data) : script.data;
                    return data.episodeNumber;
                } catch {
                    return null;
                }
            }).filter(num => num !== null)
        );
        
        // Find the next episode in sequence that has synopsis but no script
        const nextEpisodeForScript = context.canonicalEpisodeSynopsisList
            .map(synopsis => {
                try {
                    const data = typeof synopsis.data === 'string' ? JSON.parse(synopsis.data) : synopsis.data;
                    return { episodeNumber: data.episodeNumber, synopsis };
                } catch {
                    return null;
                }
            })
            .filter(item => item !== null)
            .sort((a, b) => a.episodeNumber - b.episodeNumber)
            .find(item => !existingScriptEpisodes.has(item.episodeNumber));
        
        if (nextEpisodeForScript) {
            // Find previous episode script for context (if exists)
            const previousEpisodeNumber = nextEpisodeForScript.episodeNumber - 1;
            const previousScript = context.canonicalEpisodeScriptsList.find(script => {
                try {
                    const data = typeof script.data === 'string' ? JSON.parse(script.data) : script.data;
                    return data.episodeNumber === previousEpisodeNumber;
                } catch {
                    return false;
                }
            });
            
            actions.push({
                id: 'episode_script_generation',
                type: 'button',
                title: `生成第${nextEpisodeForScript.episodeNumber}集剧本`,
                description: `基于分集大纲生成完整剧本内容`,
                component: EpisodeScriptGenerationAction,
                props: {
                    jsondocs: {
                        brainstormIdea: context.canonicalBrainstormIdea,
                        brainstormCollection: context.canonicalBrainstormCollection,
                        outlineSettings: context.canonicalOutlineSettings,
                        chronicles: context.canonicalChronicles,
                        episodePlanning: context.canonicalEpisodePlanning,
                        brainstormInput: context.canonicalBrainstormInput,
                        episodeSynopsis: nextEpisodeForScript.synopsis,
                        previousEpisodeScript: previousScript
                    },
                    workflowContext: {
                        hasActiveTransforms: context.hasActiveTransforms,
                        workflowNodes: context.workflowNodes
                    },
                    targetEpisode: {
                        episodeNumber: nextEpisodeForScript.episodeNumber,
                        synopsisId: nextEpisodeForScript.synopsis.id
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

#### 4.2 Create Episode Script Action Component
**File**: `src/client/components/actions/EpisodeScriptGenerationAction.tsx`

```typescript
import React, { useState, useCallback } from 'react';
import { Button, message, Alert, Typography } from 'antd';
import { apiService } from '../../services/apiService';
import { ActionComponentProps } from '../../utils/lineageBasedActionComputation';

const { Text } = Typography;

interface EpisodeScriptGenerationActionProps extends ActionComponentProps {
    targetEpisode: {
        episodeNumber: number;
        synopsisId: string;
    };
}

const EpisodeScriptGenerationAction: React.FC<EpisodeScriptGenerationActionProps> = (props) => {
    const { projectId, onSuccess, onError, targetEpisode, jsondocs } = props;
    const [isGenerating, setIsGenerating] = useState(false);

    const episodeSynopsis = jsondocs.episodeSynopsis;

    const handleGenerate = useCallback(async () => {
        if (!episodeSynopsis) {
            message.error('未找到分集大纲');
            return;
        }

        setIsGenerating(true);
        try {
            // Send chat message to trigger generation (following existing pattern)
            await apiService.sendChatMessage(projectId,
                `生成第${targetEpisode.episodeNumber}集剧本`,
                {
                    action: 'generate_episode_script',
                    episodeNumber: targetEpisode.episodeNumber,
                    episodeSynopsisJsondocId: targetEpisode.synopsisId
                }
            );

            message.success(`第${targetEpisode.episodeNumber}集剧本生成已启动`);
            onSuccess?.();
        } catch (error) {
            console.error('Error generating episode script:', error);
            message.error(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
            onError?.(error instanceof Error ? error : new Error('生成失败'));
        } finally {
            setIsGenerating(false);
        }
    }, [episodeSynopsis, targetEpisode, projectId, onSuccess, onError]);

    if (!episodeSynopsis) {
        return (
            <Alert message="需要先生成分集大纲" type="warning" showIcon />
        );
    }

    return (
        <div style={{ textAlign: 'center' }}>
            <Button
                type="primary"
                size="large"
                loading={isGenerating}
                onClick={handleGenerate}
                style={{ 
                    fontSize: '16px', 
                    background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', 
                    border: 'none' 
                }}
            >
                {isGenerating ? '生成中...' : `生成第${targetEpisode.episodeNumber}集剧本`}
            </Button>

            <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                    基于分集大纲生成完整剧本内容
                </Text>
            </div>
        </div>
    );
};

export default EpisodeScriptGenerationAction;
```

#### 4.3 Update Display Components
**File**: `src/client/utils/actionComputation.ts`

```typescript
function computeDisplayComponentsFromContext(context: UnifiedComputationContext): DisplayComponent[] {
    // ... existing logic
    
    // Episode script display - show all generated scripts
    if (context.canonicalContext.canonicalEpisodeScriptsList.length > 0) {
        const scriptItems = context.canonicalContext.canonicalEpisodeScriptsList.map(script => {
            const isDirectlyEditable = !context.hasActiveTransforms && script.origin_type === 'user_input';
            const canBecomeEditable = !context.hasActiveTransforms && script.origin_type === 'ai_generated';

            return {
                jsondoc: script,
                isEditable: isDirectlyEditable,
                isClickToEditable: canBecomeEditable,
            };
        });

        components.push({
            id: 'episode-script-display',
            component: getComponentById('episode-script-display'),
            mode: 'readonly',
            props: {
                scriptItems: scriptItems,
            },
            priority: componentOrder['episode-script-display'] || 9,
        });
    }
    
    return components;
}
```

#### 4.4 Create Episode Script Display Component
**File**: `src/client/components/shared/EpisodeScriptDisplay.tsx`

```typescript
import React from 'react';
import { Card, Typography, Space, Tag } from 'antd';
import { ElectricJsondoc } from '../../../common/types';

const { Title, Paragraph, Text } = Typography;

interface EpisodeScriptDisplayProps {
    scriptItems: Array<{
        jsondoc: ElectricJsondoc;
        isEditable: boolean;
        isClickToEditable: boolean;
    }>;
}

export const EpisodeScriptDisplay: React.FC<EpisodeScriptDisplayProps> = ({ scriptItems }) => {
    if (scriptItems.length === 0) {
        return null;
    }

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Title level={3}>剧本内容</Title>
            
            {scriptItems.map((item, index) => {
                const { jsondoc } = item;
                let scriptData;
                
                try {
                    scriptData = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
                } catch (error) {
                    console.error('Failed to parse script data:', error);
                    return null;
                }

                return (
                    <Card
                        key={jsondoc.id}
                        title={
                            <Space>
                                <span>第{scriptData.episodeNumber}集：{scriptData.title}</span>
                                <Tag color="blue">{Math.round(scriptData.estimatedDuration || 2)}分钟</Tag>
                                <Tag color="green">{scriptData.wordCount || 0}字</Tag>
                            </Space>
                        }
                        style={{
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #434343'
                        }}
                        headStyle={{ borderBottom: '1px solid #434343' }}
                    >
                        <Paragraph
                            style={{ 
                                whiteSpace: 'pre-wrap',
                                maxHeight: '400px',
                                overflow: 'auto',
                                backgroundColor: '#0f0f0f',
                                padding: '16px',
                                borderRadius: '6px',
                                border: '1px solid #434343'
                            }}
                        >
                            {scriptData.scriptContent}
                        </Paragraph>
                        
                        {item.isClickToEditable && (
                            <div style={{ marginTop: '12px' }}>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    点击内容可编辑
                                </Text>
                            </div>
                        )}
                    </Card>
                );
            })}
        </Space>
    );
};

export default EpisodeScriptDisplay;
```

#### 4.5 Register Display Component
**File**: `src/client/utils/componentRegistry.ts`

```typescript
// Add import
import EpisodeScriptDisplay from '../components/shared/EpisodeScriptDisplay';

// Add to component registry
const componentRegistry: Record<string, React.ComponentType<any>> = {
    // ... existing components
    'episode-script-display': EpisodeScriptDisplay,
};
```

### Phase 5: Testing & Validation

#### 5.1 Create Unit Tests
**File**: `src/server/tools/__tests__/EpisodeScriptTool.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEpisodeScriptToolDefinition } from '../EpisodeScriptTool';
import { EpisodeScriptInputSchema } from '../../../common/schemas/outlineSchemas';

// Mock dependencies
const mockTransformRepo = {} as any;
const mockJsondocRepo = {} as any;

describe('EpisodeScriptTool', () => {
    let toolDefinition: any;

    beforeEach(() => {
        toolDefinition = createEpisodeScriptToolDefinition(
            mockTransformRepo,
            mockJsondocRepo,
            'test-project',
            'test-user'
        );
    });

    it('should have correct tool configuration', () => {
        expect(toolDefinition.name).toBe('generate_episode_script');
        expect(toolDefinition.description).toContain('剧本内容');
        expect(toolDefinition.inputSchema).toBe(EpisodeScriptInputSchema);
    });

    it('should validate input schema correctly', () => {
        const validInput = {
            jsondocs: [],
            episodeNumber: 1,
            episodeSynopsisJsondocId: 'synopsis-123'
        };

        const result = toolDefinition.inputSchema.safeParse(validInput);
        expect(result.success).toBe(true);
    });

    it('should reject invalid input', () => {
        const invalidInput = {
            jsondocs: [],
            // Missing required fields
        };

        const result = toolDefinition.inputSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
    });
});
```

#### 5.2 Create Integration Tests
**File**: `src/__tests__/episodeScript.integration.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { computeCanonicalJsondocsFromLineage } from '../common/canonicalJsondocLogic';
import { buildLineageGraph } from '../common/transform-jsondoc-framework/lineageResolution';

describe('Episode Script Integration', () => {
    it('should include episode scripts in canonical context', () => {
        const mockJsondocs = [
            {
                id: 'script-1',
                schema_type: 'episode_script',
                data: JSON.stringify({
                    episodeNumber: 1,
                    title: '第一集',
                    scriptContent: '测试剧本内容...'
                }),
                origin_type: 'ai_generated'
            }
        ];

        const lineageGraph = buildLineageGraph(mockJsondocs, [], [], [], []);
        const canonicalContext = computeCanonicalJsondocsFromLineage(
            lineageGraph, mockJsondocs, [], [], [], []
        );

        expect(canonicalContext.canonicalEpisodeScriptsList).toHaveLength(1);
        expect(canonicalContext.canonicalEpisodeScriptsList[0].id).toBe('script-1');
    });

    it('should sort episode scripts by episode number', () => {
        const mockJsondocs = [
            {
                id: 'script-2',
                schema_type: 'episode_script',
                data: JSON.stringify({ episodeNumber: 2, title: '第二集' }),
                origin_type: 'ai_generated'
            },
            {
                id: 'script-1',
                schema_type: 'episode_script',
                data: JSON.stringify({ episodeNumber: 1, title: '第一集' }),
                origin_type: 'ai_generated'
            }
        ];

        const lineageGraph = buildLineageGraph(mockJsondocs, [], [], [], []);
        const canonicalContext = computeCanonicalJsondocsFromLineage(
            lineageGraph, mockJsondocs, [], [], [], []
        );

        expect(canonicalContext.canonicalEpisodeScriptsList).toHaveLength(2);
        expect(canonicalContext.canonicalEpisodeScriptsList[0].id).toBe('script-1');
        expect(canonicalContext.canonicalEpisodeScriptsList[1].id).toBe('script-2');
    });
});
```

#### 5.3 Update Build Configuration
Ensure all new files are included in the build process and TypeScript compilation.

#### 5.4 Verify npm Commands
```bash
# Test that build works
npm run build

# Test that all tests pass
npm test -- --run
```

## Implementation Order

1. **Phase 1** (Data Layer): Schemas, canonical logic, registry updates
2. **Phase 2** (Server): Template, tool, agent integration
3. **Phase 3** (Frontend): Action computation, action component
4. **Phase 4** (Display): Display component, component registry
5. **Phase 5** (Testing): Unit tests, integration tests, build verification

## Key Design Decisions

1. **Sequential Generation**: Only next episode can be generated (no dropdown)
2. **Single Text Format**: `scriptContent` as one large text field
3. **Agent-Based Actions**: All actions go through chat message → agent → tool flow
4. **Streaming Support**: Real-time preview during generation
5. **Canonical Logic**: Follows same patterns as episode synopsis
6. **Dependencies**: Episode script depends on episode synopsis + outline settings + previous script (optional)

## Testing Strategy

1. **Unit Tests**: Individual tool and component testing
2. **Integration Tests**: Canonical logic and workflow integration
3. **Build Verification**: Ensure TypeScript compilation and npm scripts work
4. **Manual Testing**: End-to-end workflow testing in development environment

This plan ensures episode script generation integrates seamlessly with the existing architecture while providing the streaming, sequential generation experience the user requested. 