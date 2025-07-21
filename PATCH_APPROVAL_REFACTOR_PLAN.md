# Patch Approval System Refactor - Implementation Plan

## Overview

✅ **COMPLETED** - Refactor the patch approval system to eliminate blocking tool execution and support multi-patch review in a flattened interface.

## Current Issues

1. **Blocking Tool Execution**: Tools wait for `patchApprovalEventBus.waitForPatchApproval()` which blocks entire agent execution
2. **Single Transform Focus**: PatchReviewModal only handles one `ai_patch` transform at a time
3. **Recovery Issues**: Server crashes leave `ai_patch` transforms in "running" state with no recovery mechanism
4. **Agent Context Loss**: Agent has no knowledge of patch content for context in subsequent responses

## Proposed Architecture

### 1. Non-Blocking Tool Execution

**Changes to BrainstormTools.ts:**
- Remove `waitForPatchApproval()` call
- Return actual patch content to agent for context
- Tool completes immediately after creating patch jsondocs
- Agent receives patch content in tool result for awareness

**Changes to OutlineSettingsTool.ts & ChroniclesTool.ts:**
- Same pattern: remove blocking wait
- Return patch content for agent context
- Immediate completion

### 2. Multi-Patch Flattened Modal

**Enhanced usePendingPatchApproval Hook:**
- Find ALL `ai_patch` transforms with lingering patches
- Flatten all patches from multiple transforms into single list
- Detect patches without `human_patch_approval` descendants

**Updated PatchReviewModal:**
- Display flattened list of all pending patches
- Individual patch approval/rejection
- Remove transform-centric grouping
- Show patch origin for context but don't group by it

### 3. Improved Pending Detection Logic

**Lingering Patch Detection:**
```typescript
// A patch is "lingering" if:
// 1. It's a json_patch jsondoc from an ai_patch transform
// 2. It has no human_patch_approval transform as descendant
// 3. The ai_patch transform is in 'running' status
```

## Implementation Steps

### Phase 1: Tool Return Value Changes

#### 1.1 Update BrainstormEditTool Return Schema
- **File**: `src/server/tools/BrainstormTools.ts`
- **Changes**:
  - Remove `waitForPatchApproval()` call (lines ~260)
  - Extract patch content from created patch jsondocs
  - Return patch content in tool result for agent context
  - Update return schema to include patch content

#### 1.2 Update Other Edit Tools
- **Files**: 
  - `src/server/tools/OutlineSettingsTool.ts`
  - `src/server/tools/ChroniclesTool.ts`
- **Changes**: Same pattern as BrainstormEditTool

#### 1.3 Update Tool Result Schemas
- **File**: `src/common/schemas/transforms.ts`
- **Changes**: Add patch content fields to tool result schemas

### Phase 2: Enhanced Pending Detection

#### 2.1 Update usePendingPatchApproval Hook
- **File**: `src/client/hooks/usePendingPatchApproval.ts`
- **Changes**:
  - Find ALL ai_patch transforms (not just first)
  - Collect patches from all transforms
  - Flatten into single array
  - Add patch origin metadata for context

#### 2.2 New Multi-Patch Data Structure
```typescript
interface PendingPatchItem {
  patchJsondoc: ElectricJsondoc;
  originalJsondoc: ElectricJsondoc;
  sourceTransformId: string;
  sourceTransformMetadata: any;
  patchIndex: number;
}

interface PendingPatchesState {
  patches: PendingPatchItem[];
  isLoading: boolean;
  error: Error | null;
}
```

### Phase 3: Flattened Modal Interface

#### 3.1 Update PatchReviewModal
- **File**: `src/client/components/PatchReviewModal.tsx`
- **Changes**:
  - Handle array of patches instead of single transform
  - Individual patch selection/approval
  - Remove transform grouping UI
  - Add patch origin context (subtle, not prominent)

#### 3.2 New Patch-Centric API Logic
- **File**: `src/server/routes/patchRoutes.ts` (new file)
- **Changes**:
  - Implement cascading deletion for patch rejection
  - Handle patches from multiple transforms in approval
  - Smart cleanup of orphaned ai_patch transforms

### Phase 4: API Refactoring

#### 4.1 New Patch-Centric Endpoints
- **File**: `src/server/routes/patchRoutes.ts` (new file)
- **Endpoints**:
  - `GET /api/patches/pending/:projectId` - Get all pending patches
  - `POST /api/patches/approve` - Approve selected patches
  - `POST /api/patches/reject` - Reject selected patches with cascading deletion

#### 4.2 Remove Old Transform Routes
- **File**: `src/server/routes/transformRoutes.ts`
- **Changes**: 
  - Remove `POST /:id/approve` endpoint
  - Remove `POST /:id/reject` endpoint
  - Remove patch approval event bus integration
  - Keep general transform CRUD operations

### Phase 5: Test Updates

#### 5.1 Update Tool Tests
- **Files**: 
  - `src/server/tools/__tests__/BrainstormEditTool.test.ts`
  - `src/server/tools/__tests__/EpisodePlanningTool.test.ts`
- **Changes**:
  - Remove approval waiting tests
  - Add patch content return tests
  - Test immediate completion

#### 5.2 Update Integration Tests
- **Files**:
  - `src/server/__tests__/agent-service-integration.test.ts`
  - `src/server/__tests__/end-to-end-workflow.test.ts`
- **Changes**:
  - Test non-blocking tool execution
  - Verify agent receives patch content
  - Test multi-patch scenarios

#### 5.3 New Patch Rejection Tests
- **File**: `src/server/__tests__/patch-rejection-cascading.test.ts` (new)
- **Tests**:
  - Simple patch rejection (delete patch, cleanup orphaned ai_patch)
  - Complex rejection with human edits (delete human transform tree first)
  - Multiple patches rejection from same transform
  - Mixed approval/rejection scenarios
  - Orphaned transform cleanup verification

#### 5.4 Node.js Test Scripts (using ./run-ts)
- **File**: `src/server/scripts/test-cascading-deletion.ts` (new)
- **Purpose**: Test cascading deletion logic with real database
- **Usage**: `./run-ts src/server/scripts/test-cascading-deletion.ts`

- **File**: `src/server/scripts/test-multi-patch-workflow.ts` (new)
- **Purpose**: Test complete multi-patch approval/rejection workflow
- **Usage**: `./run-ts src/server/scripts/test-multi-patch-workflow.ts`

- **File**: `src/server/scripts/test-non-blocking-tools.ts` (new)
- **Purpose**: Verify tools complete immediately and return patch content
- **Usage**: `./run-ts src/server/scripts/test-non-blocking-tools.ts`

#### 5.5 New Patch Modal Tests
- **File**: `src/client/components/__tests__/PatchReviewModal.test.tsx` (new)
- **Tests**:
  - Multi-patch rendering
  - Individual selection
  - Flattened display
  - Approval/rejection flows

#### 5.6 Remove Old Test Files
- **Files to Remove**:
  - `src/server/scripts/test-patch-approval-system.ts`
  - `src/server/scripts/test-real-patch-approval.ts`
  - `src/server/scripts/test-patch-approval-workflow.ts`
- **Update Existing Tests**:
  - Remove patch approval event bus mocks
  - Remove blocking approval test cases

### Phase 6: Documentation Updates

#### 6.1 Update Framework Documentation
- **File**: `TRANSFORM_JSONDOC_FRAMEWORK.md`
- **Changes**:
  - Document non-blocking patch approval
  - Update workflow diagrams
  - Add multi-patch examples

#### 6.2 Update Cursor Rules
- **File**: Project cursor rules
- **Changes**:
  - Document new patch approval patterns
  - Update testing guidelines
  - Remove references to PatchApprovalEventBus
  - Document cascading deletion patterns

## Detailed Implementation

### Tool Return Value Changes

**Before:**
```typescript
// Blocks until user approval
const approvalResult = await patchApprovalEventBus.waitForPatchApproval(result.transformId);
return { status: 'success', outputJsondocId: derivedJsondocId };
```

**After:**
```typescript
// Return immediately with patch content for agent context
const patchContent = await extractPatchContentForAgent(result.outputJsondocs);
return { 
  status: 'success', 
  outputJsondocId: result.transformId, // AI patch transform ID
  patchContent: patchContent, // For agent awareness
  patchCount: patchContent.length,
  message: `Created ${patchContent.length} patches for review. They will be applied after user approval.`
};
```

### Cascading Patch Rejection Logic

**Simple Patch Rejection:**
```typescript
async function rejectPatch(patchJsondocId: string) {
  // 1. Delete the patch jsondoc
  await jsondocRepo.deleteJsondoc(patchJsondocId);
  
  // 2. Find parent ai_patch transform
  const parentTransform = await findParentAiPatchTransform(patchJsondocId);
  
  // 3. Check if ai_patch transform has any remaining patch outputs
  const remainingPatches = await getTransformOutputs(parentTransform.id);
  
  // 4. If no remaining patches, delete the ai_patch transform
  if (remainingPatches.length === 0) {
    await transformRepo.deleteTransform(parentTransform.id);
  }
}
```

**Complex Rejection with Human Edits:**
```typescript
async function rejectPatchWithHumanEdits(patchJsondocId: string) {
  // 1. Find all human transforms that use this patch as input
  const humanTransforms = await findHumanTransformsUsingPatch(patchJsondocId);
  
  // 2. Recursively delete human transform trees (children first)
  for (const humanTransform of humanTransforms) {
    await deleteHumanTransformTree(humanTransform.id);
  }
  
  // 3. Now delete the original patch (same as simple rejection)
  await rejectPatch(patchJsondocId);
}

async function deleteHumanTransformTree(transformId: string) {
  // 1. Find all outputs of this human transform
  const outputs = await getTransformOutputs(transformId);
  
  // 2. For each output, find and delete any dependent transforms
  for (const output of outputs) {
    const dependentTransforms = await findTransformsUsingAsInput(output.jsondoc_id);
    for (const dependent of dependentTransforms) {
      await deleteHumanTransformTree(dependent.id); // Recursive
    }
    
    // 3. Delete the output jsondoc
    await jsondocRepo.deleteJsondoc(output.jsondoc_id);
  }
  
  // 4. Delete the transform itself
  await transformRepo.deleteTransform(transformId);
}
```

### Flattened Patch Detection

**New Logic:**
```typescript
// Find all ai_patch transforms with lingering patches
const pendingPatches = [];

for (const transform of aiPatchTransforms) {
  const patchOutputs = getTransformOutputs(transform.id);
  
  for (const patchJsondoc of patchOutputs) {
    // Check if this patch has human_patch_approval descendant
    const hasApproval = hasHumanPatchApprovalDescendant(patchJsondoc.id);
    
    if (!hasApproval) {
      pendingPatches.push({
        patchJsondoc,
        sourceTransformId: transform.id,
        sourceTransformMetadata: transform.execution_context
      });
    }
  }
}
```

### Agent Context Enhancement

**Agent Response Pattern:**
```typescript
// Agent now knows about patches and can reference them
const toolResult = await editTool.execute(params);
if (toolResult.patchContent) {
  agentResponse = `I've created ${toolResult.patchCount} patches to improve your story:
  
${toolResult.patchContent.map(p => `- ${p.description}: ${p.summary}`).join('\n')}

These changes are waiting for your review. You can approve or reject them individually in the review modal that will appear.`;
}
```

## Risk Assessment

### Low Risk
- Tool return value changes (internal API)
- Hook updates (contained changes)
- Test updates (no runtime impact)

### Medium Risk  
- Modal UI changes (user-facing)
- API endpoint changes (requires coordination)
- Agent response patterns (affects user experience)

### High Risk
- Database query changes (performance impact)
- Multi-patch approval logic (complex state management)
- Backward compatibility (existing pending patches)

## Migration Strategy

### Phase 1: Core System Changes
1. Implement new patch-centric endpoints with cascading deletion
2. Update tools to return patch content and remove blocking calls
3. Enhance detection logic for flattened multi-patch scenarios

### Phase 2: UI Migration
1. Update modal to handle flattened multi-patch scenarios
2. Test thoroughly with existing pending patches
3. Implement cascading rejection UI

### Phase 3: Complete Removal of Old System
1. **Remove PatchApprovalEventBus entirely**:
   - Delete `src/server/services/PatchApprovalEventBus.ts` (if exists)
   - Remove from `src/server/services/ParticleSystemInitializer.ts`
   - Remove `getPatchApprovalEventBus()` calls from all tools

2. **Remove old endpoints from transformRoutes**:
   - Delete `POST /:id/approve` endpoint
   - Delete `POST /:id/reject` endpoint  
   - Remove `deleteTransformRecursively` function (replace with new cascading logic)

3. **Remove blocking code from tools**:
   - Remove `waitForPatchApproval()` calls from BrainstormTools.ts
   - Remove `waitForPatchApproval()` calls from OutlineSettingsTool.ts
   - Remove patch approval event bus imports

4. **Clean up test files**:
   - Delete old patch approval test scripts
   - Remove event bus mocks from existing tests
   - Update test expectations for immediate completion

5. **Remove old transform status dependencies**:
   - Remove 'running' status checks for ai_patch transforms
   - Update status to 'completed' immediately after patch creation

## Success Criteria

✅ **ALL COMPLETED**

1. ✅ **Non-Blocking**: Agent execution never blocks on patch approval
2. ✅ **Multi-Patch**: Modal handles patches from multiple transforms in flattened view
3. ✅ **Context Awareness**: Agent can reference patch content in responses
4. ✅ **Recovery**: System handles server crashes gracefully
5. ✅ **Cascading Deletion**: Proper cleanup of patches and orphaned transforms
6. ✅ **Human Edit Handling**: Correctly delete human edit trees before patch deletion
7. ✅ **Performance**: No degradation in patch approval workflow
8. ✅ **Complete Removal**: Old blocking system completely removed

## Testing Strategy

### Unit Tests
- Tool return value validation
- Patch detection logic
- Modal rendering with various patch combinations
- Cascading deletion logic
- Human transform tree deletion

### Integration Tests  
- End-to-end agent workflows with patches
- Multi-patch approval scenarios
- Error recovery after server restart
- Complex rejection scenarios with human edits
- Orphaned transform cleanup verification

### Manual Testing
- Create patches, restart server, verify recovery
- Test with multiple concurrent ai_patch transforms
- Verify agent context awareness in responses
- Test patch rejection with and without human edits
- Verify complete cleanup of rejected patches

## Timeline Estimate

- **Phase 1-2**: 2-3 days (core functionality + cascading deletion)
- **Phase 3**: 1-2 days (UI updates + complete removal of old system)
- **Phase 4**: 1 day (API refactoring)
- **Phase 5**: 2-3 days (comprehensive test updates + new rejection tests)
- **Phase 6**: 0.5 day (documentation)

**Total**: 6.5-9.5 days

## Dependencies

- No external dependencies
- Requires coordination with frontend team for modal updates
- Database schema is already compatible
- Electric SQL sync should handle real-time updates automatically 