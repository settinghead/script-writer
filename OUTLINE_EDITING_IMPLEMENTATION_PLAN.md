# Outline Editing Implementation Plan

## Overview
Implement auto-resize textareas with debounced auto-save, episode generation, and revert functionality for the outline results page, while fixing existing bugs in the user edit system.

## Current Architecture Analysis

### ✅ What's Working Well
- **LLM output is stored as individual artifacts** per component (`outline_title`, `outline_genre`, etc.)
- **Original data is preserved** - LLM artifacts remain untouched
- **Transform tracking** - all changes create proper transforms
- **Artifact-transform paradigm** is followed correctly

### 🐛 Current Bugs to Fix
1. **User edits stored as wrong type**: Creates `user_input` instead of specific types
2. **Data retrieval broken**: Looks for `outline_title` but user edits are `user_input`
3. **No modification tracking**: Frontend doesn't know what's been changed
4. **No revert capability**: Can't restore original LLM data

## Implementation Tasks

### Phase 1: Fix Backend User Edit System

#### 1.1 Fix User Edit Storage
**File**: `src/server/routes/outlineRoutes.ts`
**Current Problem**: 
```typescript
// Creates generic 'user_input' - WRONG
const newArtifact = await artifactRepo.createArtifact(userId, 'user_input', {
  text: value,
  source: `edited_${componentType}`,
  outline_session_id: sessionId
});
```

**Fix**:
```typescript
// Create specific edit artifact types
const artifactType = `${componentType}_edit`; // e.g., 'title_edit', 'genre_edit'
const newArtifact = await artifactRepo.createArtifact(userId, artifactType, {
  [componentType]: value,
  outline_session_id: sessionId,
  edited_at: new Date().toISOString(),
  original_artifact_id: originalArtifactId // Link to original
});
```

#### 1.2 Add New Artifact Types
**File**: `src/server/types/artifacts.ts`
```typescript
// Add edit artifact types
export interface OutlineTitleEditV1 {
  title: string;
  outline_session_id: string;
  edited_at: string;
  original_artifact_id?: string;
}

export interface OutlineGenreEditV1 {
  genre: string;
  outline_session_id: string;
  edited_at: string;
  original_artifact_id?: string;
}

// ... similar for all other components
```

#### 1.3 Fix Data Retrieval
**File**: `src/server/services/UnifiedStreamingService.ts`
**Method**: `getOutlineComponents()`

**Current Problem**: Only looks for original artifacts, ignores user edits

**Fix**:
```typescript
private async getOutlineComponents(userId: string, sessionId: string, transforms: any[]): Promise<{
  components: any;
  modifiedFields: string[];
  hasModifications: boolean;
}> {
  // 1. Get original LLM artifacts
  const originalComponents = await this.getOriginalOutlineArtifacts(userId, transforms);
  
  // 2. Get user edit artifacts
  const { userEdits, modifiedFields } = await this.getUserEditArtifacts(userId, sessionId);
  
  // 3. Merge: user edits override original
  const components = { ...originalComponents, ...userEdits };
  
  return {
    components,
    modifiedFields,
    hasModifications: modifiedFields.length > 0
  };
}

private async getUserEditArtifacts(userId: string, sessionId: string): Promise<{
  userEdits: any;
  modifiedFields: string[];
}> {
  const editTypes = [
    'title_edit', 'genre_edit', 'selling_points_edit', 'setting_edit',
    'synopsis_edit', 'target_audience_edit', 'satisfaction_points_edit',
    'characters_edit', 'synopsis_stages_edit'
  ];
  
  const editArtifacts = await this.artifactRepo.getArtifactsByTypes(userId, editTypes);
  const sessionEdits = editArtifacts.filter(a => a.data.outline_session_id === sessionId);
  
  const userEdits = {};
  const modifiedFields = [];
  
  for (const artifact of sessionEdits) {
    const fieldName = artifact.type.replace('_edit', '');
    userEdits[fieldName] = artifact.data[fieldName];
    modifiedFields.push(fieldName);
  }
  
  return { userEdits, modifiedFields };
}
```

#### 1.4 Add New API Endpoints
**File**: `src/server/routes/outlineRoutes.ts`

```typescript
// Get original LLM data (without user edits)
router.get('/outlines/:id/original', authMiddleware.authenticate, async (req, res) => {
  const userId = req.user?.id;
  const sessionId = req.params.id;
  
  const originalData = await unifiedStreamingService.getOriginalOutlineData(userId, sessionId);
  res.json(originalData);
});

// Clear all user edits for a session
router.delete('/outlines/:id/edits', authMiddleware.authenticate, async (req, res) => {
  const userId = req.user?.id;
  const sessionId = req.params.id;
  
  await outlineService.clearUserEdits(userId, sessionId);
  res.json({ success: true });
});
```

### Phase 2: Frontend Auto-Save System

#### 2.1 Enhanced Field Components
**File**: `src/client/components/shared/streaming/fieldComponents.tsx`

Replace current `TextAreaField` with auto-save version:

```typescript
import TextareaAutosize from 'react-textarea-autosize';
import { debounce } from 'lodash';

export const AutoSaveTextAreaField: React.FC<FieldProps & {
  label?: string;
  placeholder?: string;
  onSave?: (value: string) => Promise<void>;
  debounceMs?: number;
}> = ({ 
  value, 
  onSave, 
  debounceMs = 1000, 
  label, 
  placeholder,
  ...props 
}) => {
  const [localValue, setLocalValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value || '');
    setHasUnsavedChanges(false);
  }, [value]);
  
  // Debounced save function
  const debouncedSave = useMemo(
    () => debounce(async (newValue: string) => {
      if (onSave && newValue !== value) {
        setIsSaving(true);
        setSaveError(null);
        try {
          await onSave(newValue);
          setHasUnsavedChanges(false);
        } catch (error) {
          console.error('Auto-save failed:', error);
          setSaveError('保存失败');
        } finally {
          setIsSaving(false);
        }
      }
    }, debounceMs),
    [onSave, value, debounceMs]
  );
  
  // Auto-save on value change
  useEffect(() => {
    if (localValue !== value) {
      setHasUnsavedChanges(true);
      debouncedSave(localValue);
    }
  }, [localValue, debouncedSave]);
  
  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);
  
  return (
    <div style={{ marginBottom: '8px' }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          <Text strong style={{ color: '#fff' }}>
            {label}
          </Text>
          {isSaving && (
            <Spin size="small" style={{ marginLeft: '8px' }} />
          )}
          {hasUnsavedChanges && !isSaving && (
            <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
              未保存
            </Text>
          )}
          {saveError && (
            <Text type="danger" style={{ marginLeft: '8px', fontSize: '12px' }}>
              {saveError}
            </Text>
          )}
        </div>
      )}
      
      <TextareaAutosize
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        minRows={3}
        maxRows={20}
        style={{
          width: '100%',
          backgroundColor: '#1f1f1f',
          border: '1px solid #404040',
          borderRadius: '6px',
          color: '#fff',
          padding: '8px 12px',
          fontSize: '14px',
          lineHeight: '1.5715',
          resize: 'none',
          outline: 'none'
        }}
      />
    </div>
  );
};

// Single-line auto-save field
export const AutoSaveTextField: React.FC<FieldProps & {
  label?: string;
  placeholder?: string;
  onSave?: (value: string) => Promise<void>;
  debounceMs?: number;
}> = ({ 
  value, 
  onSave, 
  debounceMs = 1000, 
  label, 
  placeholder,
  ...props 
}) => {
  // Similar implementation but with Input instead of TextareaAutosize
  // ... (similar logic to AutoSaveTextAreaField)
  
  return (
    <div style={{ marginBottom: '8px' }}>
      {/* Similar header with save status */}
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        style={{
          backgroundColor: '#1f1f1f',
          borderColor: '#404040',
          color: '#fff'
        }}
      />
    </div>
  );
};
```

#### 2.2 Update Field Registry
**File**: `src/client/components/shared/streaming/outlineFieldRegistry.ts`

```typescript
import { AutoSaveTextAreaField, AutoSaveTextField } from './fieldComponents';

export const outlineFieldRegistry: FieldDefinition[] = [
  {
    path: 'title',
    component: AutoSaveTextField,
    label: '剧本标题',
    order: 1,
    containerType: 'default'
  },
  {
    path: 'genre',
    component: AutoSaveTextField,
    label: '剧本类型',
    order: 2,
    containerType: 'default'
  },
  {
    path: 'synopsis',
    component: AutoSaveTextAreaField,
    label: '剧情大纲',
    order: 6,
    containerType: 'default'
  },
  // ... update all fields to use auto-save components
];
```

#### 2.3 Enhanced Results Component
**File**: `src/client/components/DynamicOutlineResults.tsx`

```typescript
export const DynamicOutlineResults: React.FC<Props> = ({ 
  sessionId, 
  components, 
  status,
  ...props 
}) => {
  const [originalData, setOriginalData] = useState<OutlineComponents | null>(null);
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());
  const [isLoadingOriginal, setIsLoadingOriginal] = useState(false);
  const navigate = useNavigate();
  
  // Load original data and modification status
  useEffect(() => {
    loadOutlineData();
  }, [sessionId]);
  
  const loadOutlineData = async () => {
    try {
      // Get current data (with modifications)
      const currentData = await apiService.getOutlineSession(sessionId);
      
      // Get original data (without modifications)
      const originalData = await apiService.getOriginalOutlineData(sessionId);
      
      setOriginalData(originalData.components);
      
      // Determine which fields have been modified
      const modified = new Set<string>();
      Object.keys(currentData.components).forEach(key => {
        if (JSON.stringify(currentData.components[key]) !== JSON.stringify(originalData.components[key])) {
          modified.add(key);
        }
      });
      setModifiedFields(modified);
      
    } catch (error) {
      console.error('Error loading outline data:', error);
    }
  };
  
  const handleFieldSave = async (fieldPath: string, newValue: any) => {
    try {
      // Save to backend
      await apiService.updateOutlineComponent(sessionId, fieldPath, newValue);
      
      // Update local state
      setModifiedFields(prev => new Set([...prev, fieldPath]));
      
      // Update parent component
      if (onComponentUpdate) {
        onComponentUpdate(fieldPath, newValue, `edit-${Date.now()}`);
      }
    } catch (error) {
      console.error('Error saving field:', error);
      throw error; // Re-throw for component to handle
    }
  };
  
  const handleRevertToOriginal = async () => {
    if (!originalData) return;
    
    try {
      setIsLoadingOriginal(true);
      
      // Clear all user edits from backend
      await apiService.clearOutlineEdits(sessionId);
      
      // Reset local state
      setModifiedFields(new Set());
      
      // Reload data
      await loadOutlineData();
      
      message.success('已恢复到原始生成内容');
    } catch (error) {
      console.error('Error reverting to original:', error);
      message.error('恢复失败');
    } finally {
      setIsLoadingOriginal(false);
    }
  };
  
  const handleGenerateEpisodes = () => {
    navigate(`/episodes/generate?outlineId=${sessionId}`);
  };
  
  const hasModifications = modifiedFields.size > 0;
  
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Action Buttons */}
      <Row gutter={[16, 16]}>
        <Col>
          <Button
            type="default"
            icon={<ReloadOutlined />}
            onClick={onRegenerate}
            disabled={isStreaming}
          >
            重新生成
          </Button>
        </Col>
        <Col>
          <Button
            type="default"
            icon={<ExportOutlined />}
            onClick={handleExport}
            disabled={!components || Object.keys(components).length === 0}
          >
            导出大纲
          </Button>
        </Col>
        {hasModifications && (
          <Col>
            <Button
              type="default"
              icon={<UndoOutlined />}
              onClick={handleRevertToOriginal}
              loading={isLoadingOriginal}
              style={{
                background: '#722ed1',
                borderColor: '#722ed1',
                color: '#fff'
              }}
            >
              恢复到原始生成
            </Button>
          </Col>
        )}
        <Col>
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
            生成剧集
          </Button>
        </Col>
      </Row>
      
      {/* Modification indicator */}
      {hasModifications && (
        <Alert
          message={`已修改 ${modifiedFields.size} 个字段`}
          description="您可以继续编辑或恢复到原始生成内容"
          type="info"
          showIcon
          style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #1890ff',
            color: '#fff'
          }}
        />
      )}
      
      {/* Dynamic streaming UI with auto-save */}
      <DynamicStreamingUI
        fieldRegistry={outlineFieldRegistry}
        streamingData={streamingData}
        streamingStatus={streamingStatus}
        isThinking={isThinking}
        onStopStreaming={onStopStreaming}
        onFieldEdit={handleFieldSave}
        className="outline-results"
      />
      
      {/* Rest of component... */}
    </Space>
  );
};
```

### Phase 3: Episode Generation System

#### 3.1 New Artifact Types
**File**: `src/server/types/artifacts.ts`

```typescript
export interface EpisodeGenerationParamsV1 {
  outline_session_id: string;
  episode_count: number;
  episode_duration: number;
  generation_strategy: 'sequential' | 'batch';
  custom_requirements?: string;
  use_modified_outline: boolean; // Use current (modified) or original outline
}

export interface EpisodeSessionV1 {
  id: string;
  outline_session_id: string;
  status: 'active' | 'completed' | 'failed';
  created_at: string;
}

export interface EpisodeV1 {
  episode_number: number;
  title: string;
  content: string;
  duration_minutes: number;
  outline_session_id: string;
  episode_session_id: string;
  generated_at: string;
}
```

#### 3.2 Episode Service
**File**: `src/server/services/EpisodeService.ts`

```typescript
export class EpisodeService {
  constructor(
    private artifactRepo: ArtifactRepository,
    private transformRepo: TransformRepository,
    private unifiedStreamingService: UnifiedStreamingService,
    private streamingExecutor: StreamingTransformExecutor
  ) {}
  
  async generateEpisodes(
    userId: string,
    outlineSessionId: string,
    params: EpisodeGenerationParamsV1
  ): Promise<{ sessionId: string; transformId: string }> {
    // 1. Get outline data (with or without user modifications)
    const outlineData = params.use_modified_outline
      ? await this.unifiedStreamingService.getOutlineSession(userId, outlineSessionId)
      : await this.unifiedStreamingService.getOriginalOutlineData(userId, outlineSessionId);
    
    if (!outlineData) {
      throw new Error('Outline session not found');
    }
    
    // 2. Create episode generation session
    const episodeSessionId = uuidv4();
    const sessionArtifact = await this.artifactRepo.createArtifact(
      userId,
      'episode_session',
      {
        id: episodeSessionId,
        outline_session_id: outlineSessionId,
        status: 'active',
        created_at: new Date().toISOString()
      } as EpisodeSessionV1
    );
    
    // 3. Create parameters artifact
    const paramsArtifact = await this.artifactRepo.createArtifact(
      userId,
      'episode_generation_params',
      params
    );
    
    // 4. Start streaming LLM generation
    const { transformId } = await this.streamingExecutor.startEpisodeJob(
      userId,
      params,
      [sessionArtifact.id, paramsArtifact.id]
    );
    
    return { sessionId: episodeSessionId, transformId };
  }
}
```

#### 3.3 Episode Routes
**File**: `src/server/routes/episodeRoutes.ts`

```typescript
export function createEpisodeRoutes(
  authMiddleware: any,
  episodeService: EpisodeService
) {
  const router = express.Router();
  
  // Start episode generation
  router.post('/episodes/generate', authMiddleware.authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      const { outlineSessionId, ...params } = req.body;
      
      const result = await episodeService.generateEpisodes(userId, outlineSessionId, params);
      res.json(result);
    } catch (error) {
      console.error('Error generating episodes:', error);
      res.status(500).json({ error: 'Failed to generate episodes' });
    }
  });
  
  // Get episode session
  router.get('/episodes/:sessionId', authMiddleware.authenticate, async (req, res) => {
    // Implementation...
  });
  
  return router;
}
```

#### 3.4 Episode Generation UI
**File**: `src/client/components/EpisodeGenerationForm.tsx`

```typescript
export const EpisodeGenerationForm: React.FC = () => {
  const [searchParams] = useSearchParams();
  const outlineId = searchParams.get('outlineId');
  const navigate = useNavigate();
  
  const [episodeCount, setEpisodeCount] = useState(10);
  const [episodeDuration, setEpisodeDuration] = useState(3);
  const [useModifiedOutline, setUseModifiedOutline] = useState(true);
  const [customRequirements, setCustomRequirements] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      
      const result = await apiService.generateEpisodes({
        outlineSessionId: outlineId,
        episode_count: episodeCount,
        episode_duration: episodeDuration,
        generation_strategy: 'sequential',
        custom_requirements: customRequirements,
        use_modified_outline: useModifiedOutline
      });
      
      navigate(`/episodes/${result.sessionId}?transform=${result.transformId}`);
    } catch (error) {
      console.error('Error generating episodes:', error);
      message.error('生成失败');
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <Card title="生成剧集" style={{ maxWidth: 600, margin: '0 auto' }}>
      {/* Form fields for episode generation parameters */}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Text strong>剧集数量</Text>
          <InputNumber
            value={episodeCount}
            onChange={setEpisodeCount}
            min={1}
            max={100}
            style={{ width: '100%' }}
          />
        </div>
        
        <div>
          <Text strong>每集时长（分钟）</Text>
          <InputNumber
            value={episodeDuration}
            onChange={setEpisodeDuration}
            min={1}
            max={30}
            style={{ width: '100%' }}
          />
        </div>
        
        <div>
          <Checkbox
            checked={useModifiedOutline}
            onChange={(e) => setUseModifiedOutline(e.target.checked)}
          >
            使用修改后的大纲（如果未修改则使用原始大纲）
          </Checkbox>
        </div>
        
        <div>
          <Text strong>额外要求（可选）</Text>
          <TextareaAutosize
            value={customRequirements}
            onChange={(e) => setCustomRequirements(e.target.value)}
            placeholder="请输入对剧集生成的特殊要求..."
            minRows={3}
            style={{ width: '100%' }}
          />
        </div>
        
        <Button
          type="primary"
          onClick={handleGenerate}
          loading={isGenerating}
          disabled={!outlineId}
          style={{ width: '100%' }}
        >
          开始生成剧集
        </Button>
      </Space>
    </Card>
  );
};
```

### Phase 4: API Service Updates

#### 4.1 Add New API Methods
**File**: `src/client/services/apiService.ts`

```typescript
class ApiService {
  // ... existing methods
  
  // Get original outline data (without user edits)
  async getOriginalOutlineData(sessionId: string): Promise<OutlineSessionData> {
    const response = await fetch(`${this.baseUrl}/outlines/${sessionId}/original`);
    if (!response.ok) {
      throw new Error(`Failed to fetch original outline data: ${response.status}`);
    }
    return response.json();
  }
  
  // Clear all user edits for a session
  async clearOutlineEdits(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/outlines/${sessionId}/edits`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`Failed to clear outline edits: ${response.status}`);
    }
  }
  
  // Episode generation
  async generateEpisodes(params: {
    outlineSessionId: string;
    episode_count: number;
    episode_duration: number;
    generation_strategy: 'sequential' | 'batch';
    custom_requirements?: string;
    use_modified_outline: boolean;
  }): Promise<{ sessionId: string; transformId: string }> {
    const response = await fetch(`${this.baseUrl}/episodes/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
    if (!response.ok) {
      throw new Error(`Failed to generate episodes: ${response.status}`);
    }
    return response.json();
  }
  
  async getEpisodeSession(sessionId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/episodes/${sessionId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch episode session: ${response.status}`);
    }
    return response.json();
  }
}
```

## Testing Plan

### Phase 1 Testing: Backend Fixes
1. **Test user edit storage**: Verify edits create correct artifact types
2. **Test data retrieval**: Verify modified fields are returned correctly
3. **Test modification tracking**: Verify `modifiedFields` array is accurate
4. **Test revert functionality**: Verify clearing edits restores original data

### Phase 2 Testing: Frontend Auto-Save
1. **Test auto-save timing**: Verify debounced saves work correctly
2. **Test save status indicators**: Verify loading/error states display
3. **Test modification tracking**: Verify modified fields are highlighted
4. **Test revert button**: Verify it appears/disappears correctly

### Phase 3 Testing: Episode Generation
1. **Test form validation**: Verify required fields and limits
2. **Test navigation**: Verify routing to episode results
3. **Test data flow**: Verify outline data is passed correctly
4. **Test streaming**: Verify episode generation streams properly

## Deployment Checklist

- [x] Backend artifact types added (edit artifact types)
- [x] Backend routes updated (original data, clear edits endpoints)
- [x] Frontend components updated (auto-save fields, modification tracking)
- [x] API service methods added (original data, clear edits, episode generation)
- [x] Episode generation system implemented (form component)
- [ ] All tests passing (needs testing with real data)
- [x] Documentation updated

## Implementation Status

### ✅ Completed (Phase 1 & 2)

1. **Backend User Edit System Fixed**:
   - ✅ Fixed user edit storage to create specific artifact types (`title_edit`, `genre_edit`, etc.)
   - ✅ Added new API endpoints for getting original data and clearing edits
   - ✅ Updated OutlineService with `clearUserEdits` method
   - ✅ Enhanced UnifiedStreamingService with `getOriginalOutlineData` method

2. **Frontend Auto-Save System**:
   - ✅ Created `AutoSaveTextAreaField` and `AutoSaveTextField` components with:
     - Debounced auto-save (1000ms default)
     - Loading states and error handling
     - Visual indicators for unsaved changes
   - ✅ Updated field registry to use auto-save components
   - ✅ Enhanced DynamicOutlineResults with:
     - Modification tracking
     - Revert to original functionality
     - Episode generation button

3. **Episode Generation System**:
   - ✅ Created EpisodeGenerationForm component
   - ✅ Added episode generation API methods
   - ✅ Integrated with navigation system

### 🔄 Next Steps (Phase 3 & 4)

1. **Backend Episode Service**: Need to implement the actual episode generation logic
2. **Episode Routes**: Need to add episode routes to the main server
3. **Testing**: Need to test with real outline data
4. **Route Configuration**: Need to add episode generation route to the app

## Key Features Implemented

### 🎯 Auto-Save Functionality
- **Debounced saving**: Prevents excessive API calls
- **Visual feedback**: Shows saving/unsaved/error states
- **Error handling**: Graceful degradation if save fails
- **Type safety**: Proper TypeScript interfaces

### 🔄 Modification Tracking
- **Field-level tracking**: Knows exactly which fields were modified
- **Visual indicators**: Alert showing number of modified fields
- **Revert capability**: Can restore to original LLM-generated content

### 📝 Episode Generation
- **Form validation**: Proper input validation and limits
- **Navigation integration**: Seamless routing to episode generation
- **Outline selection**: Can use modified or original outline data

### 🏗️ Architecture Compliance
- **Artifact-transform paradigm**: All changes create proper transforms
- **Data integrity**: Original LLM data always preserved
- **User scoping**: All operations properly scoped to authenticated user
- **Type safety**: Comprehensive TypeScript coverage

## Notes

- **Debounce timing**: 1000ms default, configurable per field
- **Save indicators**: Show saving/unsaved/error states clearly
- [ ] Error handling**: Graceful degradation if auto-save fails
- **Performance**: Individual field saves prevent conflicts
- **Data integrity**: Original LLM data always preserved
- **User experience**: Clear visual feedback for all states 