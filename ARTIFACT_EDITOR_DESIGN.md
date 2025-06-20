# ArtifactEditor Component Design Plan

## Overview
Create a universal artifact editing component that handles path-based artifact derivation with atomic human transforms, Electric SQL real-time sync, and optimistic updates using TanStack Query.

## 1. Path-Based Artifact Derivation

### Core Concept
- **No separate services needed** - `ArtifactEditor` handles derivation internally
- **Atomic human transforms** - first edit creates transform + derived artifact in one operation
- **JSON path-based derivation** - use paths like `ideas[0].title` or `ideas[1].body` to specify artifact parts
- **Automatic lookup** - editor checks for existing human transforms before deciding what to load

### Path Examples
```typescript
// Collection artifacts (fan-out)
"ideas[0].title"     // First idea's title
"ideas[1].body"      // Second idea's body
"characters[2].name" // Third character's name

// Single artifacts (1-to-1, root path)
""                   // Root path (default)
"title"              // Direct field access
"synopsis"           // Direct field access
```

### Transform Lookup Strategy
```typescript
// Composite key for finding existing human transforms
interface TransformLookupKey {
  source_artifact_id: string;
  derivation_path: string; // JSON path, empty string for root
}

// Database query example
const existingTransform = await db.query(`
  SELECT ht.*, t.* FROM human_transforms ht
  JOIN transforms t ON ht.transform_id = t.id
  WHERE ht.source_artifact_id = ? AND ht.derivation_path = ?
`, [artifactId, path || ""]);
```

## 2. Component Architecture

### ArtifactEditor Interface
```typescript
interface ArtifactEditorProps {
  artifactId: string;
  path?: string;           // JSON path for derivation (optional, defaults to root)
  className?: string;
  onTransition?: (newArtifactId: string) => void;
}

// Usage examples:
<ArtifactEditor artifactId="abc123" />                    // Edit root artifact
<ArtifactEditor artifactId="abc123" path="ideas[0]" />    // Edit first idea
<ArtifactEditor artifactId="abc123" path="ideas[1].title" /> // Edit second idea's title
```

### Internal Logic Flow
```typescript
function ArtifactEditor({ artifactId, path = "" }: ArtifactEditorProps) {
  // 1. Look up existing human transform for (artifactId, path)
  const existingTransform = useQuery({
    queryKey: ['human-transform', artifactId, path],
    queryFn: () => api.getHumanTransform(artifactId, path)
  });

  // 2. Determine which artifact to load
  const targetArtifactId = existingTransform?.data?.derived_artifact_id || artifactId;
  const targetPath = existingTransform?.data ? "" : path; // If derived, use root path

  // 3. Load artifact data with Electric SQL
  const { data: artifacts } = useShape({
    url: `${ELECTRIC_URL}/v1/shape`,
    params: {
      table: 'artifacts',
      where: `id = '${targetArtifactId}'`
    }
  });

  // 4. Extract data using path if needed
  const artifact = artifacts?.[0];
  const editableData = targetPath ? 
    extractDataAtPath(artifact?.data, targetPath) : 
    artifact?.data;

  // 5. Handle edits with atomic transform creation
  const editMutation = useMutation({
    mutationFn: (editData) => api.editArtifactWithPath({
      artifactId,
      path,
      editData
    }),
    onSuccess: (response) => {
      if (response.wasTransformed) {
        onTransition?.(response.newArtifactId);
      }
    }
  });
}
```

## 3. Backend Implementation

### New API Endpoint: `/api/artifacts/:id/edit-with-path`

```typescript
POST /api/artifacts/:id/edit-with-path
{
  path?: string;           // JSON path (empty string for root)
  field: string;           // Field to edit within the path
  value: any;              // New value
  projectId: string;
}

Response:
{
  artifactId: string;        // New artifact ID if transform occurred
  wasTransformed: boolean;   // True if human transform was created
  transformId?: string;      // Transform ID if created
}
```

### Atomic Transform Logic
```typescript
async function editArtifactWithPath(
  artifactId: string, 
  path: string = "", 
  field: string, 
  value: any, 
  userId: string
) {
  // 1. Check for existing human transform
  const existingTransform = await findHumanTransform(artifactId, path);
  
  if (existingTransform) {
    // Edit existing derived artifact
    const derivedArtifactId = existingTransform.derived_artifact_id;
    await artifactRepo.updateArtifact(derivedArtifactId, { [field]: value });
    return { artifactId: derivedArtifactId, wasTransformed: false };
  }

  // 2. First edit - create atomic human transform
  const sourceArtifact = await artifactRepo.getArtifact(artifactId);
  
  // Extract data at path
  const sourceData = path ? extractDataAtPath(sourceArtifact.data, path) : sourceArtifact.data;
  
  // Create new data with edit
  const newData = { ...sourceData, [field]: value };
  
  // 3. Atomic operation: create transform + derived artifact
  const result = await db.transaction(async (trx) => {
    // Create human transform
    const transform = await transformRepo.createTransform(
      userId, 'human', 'v1', 'completed',
      { timestamp: new Date().toISOString(), action_type: 'edit' },
      trx
    );
    
    // Create derived user_input artifact
    const derivedArtifact = await artifactRepo.createArtifact(
      userId,
      'user_input',
      { text: JSON.stringify(newData) }, // Or appropriate structure
      'v1',
      { source: 'human', original_artifact_id: artifactId },
      trx
    );
    
    // Link transform
    await transformRepo.addTransformInputs(transform.id, [{ artifactId }], trx);
    await transformRepo.addTransformOutputs(transform.id, [{ artifactId: derivedArtifact.id }], trx);
    
    // Store human transform metadata
    await transformRepo.addHumanTransform({
      transform_id: transform.id,
      action_type: 'edit',
      source_artifact_id: artifactId,
      derivation_path: path,
      derived_artifact_id: derivedArtifact.id
    }, trx);
    
    return { artifactId: derivedArtifact.id, transformId: transform.id };
  });
  
  return { ...result, wasTransformed: true };
}
```

### Database Schema Extensions

```sql
-- Extend human_transforms table
ALTER TABLE human_transforms ADD COLUMN source_artifact_id VARCHAR(255);
ALTER TABLE human_transforms ADD COLUMN derivation_path TEXT DEFAULT '';
ALTER TABLE human_transforms ADD COLUMN derived_artifact_id VARCHAR(255);

-- Add index for fast lookups
CREATE INDEX idx_human_transforms_derivation 
ON human_transforms(source_artifact_id, derivation_path);
```

## 4. Path Extraction Utilities

### JSON Path Helper Functions
```typescript
// Extract data at a JSON path
function extractDataAtPath(data: any, path: string): any {
  if (!path) return data;
  
  // Handle array indices: ideas[0].title -> ideas.0.title
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  
  return normalizedPath.split('.').reduce((obj, key) => {
    return obj?.[key];
  }, data);
}

// Set data at a JSON path (for updates)
function setDataAtPath(data: any, path: string, value: any): any {
  if (!path) return value;
  
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  const keys = normalizedPath.split('.');
  const result = JSON.parse(JSON.stringify(data)); // Deep clone
  
  let current = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
  return result;
}
```

## 5. Usage Examples

### Brainstorm Collection Editing
```typescript
// In ProjectBrainstormPage.tsx
function BrainstormResults({ collectionArtifactId }: { collectionArtifactId: string }) {
  const { data: artifacts } = useShape({
    url: `${ELECTRIC_URL}/v1/shape`,
    params: {
      table: 'artifacts',
      where: `id = '${collectionArtifactId}'`
    }
  });
  
  const collection = artifacts?.[0];
  const ideas = collection?.data?.ideas || [];
  
  return (
    <div>
      {ideas.map((idea, index) => (
        <div key={index} className="idea-card">
          {/* Edit individual idea titles */}
          <ArtifactEditor 
            artifactId={collectionArtifactId} 
            path={`ideas[${index}].title`}
          />
          
          {/* Edit individual idea bodies */}
          <ArtifactEditor 
            artifactId={collectionArtifactId} 
            path={`ideas[${index}].body`}
          />
        </div>
      ))}
    </div>
  );
}
```

### Single Artifact Editing
```typescript
// For outline components
<ArtifactEditor artifactId="outline-123" path="title" />
<ArtifactEditor artifactId="outline-123" path="synopsis" />

// For root-level editing (path defaults to "")
<ArtifactEditor artifactId="user-input-456" />
```

## 6. State Management Strategy

### Simplified Architecture
- **Electric SQL**: Real-time data sync (reads only)
- **TanStack Query**: API calls with optimistic updates + transform lookups
- **Local React State**: Component-level editing state (no Zustand needed)

### Transform Caching
```typescript
// Cache human transforms for fast lookups
const transformQuery = useQuery({
  queryKey: ['human-transform', artifactId, path],
  queryFn: () => api.getHumanTransform(artifactId, path),
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000    // 10 minutes
});
```

## 7. Error Handling & Edge Cases

### Concurrent Edits
- **Same path**: Last write wins (Electric SQL handles sync)
- **Different paths**: Independent edits, no conflicts
- **Transform conflicts**: Rare, but handled by database constraints

### Path Validation
```typescript
function validatePath(data: any, path: string): boolean {
  try {
    const value = extractDataAtPath(data, path);
    return value !== undefined;
  } catch {
    return false;
  }
}
```

### Graceful Degradation
- **Invalid paths**: Show error message, disable editing
- **Missing artifacts**: Show loading state, retry logic
- **Transform failures**: Fallback to read-only mode

## 8. Performance Considerations

### Optimization Strategies
- **Path-based caching**: Cache extracted data to avoid re-computation
- **Debounced saves**: 500ms delay to reduce API calls
- **Selective re-renders**: Only re-render when target path data changes
- **Transform lookup caching**: Cache human transform queries

### Memory Management
- **Shallow cloning**: Only clone data when actually editing
- **Query cleanup**: Proper cleanup of TanStack Query caches
- **Electric SQL subscriptions**: Minimize subscription scope

## 9. Implementation Steps

### Phase 1: Core Path Logic
1. ✅ Implement path extraction utilities
2. ✅ Create human transform lookup API
3. ✅ Add database schema extensions
4. ✅ Test path validation and edge cases

### Phase 2: ArtifactEditor Refactor
1. ✅ Update component to accept path prop
2. ✅ Implement transform lookup logic
3. ✅ Add atomic edit endpoint
4. ✅ Test with collection artifacts

### Phase 3: Integration
1. ✅ Update brainstorm results to use path-based editing
2. ✅ Ensure Electric SQL sync works with derived artifacts
3. ✅ Handle artifact transitions and animations
4. ✅ Performance optimization and caching

### Phase 4: Polish & Testing
1. ✅ Add comprehensive error handling
2. ✅ Implement concurrent edit handling
3. ✅ Add visual feedback for transform states
4. ✅ End-to-end testing with real-time sync

---

This revised design eliminates the need for separate services while providing a clean, atomic approach to artifact derivation through path-based editing. The `ArtifactEditor` becomes a universal component that can handle both simple edits and complex collection derivations seamlessly. 