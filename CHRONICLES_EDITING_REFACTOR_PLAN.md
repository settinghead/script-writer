# Chronicles Editing Refactor Plan

## Overview

This document outlines the refactoring plan to migrate Chronicles editing from individual stage editing to whole-document editing, aligning with the YJS collaborative editing system and maintaining consistency with other artifact editors (brainstorm ideas, outline settings).

## Current State Analysis

### Current Implementation
- **ChroniclesDisplay.tsx**: Renders individual `ChronicleStageCard` components
- **ChronicleStageCard**: Uses `ChronicleStageWrapper` for stage-by-stage editing
- **Individual Stage Editing**: Each stage can be edited via human transforms with paths like `$.stages[0]`
- **EditableChronicleStageForm**: Component for editing individual stages
- **Complex Lineage**: Stage-specific lineage resolution and transform management

### Problems with Current Approach
1. **Inconsistent UX**: Different editing pattern from other artifacts
2. **Complex Lineage Management**: Individual stage transforms create complex dependency chains
3. **YJS Integration Issues**: Stage-by-stage editing doesn't leverage YJS collaborative features effectively
4. **UI Inconsistency**: Different styling and interaction patterns

## Target Implementation

### Desired State
- **Whole-Document Editing**: Edit entire chronicles document as a single unit
- **Click-to-Edit Pattern**: Consistent with `SingleBrainstormIdeaEditor.tsx` and `OutlineSettingsDisplay.tsx`
- **YJS Integration**: Full collaborative editing support for the complete document
- **Stage Management**: Add/remove stages dynamically within the editor
- **Consistent UI**: Same styling and interaction patterns across all artifacts

### Benefits
1. **Consistency**: All artifacts use the same editing pattern
2. **Simplicity**: No complex stage-by-stage lineage management
3. **Better UX**: Single edit mode for the entire document
4. **YJS Integration**: Full collaborative editing support
5. **Flexibility**: Easy to add/remove stages within the editor

## Implementation Plan

### Phase 1: Create New Components

#### 1.1 Create EditableChroniclesForm.tsx
**Location**: `src/client/components/shared/EditableChroniclesForm.tsx`

**Requirements**:
- Edit entire chronicles document using YJS
- Include stage management (add/remove stages)
- Use YJS fields for all chronicle properties
- Similar structure to `EditableOutlineForm.tsx` but for chronicles schema

**Key Features**:
```typescript
interface EditableChroniclesFormProps {
  // No props needed - gets data from YJSArtifactContext
}

// Key functionality:
- YJS-enabled editing for all chronicle fields
- Dynamic stage management (add/remove stages)
- Stage reordering capabilities
- Consistent styling with other artifact editors
```

**Stage Management Features**:
- Add new stage button
- Remove stage button for each stage
- Stage reordering (drag & drop or up/down buttons)
- Stage numbering updates automatically

#### 1.2 Update ChroniclesDisplay.tsx
**Requirements**:
- Remove individual `ChronicleStageCard` rendering
- Implement the same pattern as `SingleBrainstormIdeaEditor.tsx`
- Use `ArtifactDisplayWrapper` for consistent UI

**Three Display Modes**:
1. **Read-only Mode**: Gray border, shows "已被后续步骤使用，不可编辑" or "当前阶段不可编辑"
2. **Click-to-Edit Mode**: Blue border, shows "点击编辑" with edit button
3. **Editable Mode**: Green border, shows YJS-enabled editing form

### Phase 2: Update Action Computation Logic

#### 2.1 Update actionComputation.ts
**Requirements**:
- Modify chronicles editability logic for document-level editing
- Remove stage-specific lineage resolution
- Apply same logic used for brainstorm ideas and outline settings

**Changes Needed**:
```typescript
// In computeDisplayComponentsFromContext function
case 'chronicles_generation':
  // Show chronicles with document-level editability
  if (context.canonicalChronicles) {
    const isChroniclesLeafNode = isLeafNode(context.canonicalChronicles.id, context.transformInputs);
    const isChroniclesEditable = !context.hasActiveTransforms &&
      isChroniclesLeafNode &&
      context.canonicalChronicles.origin_type === 'user_input';

    components.push({
      id: 'chronicles-display',
      component: getComponentById('chronicles-display'),
      mode: context.hasActiveTransforms ? 'readonly' : 'editable',
      props: {
        chronicles: context.canonicalChronicles,
        isEditable: isChroniclesEditable,
        currentStage: context.currentStage
      },
      priority: 5
    });
  }
  break;
```

#### 2.2 Create Unit Tests
**Location**: `src/client/utils/__tests__/actionComputation.chronicles.test.ts`

**Test Cases**:
1. **Chronicles Editability Logic**:
   - Test when chronicles is editable (user_input + leaf node + no active transforms)
   - Test when chronicles is click-to-edit (ai_generated + leaf node + no active transforms)
   - Test when chronicles is read-only (has descendants or active transforms)

2. **Display Component Generation**:
   - Test correct component props for each mode
   - Test priority ordering
   - Test stage-specific behavior

3. **Workflow Stage Detection**:
   - Test chronicles_generation stage detection
   - Test interaction with other stages
   - Test hasActiveTransforms logic

**Sample Test Structure**:
```typescript
describe('Chronicles Editing Logic', () => {
  describe('editability determination', () => {
    it('should make chronicles editable when user_input and leaf node', () => {
      // Test implementation
    });

    it('should make chronicles click-to-edit when ai_generated and leaf node', () => {
      // Test implementation
    });

    it('should make chronicles read-only when has descendants', () => {
      // Test implementation
    });

    it('should disable chronicles when transforms are active', () => {
      // Test implementation
    });
  });

  describe('display component generation', () => {
    it('should generate correct props for editable mode', () => {
      // Test implementation
    });

    it('should generate correct props for click-to-edit mode', () => {
      // Test implementation
    });

    it('should generate correct props for read-only mode', () => {
      // Test implementation
    });
  });
});
```

### Phase 3: Create YJS Chronicles Schema Support

#### 3.1 Chronicles Schema Definition
**Location**: `src/common/schemas/artifacts.ts`

**Ensure Chronicles Schema Includes**:
```typescript
export const ChroniclesSchema = z.object({
  stages: z.array(z.object({
    title: z.string(),
    stageSynopsis: z.string(),
    event: z.string().optional(),
    emotionArcs: z.array(z.object({
      characters: z.array(z.string()),
      content: z.string()
    })).optional(),
    relationshipDevelopments: z.array(z.object({
      characters: z.array(z.string()),
      content: z.string()
    })).optional(),
    insights: z.array(z.string()).optional()
  }))
});
```

#### 3.2 YJS Field Components
**Requirements**:
- Ensure YJS components can handle chronicles structure
- Add stage array management capabilities
- Support for nested objects within stages

### Phase 4: Remove Legacy Components

#### 4.1 Components to Remove
- `ChronicleStageWrapper.tsx`
- `EditableChronicleStageForm.tsx`
- `ChronicleStageCard.tsx`
- Any stage-specific lineage resolution utilities

#### 4.2 Clean Up References
- Remove imports and usage of removed components
- Update component registry if needed
- Clean up any stage-specific routing or navigation

### Phase 5: Update UI Components and Styling

#### 5.1 Consistent Styling
**Color Scheme**:
- **Editable Mode**: Green border (`#52c41a`)
- **Click-to-Edit Mode**: Blue border (`#1890ff`)
- **Read-Only Mode**: Gray border (`#555`)
- **Disabled Mode**: Gray border with opacity (`#666` with `opacity: 0.6`)

#### 5.2 Visual Indicators
- **Editable**: ✏️ icon with "编辑时间顺序大纲"
- **Click-to-Edit**: 🤖 icon with "AI生成 • 点击编辑"
- **Read-Only**: 📖 icon with appropriate status message
- **Disabled**: ⏳ icon with "正在处理中，请稍候..."

### Phase 6: Testing Strategy

#### 6.1 Unit Tests
**actionComputation.ts Tests**:
- Chronicles editability logic
- Display component generation
- Workflow stage integration
- Edge cases and error handling

#### 6.2 Integration Tests
**Chronicles Editing Workflow**:
- Read-only display
- Click-to-edit transformation
- YJS collaborative editing
- Stage management (add/remove)
- Save and persistence

#### 6.3 Manual Testing Scenarios
1. **Fresh Chronicles**: AI-generated → Click-to-edit → Edit mode
2. **Existing Chronicles**: User-edited → Direct edit mode
3. **Chronicles with Descendants**: Read-only mode
4. **Active Transforms**: Disabled mode
5. **Stage Management**: Add/remove stages, reordering
6. **Collaborative Editing**: Multiple users editing simultaneously

## Implementation Timeline

### Week 1: Foundation
- [ ] Create `EditableChroniclesForm.tsx`
- [ ] Update `ChroniclesDisplay.tsx` basic structure
- [ ] Set up unit test framework

### Week 2: Core Functionality
- [ ] Implement YJS integration for chronicles
- [ ] Add stage management features
- [ ] Update action computation logic

### Week 3: Testing and Refinement
- [ ] Complete unit tests
- [ ] Integration testing
- [ ] UI polish and consistency

### Week 4: Cleanup and Documentation
- [ ] Remove legacy components
- [ ] Update documentation
- [ ] Final testing and deployment

## Risk Mitigation

### Potential Issues
1. **Data Migration**: Existing stage-specific transforms need handling
2. **YJS Schema Changes**: Chronicles structure changes may affect YJS
3. **Performance**: Large chronicles documents may impact YJS performance
4. **User Experience**: Transition from stage-by-stage to whole-document editing

### Mitigation Strategies
1. **Backward Compatibility**: Ensure existing data still works
2. **Gradual Migration**: Feature flags for gradual rollout
3. **Performance Testing**: Test with large documents
4. **User Training**: Clear UI indicators and help text

## Success Criteria

### Technical Success
- [ ] All artifacts use consistent editing patterns
- [ ] YJS integration works seamlessly
- [ ] Unit tests pass with >90% coverage
- [ ] No performance regressions

### User Experience Success
- [ ] Intuitive editing workflow
- [ ] Consistent UI across all artifacts
- [ ] Smooth transitions between modes
- [ ] Collaborative editing works correctly

### Business Success
- [ ] Reduced development complexity
- [ ] Easier maintenance and debugging
- [ ] Better user satisfaction
- [ ] Foundation for future features

## Conclusion

This refactoring will significantly improve the chronicles editing experience by:
1. Aligning with established patterns in the codebase
2. Leveraging YJS for better collaborative editing
3. Simplifying the codebase and reducing complexity
4. Providing a consistent user experience across all artifact types

The implementation should be done incrementally with thorough testing at each phase to ensure a smooth transition and maintain system stability. 