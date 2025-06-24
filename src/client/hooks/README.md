# Lineage Resolution Hooks

This directory contains React hooks for resolving artifact lineages in the frontend.

## Overview

The lineage resolution system allows the UI to automatically find the latest version of any artifact that may have been edited multiple times through human or LLM transforms. This ensures users always interact with the most recent version of their content.

## Hooks

### `useLineageResolution`

Resolves the latest artifact in a lineage chain for a single artifact and path.

```typescript
const {
  latestArtifactId,
  resolvedPath,
  lineagePath,
  depth,
  isLoading,
  error,
  hasLineage,
  originalArtifactId
} = useLineageResolution(sourceArtifactId, path, options);
```

**Parameters:**
- `sourceArtifactId`: The original artifact ID to start resolution from
- `path`: Optional path for brainstorm ideas (e.g., `"[0]"`, `"[1]"`)
- `options`: Configuration options including `enabled` flag

**Returns:**
- `latestArtifactId`: The most recent artifact ID in the lineage chain
- `resolvedPath`: The resolved path (may differ from input path)
- `lineagePath`: Array of nodes showing the full lineage chain
- `depth`: How many transforms deep the lineage goes
- `isLoading`: Whether the resolution is in progress
- `error`: Any error that occurred during resolution
- `hasLineage`: Whether the artifact has been edited (depth > 0)
- `originalArtifactId`: The original source artifact ID

### `useBrainstormLineageResolution`

Specialized hook for brainstorm idea collections that resolves lineages for all ideas at once.

```typescript
const lineageResolutions = useBrainstormLineageResolution(
  collectionArtifactId,
  ideaCount,
  options
);
```

**Parameters:**
- `collectionArtifactId`: The brainstorm collection artifact ID
- `ideaCount`: Number of ideas in the collection
- `options`: Configuration options

**Returns:**
- Object with keys `"[0]"`, `"[1]"`, etc. mapping to individual resolution results

## Usage Example

```typescript
// In DynamicBrainstormingResults.tsx
const collectionArtifactId = ideas[0]?.artifactId || null;
const lineageResolutions = useBrainstormLineageResolution(
  collectionArtifactId,
  ideas.length,
  { enabled: !isStreaming }
);

// For each idea, get the resolved artifact ID
ideas.map((idea, index) => {
  const pathKey = `[${index}]`;
  const resolution = lineageResolutions[pathKey];
  const resolvedArtifactId = resolution?.latestArtifactId;
  const hasLineage = resolution?.hasLineage || false;
  
  return (
    <ArtifactEditor
      artifactId={resolvedArtifactId || idea.artifactId}
      path={pathKey}
      transformName="edit_brainstorm_idea"
    />
  );
});
```

## Integration with ProjectDataContext

The hooks integrate seamlessly with the `ProjectDataContext` to:
- Access real-time artifact and transform data
- Handle loading states automatically
- Provide error handling and fallbacks
- Update when underlying data changes

## Performance

The lineage resolution algorithm is optimized for performance:
- Graph building: ~10ms for typical project sizes
- Resolution: <1ms per artifact
- Memoized results prevent unnecessary recalculations
- Batch resolution for multiple artifacts

## Error Handling

The hooks provide graceful error handling:
- Fall back to original artifact IDs if resolution fails
- Log errors for debugging while maintaining UI functionality
- Handle missing artifacts and broken lineage chains
- Provide clear error messages for developers 