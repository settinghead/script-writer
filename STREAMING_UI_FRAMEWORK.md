# Dynamic Streaming UI Framework

## Overview

The Dynamic Streaming UI Framework is a unified system for rendering UI components progressively as JSON data streams in. It replaces static field layouts with dynamic rendering that shows content as soon as it arrives, providing better perceived performance and user experience.

## Architecture

### Core Components

1. **DynamicStreamingUI** - Main orchestrating component
2. **StreamingFieldDetector** - Processes streaming chunks and extracts JSON paths
3. **PathMatcher** - Matches data paths to field definitions
4. **Field Components** - Reusable UI components for different data types
5. **Field Registries** - Configuration that maps JSON paths to UI components

### Key Features

- **Eager Rendering**: UI components appear immediately when data is detected
- **Progressive Enhancement**: Components update and enhance as more data arrives
- **Order Agnostic**: Fields appear in streaming order, not predefined order
- **Unified Architecture**: Same framework handles both simple and complex data structures
- **Type Safe**: Full TypeScript support with proper interfaces

## Usage

### Basic Example

```tsx
import { DynamicStreamingUI, brainstormFieldRegistry } from './shared/streaming';

<DynamicStreamingUI
  fieldRegistry={brainstormFieldRegistry}
  streamingData={ideas}
  streamingStatus="streaming"
  onStopStreaming={handleStop}
  onFieldEdit={handleEdit}
/>
```

### For Brainstorming (Simple Array)

```tsx
import { DynamicBrainstormingResults } from './DynamicBrainstormingResults';

<DynamicBrainstormingResults
  ideas={ideas}
  onIdeaSelect={onSelect}
  isStreaming={isStreaming}
  onStop={onStop}
/>
```

### For Outline (Complex Object)

```tsx
import { DynamicOutlineResults } from './DynamicOutlineResults';

<DynamicOutlineResults
  components={outlineData}
  isStreaming={isStreaming}
  onFieldEdit={onEdit}
  onStopStreaming={onStop}
/>
```

## Field Registries

Field registries define how JSON paths map to UI components.

### Outline Registry Example

```typescript
export const outlineFieldRegistry: FieldDefinition[] = [
  { 
    path: "title", 
    component: TextField, 
    label: "剧本标题",
    order: 1
  },
  { 
    path: "characters[*]", 
    component: CharacterCard,
    containerType: 'card',
    extractKey: (char) => char?.name || `char-${Date.now()}`,
    order: 9
  },
  { 
    path: "characters[*].name", 
    component: TextField, 
    label: "姓名",
    group: "characters"
  }
];
```

### Brainstorming Registry Example

```typescript
export const brainstormFieldRegistry: FieldDefinition[] = [
  { 
    path: "[*]",
    component: IdeaCard,
    containerType: 'card',
    extractKey: (idea) => `${idea.title}-${idea.body?.substring(0, 20)}`
  }
];
```

## Available Field Components

### Basic Components

- **TextField** - Single-line text input with inline editing
- **TextAreaField** - Multi-line text input with inline editing  
- **TagListField** - Display array of strings as tags
- **TextListField** - Display array of strings as formatted list

### Complex Components

- **CharacterCard** - Progressive character information display
- **IdeaCard** - Interactive idea selection card
- **SectionWrapper** - Groups related fields with title

### Component Features

- **Inline Editing**: Click to edit, save on blur/enter
- **Progressive Enhancement**: Components build up as data streams in
- **Loading States**: Visual indicators during streaming
- **Error Handling**: Graceful error display and recovery

## Path Matching

The framework uses flexible path matching with wildcard support:

- `"title"` - Matches exact field
- `"characters[*]"` - Matches any array item
- `"characters[*].name"` - Matches nested fields in arrays
- `"setting.core_setting_summary"` - Matches nested object fields

## Streaming States

- **idle** - No active streaming, static display
- **streaming** - Actively receiving data, show loading indicators
- **completed** - Streaming finished, show final state
- **error** - Error occurred, show error state

## Migration from Static Components

### Before (Static)
```tsx
<div>
  <TextField label="标题" value={data.title} />
  <TextField label="类型" value={data.genre} />
  {/* All fields predefined, empty until data arrives */}
</div>
```

### After (Dynamic)
```tsx
<DynamicStreamingUI
  fieldRegistry={registry}
  streamingData={[data]}
  streamingStatus="completed"
/>
```

## Performance Considerations

### Optimizations

- **React.memo** - Components only re-render when props change
- **Batched Updates** - Multiple field updates batched together
- **Virtual Scrolling** - For large lists (future enhancement)
- **Path Caching** - Efficient path matching with caching

### Memory Management

- **Field Cleanup** - Remove components when data is removed
- **Detector Reset** - Clear path tracking between sessions
- **Component Pooling** - Reuse components where possible

## Error Handling

### Graceful Degradation

- **Parse Errors** - Use jsonrepair for malformed JSON
- **Component Errors** - Show error boundaries around components
- **Path Errors** - Log warnings for unmatched paths
- **Network Errors** - Display connection status and retry options

## Testing

### Unit Tests
```typescript
// Test path matching
expect(PathMatcher.matchPath('characters[0].name', 'characters[*].name')).toBeTruthy();

// Test field detection
const detector = new StreamingFieldDetector();
const updates = detector.processChunk({ title: 'Test Title' });
expect(updates).toHaveLength(1);
```

### Integration Tests
```typescript
// Test streaming simulation
render(<DynamicStreamingUI fieldRegistry={registry} />);
// Simulate streaming data arrival
// Assert UI updates correctly
```

## Future Enhancements

### Planned Features

1. **Field Validation** - Real-time validation as data streams
2. **Custom Animations** - Configurable transition animations
3. **Drag & Drop** - Reorder fields and components
4. **Export/Import** - Save and load field configurations
5. **Performance Monitoring** - Track rendering performance metrics

### Advanced Features

1. **Virtual Scrolling** - Handle very large datasets efficiently
2. **Lazy Loading** - Load field components on demand
3. **Hot Reloading** - Update registries without page refresh
4. **A/B Testing** - Switch between different field layouts

## Integration Notes

### With Existing Services

The framework integrates with existing streaming services through props:

```typescript
// Outline service integration
const { items, status } = useStreamingOutline(transformId);

<DynamicStreamingUI
  streamingData={items}
  streamingStatus={status}
  // ... other props
/>
```

### Backward Compatibility

- Original components remain available
- Gradual migration path supported
- Feature flags to switch between old/new

## Best Practices

### Registry Design

1. **Order Fields** - Use `order` property for logical grouping
2. **Group Related** - Use `group` for complex structures  
3. **Extract Keys** - Provide stable keys for array items
4. **Component Choice** - Match component to data type

### Performance

1. **Minimal Re-renders** - Use React.memo and stable props
2. **Batch Updates** - Avoid frequent small updates
3. **Lazy Registration** - Don't register unused paths
4. **Profile Performance** - Monitor rendering times

### User Experience

1. **Smooth Animations** - Use CSS transitions for field appearance
2. **Loading States** - Clear indicators during streaming
3. **Error Recovery** - Helpful error messages and retry options
4. **Accessibility** - Proper ARIA labels and keyboard navigation

## Files Structure

```
src/client/components/shared/streaming/
├── types.ts                    # TypeScript interfaces
├── StreamingFieldDetector.ts   # Path extraction and detection
├── fieldComponents.tsx         # Reusable UI components
├── fieldRegistries.ts          # Registry definitions
├── DynamicStreamingUI.tsx      # Main orchestrating component
└── index.ts                    # Public exports

src/client/components/
├── DynamicBrainstormingResults.tsx  # Brainstorming integration
└── DynamicOutlineResults.tsx        # Outline integration
```

## Summary

The Dynamic Streaming UI Framework provides a modern, efficient way to handle progressive data rendering. It improves user experience through eager rendering, reduces code duplication through unified architecture, and maintains type safety throughout the application.

Key benefits:
- **Better UX**: Users see content immediately as it streams
- **Maintainable**: Add new fields by updating registry, not code
- **Performant**: Optimized rendering with minimal re-renders
- **Flexible**: Handles any JSON structure dynamically
- **Type Safe**: Full TypeScript support prevents runtime errors 