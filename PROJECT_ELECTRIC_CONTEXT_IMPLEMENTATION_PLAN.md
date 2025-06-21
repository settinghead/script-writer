# Unified Project Electric Context Implementation Plan

## Overview

Create a unified, project-level React context that manages ALL Electric SQL subscriptions and mutations for artifacts, transforms, and human transforms within a project. This will replace the current scattered `useShape` calls throughout components and centralize all data management and mutations.

## Current Architecture Analysis

### Current Electric SQL Usage Patterns
1. **ArtifactEditor**: Individual `useShape` for specific artifacts with complex WHERE clauses
2. **useElectricBrainstorm**: Dedicated hook with conditional subscriptions for artifacts and transforms
3. **Individual components**: Each component manages its own Electric subscriptions

### Current Mutation Patterns
1. **ArtifactEditor**: Direct fetch calls to `/api/artifacts/:id/schema-transform` and artifact updates
2. **SchemaTransformExecutor**: Server-side transform creation and execution
3. **TanStack Query**: Used for non-real-time data fetching (human transforms)

### Database Schema Structure
```sql
-- Core tables to subscribe to:
artifacts (id, project_id, type, type_version, data, metadata, streaming_status, streaming_progress, partial_data, created_at, updated_at)
transforms (id, project_id, type, type_version, status, streaming_status, progress_percentage, error_message, execution_context, created_at, updated_at)  
human_transforms (id, user_id, input_artifact_id, output_artifact_id, transform_name, path, created_at)
transform_inputs (transform_id, artifact_id, input_role)
transform_outputs (transform_id, artifact_id, output_role)
```

## Implementation Plan

### Phase 1: Core Context Infrastructure

#### 1.1 Create ProjectElectricContext
**File**: `src/client/contexts/ProjectElectricContext.tsx`

```typescript
interface ProjectElectricContextValue {
  // Data
  artifacts: ElectricArtifact[]
  transforms: ElectricTransform[]
  humanTransforms: HumanTransform[]
  transformInputs: TransformInput[]
  transformOutputs: TransformOutput[]
  
  // Loading states
  isLoading: boolean
  artifactsLoading: boolean
  transformsLoading: boolean
  humanTransformsLoading: boolean
  
  // Error states
  error: Error | null
  artifactsError: Error | null
  transformsError: Error | null
  humanTransformsError: Error | null
  
  // Selectors (memoized)
  getArtifactById: (id: string) => ElectricArtifact | undefined
  getArtifactsByType: (type: string) => ElectricArtifact[]
  getTransformsByArtifact: (artifactId: string) => ElectricTransform[]
  getHumanTransformsByPath: (artifactId: string, path: string) => HumanTransform | undefined
  getDerivedArtifactId: (sourceId: string, path: string) => string | undefined
  
  // Mutations
  createSchemaTransform: (params: CreateSchemaTransformParams) => Promise<CreateSchemaTransformResult>
  updateArtifact: (artifactId: string, data: any, metadata?: any) => Promise<void>
  
  // Streaming helpers
  getBrainstormIdeas: (sessionId?: string) => IdeaWithTitle[]
  getOutlineData: (sessionId?: string) => OutlineData | null
  getStreamingStatus: (artifactId: string) => StreamingStatus
}
```

#### 1.2 Electric SQL Subscriptions Strategy
- **Single subscription per table** with project-scoped WHERE clauses
- **Aggressive error handling** with automatic retries and backoff
- **Conditional subscriptions** to reduce load (transforms only if artifacts exist)
- **Optimized WHERE clauses** using indexed columns

```typescript
// Core subscriptions
const whereClausesStable = useMemo(() => ({
  artifacts: `project_id = '${projectId}'`,
  transforms: `project_id = '${projectId}'`, 
  humanTransforms: `input_artifact_id IN (SELECT id FROM artifacts WHERE project_id = '${projectId}')`,
  transformInputs: `transform_id IN (SELECT id FROM transforms WHERE project_id = '${projectId}')`,
  transformOutputs: `transform_id IN (SELECT id FROM transforms WHERE project_id = '${projectId}')`
}), [projectId])
```

#### 1.3 Memoized Selectors
All data selectors will be heavily memoized to prevent unnecessary re-renders:

```typescript
const getArtifactById = useMemo(() => 
  (id: string) => artifacts.find(a => a.id === id), 
  [artifacts]
)

const getArtifactsByType = useMemo(() => 
  (type: string) => artifacts.filter(a => a.type === type),
  [artifacts]
)

const getDerivedArtifactId = useMemo(() => 
  (sourceId: string, path: string) => {
    const humanTransform = humanTransforms.find(ht => 
      ht.input_artifact_id === sourceId && ht.path === path
    )
    return humanTransform?.output_artifact_id
  },
  [humanTransforms]
)
```

### Phase 2: Centralized Mutations

#### 2.1 Schema Transform Mutations
Centralize all transform creation and execution:

```typescript
const createSchemaTransform = useCallback(async ({
  transformName,
  sourceArtifactId, 
  derivationPath,
  fieldUpdates = {}
}: CreateSchemaTransformParams) => {
  const response = await fetch(`/api/artifacts/${sourceArtifactId}/schema-transform`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      transformName,
      derivationPath, 
      fieldUpdates
    })
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `HTTP ${response.status}`)
  }
  
  return response.json()
}, [])
```

#### 2.2 Artifact Update Mutations
Centralize direct artifact updates:

```typescript
const updateArtifact = useCallback(async (
  artifactId: string, 
  data: any, 
  metadata?: any
) => {
  const artifact = getArtifactById(artifactId)
  if (!artifact) throw new Error('Artifact not found')
  
  let requestBody
  if (artifact.type === 'user_input') {
    requestBody = { text: JSON.stringify(data) }
  } else if (artifact.type === 'brainstorm_idea') {
    requestBody = { data }
  } else {
    throw new Error(`Unsupported artifact type: ${artifact.type}`)
  }
  
  const response = await fetch(`/api/artifacts/${artifactId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(requestBody)
  })
  
  if (!response.ok) throw new Error(`Update failed: ${response.statusText}`)
}, [getArtifactById])
```

### Phase 3: Domain-Specific Helpers

#### 3.1 Brainstorming Helpers
```typescript
const getBrainstormIdeas = useMemo(() => (sessionId?: string) => {
  const brainstormArtifacts = getArtifactsByType('brainstorm_idea_collection')
  
  let targetArtifact
  if (sessionId) {
    targetArtifact = brainstormArtifacts.find(a => {
      const data = JSON.parse(a.data)
      return data.id === sessionId || data.ideation_session_id === sessionId
    })
  } else {
    targetArtifact = brainstormArtifacts.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )[0]
  }
  
  if (!targetArtifact) return []
  
  const data = targetArtifact.streaming_status === 'streaming' 
    ? targetArtifact.partial_data 
    : JSON.parse(targetArtifact.data)
    
  return (data?.ideas || []).map((idea: any, index: number) => ({
    ...idea,
    artifactId: targetArtifact.id,
    index
  }))
}, [getArtifactsByType])
```

#### 3.2 Streaming Status Helpers
```typescript
const getStreamingStatus = useMemo(() => (artifactId: string) => {
  const artifact = getArtifactById(artifactId)
  if (!artifact) return { status: 'idle', progress: 0 }
  
  const relatedTransforms = getTransformsByArtifact(artifactId)
  const latestTransform = relatedTransforms.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0]
  
  // Combine artifact and transform status
  let status = artifact.streaming_status || 'completed'
  let progress = artifact.streaming_progress || 100
  
  if (latestTransform?.streaming_status === 'running') {
    status = 'streaming'
    progress = Math.max(progress, latestTransform.progress_percentage || 0)
  }
  
  return { status, progress, error: latestTransform?.error_message }
}, [getArtifactById, getTransformsByArtifact])
```

### Phase 4: Integration with ProjectLayout

#### 4.1 Provider Integration
**File**: `src/client/components/ProjectLayout.tsx`

```typescript
import { ProjectElectricProvider } from '../contexts/ProjectElectricContext'

const ProjectLayout: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>()
  
  if (!projectId) {
    return <Navigate to="/" replace />
  }
  
  return (
    <ProjectElectricProvider projectId={projectId}>
      <Layout style={{ height: '100%', overflow: 'hidden' }}>
        <Sider width={250} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
          {/* Sidebar content */}
        </Sider>
        <Content style={{ padding: '24px', overflowY: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </ProjectElectricProvider>
  )
}
```

#### 4.2 Hook for Components
**File**: `src/client/hooks/useProjectElectric.ts`

```typescript
export function useProjectElectric() {
  const context = useContext(ProjectElectricContext)
  if (!context) {
    throw new Error('useProjectElectric must be used within ProjectElectricProvider')
  }
  return context
}

// Specialized hooks for common use cases
export function useBrainstormData(sessionId?: string) {
  const { getBrainstormIdeas, getStreamingStatus } = useProjectElectric()
  
  const ideas = getBrainstormIdeas(sessionId)
  const artifact = ideas[0]?.artifactId
  const streaming = artifact ? getStreamingStatus(artifact) : { status: 'idle', progress: 0 }
  
  return {
    ideas,
    isStreaming: streaming.status === 'streaming',
    progress: streaming.progress,
    error: streaming.error
  }
}

export function useArtifactEditor(artifactId: string, path: string = '') {
  const { 
    getArtifactById, 
    getDerivedArtifactId, 
    createSchemaTransform, 
    updateArtifact 
  } = useProjectElectric()
  
  const derivedId = getDerivedArtifactId(artifactId, path)
  const targetArtifact = derivedId ? getArtifactById(derivedId) : getArtifactById(artifactId)
  const hasExistingTransform = !!derivedId
  
  return {
    artifact: targetArtifact,
    hasExistingTransform,
    createTransform: createSchemaTransform,
    updateArtifact
  }
}
```

### Phase 5: Component Refactoring

#### 5.1 ArtifactEditor Refactoring
**Major changes**:
- Remove individual `useShape` subscription
- Remove TanStack Query for human transforms (use context data)
- Use context mutations instead of direct fetch calls
- Maintain local state for typing/editing UI

```typescript
// Before: Individual subscriptions and mutations
const { data: artifacts } = useShape({ /* complex where clause */ })
const createTransformMutation = useMutation({ /* direct fetch */ })

// After: Use unified context
const { artifact, hasExistingTransform, createTransform, updateArtifact } = useArtifactEditor(artifactId, path)
```

#### 5.2 DynamicBrainstormingResults Refactoring
```typescript
// Before: Custom hook with separate subscriptions
const { ideas, isStreaming } = useElectricBrainstorm(projectId)

// After: Use unified context
const { ideas, isStreaming, progress, error } = useBrainstormData(ideationRunId)
```

#### 5.3 Remove Obsolete Hooks
- `useElectricBrainstorm` → Replace with context selectors
- Individual `useShape` calls → Centralized in context
- Scattered mutation logic → Centralized in context

### Phase 6: Performance Optimizations

#### 6.1 Subscription Optimization
- **Conditional subscriptions**: Only subscribe to transforms if artifacts exist
- **Indexed WHERE clauses**: Use database indexes for optimal performance
- **Connection pooling**: Single Electric connection per project
- **Backoff strategies**: Exponential backoff for 409 conflicts

#### 6.2 Re-render Prevention
- **Heavy memoization** of all selectors and derived data
- **React.memo** for components with stable props
- **useCallback** for all event handlers
- **Stable references** for context values

#### 6.3 Memory Management
- **Cleanup on unmount**: Proper subscription cleanup
- **Data pruning**: Remove stale data when project changes
- **Error boundary**: Graceful error handling and recovery

## Implementation Timeline

### Week 1: Core Infrastructure
- [ ] Create ProjectElectricContext with basic subscriptions
- [ ] Implement memoized selectors
- [ ] Add centralized mutations
- [ ] Create useProjectElectric hook

### Week 2: Domain Helpers & Integration
- [ ] Implement brainstorming helpers
- [ ] Add streaming status helpers  
- [ ] Integrate with ProjectLayout
- [ ] Create specialized hooks

### Week 3: Component Refactoring
- [ ] Refactor ArtifactEditor to use context
- [ ] Refactor DynamicBrainstormingResults
- [ ] Remove obsolete hooks
- [ ] Update all other components

### Week 4: Testing & Optimization
- [ ] Performance testing and optimization
- [ ] Error handling and edge cases
- [ ] Memory leak testing
- [ ] Documentation updates

## Benefits

### 1. **Centralized Data Management**
- Single source of truth for all project data
- Consistent data access patterns
- Simplified debugging and monitoring

### 2. **Performance Improvements**
- Reduced Electric SQL connections (5+ → 1 per project)
- Eliminated duplicate subscriptions
- Optimized re-render patterns

### 3. **Developer Experience**
- Simplified component logic
- Consistent API patterns
- Better type safety with centralized types

### 4. **Scalability**
- Easy to add new data types
- Centralized optimization points
- Prepared for complex workflows

### 5. **Maintainability**
- Single place to update Electric logic
- Consistent error handling
- Easier to test and debug

## Risks & Mitigation

### 1. **Memory Usage**
- **Risk**: Loading all project data at once
- **Mitigation**: Implement data pruning and pagination when needed

### 2. **Complex State Management**
- **Risk**: Context becoming too complex
- **Mitigation**: Use multiple smaller contexts if needed, heavy memoization

### 3. **Migration Complexity**
- **Risk**: Breaking existing functionality during refactor
- **Mitigation**: Incremental migration, maintain backward compatibility temporarily

### 4. **Performance Regression**
- **Risk**: Context re-renders affecting performance
- **Mitigation**: Extensive memoization, performance monitoring

## Success Metrics

1. **Subscription Reduction**: 5+ useShape calls → 1 context per project
2. **Performance**: No increase in re-render frequency
3. **Code Reduction**: 30%+ reduction in Electric SQL boilerplate
4. **Maintainability**: Single file for all Electric logic per project
5. **Developer Experience**: Consistent API patterns across all components 