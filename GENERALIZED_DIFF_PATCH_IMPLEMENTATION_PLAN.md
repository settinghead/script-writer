# Generalized Diff Patch Implementation Plan

## Executive Summary

This plan outlines the implementation of a generalized diff patch mechanism that enables all jsondocs to be editable via click-to-edit, automatically detects affected downstream jsondocs when edits are made, and provides batch auto-correction capabilities.

## Design Decisions

Based on user preferences:
1. **Stale Detection Scope**: Direct children only (immediate AI-transform outputs)
2. **Generic Diff Tool**: Single GenericEditTool with auto-generated templates from Zod schemas
3. **Auto-fix Strategy**: Batch processing with bulk approval
4. **Terminology**: "受影响" (Affected) for stale jsondocs
5. **Brainstorm Collection Edit**: Disabled when an idea is already chosen

## Current System Analysis

### 1. Current Editing Rules (`src/client/utils/componentState.ts`)

The current system determines editability based on:

```typescript
ComponentState {
  EDITABLE           // user_input origin, no descendants
  CLICK_TO_EDIT      // ai_generated origin, no descendants, parent transform complete
  READ_ONLY          // has descendants
  PENDING_PARENT_TRANSFORM  // parent transform not complete
}
```

**Key Rules:**
- AI-generated jsondocs become editable only if they have no descendants
- User-input jsondocs are directly editable if they have no descendants
- Any jsondoc with descendants is read-only (immutability preservation)

### 2. Current Click-to-Edit Mechanism

**Flow:**
1. User clicks AI-generated content → `JsondocDisplayWrapper.handleCreateEditableVersion()`
2. POST `/api/jsondocs/:id/human-transform` creates human transform
3. Human transform produces new `user_input` jsondoc
4. UI switches to display the new editable jsondoc

**Current Transform Names:**
- `edit_brainstorm_input_params`
- `edit_灵感创意`
- `edit_剧本设定`
- `edit_chronicles`
- `edit_分集结构`
- `edit_单集大纲`
- `edit_单集剧本`

### 3. Current Diff Generation System

**Unified Diff Flow:**
1. Template renders with line-numbered JSON + edit requirements
2. LLM generates unified diff text
3. `parseUnifiedDiff()` → structured hunks
4. `applyHunksToText()` → modified JSON (with fuzzy matching)
5. `rfc6902.createPatch()` → RFC6902 patches
6. Patches stored as `json_patch` jsondocs
7. Approval applies patches to create derived jsondoc

**Template Structure (`unifiedDiffBase.ts`):**
- Zod schema → JSON Schema for validation
- Instructions for unified diff format
- Line-numbered current content
- User's edit requirements

### 4. Current Lineage Graph Traversal

**Key Functions:**
- `hasJsondocDescendants()`: Check if jsondoc is used as input elsewhere
- `findLatestJsondoc()`: Traverse to find leaf nodes
- `traceForwardFromJsondoc()`: Find downstream jsondocs
- `computeCanonicalJsondocsFromLineage()`: Determine active/canonical jsondocs

### 5. Current Agent/Intent System

**Intent Shortcuts (`IntentShortcutService`):**
- Bypass LLM for known patterns
- Direct tool execution with resolved parameters
- Currently supports: `create_brainstorm`, `select_idea`, etc.

**Agent Auto-routing (`ChatService`):**
- Checks for intent metadata in user messages
- Routes to intent shortcuts when available
- Falls back to LLM agent for complex requests

## What Needs to Change

### 1. ✅ Component State Rules Modification

**File:** `src/client/utils/componentState.ts`

**Changes:**
- [ ] Remove "has descendants" check for click-to-edit eligibility
- [ ] Add special case for brainstorm collections when idea is chosen
- [ ] All AI-generated jsondocs become click-to-edit (except special cases)
- [ ] Maintain read-only for pending parent transforms

**New Logic:**
```typescript
// Pseudo-code
if (jsondoc.origin_type === 'ai_generated') {
  if (isBrainstormCollection && hasChosenIdea) {
    return READ_ONLY; // Special case
  }
  if (parentTransform?.status !== 'completed') {
    return PENDING_PARENT_TRANSFORM;
  }
  return CLICK_TO_EDIT; // Always allow click-to-edit
} else if (jsondoc.origin_type === 'user_input') {
  return EDITABLE; // Always directly editable
}
```

### 2. ✅ Automatic Human Transform Creation

**File:** `src/client/transform-jsondoc-framework/components/JsondocDisplayWrapper.tsx`

**Changes:**
- [ ] Modify `handleCreateEditableVersion` to check if editable version exists
- [ ] If no human transform exists, create it automatically
- [ ] If human transform exists but no edits, switch to existing derived jsondoc

### 3. ✅ Stale Detection System

**New File:** `src/common/staleDetection.ts`

**Implementation:**
```typescript
export interface DiffChange {
  jsondocId: string;
  path: string;
  before: any;
  after: any;
}

export interface AffectedJsondoc {
  jsondocId: string;
  schemaType: string;
  reason: string;
  affectedPaths?: string[];
  severity: 'high' | 'medium' | 'low';
}

export async function computeStaleJsondocs(
  diffs: DiffChange[],
  lineageGraph: LineageGraph,
  jsondocs: ElectricJsondoc[]
): Promise<AffectedJsondoc[]>
```

**Algorithm:**
1. For each edited jsondoc in diffs
2. Find direct children via lineage graph edges
3. Filter to AI-generated jsondocs only (not user edits)
4. Mark as affected with reason and severity
5. Return list of affected jsondocs

### 4. ✅ Generic Edit Tool

**New File:** `src/server/tools/GenericEditTool.ts`

**Features:**
- [ ] Dynamic template generation from Zod schemas
- [ ] Schema-aware field descriptions
- [ ] Type-specific edit instructions
- [ ] Automatic validation rules

**Implementation:**
```typescript
export function createGenericEditTool(
  schemaType: string,
  schema: z.ZodSchema,
  jsondocRepo: TransformJsondocRepository,
  transformRepo: TransformJsondocRepository,
  projectId: string,
  userId: string
): StreamingToolDefinition
```

### 5. ✅ UI Components for Affected Jsondocs

**New Component:** `src/client/components/AffectedJsondocsPanel.tsx`

**Features:**
- [ ] List of affected jsondocs with reasons
- [ ] Severity indicators (color coding)
- [ ] "自动修正" button for batch processing
- [ ] Progress indicator during auto-fix
- [ ] Patch approval interface

**Integration Points:**
- [ ] Add to `ActionItemsSection.tsx`
- [ ] Subscribe to jsondoc edit events (debounced)
- [ ] Update when lineage changes

### 6. ✅ Batch Auto-Fix System

**New File:** `src/server/services/BatchAutoFixService.ts`

**Features:**
- [ ] Parallel patch generation for multiple jsondocs
- [ ] Progress tracking via SSE/WebSocket
- [ ] Batch approval endpoint
- [ ] Rollback capability

**Flow:**
1. Receive list of affected jsondoc IDs
2. Generate patches in parallel using GenericEditTool
3. Stream progress updates to UI
4. Present all patches for approval
5. Apply approved patches in dependency order

### 7. ✅ Intent Shortcut for Auto-Fix

**File:** `src/server/services/IntentParameterResolver.ts`

**New Intent:** `auto_fix_affected`

**Parameters:**
- `affectedJsondocIds`: Array of jsondoc IDs
- `editContext`: Original edits that caused the changes
- `autoApprove`: Boolean for skip approval (false by default)

## Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Create `staleDetection.ts` with core algorithm
- [ ] Write comprehensive tests for stale detection
- [ ] Modify `componentState.ts` editing rules
- [ ] Test new editing rules don't break existing features

### Phase 2: Generic Diff Tool (Week 1-2)
- [ ] Create `GenericEditTool.ts` with schema introspection
- [ ] Implement dynamic template generation
- [ ] Add schema-specific edit instructions
- [ ] Test with all existing jsondoc types
- [ ] Create registry for schema → tool mapping

### Phase 3: UI Integration (Week 2)
- [ ] Create `AffectedJsondocsPanel.tsx` component
- [ ] Integrate with `ActionItemsSection.tsx`
- [ ] Add debounced stale detection on edits
- [ ] Implement "自动修正" button and loading states
- [ ] Add Chinese translations for UI elements

### Phase 4: Batch Processing (Week 2-3)
- [ ] Create `BatchAutoFixService.ts`
- [ ] Implement parallel patch generation
- [ ] Add progress tracking system
- [ ] Create batch approval endpoint
- [ ] Add patch preview UI component

### Phase 5: Testing & Polish (Week 3)
- [ ] End-to-end testing of complete flow
- [ ] Performance testing with large projects
- [ ] Error handling and recovery
- [ ] Documentation updates
- [ ] Migration guide for existing projects

## Rationale

### Why Direct Children Only for Stale Detection?

1. **Predictability**: Users can understand the immediate impact of their edits
2. **Performance**: Avoids cascading updates through entire lineage tree
3. **Control**: Users can choose which downstream effects to propagate
4. **Incremental**: Can expand scope later based on user feedback

### Why Generic Tool Over Type-Specific Tools?

1. **Maintainability**: Single tool to maintain vs. many specialized tools
2. **Consistency**: Uniform editing experience across all jsondoc types
3. **Extensibility**: New jsondoc types automatically supported
4. **Schema-Driven**: Leverages existing Zod schemas for validation

### Why Batch Processing for Auto-Fix?

1. **Efficiency**: Parallel processing reduces total wait time
2. **Context**: User sees all changes before approval
3. **Atomicity**: Can approve/reject as a coherent set
4. **Undo**: Easier to rollback batch operations

## Risk Mitigation

### Risk 1: Breaking Existing Workflows
**Mitigation**: 
- Feature flag for gradual rollout
- Maintain backward compatibility
- Extensive testing of edge cases

### Risk 2: Performance Impact
**Mitigation**:
- Debounced stale detection
- Lazy loading of affected jsondocs
- Caching of lineage traversals
- Progressive UI updates

### Risk 3: User Confusion
**Mitigation**:
- Clear visual indicators for affected content
- Tooltips explaining why content is affected
- Option to disable auto-detection
- Comprehensive user documentation

## Success Metrics

1. **Functionality**
   - All jsondoc types editable via click-to-edit
   - Affected jsondocs correctly identified
   - Auto-fix generates valid patches

2. **Performance**
   - Stale detection < 100ms for typical project
   - Batch auto-fix < 5s for 10 jsondocs
   - No UI lag during editing

3. **User Experience**
   - Reduced clicks to edit content
   - Clear understanding of edit impacts
   - Successful auto-fix rate > 90%

## Next Steps

1. Review and approve this implementation plan
2. Create feature branch `feature/generalized-diff-patch`
3. Begin Phase 1 implementation
4. Weekly progress reviews
5. User testing after Phase 3

## Appendix: Example Scenarios

### Scenario 1: Edit Story Idea
1. User clicks on AI-generated 灵感创意
2. System creates human transform → editable version
3. User changes plot
4. System detects 剧本设定 is affected
5. User clicks "自动修正"
6. System generates patch for 剧本设定
7. User approves patch
8. 剧本设定 updated to match new plot

### Scenario 2: Edit Chronicle
1. User edits chronicles timeline
2. System detects 分集结构 is affected
3. Multiple episode structures marked as affected
4. User clicks "自动修正"
5. System generates patches for all episodes in parallel
6. User reviews and approves patches
7. All episodes updated consistently

### Scenario 3: Brainstorm Collection Special Case
1. User has already chosen and edited an idea
2. Brainstorm collection shows as read-only
3. No click-to-edit available (prevents confusion)
4. User can still view collection content
5. Clear message explains why editing is disabled
