# ActionItemsSection Refactoring Implementation Plan

## Overview

Refactor all actionable items (forms, generate buttons) from individual components into a centralized `ActionItemsSection.tsx` component. The system will use a `computeParamsAndActions(lineageGraph)` function to determine available actions based on the current project state, following the existing linear progression logic where artifacts with descendants become non-actionable.

## Core Architecture

### 1. Global Selection State Management

**File**: `src/client/stores/actionItemsStore.ts`
```typescript
interface ActionItemsState {
  // Brainstorm idea selection (single select)
  selectedBrainstormIdea: {
    artifactId: string;
    originalArtifactId: string;
    artifactPath: string;
    index: number;
  } | null;
  
  // Form data persistence (auto-saved drafts)
  formData: {
    brainstormParams: BrainstormParams | null;
    outlineGenerationParams: OutlineGenerationParams | null;
  };
  
  // Actions
  setSelectedBrainstormIdea: (idea: SelectedBrainstormIdea | null) => void;
  updateFormData: (key: string, data: any) => void;
  clearFormData: (key: string) => void;
}
```

**Integration**: Use `useLocalStorage` for persistence with key `"action-items-state-${projectId}"`

### 2. Core Logic Functions

**File**: `src/client/utils/actionComputation.ts`

#### `computeParamsAndActions(projectData, lineageGraph)`
Pure function that analyzes the current project state and returns available actions following the linear progression logic:

```typescript
interface ActionItem {
  id: string;
  type: 'form' | 'button' | 'selection';
  title: string;
  description?: string;
  component: React.ComponentType<any>;
  props: Record<string, any>;
  enabled: boolean;
  priority: number; // For ordering
}

interface ComputedActions {
  actions: ActionItem[];
  currentStage: 'initial' | 'brainstorm_input' | 'brainstorm_selection' | 'idea_editing' | 'outline_generation' | 'chronicles_generation' | 'episode_generation';
  hasActiveTransforms: boolean;
}
```

#### Linear Progression Logic Implementation:
1. **Initial Stage**: No brainstorm input → Show creation buttons
2. **Brainstorm Input Stage**: Has input artifact (leaf node) → Show brainstorm form + generate button
3. **Brainstorm Selection Stage**: Has generated ideas, no chosen idea → Show idea selection
4. **Idea Editing Stage**: Has chosen idea (leaf node) → Show outline generation form
5. **Outline Generation Stage**: Has outline settings (leaf node) → Show chronicles generation
6. **Chronicles Generation Stage**: Has chronicles (leaf node) → Show episode generation
7. **Episode Generation Stage**: Has episodes → Show script generation

### 3. Action Components

**Directory**: `src/client/components/actions/`

#### Individual Action Components:
- `BrainstormCreationActions.tsx` - Creation buttons from ProjectCreationForm
- `BrainstormInputForm.tsx` - Form from BrainstormInputEditor
- `BrainstormIdeaSelection.tsx` - Selection UI for brainstorm ideas
- `OutlineGenerationForm.tsx` - Form from SingleBrainstormIdeaEditor
- `ChroniclesGenerationAction.tsx` - Button from OutlineSettingsDisplay
- `EpisodeGenerationAction.tsx` - New placeholder button

#### Form Components with Auto-Save:
Each form component will:
- Read initial data from `actionItemsStore.formData`
- Auto-save changes with debouncing (500ms)
- Validate before enabling submit buttons
- Clear form data after successful submission

### 4. Enhanced ActionItemsSection

**File**: `src/client/components/ActionItemsSection.tsx`

```typescript
const ActionItemsSection: React.FC = () => {
  const { projectId } = useParams();
  const projectData = useProjectData();
  const actionItemsStore = useActionItemsStore();
  
  // Compute available actions
  const { actions, currentStage, hasActiveTransforms } = useMemo(() => 
    computeParamsAndActions(projectData, projectData.lineageGraph),
    [projectData, projectData.lineageGraph]
  );
  
  // Show loading state during active transforms
  if (hasActiveTransforms) {
    return <LoadingActionItems />;
  }
  
  // Render actions in priority order
  return (
    <div className="action-items-section">
      {actions.map(action => (
        <ActionItemRenderer key={action.id} action={action} />
      ))}
    </div>
  );
};
```

## Detailed Refactoring Steps

### Phase 1: Setup Infrastructure

1. **Create Action Items Store**
   - `src/client/stores/actionItemsStore.ts`
   - Integrate with `useLocalStorage` for persistence
   - Add TypeScript interfaces for all form data types

2. **Create Action Computation Logic**
   - `src/client/utils/actionComputation.ts`
   - Implement `computeParamsAndActions` function
   - Add comprehensive tests for all workflow stages

3. **Create Action Components Directory**
   - `src/client/components/actions/`
   - Create base interfaces and shared utilities

### Phase 2: Extract and Refactor Actions

#### 2.1 ProjectCreationForm Actions
**Current**: Two creation buttons (brainstorm/manual)
**Target**: `BrainstormCreationActions.tsx`

**Changes**:
- Extract button logic from `ProjectCreationForm.tsx`
- Move to action components directory
- Remove original buttons, keep only display content
- Update `ProjectCreationForm.tsx` to be display-only

#### 2.2 BrainstormInputEditor Actions
**Current**: Form + "开始头脑风暴" button
**Target**: `BrainstormInputForm.tsx`

**Changes**:
- Extract form logic and validation
- Implement auto-save with debouncing
- Move brainstorm generation API call
- Update `BrainstormInputEditor.tsx` to show compact read-only view
- Store form data in `actionItemsStore.formData.brainstormParams`

#### 2.3 ProjectBrainstormPage Selection
**Current**: Direct human transform creation on click
**Target**: `BrainstormIdeaSelection.tsx`

**Changes**:
- Remove immediate human transform creation
- Add selection state management
- Show "Continue with Selected Idea" button in ActionItemsSection
- Update `BrainstormIdeaEditor.tsx` to show selection state
- Implement single-select with visual feedback

#### 2.4 SingleBrainstormIdeaEditor Actions
**Current**: Outline generation form + button
**Target**: `OutlineGenerationForm.tsx`

**Changes**:
- Extract form (episodes, duration, platform, requirements)
- Move outline generation mutation
- Remove action section from `SingleBrainstormIdeaEditor.tsx`
- Keep only editing interface and display content
- Store form data in `actionItemsStore.formData.outlineGenerationParams`

#### 2.5 OutlineSettingsDisplay Actions
**Current**: Chronicles generation button
**Target**: `ChroniclesGenerationAction.tsx`

**Changes**:
- Extract chronicles generation mutation
- Remove button from `OutlineSettingsDisplay.tsx`
- Keep only editing interface and display content

#### 2.6 ChroniclesDisplay Actions
**Current**: None (placeholder needed)
**Target**: `EpisodeGenerationAction.tsx`

**Changes**:
- Add placeholder "生成分集概要" button
- Prepare for future episode generation implementation

### Phase 3: Implement Lineage-Based Action Logic

#### 3.1 Artifact Leaf Node Detection
Implement helper functions to determine actionability:

```typescript
const isLeafNode = (artifactId: string, transformInputs: TransformInput[]): boolean => {
  return !transformInputs.some(input => input.artifact_id === artifactId);
};

const canBecomeEditable = (artifact: Artifact, transformInputs: TransformInput[]): boolean => {
  return isLeafNode(artifact.id, transformInputs) && artifact.origin_type === 'ai_generated';
};
```

#### 3.2 Stage Detection Logic
```typescript
const detectCurrentStage = (projectData: ProjectDataContextType): WorkflowStage => {
  // Check for brainstorm input artifact
  const brainstormInput = findBrainstormInputArtifact(projectData.artifacts);
  if (!brainstormInput) return 'initial';
  
  // Check if brainstorm input has been used (has descendants)
  if (!isLeafNode(brainstormInput.id, projectData.transformInputs)) {
    // Has generated ideas - check for chosen idea
    const chosenIdea = findChosenBrainstormIdea(projectData);
    if (!chosenIdea) return 'brainstorm_selection';
    
    // Has chosen idea - check for outline settings
    const outlineSettings = findLatestOutlineSettings(projectData);
    if (!outlineSettings) return 'idea_editing';
    
    // Continue progression...
  }
  
  return 'brainstorm_input';
};
```

### Phase 4: Update Component Interfaces

#### 4.1 Remove Action Props
Update components to remove action-related props:
- Remove `onIdeaClick` from `BrainstormIdeaEditor`
- Remove form submission handlers from various components
- Keep only display and editing functionality

#### 4.2 Add Selection State Display
Update components to show selection state:
- `BrainstormIdeaEditor`: Show selected state styling
- `ProjectBrainstormPage`: Show selection instructions
- `SingleBrainstormIdeaEditor`: Remove action forms

#### 4.3 Maintain Editing Capabilities
Ensure editing remains functional:
- `SingleBrainstormIdeaEditor`: Keep `ArtifactEditor` for idea editing
- `OutlineSettingsDisplay`: Keep all editing interfaces
- `ChronicleStageCard`: Keep stage editing functionality

### Phase 5: Testing and Integration

#### 5.1 Action Computation Tests
```typescript
describe('computeParamsAndActions', () => {
  it('should return creation actions for initial state', () => {
    const result = computeParamsAndActions(emptyProjectData, emptyLineageGraph);
    expect(result.currentStage).toBe('initial');
    expect(result.actions).toContainEqual(expect.objectContaining({
      type: 'button',
      id: 'create-brainstorm-input'
    }));
  });
  
  it('should return brainstorm form for input stage', () => {
    const projectDataWithInput = createProjectDataWithBrainstormInput();
    const result = computeParamsAndActions(projectDataWithInput, lineageGraph);
    expect(result.currentStage).toBe('brainstorm_input');
    expect(result.actions).toContainEqual(expect.objectContaining({
      type: 'form',
      id: 'brainstorm-input-form'
    }));
  });
  
  // ... more test cases for each stage
});
```

#### 5.2 Integration Tests
- Test full workflow progression through ActionItemsSection
- Verify form data persistence across navigation
- Test selection state management
- Verify no action buttons remain in original components

#### 5.3 Manual Testing Checklist
- [ ] Initial project creation works
- [ ] Brainstorm input form auto-saves
- [ ] Brainstorm generation triggers correctly
- [ ] Idea selection works with visual feedback
- [ ] Continue button creates human transform
- [ ] Outline generation form works
- [ ] Chronicles generation works
- [ ] All original editing capabilities preserved
- [ ] Form data persists across page refresh
- [ ] Selection state persists appropriately

## Implementation Timeline

### Week 1: Infrastructure Setup
- [ ] Create action items store with localStorage integration
- [ ] Implement `computeParamsAndActions` function
- [ ] Create action components directory structure
- [ ] Set up testing framework for action logic

### Week 2: Extract Actions (Phase 2.1-2.3)
- [ ] Refactor ProjectCreationForm actions
- [ ] Refactor BrainstormInputEditor actions
- [ ] Refactor ProjectBrainstormPage selection logic
- [ ] Update ActionItemsSection to render extracted actions

### Week 3: Extract Actions (Phase 2.4-2.6)
- [ ] Refactor SingleBrainstormIdeaEditor actions
- [ ] Refactor OutlineSettingsDisplay actions
- [ ] Add ChroniclesDisplay placeholder action
- [ ] Implement form data auto-save

### Week 4: Testing and Polish
- [ ] Comprehensive testing of all stages
- [ ] Fix any remaining UI/UX issues
- [ ] Verify editing capabilities preserved
- [ ] Performance optimization and cleanup

## Key Considerations

### 1. Backward Compatibility
- All existing editing functionality must be preserved
- No breaking changes to artifact/transform system
- Maintain all current keyboard shortcuts and interactions

### 2. Performance
- Use `useMemo` for expensive action computations
- Debounce form auto-save appropriately
- Minimize re-renders in ActionItemsSection

### 3. User Experience
- Smooth transitions between workflow stages
- Clear visual feedback for selections and form states
- Intuitive action organization and prioritization
- Preserve all current navigation capabilities

### 4. Error Handling
- Graceful degradation when action computation fails
- Clear error messages for failed actions
- Fallback to original component behavior if needed

### 5. Accessibility
- Maintain keyboard navigation
- Proper ARIA labels for dynamic action items
- Screen reader compatibility for selection states

## Success Criteria

1. **Functional**: All current workflows work identically
2. **Centralized**: All actions appear only in ActionItemsSection
3. **Persistent**: Form data and selections survive page refresh
4. **Linear**: Actions follow strict linear progression logic
5. **Maintainable**: New actions can be easily added to the system
6. **Tested**: Comprehensive test coverage for all action logic 