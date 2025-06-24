# Raw Graph Debugging Feature Implementation Plan

## Overview
Add a debugging visualization that shows the complete artifact and transform lineage graph using React Flow. Accessible via `?raw-graph=1` query parameter on any project view.

## Implementation Steps

### 1. URL Parameter Detection & Toggle Button

**File: `src/client/components/ProjectLayout.tsx`**
- Add `useSearchParams` hook to detect `?raw-graph=1`
- Add toggle button in breadcrumb row (top-right, opposite to breadcrumb)
- Toggle button switches between normal view and raw graph view
- Button text: "显示原始图谱" / "隐藏原始图谱"

### 2. Raw Graph Component

**File: `src/client/components/RawGraphVisualization.tsx`**
- Use React Flow with hierarchical left-to-right layout
- Consume data from `ProjectDataContext`
- Use existing `buildLineageGraph()` function

#### Node Types & Styling
```typescript
// Artifact nodes - rounded rectangles with type-based colors
const ARTIFACT_COLORS = {
  brainstorm_idea_collection: '#1890ff',
  brainstorm_idea: '#52c41a', 
  user_input: '#fa8c16',
  outline_input: '#722ed1',
  outline_response: '#eb2f96',
  // ... other types
}

// Transform nodes - diamond shapes
const TRANSFORM_COLORS = {
  human: '#13c2c2',
  llm: '#f5222d'
}
```

#### Node Content
- **Artifacts**: 
  - Type badge
  - Truncated ID (first 8 chars)
  - Title/content preview (first 30 chars)
  - Creation timestamp
- **Transforms**:
  - Type (Human/LLM)
  - Transform name
  - User (for human transforms)
  - Timestamp

#### Edge Styling
- **Artifact → Transform**: Solid blue line
- **Transform → Artifact**: Solid green line
- Different arrow markers for each direction

### 3. Graph Data Processing

**Function: `processLineageForVisualization()`**
```typescript
interface GraphNode extends Node {
  data: {
    id: string;
    type: 'artifact' | 'transform';
    artifactType?: string;
    transformType?: string;
    label: ReactNode;
    details: any; // Full object for hover
    isLatest?: boolean; // Highlight latest in lineage chains
  }
}
```

#### Processing Logic
1. Use `buildLineageGraph()` to get lineage data
2. Convert artifacts to React Flow nodes
3. Convert transforms to React Flow nodes  
4. Create edges for all relationships
5. Apply hierarchical layout (dagre or elk)
6. Mark "latest" artifacts in lineage chains

### 4. Layout Algorithm

**Layout: Left-to-Right Hierarchical**
- Root artifacts on the left
- Transforms and derived artifacts flow to the right
- Use `dagre` layout algorithm for automatic positioning
- Ensure proper spacing and no overlaps

### 5. Interactivity Features

#### Hover Tooltips
- **Artifacts**: Show full data object (formatted JSON)
- **Transforms**: Show execution context, parameters
- Use Ant Design `Tooltip` component

#### Node Selection
- Click to select/highlight node and connected edges
- Show detailed info panel (optional future enhancement)

### 6. Latest Artifact Highlighting

**Logic**: 
- For each lineage chain, identify the leaf (latest) artifact
- Only highlight when there are multiple versions of same content
- Use glowing border or special color for latest artifacts

### 7. Graph Controls

**Features**:
- MiniMap for navigation
- Zoom controls
- Fit view button
- Filter toggles (show/hide artifact types, transform types)

### 8. Integration Points

#### ProjectLayout Changes
```typescript
// Add to ProjectLayout.tsx
const [searchParams, setSearchParams] = useSearchParams();
const showRawGraph = searchParams.get('raw-graph') === '1';

const toggleRawGraph = () => {
  if (showRawGraph) {
    searchParams.delete('raw-graph');
  } else {
    searchParams.set('raw-graph', '1');
  }
  setSearchParams(searchParams);
};

// Conditional rendering
{showRawGraph ? (
  <RawGraphVisualization />
) : (
  <Outlet />
)}
```

#### Data Flow
```
ProjectDataContext → buildLineageGraph() → processLineageForVisualization() → React Flow
```

## File Structure

```
src/client/components/
├── RawGraphVisualization.tsx        # Main graph component
├── ProjectLayout.tsx                # Modified for toggle button
└── shared/
    └── GraphTooltip.tsx            # Reusable tooltip component
```

## Dependencies

**New Dependencies Needed**:
- `dagre` - For hierarchical layout algorithm
- `@types/dagre` - TypeScript definitions

**Existing Dependencies Used**:
- `reactflow` - Already available
- `@ant-design/icons` - For toggle button icon
- React Router's `useSearchParams` - For URL parameter handling

## Technical Considerations

### Performance
- Memoize graph processing to avoid recalculation on every render
- Use React Flow's built-in virtualization for large graphs
- Debounce layout calculations

### Responsive Design
- Full width/height when active
- Maintain chat sidebar on the left
- Handle window resize events

### Error Handling
- Graceful handling of missing lineage data
- Fallback UI if graph processing fails
- Loading states during graph calculation

## Testing Strategy

### Manual Testing
1. Test with various project states (empty, small, large graphs)
2. Verify URL parameter persistence across navigation
3. Test graph interactions (zoom, pan, hover)
4. Verify lineage highlighting accuracy

### Edge Cases
- Projects with no artifacts/transforms
- Circular dependencies (shouldn't exist but handle gracefully)
- Very large graphs (100+ nodes)
- Missing transform relationships

## Future Enhancements (Out of Scope)

- Export graph as image/PDF
- Advanced filtering and search
- Time-based animation of graph evolution
- Integration with artifact editor (click to edit)
- Graph comparison between project states

## Implementation Order

1. ✅ Create implementation plan
2. ✅ Add toggle button to ProjectLayout
3. ✅ Create basic RawGraphVisualization component
4. ✅ Implement graph data processing
5. ✅ Add hierarchical layout
6. ✅ Implement hover tooltips
7. ✅ Add latest artifact highlighting
8. ✅ Add graph controls and styling
9. ✅ Testing and refinement

## Testing Instructions

The raw graph visualization is now fully implemented and ready for testing:

### How to Access
1. Navigate to any project page (e.g., brainstorm, outline, etc.)
2. Add `?raw-graph=1` to the URL, or
3. Click the "显示原始图谱" button in the top-right corner of the breadcrumb area

### Example URLs
- `http://localhost:4600/projects/b1da3885-73a9-4ce0-a191-f679db11bd6c/brainstorm?raw-graph=1`
- `http://localhost:4600/projects/[PROJECT_ID]/outline?raw-graph=1`

### Features to Test
- ✅ **Toggle Button**: Shows "显示原始图谱" when hidden, "隐藏原始图谱" when visible
- ✅ **Graph Layout**: Left-to-right hierarchical layout with proper spacing
- ✅ **Artifact Nodes**: Colored rectangles with type badges, IDs, content previews, and timestamps
- ✅ **Transform Nodes**: Diamond-shaped nodes with human/LLM indicators
- ✅ **Hover Tooltips**: Detailed information on hover including full JSON data
- ✅ **Latest Highlighting**: Gold border and "LATEST" tag for leaf artifacts in lineage chains
- ✅ **Filter Controls**: Show/hide artifacts, transforms, human transforms, and LLM transforms
- ✅ **Graph Controls**: Zoom, pan, fit view, and minimap
- ✅ **Real-time Updates**: Electric SQL integration provides live data updates

### Data Verification
Test with project `b1da3885-73a9-4ce0-a191-f679db11bd6c` which contains:
- 13 artifacts (11 brainstorm_idea, 1 brainstorm_tool_input, 1 brainstorm_params)
- 11 transforms (8 human, 3 LLM)
- Complete lineage relationships for debugging

## Implementation Complete ✅

The raw graph debugging feature is fully functional and provides comprehensive visualization of the artifact and transform lineage system. This tool will be invaluable for debugging lineage resolution issues and understanding the flow of data through the system.

## Estimated Timeline
- **Setup & Basic Graph**: 2-3 hours
- **Layout & Styling**: 2-3 hours  
- **Interactivity & Polish**: 1-2 hours
- **Testing & Debugging**: 1-2 hours
- **Total**: 6-10 hours

This debugging tool will provide invaluable insights into the lineage system's behavior and help identify any issues with artifact relationships and transform execution. 