# Outline Streaming Refactor Implementation Plan

## Overview
Refactor the outline feature to match the brainstorming streaming architecture, maintaining the artifacts => transform => artifacts pattern while maximizing code reuse.

## URL Structure
- Keep `/new-outline` for the input form
- Navigate to `/outlines/{id}` after clicking generate (plural, matches brainstorming pattern)
- Support direct access to `/outlines/{id}` for viewing completed/in-progress outlines
- Add `/outlines` for listing all user's outline sessions

## Architecture Goals
1. **Generic Pattern**: artifacts => transform => artifacts
2. **Streaming First**: Real-time updates during generation
3. **Full Traceability**: Every edit creates new artifacts with human transforms
4. **Reusable Components**: Share UI patterns with brainstorming
5. **Backward Compatibility**: Support existing outline data

## Component Structure

### 1. Split OutlineTab Component
Similar to how BrainstormingPanel was split into three components:

#### **OutlineInputForm.tsx** (similar to BrainstormingInputForm)
- Source artifact selection (from ideation)
- Episode count input
- Episode duration input
- Generate button
- Only shown on `/new-outline`

#### **OutlineParameterSummary.tsx** (similar to BrainstormingParameterSummary)
- Read-only display of outline parameters
- Shows source idea/artifact
- Shows episode configuration
- Shown on `/outlines/{id}` for existing outlines

#### **OutlineResults.tsx** (similar to BrainstormingResults)
- Displays generated outline components (title, genre, characters, etc.)
- Each field is an editable TextBox that creates new artifacts on edit
- Streaming progress indicator
- Error handling
- Regenerate functionality

#### **OutlinesList.tsx** (similar to IdeationsList)
```typescript
interface OutlineSession {
  id: string;
  source_idea: string;
  source_idea_title?: string;
  source_artifact_id: string;
  ideation_run_id?: string;
  title?: string;
  genre?: string;
  total_episodes?: number;
  episode_duration?: number;
  created_at: string;
  status: 'active' | 'completed' | 'failed';
}
```
- List view of all outline sessions
- Shows source idea snippet
- Links to both source ideation and outline details
- Delete functionality
- Sort by creation date

### 2. Shared Components Library

#### **StreamingProgress.tsx**
```typescript
interface StreamingProgressProps {
  isStreaming: boolean;
  isConnecting: boolean;
  onStop: () => void;
  itemCount?: number;
  itemLabel?: string; // "ideas" or "components"
}
```

#### **EditableTextField.tsx**
```typescript
interface EditableTextFieldProps {
  value: string;
  artifactId: string;
  artifactType: string;
  onChange: (newValue: string, newArtifactId: string) => void;
  placeholder?: string;
  multiline?: boolean;
  label?: string;
}
// Creates new artifact + human transform on edit
```

#### **ArtifactLineage.tsx**
```typescript
interface ArtifactLineageProps {
  artifactId: string;
  userId: string;
}
// Shows artifact => transform => artifact chain
```

### 3. Lineage Visualization Components

#### **LineageGraph.tsx**
```typescript
interface LineageNode {
  id: string;
  type: 'artifact' | 'transform';
  artifactType?: string;
  transformType?: string;
  label: string;
  timestamp: string;
}

interface LineageEdge {
  from: string;
  to: string;
  role?: string; // 'input' | 'output'
}
```
- Visual graph showing artifact flow
- Collapsible nodes for complex chains
- Click to view artifact/transform details

#### **LineageBreadcrumb.tsx**
```typescript
// Simple text-based lineage display
// Example: "故事灵感 > 大纲设计 > 标题编辑"
interface BreadcrumbItem {
  label: string;
  artifactId: string;
  onClick?: () => void;
}
```

## Data Model

### Artifact Types
1. **outline_job_params** (already exists)
   - sourceArtifactId
   - totalEpisodes
   - episodeDuration
   - requestedAt

2. **outline_session** (already exists)
   - id
   - ideation_session_id
   - status
   - created_at

3. **outline_[component]** (already exists)
   - outline_title
   - outline_genre  
   - outline_selling_points
   - outline_setting
   - outline_synopsis
   - outline_characters

4. **user_input** (reuse existing)
   - For edited outline fields

### Transform Flow
```
[brainstorm_idea/user_input] + [outline_job_params] 
  => LLM Transform (streaming)
  => [outline_title, outline_genre, outline_characters, etc.]
  
[outline_title] 
  => Human Transform (edit)
  => [user_input with modified title]
```

## Implementation Steps

### Phase 1: Backend Updates (Day 1)

#### 1.1 Update Routes
```typescript
// New routes for outline management
router.get('/outlines', authMiddleware.authenticate, async (req, res) => {
  // List user's outline sessions
});

router.get('/outlines/:id', authMiddleware.authenticate, async (req, res) => {
  // Get specific outline session with all components
});

router.delete('/outlines/:id', authMiddleware.authenticate, async (req, res) => {
  // Delete outline session
});

router.get('/outlines/:id/lineage', authMiddleware.authenticate, async (req, res) => {
  // Get lineage data for visualization
});
```

#### 1.2 Create OutlineService
Similar to IdeationService but for outlines:
```typescript
class OutlineService {
  async getOutlineSession(userId: string, sessionId: string): Promise<OutlineSessionData>
  async listOutlineSessions(userId: string): Promise<OutlineSessionSummary[]>
  async deleteOutlineSession(userId: string, sessionId: string): Promise<boolean>
  async getOutlineLineage(userId: string, sessionId: string): Promise<LineageData>
  
  // Helper to find all related artifacts for an outline
  private async getOutlineArtifacts(userId: string, sessionId: string): Promise<Artifact[]>
}
```

#### 1.3 Update Transform Executor
- Ensure outline streaming works with new UI pattern
- Support partial updates for each outline component

### Phase 2: Frontend Refactor (Day 2)

#### 2.1 Create Shared Components
- Extract common UI patterns from BrainstormingResults
- Create reusable streaming components
- Build EditableTextField with artifact creation

#### 2.2 Split OutlineTab
- Create three new components as outlined above
- Update routing to support `/outlines/{id}`
- Maintain `/new-outline` for input form

#### 2.3 Implement Streaming Hook
```typescript
// Reuse existing streaming infrastructure
export function useStreamingOutline(transformId?: string) {
  // Similar to useStreamingBrainstorm
  return useOutlineStreaming(transformId);
}
```

#### 2.4 Create OutlinesList Component
- Copy patterns from IdeationsList
- Add source idea information
- Link to both ideation and outline

### Phase 3: Integration & Polish (Day 3)

#### 3.1 Artifact Editing
```typescript
// Example implementation for EditableTextField
const handleFieldEdit = async (fieldType: string, newValue: string) => {
  // 1. Create new user_input artifact
  const artifact = await createArtifact('user_input', {
    text: newValue,
    source: `edited_${fieldType}`,
    source_artifact_id: originalArtifactId
  });
  
  // 2. Create human transform
  await createHumanTransform(
    [originalArtifact],
    'edit_field',
    [artifact],
    { field: fieldType, interface: 'outline_editor' }
  );
  
  // 3. Update UI state
  updateField(fieldType, newValue, artifact.id);
};
```

#### 3.2 Navigation Flow
- `/new-outline` => click generate => `/outlines/{id}?transform={transformId}`
- Handle completed vs in-progress states
- Support regeneration

#### 3.3 List View
- Create `/outlines` list page
- Show outline sessions with source ideas
- Support deletion and navigation

### Phase 4: Lineage Visualization (Day 4)

#### 4.1 Basic Lineage Display
```typescript
// Lineage data structure
interface LineageData {
  nodes: Array<{
    id: string;
    type: 'artifact' | 'transform';
    data: Artifact | Transform;
    level: number; // For layout
  }>;
  edges: Array<{
    from: string;
    to: string;
    role?: string;
  }>;
}

// Simple text display
"灵感 '外卖奇缘' → 大纲生成 → 标题 '重启老店的爱情故事'"

// With edit history
"标题 '重启老店的爱情故事' → 编辑 → '父亲的味道'"
```

#### 4.2 Advanced Features
- Replay capability for outline generation
- Compare different versions
- Export lineage data

## Code Reuse Strategy

### Shared Services
```typescript
// Base streaming service can be reused
abstract class TransformStreamingService<T> {
  // Common streaming logic
}

// Specific implementations
class OutlineStreamingService extends TransformStreamingService<OutlineComponent> {
  // Outline-specific parsing
}
```

### Shared Hooks
```typescript
// Generic streaming hook
function useTransformStreaming<T>(
  service: TransformStreamingService<T>,
  transformId?: string
) {
  // Reusable streaming logic
}
```

### Shared Components
- ParameterSummary base component
- StreamingResults base component
- EditableField base component

## Migration Strategy

1. **Existing Data**: 
   - Old outline data remains accessible
   - New system can load and display old outlines
   - Edits create new artifacts maintaining history

2. **API Compatibility**:
   - Keep existing endpoints working
   - Add new endpoints alongside
   - Gradual migration path

3. **UI Transition**:
   - New UI for new outlines
   - Legacy view for old outlines (if needed)
   - Consistent experience across features

## Success Criteria

1. **User Experience**:
   - Seamless streaming experience like brainstorming
   - All fields editable with full traceability
   - Clear lineage visualization

2. **Code Quality**:
   - Maximum code reuse with brainstorming
   - Generic patterns for future features
   - Clean separation of concerns

3. **Data Integrity**:
   - Complete artifact chain preservation
   - Human transforms for all edits
   - Backward compatibility maintained

## Future Extensibility

This pattern enables easy addition of new features:
- Script generation (outline => script)
- Character development (character => detailed profile)
- Scene breakdown (outline => scene list)

Each follows the same pattern:
1. Input artifacts + parameters
2. Transform (LLM or human)
3. Output artifacts
4. Editable results creating new artifacts

## Technical Risks & Mitigations

1. **Risk**: Complex state management with multiple editable fields
   - **Mitigation**: Use controlled components with clear data flow

2. **Risk**: Performance with many artifacts
   - **Mitigation**: Pagination and lazy loading

3. **Risk**: UI complexity with lineage display
   - **Mitigation**: Start simple, enhance progressively

## Timeline Estimate

- **Day 1**: Backend services and API updates
- **Day 2**: Frontend component refactoring
- **Day 3**: Integration and editing features
- **Day 4**: Lineage visualization and polish
- **Total**: 4 days for full implementation

## Next Steps

1. Review and approve plan
2. Start with shared component extraction
3. Implement backend services
4. Refactor frontend progressively
5. Test with existing data
6. Deploy with feature flag if needed 