# Streaming UI Framework Refactor Plan

## Overview
Create a unified dynamic streaming UI framework that renders fields progressively as JSON data streams in, supporting both brainstorming (simple array) and outline (complex nested object) use cases.

## Core Principles
1. **Eager Rendering**: Show UI components as soon as any field is detected
2. **Progressive Enhancement**: Update components as more data arrives
3. **Order Agnostic**: Fields appear in streaming order, not predefined order
4. **Unified Architecture**: Same framework handles both simple and complex structures

## Architecture Components

### 1. Field Registry System
```typescript
interface FieldDefinition {
  path: string;                           // JSON path pattern (e.g., "title", "characters[*].name")
  component: ComponentType<FieldProps>;   // React component to render
  label?: string;                        // Display label
  containerType?: 'card' | 'section';   // How to wrap the field
  extractKey?: (data: any) => string;   // For arrays, extract unique key
}

// Registry maps JSON paths to UI components
const outlineFieldRegistry: FieldDefinition[] = [
  { path: "title", component: TextField, label: "剧本标题" },
  { path: "genre", component: TextField, label: "剧本类型" },
  { path: "selling_points", component: ArrayField, label: "产品卖点" },
  { path: "characters[*]", component: CharacterCard, containerType: 'card' },
  { path: "characters[*].name", component: TextField, label: "姓名" },
  // ... more fields
];

const brainstormFieldRegistry: FieldDefinition[] = [
  { path: "[*]", component: IdeaCard, containerType: 'card', extractKey: (item) => `${item.title}-${item.body}` }
];
```

### 2. Dynamic Field Detector
```typescript
class StreamingFieldDetector {
  private discoveredPaths: Set<string> = new Set();
  private pathData: Map<string, any> = new Map();
  
  processChunk(partialJson: any): FieldUpdate[] {
    const updates: FieldUpdate[] = [];
    const paths = extractJsonPaths(partialJson);
    
    for (const [path, value] of paths) {
      if (!this.discoveredPaths.has(path)) {
        // New field discovered!
        this.discoveredPaths.add(path);
        updates.push({ type: 'new-field', path, value });
      } else if (this.pathData.get(path) !== value) {
        // Existing field updated
        updates.push({ type: 'update-field', path, value });
      }
      this.pathData.set(path, value);
    }
    
    return updates;
  }
}
```

### 3. Dynamic UI Renderer
```typescript
interface DynamicStreamingUIProps {
  fieldRegistry: FieldDefinition[];
  transformId: string;
  onFieldEdit?: (path: string, value: any) => void;
}

const DynamicStreamingUI: React.FC<DynamicStreamingUIProps> = ({ fieldRegistry, transformId, onFieldEdit }) => {
  const [renderedFields, setRenderedFields] = useState<RenderedField[]>([]);
  const detector = useRef(new StreamingFieldDetector());
  
  // Subscribe to streaming data
  useStreamingData(transformId, (chunk) => {
    const updates = detector.current.processChunk(chunk);
    
    updates.forEach(update => {
      if (update.type === 'new-field') {
        const fieldDef = findMatchingDefinition(update.path, fieldRegistry);
        if (fieldDef) {
          setRenderedFields(prev => [...prev, {
            id: generateFieldId(update.path),
            path: update.path,
            definition: fieldDef,
            value: update.value
          }]);
        }
      } else if (update.type === 'update-field') {
        setRenderedFields(prev => prev.map(field => 
          field.path === update.path ? { ...field, value: update.value } : field
        ));
      }
    });
  });
  
  return (
    <div className="streaming-ui-container">
      {renderedFields.map(field => (
        <StreamingFieldRenderer
          key={field.id}
          field={field}
          onEdit={(value) => onFieldEdit?.(field.path, value)}
        />
      ))}
      {isStreaming && <StreamingIndicator />}
    </div>
  );
};
```

### 4. Field Components with Progressive Enhancement
```typescript
// Example: Character Card that builds progressively
const CharacterCard: React.FC<FieldProps> = ({ value, onEdit, path }) => {
  // Value starts partial and fills in over time
  return (
    <Card className="character-card">
      {value.name && (
        <TextField 
          label="姓名" 
          value={value.name} 
          onEdit={(v) => onEdit({ ...value, name: v })}
        />
      )}
      {value.type && (
        <TextField 
          label="角色类型" 
          value={value.type}
          onEdit={(v) => onEdit({ ...value, type: v })}
        />
      )}
      {/* More fields appear as they stream in */}
    </Card>
  );
};
```

## Implementation Phases

### Phase 1: Core Framework
1. Implement `StreamingFieldDetector` for JSON path extraction
2. Create `DynamicStreamingUI` base component
3. Build path matching algorithm for wildcard patterns
4. Add field ordering/grouping logic (optional, for visual organization)

### Phase 2: Field Components
1. Create reusable field components (TextField, ArrayField, etc.)
2. Implement progressive enhancement for complex fields
3. Add edit functionality with proper path tracking
4. Handle array item additions/removals

### Phase 3: Integration
1. Refactor `OutlineResults` to use `DynamicStreamingUI`
2. Refactor `BrainstormingResults` to use same framework
3. Update streaming services to emit partial JSON
4. Ensure artifact/transform tracking still works

### Phase 4: Optimizations
1. Add virtualization for large arrays
2. Implement field change batching
3. Add smooth animations for field appearance
4. Cache rendered components for performance

## Key Benefits

1. **Unified Codebase**: Same framework for all streaming UI needs
2. **Faster Perceived Performance**: Users see content immediately
3. **Better UX**: Progressive enhancement feels more responsive
4. **Maintainable**: Add new fields by updating registry, not code
5. **Flexible**: Handles any JSON structure dynamically

## Migration Strategy

### For Outline:
- Replace static field layout with dynamic renderer
- Convert each field section to a registry entry
- Preserve edit functionality through path-based updates

### For Brainstorming:
- Already close to this model, minor adjustments needed
- Unify the streaming detection logic
- Use same progressive rendering approach

## Technical Considerations

1. **JSON Path Library**: Use or build robust path extraction
2. **Partial JSON Parsing**: Leverage jsonrepair for incomplete data
3. **Performance**: Use React.memo and careful re-render management
4. **Type Safety**: Generate TypeScript types from registries
5. **Testing**: Unit test path detection and field matching

## Example Usage

```typescript
// Outline page
<DynamicStreamingUI
  fieldRegistry={outlineFieldRegistry}
  transformId={transformId}
  onFieldEdit={handleOutlineFieldEdit}
/>

// Brainstorming page  
<DynamicStreamingUI
  fieldRegistry={brainstormFieldRegistry}
  transformId={transformId}
  onFieldEdit={handleIdeaEdit}
/>
```

## Next Steps

1. Create proof-of-concept with simple fields
2. Test with real streaming data
3. Iterate on UX (animations, loading states)
4. Full implementation across both features
5. Performance optimization and testing 

## Current Implementation Analysis

### Brainstorming (Partially Dynamic)
- **Good**: Already renders ideas as they stream in
- **Issue**: Not using a generic framework, custom implementation
- **Structure**: Simple array of `{title, body}` objects
- **Current Flow**: 
  ```
  Stream → Parse array → Map to IdeaCards → Render
  ```

### Outline (Static Layout)
- **Issue**: Pre-defined UI fields that get populated
- **Structure**: Complex nested object with multiple field types
- **Current Flow**:
  ```
  Stream → Parse JSON → Update state → Fill pre-existing fields
  ```
- **Problems**:
  - Fields must be known ahead of time
  - Empty UI shown before data arrives
  - No progressive enhancement within complex fields

## Detailed Field Registry Examples

### Complete Outline Registry
```typescript
const outlineFieldRegistry: FieldDefinition[] = [
  // Simple fields
  { path: "title", component: TextField, label: "剧本标题" },
  { path: "genre", component: TextField, label: "剧本类型" },
  
  // Nested object
  { 
    path: "target_audience", 
    component: TargetAudienceSection,
    label: "目标受众",
    containerType: 'section'
  },
  { path: "target_audience.demographic", component: TextField, label: "受众群体" },
  { path: "target_audience.core_themes", component: TagList, label: "核心主题" },
  
  // Arrays
  { path: "selling_points", component: TextAreaList, label: "产品卖点" },
  { path: "satisfaction_points", component: TextAreaList, label: "情感爽点" },
  
  // Complex nested structure
  { path: "setting", component: SettingSection, label: "故事设定" },
  { path: "setting.core_setting_summary", component: TextArea, label: "核心设定" },
  { path: "setting.key_scenes", component: SceneList, label: "关键场景" },
  
  // Array of objects (characters)
  { 
    path: "characters[*]", 
    component: CharacterCard,
    containerType: 'card',
    extractKey: (char) => char.name || `char-${Date.now()}`
  },
  { path: "characters[*].name", component: TextField, label: "姓名" },
  { path: "characters[*].type", component: SelectField, label: "角色类型" },
  { path: "characters[*].description", component: TextArea, label: "角色描述" },
  { path: "characters[*].age", component: TextField, label: "年龄" },
  { path: "characters[*].gender", component: TextField, label: "性别" },
  { path: "characters[*].occupation", component: TextField, label: "职业" },
  { path: "characters[*].personality_traits", component: TagList, label: "性格特点" },
  { path: "characters[*].character_arc", component: TextArea, label: "人物成长轨迹" },
  
  // Synopsis stages
  { path: "synopsis_stages", component: SynopsisStagesList, label: "分段故事梗概" }
];
```

### Brainstorming Registry (Simplified)
```typescript
const brainstormFieldRegistry: FieldDefinition[] = [
  { 
    path: "[*]",
    component: IdeaCard,
    containerType: 'card',
    extractKey: (idea) => `${idea.title}-${idea.body.substring(0, 20)}`
  },
  { path: "[*].title", component: IdeaTitle },
  { path: "[*].body", component: IdeaBody }
];
```

## Path Matching Algorithm

```typescript
function matchPath(dataPath: string, registryPath: string): boolean {
  // Convert registry path to regex
  // "characters[*].name" → /^characters\[\d+\]\.name$/
  // "[*]" → /^\[\d+\]$/
  
  const regexPattern = registryPath
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\*/g, '\\d+')
    .replace(/\./g, '\\.');
    
  return new RegExp(`^${regexPattern}$`).test(dataPath);
}

// Extract all paths from partial JSON
function extractJsonPaths(obj: any, prefix = ''): Array<[string, any]> {
  const paths: Array<[string, any]> = [];
  
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      paths.push([`${prefix}[${index}]`, item]);
      if (typeof item === 'object' && item !== null) {
        paths.push(...extractJsonPaths(item, `${prefix}[${index}]`));
      }
    });
  } else if (typeof obj === 'object' && obj !== null) {
    Object.entries(obj).forEach(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      paths.push([path, value]);
      if (typeof value === 'object' && value !== null) {
        paths.push(...extractJsonPaths(value, path));
      }
    });
  }
  
  return paths;
}
```

## Animation and UX Enhancements

```css
/* Smooth field appearance */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.streaming-field-enter {
  animation: slideIn 0.3s ease-out;
}

/* Pulsing effect for fields being updated */
@keyframes pulse {
  0% { background-color: rgba(24, 144, 255, 0.1); }
  50% { background-color: rgba(24, 144, 255, 0.2); }
  100% { background-color: rgba(24, 144, 255, 0.1); }
}

.streaming-field-updating {
  animation: pulse 1s ease-in-out;
}
```

## Performance Considerations

### Batching Updates
```typescript
const useBatchedUpdates = (callback: (updates: FieldUpdate[]) => void, delay = 50) => {
  const batchRef = useRef<FieldUpdate[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((update: FieldUpdate) => {
    batchRef.current.push(update);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      if (batchRef.current.length > 0) {
        callback(batchRef.current);
        batchRef.current = [];
      }
    }, delay);
  }, [callback, delay]);
};
```

## Error Handling

```typescript
interface StreamingError {
  path: string;
  error: string;
}

// Handle malformed JSON gracefully
const safeJsonParse = (content: string): { data?: any; error?: string } => {
  try {
    return { data: JSON.parse(content) };
  } catch (e) {
    try {
      const repaired = jsonrepair(content);
      return { data: JSON.parse(repaired) };
    } catch (repairError) {
      return { error: 'Failed to parse JSON' };
    }
  }
};
```

## Testing Strategy

1. **Unit Tests**:
   - Path matching algorithm
   - JSON path extraction
   - Field registry lookups
   - Update batching

2. **Integration Tests**:
   - Streaming simulation with partial data
   - Field appearance order
   - Edit functionality
   - Error recovery

3. **E2E Tests**:
   - Full streaming flow
   - User interactions during streaming
   - Performance under load 