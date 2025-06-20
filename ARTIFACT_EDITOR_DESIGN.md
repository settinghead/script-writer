# ArtifactEditor Component Design Plan

## Overview
Create a universal artifact editing component that handles brainstorm ideas with Electric SQL real-time sync, LLM→Human transform pattern, and optimistic updates using TanStack Query + Zustand.

## 1. Data Structure Refactoring

### Current State Analysis
From the screenshot, brainstorm ideas have:
- **Title**: Short name (e.g., "逆世商凰", "智穿山河")
- **Body**: Detailed description (long text)

### Target Artifact Structure
```typescript
// Ensure each idea is a separate artifact
interface BrainstormIdeaArtifact {
  id: string;
  type: 'brainstorm_idea';
  type_version: 'v1';
  data: {
    idea_title: string;    // Short title
    idea_text: string;     // Detailed body
    order_index: number;
    confidence_score?: number;
  };
  metadata: {
    source: 'llm' | 'human';
    original_artifact_id?: string; // For human transforms
  };
}
```

## 2. Component Architecture

### Frontend Components

#### `ArtifactEditor`
```typescript
interface ArtifactEditorProps {
  artifactId: string;
  className?: string;
  onTransition?: (newArtifactId: string) => void;
}
```

**Features:**
- Electric SQL `useShape` for real-time artifact data
- TanStack Query for API calls with optimistic updates
- Zustand for local editing state management
- Debounced auto-save (500ms)
- Visual state transitions with animations

#### `EditableField`
```typescript
interface EditableFieldProps {
  value: string;
  fieldType: 'title' | 'body' | 'text';
  isLLMGenerated: boolean;
  isTransitioning: boolean;
  onChange: (value: string) => void;
  className?: string;
}
```

### Artifact Type Mapping
```typescript
const ARTIFACT_FIELD_MAPPING = {
  'brainstorm_idea': [
    { field: 'idea_title', component: 'input', maxLength: 20 },
    { field: 'idea_text', component: 'textarea', rows: 6 }
  ],
  'user_input': [
    { field: 'text', component: 'textarea', rows: 4 }
  ],
  'outline_title': [
    { field: 'title', component: 'input', maxLength: 50 }
  ]
} as const;
```

## 3. State Management Strategy

**Key Principle**: Each tool handles what it's best at:
- **Electric SQL**: Real-time data sync (reads only)
- **TanStack Query**: API calls for writes with optimistic updates
- **Zustand**: Local UI state only (not artifacts)

### Electric SQL Integration (Data Reads)
```typescript
// Custom hook for artifact editing
function useArtifactEditor(artifactId: string) {
  // ✅ Electric SQL handles real-time artifact data
  const { data: artifacts } = useShape({
    url: `${ELECTRIC_URL}/v1/shape`,
    params: {
      table: 'artifacts',
      where: `id = '${artifactId}'`
    }
  });
  
  const artifact = artifacts?.[0]; // Single artifact
  
  // ✅ TanStack Query handles write operations only
  const editMutation = useMutation({
    mutationFn: (editData) => fetch(`/api/artifacts/${artifactId}/edit`, {
      method: 'POST',
      body: JSON.stringify(editData)
    }).then(res => res.json()),
    
    // No optimistic updates needed - Electric SQL will sync the changes!
    onSuccess: (response) => {
      if (response.wasTransformed) {
        // Artifact ID changed due to LLM→Human transform
        onArtifactTransition?.(response.artifactId);
      }
    }
  });
  
  return { artifact, editMutation };
}
```

### Local Component State (No Zustand Needed)
```typescript
// ✅ SIMPLIFIED: Use React's built-in useState for local UI state
function ArtifactEditor({ artifactId }: { artifactId: string }) {
  // Electric SQL provides real-time data
  const { data: artifacts } = useShape({
    url: `${ELECTRIC_URL}/v1/shape`,
    params: { table: 'artifacts', where: `id = '${artifactId}'` }
  });
  
  // Local component state - no global store needed
  const [isEditing, setIsEditing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentArtifactId, setCurrentArtifactId] = useState(artifactId);
  
  const artifact = artifacts?.[0];
  
  // TanStack Query for write operations
  const editMutation = useMutation({
    mutationFn: editArtifact,
    onSuccess: (response) => {
      if (response.wasTransformed) {
        // Artifact ID changed, trigger transition animation
        setCurrentArtifactId(response.artifactId);
        setIsTransitioning(true);
        setTimeout(() => setIsTransitioning(false), 600);
      }
    }
  });
}
```

### Why Skip Zustand for ArtifactEditor?

**Current Zustand Usage in Codebase:**
- ✅ **Cross-component state** (project data shared across pages)
- ✅ **Complex hierarchical data** (projects → stages → episodes)
- ✅ **UI persistence** (expanded tree nodes, selections)

**ArtifactEditor is Different:**
- ❌ **Self-contained component** - no cross-component sharing needed
- ❌ **Simple single-artifact scope** - not complex hierarchical data
- ❌ **Temporary local state** - editing states don't need persistence

**Benefits of Local State Approach:**
1. **Simpler architecture** - no global store setup needed
2. **Better encapsulation** - component owns its state
3. **Easier testing** - no store mocking required
4. **Less coupling** - component works independently
5. **Electric SQL handles data** - real-time sync automatically

## 4. Backend Implementation

### New API Endpoint: `/api/artifacts/:id/edit`

```typescript
POST /api/artifacts/:id/edit
{
  field: string;
  value: any;
  projectId: string;
}

Response:
{
  artifactId: string;        // Same ID if user_input, new ID if LLM→Human
  wasTransformed: boolean;   // True if LLM→Human transform occurred
  transformId?: string;      // If transform was created
}
```

### Transform Logic
```typescript
async function editArtifact(artifactId: string, field: string, value: any, projectId: string) {
  const artifact = await artifactRepo.getArtifact(artifactId, projectId);
  
  if (artifact.metadata?.source === 'llm') {
    // Create human transform + new artifact
    const transformId = await transformRepo.createTransform(
      projectId, 'human', 'v1', 'completed'
    );
    
    const newArtifact = await artifactRepo.createArtifact(
      projectId,
      artifact.type,
      { ...artifact.data, [field]: value },
      artifact.type_version,
      { source: 'human', original_artifact_id: artifactId }
    );
    
    // Link transform
    await transformRepo.addTransformInputs(transformId, [{ artifactId }]);
    await transformRepo.addTransformOutputs(transformId, [{ artifactId: newArtifact.id }]);
    
    return { artifactId: newArtifact.id, wasTransformed: true, transformId };
  } else {
    // Direct update for user artifacts
    await artifactRepo.updateArtifact(artifactId, { [field]: value });
    return { artifactId, wasTransformed: false };
  }
}
```

## 5. Visual Design & Animation

### Color Scheme
- **LLM Generated**: `border-blue-300` (default state)
- **User Modified**: `border-green-400` (after transform)
- **Editing**: `border-blue-500` (focus state)
- **Error**: `border-red-400` (error state)

### Animations
```css
.artifact-editor {
  @apply transition-all duration-300 ease-in-out;
}

.artifact-editor.transitioning {
  @apply border-green-400 shadow-lg;
  animation: glow 0.6s ease-in-out;
}

@keyframes glow {
  0% { box-shadow: 0 0 5px rgba(34, 197, 94, 0.5); }
  50% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.8); }
  100% { box-shadow: 0 0 5px rgba(34, 197, 94, 0.5); }
}
```

## 6. Implementation Steps

### Phase 1: Core Component
1. ✅ Create `ArtifactEditor` component with Electric SQL integration
2. ✅ Implement `EditableField` with proper input types
3. ✅ Add debounced auto-save functionality
4. ✅ Create artifact type mapping system

### Phase 2: Backend Integration
1. ✅ Create `/api/artifacts/:id/edit` endpoint
2. ✅ Implement LLM→Human transform logic
3. ✅ Add proper error handling and validation
4. ✅ Test with Electric SQL sync

### Phase 3: State Management
1. ✅ Integrate TanStack Query for optimistic updates
2. ✅ Add Zustand store for editor state
3. ✅ Implement proper caching strategies
4. ✅ Handle concurrent edit conflicts

### Phase 4: Visual Polish
1. ✅ Add color transitions and animations
2. ✅ Implement loading and error states
3. ✅ Add subtle visual feedback
4. ✅ Test responsive design

### Phase 5: Integration
1. ✅ Replace existing idea display in `ProjectBrainstormPage`
2. ✅ Ensure Electric SQL real-time updates work
3. ✅ Handle edge cases and error scenarios
4. ✅ Performance optimization

## 7. Error Handling Strategy

### Frontend Error States
- **Network errors**: Show retry button with offline indicator
- **Validation errors**: Inline field-level error messages
- **Conflict resolution**: Show conflict dialog with merge options
- **Transform failures**: Graceful fallback to read-only mode

### Backend Error Responses
```typescript
{
  error: 'TRANSFORM_FAILED' | 'VALIDATION_ERROR' | 'PERMISSION_DENIED';
  message: string;
  details?: any;
}
```

## 8. Performance Considerations

### Optimization Strategies
- **Debounced saves**: 500ms delay to reduce API calls
- **TanStack Query caching**: 5-minute stale time for artifacts
- **Electric SQL subscriptions**: Minimize re-renders with proper memoization
- **Virtualization**: For large lists of editable artifacts (future)

### Monitoring Points
- API call frequency and success rates
- Electric SQL sync latency
- Component re-render counts
- Memory usage with large artifact sets

## 9. Testing Strategy

### Unit Tests
- Component rendering with different artifact types
- Transform logic correctness
- Debounced save behavior
- Error handling scenarios

### Integration Tests
- Electric SQL real-time sync
- TanStack Query optimistic updates
- Multi-user concurrent editing
- Backend API endpoint functionality

---

This design provides a robust, scalable foundation for artifact editing with real-time collaboration and smooth user experience. 
This design provides a robust, scalable foundation for artifact editing with real-time collaboration and smooth user experience. 