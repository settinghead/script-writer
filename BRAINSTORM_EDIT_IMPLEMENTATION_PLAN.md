# Brainstorm Idea Editing System Implementation Plan

## Context & Rationale

The current script-writer application has a robust brainstorm system that generates story ideas using AI. However, users currently can only edit these ideas through manual human transforms that create `user_input` artifacts. We need to enhance this system to allow **AI-powered editing** of brainstorm ideas through an agent-driven interface.

### Current System Overview

The existing brainstorm system works as follows:
1. **Initial Generation**: Agent creates `brainstorm_idea_collection` artifact containing multiple story ideas
2. **Manual Editing**: Users can edit individual ideas through `ArtifactEditor`, which creates human transforms and `user_input` artifacts
3. **Simple Lineage**: Currently only supports one level of human editing (original → human_transform → user_input)

### Problems with Current System

1. **Limited AI Integration**: Users cannot ask the AI to improve or modify existing ideas
2. **Simple Lineage**: No support for complex transformation chains (AI edit → human edit → AI edit)
3. **Context Loss**: Agent has no awareness of existing brainstorm ideas when making edits
4. **Manual Process**: All edits require manual typing rather than natural language instructions

## Proposed Solution

We will implement a **multi-phase enhancement** that adds:

1. **LLM-powered brainstorm editing tool** for the agent
2. **Complex lineage resolution system** to handle transformation chains
3. **Agent context enrichment** with existing brainstorm ideas
4. **Dynamic lineage tracking** in the UI components

### Example Use Cases

**Simple Edit Request:**
```
User: "Make the first idea more romantic"
Agent: Analyzes current ideas → Calls edit tool with detailed requirements → Creates new brainstorm_idea artifact
```

**Complex Lineage Chain:**
```
brainstorm_collection[0] "复仇公主"
  → human_transform → user_input (user edited title)
  → llm_transform(edit) → brainstorm_idea (AI improved plot)
  → human_transform → user_input (user refined ending)
  → llm_transform(edit) → brainstorm_idea (AI enhanced romance)
```

**Agent Context Awareness:**
```
Agent Prompt: "Current brainstorm ideas:
1. 复仇公主 (latest: AI-enhanced with romance) - A princess seeks revenge...
2. 商战精英 (original) - A business elite discovers...
3. 时空恋人 (user-edited) - A time traveler meets...

User wants to: 'make the first story less violent'"
```

## Implementation Plan

### Phase 1: LLM Edit Tool & Agent Integration

**Goal**: Create the core LLM transform for editing brainstorm ideas and integrate it with the agent framework.

#### 1.1 Create LLM Transform Definition

**File**: `src/common/schemas/transforms.ts`
- Add new transform definition for `llm_edit_brainstorm_idea`
- Define input/output schemas and validation rules

#### 1.2 Create LLM Edit Template

**File**: `src/server/services/templates/brainstormEdit.ts`
- Create prompt template for editing existing brainstorm ideas
- Include context about original idea and editing requirements
- Ensure output follows 去脸谱化 (de-stereotyping) guidelines

#### 1.3 Create Brainstorm Edit Tool

**File**: `src/server/tools/BrainstormEditTool.ts`
- Implement `StreamingToolDefinition` for brainstorm editing
- Handle input validation (artifactId, ideaIndex, editRequirements)
- Create LLM transform and new `brainstorm_idea` artifact
- Follow existing patterns from `BrainstormTool.ts`

#### 1.4 Integrate with Agent Service

**File**: `src/server/services/AgentService.ts`
- Add brainstorm edit tool to available tools
- Update agent prompt to recognize edit requests
- Add context enrichment for existing brainstorm ideas

#### 1.5 Add Agent Tool Registry

**File**: `src/server/services/StreamingAgentFramework.ts`
- Update agent instructions to handle brainstorm editing requests
- Add keyword detection for edit vs. create operations

### Phase 2: Lineage Resolution System

**Goal**: Create a robust system for resolving complex artifact transformation chains.

#### 2.1 Create Lineage Resolution Utilities

**File**: `src/common/utils/lineageResolution.ts`
- Pure functions for traversing artifact → transform → artifact chains
- Handle multiple types of transforms (human, llm)
- Support path-based resolution (e.g., `[0]` for first brainstorm idea)

**Core Functions**:
```typescript
interface LineageNode {
  artifactId: string;
  artifactType: string;
  transformId?: string;
  transformType?: 'human' | 'llm';
  path?: string;
}

// Resolve the latest artifact in a lineage chain
function resolveLatestArtifact(
  startArtifactId: string, 
  path: string,
  artifacts: ElectricArtifact[],
  transforms: ElectricTransform[],
  humanTransforms: ElectricHumanTransform[],
  transformInputs: ElectricTransformInput[],
  transformOutputs: ElectricTransformOutput[]
): LineageNode | null

// Get full lineage chain for debugging/display
function getFullLineageChain(
  startArtifactId: string,
  path: string,
  // ... same params
): LineageNode[]

// Validate that a lineage chain is valid
function validateLineageChain(chain: LineageNode[]): boolean
```

#### 2.2 Create Comprehensive Tests

**File**: `src/common/utils/__tests__/lineageResolution.test.ts`
- Test simple chains: original → human → user_input
- Test complex chains: original → human → user_input → llm → brainstorm_idea → human → user_input
- Test branching scenarios and error cases
- Test path-based resolution for different indices

**Test Scenarios**:
```typescript
describe('Lineage Resolution', () => {
  test('simple human edit chain', () => {
    // brainstorm_collection[0] → human_transform → user_input
  });
  
  test('complex multi-step chain', () => {
    // brainstorm_collection[0] → human → user_input → llm → brainstorm_idea → human → user_input
  });
  
  test('multiple ideas with different lineages', () => {
    // [0] has complex chain, [1] is original, [2] has simple edit
  });
  
  test('broken lineage handling', () => {
    // Missing artifacts, circular references, etc.
  });
});
```

#### 2.3 Add Context Translation Utilities

**File**: `src/common/utils/contextTranslation.ts`
- Convert artifact/transform graph to LLM-friendly context
- Extract brainstorm ideas with their current state
- Create human-readable descriptions of editing history

```typescript
interface BrainstormContextItem {
  index: number;
  title: string;
  body: string;
  status: 'original' | 'user-edited' | 'ai-enhanced' | 'multi-edited';
  editHistory: string; // Human-readable description
}

function translateBrainstormContext(
  projectArtifacts: ElectricArtifact[],
  // ... other params
): BrainstormContextItem[]
```

### Phase 3: UI Integration & Dynamic Lineage

**Goal**: Update the frontend components to use lineage resolution and display the editing capabilities.

#### 3.1 Update DynamicBrainstormingResults

**File**: `src/client/components/DynamicBrainstormingResults.tsx`
- Add lineage resolution for each brainstorm idea
- Pass resolved artifact IDs to `ArtifactEditor`
- Show lineage status indicators (original, edited, AI-enhanced)
- Keep `ArtifactEditor` props unchanged for compatibility

**Key Changes**:
```typescript
// For each idea, resolve the latest artifact
const resolvedArtifactId = useMemo(() => {
  return resolveLatestArtifact(
    idea.artifactId,
    `[${index}]`,
    projectData.artifacts,
    projectData.transforms,
    projectData.humanTransforms,
    projectData.transformInputs,
    projectData.transformOutputs
  )?.artifactId || idea.artifactId;
}, [idea.artifactId, index, projectData]);

// Pass resolved ID to ArtifactEditor
<ArtifactEditor
  artifactId={resolvedArtifactId}
  path="" // Empty since we resolved to the final artifact
  transformName="edit_brainstorm_idea"
  // ... other props
/>
```

#### 3.2 Add Lineage Status Indicators

- Visual indicators showing edit history
- Tooltips explaining the transformation chain
- Different colors/icons for different artifact types

#### 3.3 Update Chat Integration

**File**: `src/server/services/ChatService.ts`
- Add brainstorm context translation to agent messages
- Include current brainstorm state in agent prompts
- Handle edit tool responses in chat interface

### Phase 4: Testing & Validation

**Goal**: Ensure the entire system works correctly with comprehensive testing.

#### 4.1 Integration Tests

**File**: `src/server/scripts/test-brainstorm-edit-flow.ts`
- Test complete flow: brainstorm → edit via agent → lineage resolution
- Validate artifact creation and lineage tracking
- Test multiple edit rounds

#### 4.2 UI Tests

- Test lineage resolution in `DynamicBrainstormingResults`
- Verify `ArtifactEditor` works with resolved artifacts
- Test edit button visibility and functionality

#### 4.3 Agent Tests

- Test agent's ability to detect edit requests
- Validate context enrichment with existing ideas
- Test tool selection and execution

## Technical Specifications

### Data Flow

1. **User Input**: "Make the first idea more romantic"
2. **Agent Analysis**: Detects edit request for idea [0]
3. **Context Enrichment**: Resolves current state of all brainstorm ideas
4. **Tool Execution**: Calls `BrainstormEditTool` with detailed requirements
5. **LLM Transform**: Creates new `brainstorm_idea` artifact
6. **UI Update**: `DynamicBrainstormingResults` resolves new lineage and updates display

### Artifact Types & Transforms

```typescript
// New LLM Transform
interface BrainstormEditTransform {
  type: 'llm';
  transform_name: 'llm_edit_brainstorm_idea';
  input: 'brainstorm_idea_collection' | 'brainstorm_idea' | 'user_input';
  output: 'brainstorm_idea';
  execution_context: {
    source_artifact_id: string;
    idea_index: number;
    edit_requirements: string;
    agent_instructions: string;
  };
}
```

### Lineage Resolution Algorithm

```
function resolveLatestArtifact(startId, path):
  1. Find all human_transforms with source_artifact_id = startId AND derivation_path = path
  2. For each human_transform:
     a. Get derived_artifact_id
     b. Check if this artifact is input to any LLM transforms
     c. If yes, recursively resolve from LLM output
     d. If no, this is the current end of chain
  3. Return the artifact at the end of the longest valid chain
```

### Error Handling

- **Missing Artifacts**: Graceful fallback to original artifact
- **Broken Lineage**: Log warnings but continue with last valid artifact
- **Concurrent Edits**: Use existing unique constraint protection
- **Invalid Paths**: Validate path patterns before resolution

## Security Considerations

- **User Access Control**: All lineage resolution must respect project membership
- **Data Validation**: Validate all resolved artifacts against schemas
- **Rate Limiting**: Prevent excessive LLM edit requests
- **Audit Trail**: Maintain complete transform history for debugging

## Performance Considerations

- **Caching**: Cache lineage resolution results for frequently accessed artifacts
- **Lazy Loading**: Only resolve lineage when needed for display
- **Batch Operations**: Group multiple edit requests when possible
- **Memory Usage**: Avoid loading entire project graph unnecessarily

## Future Enhancements

- **Branching Lineage**: Support multiple parallel edit branches
- **Merge Operations**: Combine different edit branches
- **Version History**: UI for browsing complete edit history
- **Collaborative Editing**: Real-time conflict resolution for concurrent edits
- **Export Lineage**: Export transformation history for analysis

## Success Criteria

1. **Functional**: Users can edit brainstorm ideas through natural language chat
2. **Robust**: System handles complex lineage chains without breaking
3. **Performant**: Lineage resolution completes within 100ms for typical chains
4. **Maintainable**: Pure functions with comprehensive test coverage
5. **User-Friendly**: Clear visual indicators of edit status and history

## Migration Strategy

- **Backward Compatibility**: Existing artifacts and transforms remain functional
- **Gradual Rollout**: Enable new features project-by-project
- **Data Migration**: No migration needed - new features work with existing data
- **Fallback Behavior**: If lineage resolution fails, fall back to current behavior 