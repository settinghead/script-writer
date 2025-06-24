# Brainstorm Idea Editing System Implementation Plan

## Context & Rationale

The current script-writer application has a robust brainstorm system that generates story ideas using AI. However, users currently can only edit these ideas through manual human transforms that create `user_input` artifacts. We need to enhance this system to allow **AI-powered editing** of brainstorm ideas through an agent-driven interface.

### Current System Overview

The existing brainstorm system works as follows:
1. **Initial Generation**: Agent creates `brainstorm_idea_collection` artifact containing multiple story ideas
2. **Manual Editing**: Users can edit individual ideas through `ArtifactEditor`, which creates human transforms and `user_input` artifacts
3. **Simple Lineage**: Currently only supports one level of editing (original → user_input)

### What We're Building

We want to add **LLM-powered editing** that allows:
1. **Agent-driven editing**: Chat agent can understand user requests like "make the stories more modern" and automatically edit ideas
2. **Complex lineage**: Support multiple rounds of editing (original → LLM edit → human edit → LLM edit → etc.)
3. **Intelligent context**: Agent provides enriched context and instructions to the LLM editing tool
4. **UI integration**: Frontend can display and interact with the full editing lineage

## Implementation Phases

### ✅ Phase 1: LLM Edit Tool & Agent Integration (COMPLETED)

**Status: ✅ COMPLETED - All functionality tested and working**

**What was implemented:**
- ✅ **LLM Transform Definition**: Added `llm_edit_brainstorm_idea` transform with Zod schemas
- ✅ **LLM Edit Template**: Comprehensive Chinese prompt with platform-specific requirements
- ✅ **Brainstorm Edit Tool**: Handles multiple artifact types with proper lineage tracking
- ✅ **Enhanced Agent Service**: `runGeneralAgent` with context preparation and tool selection
- ✅ **API Integration**: `/api/projects/:id/agent` endpoint for general agent requests
- ✅ **Comprehensive Testing**: Agent successfully handles whining users, specific edits, and bulk changes

**Test Results:**
- ✅ Agent correctly recognizes edit vs generation requests
- ✅ Makes multiple tool calls (one per idea) when needed
- ✅ Handles complex lineage (original → edit → edit)
- ✅ Produces high-quality Chinese story content
- ✅ Maintains proper artifact relationships and transforms

### 🔄 Phase 2: Lineage Resolution System (IN PROGRESS)

**Objective**: Create a robust system to resolve complex artifact lineages and determine the "latest" version of any piece of content.

#### 2.1: Core Lineage Resolution Algorithm

**Goal**: Create pure functions to traverse artifact/transform graphs and find the most recent version of content.

**Data Structures**:
```typescript
interface LineageNode {
  artifactId: string;
  transformId?: string;
  path?: string;
  depth: number;
  isLeaf: boolean;
}

interface LineageGraph {
  nodes: Map<string, LineageNode>;
  edges: Map<string, string[]>; // artifactId -> [childArtifactIds]
  paths: Map<string, LineageNode[]>; // path -> [nodes in lineage]
}
```

**Core Functions Needed**:
- `buildLineageGraph(artifacts, transforms, inputs, outputs): LineageGraph`
- `findLatestArtifact(sourceArtifactId, path?, graph): Artifact | null`
- `getLineagePath(artifactId, graph): LineageNode[]`
- `validateLineageIntegrity(graph): ValidationResult`

#### 2.2: Lineage Resolution Service

**Goal**: Service layer that uses the core algorithm with real data.

```typescript
class LineageResolutionService {
  constructor(
    private artifactRepo: ArtifactRepository,
    private transformRepo: TransformRepository
  ) {}
  
  async resolveLatestArtifact(
    projectId: string, 
    sourceArtifactId: string, 
    path?: string
  ): Promise<Artifact | null>
  
  async getFullLineage(
    projectId: string, 
    artifactId: string
  ): Promise<LineageNode[]>
}
```

#### 2.3: Comprehensive Testing

**Test Scenarios**:
- Simple lineage: A → B → C
- Branching lineage: A → B, A → C  
- Complex nested paths: A[0] → B → C[1] → D
- Missing artifacts/broken chains
- Circular references (should be impossible but test anyway)

### Phase 3: UI Integration & Dynamic Lineage ✅ COMPLETED

**Objective**: Update `DynamicBrainstormingResults.tsx` to use lineage resolution and pass correct artifact IDs to `ArtifactEditor`.

#### 3.1: Update DynamicBrainstormingResults Component ✅

**Implementation**: Updated component to use lineage resolution before passing artifact IDs to `ArtifactEditor`.

**Changes Made**:
```typescript
// Before (current)
<ArtifactEditor
  artifactId={idea.artifactId}
  path={`[${index}]`}
  transformName="edit_brainstorm_idea"
/>

// After (with lineage resolution)
<ArtifactEditor
  artifactId={resolvedArtifactId || idea.artifactId} // Latest in lineage
  path={`[${index}]`}
  transformName="edit_brainstorm_idea"
/>
```

#### 3.2: Lineage Resolution Hook ✅

**Implementation**: Created comprehensive React hooks for lineage resolution.

**Hooks Created**:
- `useLineageResolution` - Single artifact/path resolution
- `useMultipleLineageResolution` - Batch resolution for multiple paths  
- `useBrainstormLineageResolution` - Specialized for brainstorm collections

```typescript
function useLineageResolution(
  sourceArtifactId: string | null, 
  path?: string
): {
  latestArtifactId: string | null;
  resolvedPath?: string;
  lineagePath: LineageNode[];
  depth: number;
  isLoading: boolean;
  error: Error | null;
  hasLineage: boolean;
  originalArtifactId: string;
}
```

#### 3.3: Visual Lineage Indicators ✅

**Implementation**: Added visual indicators for edited ideas.

**UI Elements Added**:
- 📝 "已编辑版本" badge for ideas that have been edited
- Debug logging for lineage resolution tracking
- Proper loading states during resolution
- Error handling with fallback to original artifacts

### Phase 4: Testing & Validation

#### 4.1: End-to-End Testing

**Test Scenarios**:
1. **User edits idea manually** → Creates human transform → `ArtifactEditor` shows latest version
2. **Agent edits idea via chat** → Creates LLM transform → UI updates automatically  
3. **Mixed editing workflow** → Manual edit → Agent edit → Manual edit → All tracked correctly
4. **Multiple ideas edited** → Each maintains independent lineage
5. **Concurrent editing** → Race conditions handled gracefully

#### 4.2: Performance Testing

**Concerns**:
- Lineage resolution with large graphs
- Frontend re-rendering with many artifacts
- Database query optimization for complex lineages

#### 4.3: Error Handling

**Edge Cases**:
- Broken lineage chains
- Missing artifacts
- Corrupted transform data
- Network failures during resolution

## Technical Specifications

### Artifact Types & Lineage Flow

```
brainstorm_idea_collection (original)
├── [0] → human_transform → user_input (manual edit)
│   └── llm_transform → brainstorm_idea (agent edit)
│       └── human_transform → user_input (manual edit)
├── [1] → llm_transform → brainstorm_idea (agent edit)
│   └── llm_transform → brainstorm_idea (agent re-edit)
└── [2] → (unchanged)
```

### Lineage Resolution Algorithm

**Input**: `sourceArtifactId`, `path` (optional)
**Process**:
1. Build graph of all related artifacts and transforms
2. Find all paths from source artifact
3. For given path, traverse to deepest leaf node
4. Return the artifact at the leaf (most recent version)

**Example**:
```typescript
// User wants to edit idea [1] from collection abc123
const latest = await resolveLatestArtifact('abc123', '[1]');
// Returns: artifact xyz789 (if idea [1] was previously edited)
// Falls back to: abc123 with path [1] (if never edited)
```

### Error Handling Strategy

1. **Graceful Degradation**: If lineage resolution fails, fall back to original artifact
2. **User Feedback**: Clear error messages about what went wrong
3. **Logging**: Comprehensive logging for debugging lineage issues
4. **Recovery**: Ability to "reset" lineage and start fresh if needed

## Success Criteria

### Phase 1: ✅ COMPLETED
- [x] Agent can edit brainstorm ideas via chat
- [x] LLM transforms are properly tracked
- [x] Multiple editing rounds work correctly
- [x] Tool handles different artifact types
- [x] API endpoints are functional

### Phase 2: ✅ COMPLETED
- [x] Lineage resolution algorithm works with test data
- [x] Service layer integrates with repositories  
- [x] Comprehensive test suite passes
- [x] Performance is acceptable for expected data volumes

### Phase 3: ✅ COMPLETED
- [x] `DynamicBrainstormingResults` uses lineage resolution
- [x] `ArtifactEditor` always edits the latest version
- [x] UI shows edit history and lineage information
- [x] User experience is smooth and intuitive

### Phase 4: Future  
- [ ] End-to-end workflows work flawlessly
- [ ] Error handling is robust
- [ ] Performance meets requirements
- [ ] System is ready for production use

## Next Steps

**Currently completed**: Phase 2 - Lineage Resolution System ✅

**Completed tasks**:
1. ✅ Define lineage data structures and interfaces
2. ✅ Implement `buildLineageGraph` function with topological sorting
3. ✅ Implement `findLatestArtifact` function with path resolution
4. ✅ Create comprehensive test suite (9 test cases, all passing)
5. ✅ Optimize for performance (10ms build time, <1ms resolve time for 100-node chains)

**Ready for**: Phase 4 - Testing & Validation

**Phase 3 Implementation Summary**:
1. ✅ Created `useLineageResolution` hook in `src/client/hooks/useLineageResolution.ts`
2. ✅ Updated `DynamicBrainstormingResults.tsx` to resolve artifact lineages
3. ✅ Added visual indicators for edited ideas (📝 已编辑版本)
4. ✅ Integrated with `ProjectDataContext` for real-time data
5. ✅ Added debug logging and error handling
6. ✅ Maintained backward compatibility with existing workflows

The frontend now correctly resolves the latest version of each brainstorm idea and passes the resolved artifact ID to `ArtifactEditor`, ensuring users always edit the most recent version while maintaining full lineage tracking. 