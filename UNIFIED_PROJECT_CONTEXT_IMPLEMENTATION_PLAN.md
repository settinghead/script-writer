# Unified Project Context Implementation Plan

## Overview

This plan outlines the implementation of a unified, project-level context system that consolidates all Electric SQL subscriptions and mutations for the script-writer application. The system will integrate with TanStack Query for optimistic updates and maintain a centralized project data store.

## Current State Analysis

### Existing Electric SQL Usage
- `useElectricBrainstorm` - subscribes to artifacts and transforms for brainstorming
- `ArtifactEditor` - individual useShape subscriptions for specific artifacts
- `ProjectLayout` - basic project data fetching via TanStack Query
- Multiple components creating their own Electric subscriptions

### Database Schema Analysis
Current tables with project_id:
- ✅ `artifacts` - has project_id
- ✅ `transforms` - has project_id  
- ❌ `transform_inputs` - needs project_id (references transform via transform_id)
- ❌ `transform_outputs` - needs project_id (references transform via transform_id)
- ❌ `llm_prompts` - needs project_id (references transform via transform_id)
- ❌ `llm_transforms` - needs project_id (references transform via transform_id)
- ❌ `human_transforms` - needs project_id (references transform via transform_id)

## Implementation Plan

### Phase 1: Database Schema Updates

#### 1.1 Add project_id to All Transform-Related Tables
Create migration `20241201_003_add_project_id_to_transform_tables.ts`:

```sql
-- Add project_id columns
ALTER TABLE transform_inputs ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE transform_outputs ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE llm_prompts ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE llm_transforms ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE human_transforms ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE CASCADE;

-- Populate project_id from related transforms
UPDATE transform_inputs SET project_id = (
  SELECT t.project_id FROM transforms t WHERE t.id = transform_inputs.transform_id
);
UPDATE transform_outputs SET project_id = (
  SELECT t.project_id FROM transforms t WHERE t.id = transform_outputs.transform_id
);
UPDATE llm_prompts SET project_id = (
  SELECT t.project_id FROM transforms t WHERE t.id = llm_prompts.transform_id
);
UPDATE llm_transforms SET project_id = (
  SELECT t.project_id FROM transforms t WHERE t.id = llm_transforms.transform_id
);
UPDATE human_transforms SET project_id = (
  SELECT t.project_id FROM transforms t WHERE t.id = human_transforms.transform_id
);

-- Make project_id NOT NULL after population
ALTER TABLE transform_inputs ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE transform_outputs ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE llm_prompts ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE llm_transforms ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE human_transforms ALTER COLUMN project_id SET NOT NULL;

-- Add indexes for performance
CREATE INDEX idx_transform_inputs_project ON transform_inputs(project_id);
CREATE INDEX idx_transform_outputs_project ON transform_outputs(project_id);
CREATE INDEX idx_llm_prompts_project ON llm_prompts(project_id);
CREATE INDEX idx_llm_transforms_project ON llm_transforms(project_id);
CREATE INDEX idx_human_transforms_project ON human_transforms(project_id);
```

#### 1.2 Update Database Types
Regenerate Kysely types with `npm run db:generate-types`

### Phase 2: Unified Project Context

#### 2.1 Create ProjectDataContext
`src/client/contexts/ProjectDataContext.tsx`:

```typescript
interface ProjectDataContextType {
  // Data subscriptions
  artifacts: ElectricArtifact[]
  transforms: ElectricTransform[]
  humanTransforms: ElectricHumanTransform[]
  transformInputs: ElectricTransformInput[]
  transformOutputs: ElectricTransformOutput[]
  llmPrompts: ElectricLLMPrompt[]
  llmTransforms: ElectricLLMTransform[]
  
  // Loading states
  isLoading: boolean
  isError: boolean
  error: Error | null
  
  // Selectors (memoized)
  getBrainstormArtifacts: () => ElectricArtifact[]
  getOutlineArtifacts: () => ElectricArtifact[]
  getArtifactById: (id: string) => ElectricArtifact | undefined
  getTransformById: (id: string) => ElectricTransform | undefined
  getHumanTransformsForArtifact: (artifactId: string, path?: string) => ElectricHumanTransform[]
  
  // Mutations (TanStack Query + optimistic updates)
  createTransform: UseMutationResult<any, Error, CreateTransformRequest>
  updateArtifact: UseMutationResult<any, Error, UpdateArtifactRequest>
  createHumanTransform: UseMutationResult<any, Error, HumanTransformRequest>
  
  // Local state management
  localUpdates: Map<string, any> // Optimistic updates not yet synced
  addLocalUpdate: (key: string, update: any) => void
  removeLocalUpdate: (key: string) => void
}
```

#### 2.2 Electric SQL Subscriptions
All Electric subscriptions in one place:

```typescript
// Subscribe to all project data with single where clause
const projectWhereClause = `project_id = '${projectId}'`

const { data: artifacts } = useShape<ElectricArtifact>({
  ...electricConfig,
  params: { table: 'artifacts', where: projectWhereClause }
})

const { data: transforms } = useShape<ElectricTransform>({
  ...electricConfig, 
  params: { table: 'transforms', where: projectWhereClause }
})

const { data: humanTransforms } = useShape<ElectricHumanTransform>({
  ...electricConfig,
  params: { table: 'human_transforms', where: projectWhereClause }
})

// Continue for all tables...
```

#### 2.3 TanStack Query Integration
Following [Electric + TanStack pattern](https://electric-sql.com/docs/integrations/tanstack):

```typescript
// Mutation with optimistic updates
const createTransformMutation = useMutation({
  scope: { id: `project-${projectId}` },
  mutationKey: ['create-transform'],
  mutationFn: async (request: CreateTransformRequest) => {
    // 1. Make API call
    const response = await apiService.createTransform(request)
    
    // 2. Wait for Electric sync confirmation
    await waitForElectricSync(response.transform.id)
    
    return response
  },
  onMutate: (request) => {
    // Apply optimistic update
    const optimisticTransform = createOptimisticTransform(request)
    addLocalUpdate(`transform-${optimisticTransform.id}`, optimisticTransform)
    return optimisticTransform
  },
  onSuccess: (data, variables, optimisticData) => {
    // Remove optimistic update when confirmed
    removeLocalUpdate(`transform-${optimisticData.id}`)
  },
  onError: (error, variables, optimisticData) => {
    // Revert optimistic update on error
    if (optimisticData) {
      removeLocalUpdate(`transform-${optimisticData.id}`)
    }
  }
})
```

#### 2.4 Memoized Selectors
Efficient data selection with React useMemo:

```typescript
const selectors = useMemo(() => ({
  getBrainstormArtifacts: () => 
    artifacts?.filter(a => a.type === 'brainstorm_idea_collection') || [],
    
  getArtifactById: (id: string) => {
    // Check local updates first, then Electric data
    const localUpdate = localUpdates.get(`artifact-${id}`)
    if (localUpdate) return { ...artifacts?.find(a => a.id === id), ...localUpdate }
    return artifacts?.find(a => a.id === id)
  },
  
  getHumanTransformsForArtifact: (artifactId: string, path?: string) =>
    humanTransforms?.filter(ht => 
      ht.source_artifact_id === artifactId && 
      (!path || ht.derivation_path === path)
    ) || []
}), [artifacts, transforms, humanTransforms, localUpdates])
```

### Phase 3: Context Provider Integration

#### 3.1 Update ProjectLayout
Wrap ProjectLayout with the new context:

```typescript
const ProjectLayout: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>()
  
  return (
    <ProjectDataProvider projectId={projectId!}>
      <Layout>
        <Sider>...</Sider>
        <Content>
          <Outlet />
        </Content>
      </Layout>
    </ProjectDataProvider>
  )
}
```

#### 3.2 Update Components to Use Context

**ArtifactEditor Changes:**
```typescript
// Remove individual useShape subscriptions
// const { data: artifacts } = useShape({ ... }) // REMOVE

// Use context instead
const { getArtifactById, createHumanTransform } = useProjectData()
const artifact = getArtifactById(artifactId)

// Use context mutation instead of individual useMutation
const handleFieldChange = (field: string, value: any) => {
  createHumanTransform.mutate({
    transformName: 'edit_brainstorm_idea',
    sourceArtifactId: artifactId,
    derivationPath: path,
    fieldUpdates: { [field]: value }
  })
}
```

**DynamicBrainstormingResults Changes:**
```typescript

// Use context instead
const { getBrainstormArtifacts, transforms } = useProjectData()
const brainstormArtifacts = getBrainstormArtifacts()
const ideas = extractIdeasFromArtifacts(brainstormArtifacts)
const isStreaming = brainstormArtifacts.some(a => a.streaming_status === 'streaming')
```

### Phase 4: Performance Optimizations

#### 4.1 Subscription Management
- Conditional subscriptions based on data availability
- Aggressive error handling with exponential backoff
- Subscription cleanup on unmount

#### 4.2 Memory Management
- Implement data pruning for old artifacts/transforms
- Use React.memo for expensive components
- Debounced local updates to prevent excessive re-renders

#### 4.3 Electric SQL Optimizations
- Use proper WHERE clauses for all subscriptions
- Implement shape handle management for 409 conflict resolution
- Add subscription health monitoring

### Phase 5: Migration Strategy

#### 5.1 Gradual Migration
1. **Phase 5.1**: Deploy database schema changes
2. **Phase 5.2**: Deploy context provider (alongside existing hooks)
3. **Phase 5.3**: Migrate ArtifactEditor to use context
4. **Phase 5.4**: Migrate DynamicBrainstormingResults
5. **Phase 5.5**: Remove old hooks and subscriptions

#### 5.2 Backward Compatibility
- Keep existing hooks functional during migration
- Feature flags for context vs. individual subscriptions
- Gradual component migration without breaking changes

### Phase 6: Testing & Monitoring

#### 6.1 Test Coverage
- Unit tests for context provider
- Integration tests for Electric + TanStack patterns
- End-to-end tests for optimistic updates
- Race condition testing for concurrent edits

#### 6.2 Monitoring
- Electric SQL subscription health
- TanStack Query cache hit rates
- Optimistic update success/failure rates
- Memory usage monitoring

## Implementation Timeline

### Week 1: Database & Schema
- [ ] Create migration for project_id columns
- [ ] Update database types
- [ ] Test migration with existing data

### Week 2: Core Context
- [ ] Implement ProjectDataContext
- [ ] Electric SQL subscriptions
- [ ] Basic selectors and mutations

### Week 3: TanStack Integration
- [ ] Implement optimistic updates
- [ ] Electric sync confirmation
- [ ] Error handling and rollback

### Week 4: Component Migration
- [ ] Update ArtifactEditor
- [ ] Update DynamicBrainstormingResults
- [ ] Update other Electric consumers

### Week 5: Testing & Polish
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Documentation updates

## Success Metrics

1. **Performance**: Reduced Electric subscriptions from N components to 1 context
2. **Consistency**: Single source of truth for all project data
3. **UX**: Seamless optimistic updates with proper error handling
4. **Maintainability**: Centralized data management logic
5. **Memory**: Efficient subscription management and cleanup

## Risk Mitigation

1. **Data Inconsistency**: Comprehensive testing of optimistic updates
2. **Performance Regression**: Careful monitoring and profiling
3. **Migration Issues**: Gradual rollout with feature flags
4. **Electric SQL Limitations**: Proper error handling and fallbacks
5. **Race Conditions**: Database-level constraints and retry logic

## Future Enhancements

1. **Offline Support**: Cache Electric data in IndexedDB
2. **Real-time Collaboration**: WebSocket integration for live cursors
3. **Advanced Filtering**: Client-side filtering and pagination
4. **Data Prefetching**: Intelligent prefetching for related data
5. **Analytics**: Usage tracking and performance metrics 