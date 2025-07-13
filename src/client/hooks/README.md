# Lineage Resolution Hooks

This directory contains React hooks for resolving jsonDoc lineages in the frontend.

## Overview

The lineage resolution system allows the UI to automatically find the latest version of any jsonDoc that may have been edited multiple times through human or LLM transforms. This ensures users always interact with the most recent version of their content.

## Hooks

### `useLineageResolution`

Resolves the latest jsonDoc in a lineage chain for a single jsonDoc and path.

```typescript
const {
  latestJsonDocId,
  resolvedPath,
  lineagePath,
  depth,
  isLoading,
  error,
  hasLineage,
  originalJsonDocId
} = useLineageResolution(sourceJsonDocId, path, options);
```

**Parameters:**
- `sourceJsonDocId`: The original jsonDoc ID to start resolution from
- `path`: Optional path for brainstorm ideas (e.g., `"[0]"`, `"[1]"`)
- `options`: Configuration options including `enabled` flag

**Returns:**
- `latestJsonDocId`: The most recent jsonDoc ID in the lineage chain
- `resolvedPath`: The resolved path (may differ from input path)
- `lineagePath`: Array of nodes showing the full lineage chain
- `depth`: How many transforms deep the lineage goes
- `isLoading`: Whether the resolution is in progress
- `error`: Any error that occurred during resolution
- `hasLineage`: Whether the jsonDoc has been edited (depth > 0)
- `originalJsonDocId`: The original source jsonDoc ID

### `useBrainstormLineageResolution`

Specialized hook for brainstorm idea collections that resolves lineages for all ideas at once.

```typescript
const lineageResolutions = useBrainstormLineageResolution(
  collectionJsonDocId,
  ideaCount,
  options
);
```

**Parameters:**
- `collectionJsonDocId`: The brainstorm collection jsonDoc ID
- `ideaCount`: Number of ideas in the collection
- `options`: Configuration options

**Returns:**
- Object with keys `"[0]"`, `"[1]"`, etc. mapping to individual resolution results

## Usage Example

```typescript
// In DynamicBrainstormingResults.tsx
const collectionJsonDocId = ideas[0]?.jsonDocId || null;
const lineageResolutions = useBrainstormLineageResolution(
  collectionJsonDocId,
  ideas.length,
  { enabled: !isStreaming }
);

// For each idea, get the resolved jsonDoc ID
ideas.map((idea, index) => {
  const pathKey = `[${index}]`;
  const resolution = lineageResolutions[pathKey];
  const resolvedJsonDocId = resolution?.latestJsonDocId;
  const hasLineage = resolution?.hasLineage || false;
  
  return (
    <JsonDocEditor
      jsonDocId={resolvedJsonDocId || idea.jsonDocId}
      path={pathKey}
      transformName="edit_brainstorm_idea"
    />
  );
});
```

## Integration with ProjectDataContext

The hooks integrate seamlessly with the `ProjectDataContext` to:
- Access real-time jsonDoc and transform data
- Handle loading states automatically
- Provide error handling and fallbacks
- Update when underlying data changes

## Performance

The lineage resolution algorithm is optimized for performance:
- Graph building: ~10ms for typical project sizes
- Resolution: <1ms per jsonDoc
- Memoized results prevent unnecessary recalculations
- Batch resolution for multiple jsonDocs

## Error Handling

The hooks provide graceful error handling:
- Fall back to original jsonDoc IDs if resolution fails
- Log errors for debugging while maintaining UI functionality
- Handle missing jsonDocs and broken lineage chains
- Provide clear error messages for developers 