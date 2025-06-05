# Episode Script Generation Implementation Plan

## Overview

This plan details the implementation of a two-stage episode script generation system:
1. **Episode Synopsis Generation** - Generate synopsis for each episode within a stage
2. **Episode Script Writing** - Generate detailed scripts for individual episodes

The implementation follows existing patterns from brainstorming and outline generation, ensuring consistency with the codebase architecture.

## Key Patterns From Existing Code

### 1. **Immediate Navigation Pattern** (from Brainstorming)
```typescript
// IdeationTab.tsx - Generate ideas navigates immediately
const { ideationRunId: newRunId, transformId } = await response.json();
navigate(`/ideation/${newRunId}?transform=${transformId}`);
```

### 2. **Streaming & Persistence Pattern** (from Outline)
```typescript
// OutlineTab.tsx - Check for active job and resume
const activeJob = await apiService.checkActiveStreamingJob(sessionId);
if (activeJob) {
  navigate(`/outlines/${sessionId}?transform=${activeJob.transformId}`, { replace: true });
}
```

### 3. **User Input Artifact Pattern** (from Multiple Components)
```typescript
// When user modifies LLM output, create human transform + user_input artifact
if (numberOfEpisodes !== stageArtifact.data.numberOfEpisodes) {
  const humanTransform = await createHumanTransform();
  const userInputArtifact = await createUserInputArtifact();
}
```

### 4. **Progressive UI Update Pattern** (from DynamicStreamingUI)
```typescript
// Real-time updates as data streams in
useEffect(() => {
  if (streamingData.length > 0) {
    const latestItem = streamingData[streamingData.length - 1];
    processData(latestItem, streamingStatus === 'streaming');
  }
}, [streamingData, streamingStatus]);
```

## Key Design Decisions

### 1. Navigation Flow
- Replace "生成剧集" button with "开始每集撰写"
- Navigate to new page immediately upon clicking (similar to brainstorming → outline flow)
- URL structure: `/scripts/{outlineSessionId}/stages/{stageArtifactId}/episodes/{episodeArtifactId}`

### 2. Artifact Refactoring
- **BREAKING CHANGE**: Refactor `synopsis_stages` from array to individual stage artifacts
- Each stage becomes its own artifact with type `outline_synopsis_stage`
- Enables using artifact IDs as stage IDs in URLs
- Maintains immutability and traceability

### 3. Streaming & Persistence
- Follow outline generation pattern for refresh-and-resume capability
- Database-backed streaming with transform chunks
- Progressive tree expansion during generation
- Maintain streaming state across page refreshes

### 4. Episode Synopsis Format
```json
{
  "episodeNumber": 1,
  "title": "第一集：初遇",
  "briefSummary": "李明和王小雅在新公司相遇...",
  "keyEvents": [
    "李明第一天入职，被分配到技术部",
    "王小雅在设计评审会上展示方案",
    "两人因为产品理念分歧产生争执"
  ],
  "hooks": "会议结束后，CEO宣布两人必须合作完成关键项目"
}
```

## Implementation Phases

### Phase 1: Backend Artifact Refactoring

#### 1.1 New Artifact Types
**File**: `src/server/types/artifacts.ts`

```typescript
// Refactored stage artifact (previously part of array)
export interface OutlineSynopsisStageV1 {
  stageNumber: number;
  stageSynopsis: string;
  numberOfEpisodes: number;
  outlineSessionId: string;
}

// Episode generation session
export interface EpisodeGenerationSessionV1 {
  id: string;
  outlineSessionId: string;
  stageArtifactId: string;
  status: 'active' | 'completed' | 'failed';
  totalEpisodes: number;
  episodeDuration: number;
}

// Episode synopsis artifact
export interface EpisodeSynopsisV1 {
  episodeNumber: number;
  title: string;
  briefSummary: string;
  keyEvents: string[];  // 2-3 key events per episode
  hooks: string;        // End-of-episode hook to next episode
  stageArtifactId: string;
  episodeGenerationSessionId: string;
}

// Episode generation parameters (for user modifications)
export interface EpisodeGenerationParamsV1 {
  stageArtifactId: string;
  numberOfEpisodes: number;
  stageSynopsis: string;
  customRequirements?: string;
}
```

#### 1.2 Migration Script
**File**: `src/server/database/migrations/005_refactor_synopsis_stages.ts`

```typescript
export async function up(knex: Knex) {
  // This migration will:
  // 1. Find all outline_synopsis_stages artifacts
  // 2. Extract individual stages from the array
  // 3. Create new outline_synopsis_stage artifacts for each
  // 4. Update transforms to reference new artifacts
  // 5. Delete old outline_synopsis_stages artifacts
}
```

#### 1.3 Update OutlineService
**File**: `src/server/services/OutlineService.ts`

Modify `StreamingTransformExecutor.createOutlineArtifacts()` to create individual stage artifacts instead of a single array artifact.

### Phase 2: Episode Generation Service

#### 2.1 EpisodeGenerationService
**File**: `src/server/services/EpisodeGenerationService.ts`

```typescript
export class EpisodeGenerationService {
  constructor(
    private artifactRepo: ArtifactRepository,
    private transformRepo: TransformRepository,
    private unifiedStreamingService: UnifiedStreamingService
  ) {}

  async startEpisodeGeneration(
    userId: string,
    stageArtifactId: string,
    numberOfEpisodes?: number,
    customRequirements?: string
  ): Promise<{ sessionId: string; transformId: string }> {
    // 1. Get stage artifact and validate ownership
    const stageArtifact = await this.artifactRepo.getArtifact(stageArtifactId, userId);
    if (!stageArtifact || stageArtifact.type !== 'outline_synopsis_stage') {
      throw new Error('Invalid stage artifact');
    }

    // 2. Create or get user_input artifact if modifications exist
    let paramsArtifact;
    if (numberOfEpisodes !== stageArtifact.data.numberOfEpisodes || customRequirements) {
      // Create human transform for modifications
      const humanTransform = await this.transformRepo.createTransform(
        userId, 'human', 'v1', 'completed',
        { action: 'modify_episode_params' }
      );

      // Create user_input artifact
      paramsArtifact = await this.artifactRepo.createArtifact(
        userId,
        'episode_generation_params',
        {
          stageArtifactId,
          numberOfEpisodes: numberOfEpisodes || stageArtifact.data.numberOfEpisodes,
          stageSynopsis: stageArtifact.data.stageSynopsis,
          customRequirements
        } as EpisodeGenerationParamsV1
      );
    }

    // 3. Create episode generation session
    const sessionId = `ep-gen-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sessionArtifact = await this.artifactRepo.createArtifact(
      userId,
      'episode_generation_session',
      {
        id: sessionId,
        outlineSessionId: stageArtifact.data.outlineSessionId,
        stageArtifactId,
        status: 'active',
        totalEpisodes: numberOfEpisodes || stageArtifact.data.numberOfEpisodes,
        episodeDuration: 45 // Default, can be parameterized
      } as EpisodeGenerationSessionV1
    );

    // 4. Create transform for streaming generation
    const transform = await this.transformRepo.createTransform(
      userId, 'llm', 'v1', 'running',
      {
        episode_generation_session_id: sessionId,
        stage_artifact_id: stageArtifactId,
        total_episodes: numberOfEpisodes || stageArtifact.data.numberOfEpisodes
      }
    );

    // 5. Add input artifacts
    await this.transformRepo.addTransformInputs(transform.id, [
      { artifactId: stageArtifactId },
      ...(paramsArtifact ? [{ artifactId: paramsArtifact.id }] : [])
    ]);

    return { sessionId, transformId: transform.id };
  }

  async getEpisodeGenerationSession(
    userId: string,
    sessionId: string
  ): Promise<EpisodeGenerationSessionData | null> {
    // Similar to OutlineService.getOutlineSession
    // Use UnifiedStreamingService to get real-time state
  }
}
```

### Phase 3: Frontend Implementation

#### 3.1 Update DynamicOutlineResults
**File**: `src/client/components/DynamicOutlineResults.tsx`

```typescript
// Change button text and navigation
const handleGenerateEpisodes = () => {
  navigate(`/scripts/${sessionId}`);
};

// Update button
<Button
  type="primary"
  icon={<PlayCircleOutlined />}
  onClick={handleGenerateEpisodes}
  disabled={!components || status !== 'completed'}
  style={{
    background: '#52c41a',
    borderColor: '#52c41a'
  }}
>
  开始每集撰写
</Button>
```

#### 3.2 Create Episode Generation Page
**File**: `src/client/components/EpisodeGenerationPage.tsx`

```typescript
export const EpisodeGenerationPage: React.FC = () => {
  const { scriptId } = useParams<{ scriptId: string }>();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  
  // Load outline data and build tree
  useEffect(() => {
    loadOutlineData();
  }, [scriptId]);

  const loadOutlineData = async () => {
    const outlineData = await apiService.getOutlineSession(scriptId);
    
    // Build tree from stage artifacts
    const stages = await apiService.getStageArtifacts(scriptId);
    const treeNodes = stages.map(stage => ({
      key: stage.id,
      title: `第${stage.data.stageNumber}阶段 (${stage.data.numberOfEpisodes}集)`,
      isLeaf: false,
      children: [] // Will be populated when episodes are generated
    }));
    
    setTreeData(treeNodes);
  };

  const onTreeSelect = (selectedKeys: Key[], info: any) => {
    const nodeKey = selectedKeys[0] as string;
    
    if (nodeKey.includes('episode-')) {
      // Navigate to episode detail
      const [stageId, episodeId] = parseEpisodeKey(nodeKey);
      navigate(`/scripts/${scriptId}/stages/${stageId}/episodes/${episodeId}`);
    } else {
      // Stage selected
      setSelectedStageId(nodeKey);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Left: Tree View */}
      <div style={{ 
        width: '300px', 
        borderRight: '1px solid #303030',
        padding: '20px',
        overflowY: 'auto'
      }}>
        <Title level={4}>剧集结构</Title>
        <Tree
          treeData={treeData}
          onSelect={onTreeSelect}
          expandedKeys={expandedKeys}
          onExpand={setExpandedKeys}
          style={{ background: 'transparent' }}
        />
      </div>

      {/* Right: Content Area */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        {selectedStageId ? (
          <StageDetailView 
            stageId={selectedStageId} 
            onGenerateStart={(sessionId, transformId) => {
              // Start progressive tree expansion
              startStreamingEpisodes(selectedStageId, sessionId, transformId);
            }}
          />
        ) : (
          <Empty description="请选择一个阶段开始生成每集大纲" />
        )}
      </div>
    </div>
  );
};
```

#### 3.3 Stage Detail View
**File**: `src/client/components/StageDetailView.tsx`

```typescript
export const StageDetailView: React.FC<{
  stageId: string;
  onGenerateStart: (sessionId: string, transformId: string) => void;
}> = ({ stageId, onGenerateStart }) => {
  const [stageData, setStageData] = useState<any>(null);
  const [numberOfEpisodes, setNumberOfEpisodes] = useState<number>(0);
  const [stageSynopsis, setStageSynopsis] = useState<string>('');
  const [customRequirements, setCustomRequirements] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasModifications, setHasModifications] = useState(false);

  useEffect(() => {
    loadStageData();
  }, [stageId]);

  const loadStageData = async () => {
    const stage = await apiService.getStageArtifact(stageId);
    setStageData(stage);
    setNumberOfEpisodes(stage.data.numberOfEpisodes);
    setStageSynopsis(stage.data.stageSynopsis);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await apiService.startEpisodeGeneration({
        stageArtifactId: stageId,
        numberOfEpisodes,
        customRequirements
      });

      onGenerateStart(result.sessionId, result.transformId);
      
      // Navigate to episode list view with streaming
      navigate(`/scripts/${scriptId}/stages/${stageId}?session=${result.sessionId}&transform=${result.transformId}`);
    } catch (error) {
      message.error('生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card title={`第${stageData?.data.stageNumber}阶段配置`}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Text strong>集数</Text>
          <InputNumber
            value={numberOfEpisodes}
            onChange={(value) => {
              setNumberOfEpisodes(value || 1);
              setHasModifications(value !== stageData?.data.numberOfEpisodes);
            }}
            min={1}
            max={50}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <Text strong>阶段梗概</Text>
          <TextArea
            value={stageSynopsis}
            onChange={(e) => {
              setStageSynopsis(e.target.value);
              setHasModifications(e.target.value !== stageData?.data.stageSynopsis);
            }}
            rows={6}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <Text strong>额外要求（可选）</Text>
          <TextArea
            value={customRequirements}
            onChange={(e) => setCustomRequirements(e.target.value)}
            placeholder="对本阶段剧集生成的特殊要求..."
            rows={3}
            style={{ width: '100%' }}
          />
        </div>

        {hasModifications && (
          <Alert
            message="已修改内容"
            description="修改将在生成时保存为新的用户输入"
            type="info"
            showIcon
          />
        )}

        <Button
          type="primary"
          onClick={handleGenerate}
          loading={isGenerating}
          style={{ width: '100%' }}
        >
          生成本阶段所有剧集梗概
        </Button>
      </Space>
    </Card>
  );
};
```

#### 3.4 Episode List Streaming View
**File**: `src/client/components/EpisodeListStreamingView.tsx`

```typescript
export const EpisodeListStreamingView: React.FC = () => {
  const { scriptId, stageId } = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const transformId = searchParams.get('transform');

  // Use streaming hook for episode synopsis
  const streamingService = useMemo(() => new EpisodeSynopsisStreamingService(), []);
  const { 
    status, 
    items: episodes, 
    isThinking, 
    stop 
  } = useLLMStreaming(streamingService, { transformId });

  // Update parent tree as episodes stream in
  useEffect(() => {
    if (episodes.length > 0) {
      updateParentTree(stageId, episodes);
    }
  }, [episodes]);

  return (
    <div>
      <PageHeader
        title="剧集梗概生成"
        subTitle={`第${stageNumber}阶段`}
        onBack={() => navigate(`/scripts/${scriptId}/stages/${stageId}`)}
      />

      {/* Streaming Progress */}
      {status === 'streaming' && (
        <Card style={{ marginBottom: 16 }}>
          <Space>
            <Spin />
            <Text>正在生成第 {episodes.length + 1} 集...</Text>
            <Button onClick={stop} danger size="small">停止生成</Button>
          </Space>
        </Card>
      )}

      {/* Episode List */}
      <List
        dataSource={episodes}
        renderItem={(episode, index) => (
          <List.Item>
            <Card 
              style={{ width: '100%' }}
              hoverable
              onClick={() => navigate(`/scripts/${scriptId}/stages/${stageId}/episodes/${episode.artifactId}`)}
            >
              <Card.Meta
                title={`第${episode.episodeNumber}集：${episode.title}`}
                description={
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Paragraph ellipsis={{ rows: 2 }}>
                      {episode.briefSummary}
                    </Paragraph>
                    <div>
                      <Text strong>关键事件：</Text>
                      <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                        {episode.keyEvents.map((event, idx) => (
                          <li key={idx}>{event}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <Text strong>悬念钩子：</Text>
                      <Text>{episode.hooks}</Text>
                    </div>
                  </Space>
                }
              />
            </Card>
          </List.Item>
        )}
      />
    </div>
  );
};
```

### Phase 4: Streaming Service Implementation

#### 4.1 Episode Synopsis Streaming Service
**File**: `src/client/services/implementations/EpisodeSynopsisStreamingService.ts`

```typescript
export interface EpisodeSynopsis {
  episodeNumber: number;
  title: string;
  briefSummary: string;
  keyEvents: string[];
  hooks: string;
  artifactId?: string;
}

export class EpisodeSynopsisStreamingService extends LLMStreamingService<EpisodeSynopsis> {
  validate(item: any): item is EpisodeSynopsis {
    return (
      typeof item.episodeNumber === 'number' &&
      typeof item.title === 'string' &&
      typeof item.briefSummary === 'string' &&
      Array.isArray(item.keyEvents) &&
      typeof item.hooks === 'string'
    );
  }

  parsePartial(content: string): EpisodeSynopsis[] {
    // Similar to BrainstormingStreamingService
    // Parse array of episode synopsis objects
    // Use jsonrepair for incomplete JSON
  }

  protected convertArtifactToItem(artifactData: any): EpisodeSynopsis | null {
    if (artifactData.type === 'episode_synopsis') {
      return {
        episodeNumber: artifactData.episodeNumber,
        title: artifactData.title,
        briefSummary: artifactData.briefSummary,
        keyEvents: artifactData.keyEvents,
        hooks: artifactData.hooks,
        artifactId: artifactData.id
      };
    }
    return null;
  }
}
```

### Phase 5: API Routes

#### 5.1 Episode Generation Routes
**File**: `src/server/routes/episodes.ts`

```typescript
export function createEpisodeRoutes(
  episodeService: EpisodeGenerationService,
  authMiddleware: AuthMiddleware
) {
  const router = express.Router();

  // Start episode generation for a stage
  router.post('/stages/:stageId/episodes/generate', 
    authMiddleware.authenticate, 
    async (req, res) => {
      const userId = req.user?.id;
      const { stageId } = req.params;
      const { numberOfEpisodes, customRequirements } = req.body;

      try {
        const result = await episodeService.startEpisodeGeneration(
          userId,
          stageId,
          numberOfEpisodes,
          customRequirements
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Get episode generation session
  router.get('/episode-generation/:sessionId',
    authMiddleware.authenticate,
    async (req, res) => {
      const userId = req.user?.id;
      const { sessionId } = req.params;

      try {
        const session = await episodeService.getEpisodeGenerationSession(
          userId,
          sessionId
        );
        res.json(session);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Get stage artifacts for an outline
  router.get('/outlines/:outlineId/stages',
    authMiddleware.authenticate,
    async (req, res) => {
      const userId = req.user?.id;
      const { outlineId } = req.params;

      try {
        const stages = await episodeService.getStageArtifacts(userId, outlineId);
        res.json(stages);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  );

  return router;
}
```

### Phase 6: Update App.tsx Routes

```typescript
// Add new routes
<Route path="/scripts/:scriptId" element={
  <ProtectedRoute>
    <EpisodeGenerationPage />
  </ProtectedRoute>
} />
<Route path="/scripts/:scriptId/stages/:stageId" element={
  <ProtectedRoute>
    <EpisodeGenerationPage />
  </ProtectedRoute>
} />
<Route path="/scripts/:scriptId/stages/:stageId/episodes/:episodeId" element={
  <ProtectedRoute>
    <EpisodeDetailPage />
  </ProtectedRoute>
} />
```

## Testing Plan

### 1. Backend Testing
- Test stage artifact migration
- Test episode generation transform creation
- Test streaming with progressive updates
- Test refresh-and-resume functionality

### 2. Frontend Testing
- Test tree navigation and expansion
- Test stage editing with artifact tracking
- Test streaming UI updates
- Test page refresh during streaming

### 3. Integration Testing
- Full flow from outline to episode synopsis
- Test with various stage configurations
- Test error handling and recovery
- Performance testing with multiple concurrent generations

## Rollback Plan

If issues arise:
1. The migration is reversible - we can reconstruct the array format from individual stage artifacts
2. Frontend can fallback to showing old format if needed
3. Keep backup of database before migration

## Future Enhancements

1. **Episode Script Generation** (Phase 2)
   - Add detailed script generation for each episode
   - Include dialogue, scene descriptions, etc.

2. **Batch Operations**
   - Generate all stages' episodes in parallel
   - Bulk editing capabilities

3. **Episode Relationships**
   - Track character appearances across episodes
   - Plot thread continuity checking

4. **Export Features**
   - Export episode synopsis to various formats
   - Integration with script writing software 