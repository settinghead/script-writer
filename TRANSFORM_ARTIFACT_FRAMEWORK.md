# Transform Artifact Framework

A comprehensive data transformation and artifact management framework with intelligent agent orchestration, real-time collaboration, and complete audit trail capabilities built on PostgreSQL + Electric SQL + TypeScript.

## Overview

The Transform Artifact Framework provides a sophisticated foundation for applications requiring intelligent content processing, immutable data management, and real-time collaboration capabilities.

**Key Features**:
- **Intelligent Agent Orchestration** - Context-aware agents with tool-based decision making
- **Immutable Artifact Management** - Complete audit trail with flexible editing capabilities  
- **Real-time Synchronization** - Electric SQL integration for instant cross-client updates
- **Schema-Driven Architecture** - Type-safe operations with Zod validation throughout
- **Advanced Caching System** - Development-optimized streaming response caching
- **Comprehensive Testing Framework** - React component testing with YJS collaboration mocking

## Core Concepts

### Understanding Artifacts and Transforms

At its heart, the framework operates on two fundamental concepts that work together to create a complete data transformation system:

#### **Artifacts: The Data Containers**
Think of artifacts as **immutable snapshots of content** at specific points in time. Like taking a photograph, once an artifact is created, it never changes. This could be:

- **A user's initial story idea** - "I want a romance story about a chef"
- **AI-generated content** - A detailed story outline created by an AI model
- **User-edited content** - The same outline after the user modified character names
- **Processed data** - A script generated from the outline

Each artifact contains:
- **The actual data** (story text, character details, etc.)
- **Metadata** about when it was created and by what process
- **Type information** that defines its structure and purpose

#### **Transforms: The Change Agents**
Transforms are **the processes that create new artifacts from existing ones**. They're like functions that take input artifacts and produce output artifacts, but with complete tracking of what happened and why.

The framework recognizes two fundamentally different types of transforms:

### **Human Transforms: When People Edit Content**

**What they are**: Human transforms occur when a person directly edits, modifies, or derives content from existing artifacts through user interfaces.

**How they work**:
- User sees AI-generated content in an editing interface
- User makes changes (edit text, select options, modify fields)
- System creates a new "user_input" artifact with the changes
- The original AI-generated artifact remains unchanged
- A human transform links the original to the edited version

**Key characteristics**:
- **Immediate** - Changes appear instantly in the UI
- **Granular** - Can edit specific fields or sections
- **Traceable** - System knows exactly what the user changed
- **Reversible** - Original content is preserved

**Real-world example**:
```
AI generates: "Character: John, a shy baker"
User edits to: "Character: Maria, a confident chef"
Result: New artifact with user's version + transform tracking the change
```

**Technical implementation**:
```typescript
// Human transform triggered by edit interface
const humanTransform = {
  type: 'human',
  trigger: 'user_edit',
  input_artifacts: [originalAIContent],
  edit_path: '/characters/0/name',
  user_id: 'user-123',
  streaming_status: 'completed'
};
```

### **Machine Transforms: When AI Processes Content**

**What they are**: Machine transforms occur when AI models, algorithms, or automated processes generate new content from existing artifacts.

**How they work**:
- System analyzes existing artifacts (user requirements, previous content)
- AI model processes the input using prompts and context
- AI generates new content (stories, outlines, scripts)
- System creates new "ai_generated" artifacts with the output
- Machine transform links inputs to outputs with full execution details

**Key characteristics**:
- **Intelligent** - AI makes creative and contextual decisions
- **Streaming** - Content appears progressively as AI generates it
- **Context-aware** - Uses complete project history for better results
- **Reproducible** - Same inputs + prompts can recreate similar outputs

**Real-world example**:
```
User request: "Create a story about a chef"
AI processes: Requirements + genre preferences + platform constraints
AI generates: Full story outline with characters, plot, and episodes
Result: New "ai_generated" artifact + transform tracking the process
```

**Technical implementation**:
```typescript
// Machine transform triggered by AI agent
const machineTransform = {
  type: 'llm',
  trigger: 'agent_request',
  input_artifacts: [userRequest, contextArtifacts],
  model: 'gpt-4',
  prompt_template: 'story_generation',
  streaming_status: 'active'
};
```

### **The Interplay: Human + Machine Collaboration**

The real power emerges when human and machine transforms work together in iterative cycles:

**Collaborative workflow example**:
```
1. User Request → [Machine Transform] → AI Story Ideas
2. AI Story Ideas → [Human Transform] → User Selects Idea #2
3. Selected Idea → [Machine Transform] → Detailed Outline
4. Detailed Outline → [Human Transform] → User Edits Character Names
5. Edited Outline → [Machine Transform] → Episode Scripts
6. Episode Scripts → [Human Transform] → User Refines Dialogue
```

**Why this matters**:
- **Quality Improvement** - AI generates content, humans refine it
- **Learning Loop** - System learns from human edits to improve AI
- **Flexibility** - Users can intervene at any stage
- **Transparency** - Complete history of who/what changed what

### **Origin Types: Understanding Content Sources**

Every artifact has an `origin_type` that indicates how it was created:

- **`ai_generated`** - Created by machine transforms (LLM, algorithms)
- **`user_input`** - Created by human transforms (direct user edits)
- **`decomposed_from_collection`** - Extracted from larger artifacts for individual editing

**Why origin types matter**:
- **Edit permissions** - Only user_input artifacts can be directly modified
- **UI behavior** - Different interfaces for AI vs human content
- **Data collection** - Track human preferences and corrections
- **Quality control** - Prevent accidental corruption of AI outputs

### **Schema Types: Understanding Content Structure**

Artifacts also have `schema_type` that defines their data structure:

- **`brainstorm_collection`** - Multiple story ideas grouped together
- **`brainstorm_idea`** - Individual story idea
- **`brainstorm_input_params`** - Parameters for brainstorm generation
- **`outline_settings`** - Detailed story structure with characters and plot
- **`outline_settings_input`** - Input parameters for outline generation
- **`chronicles`** - Chronological story timeline
- **`chronicles_input`** - Input parameters for chronicles generation

**Why schema types matter**:
- **Validation** - Ensure data integrity and type safety via ArtifactSchemaRegistry
- **UI generation** - Automatically create appropriate editing interfaces
- **Transform compatibility** - Match inputs/outputs correctly
- **Evolution** - Version schemas as requirements change

### **TypedArtifact System**

The framework uses a sophisticated TypeScript typing system with `TypedArtifact`:

```typescript
// TypedArtifact is a discriminated union based on schema_type
export type TypedArtifact =
    | ArtifactWithData<'brainstorm_collection', 'v1', BrainstormIdeaCollectionV1>
    | ArtifactWithData<'brainstorm_idea', 'v1', BrainstormIdeaV1>
    | ArtifactWithData<'brainstorm_input_params', 'v1', BrainstormParamsV1>
    | ArtifactWithData<'outline_settings', 'v1', OutlineSettingsV1>
    | ArtifactWithData<'chronicles', 'v1', ChroniclesV1>
    // ... more types

// Each artifact has strongly typed data based on its schema_type
export interface ArtifactWithData<
    SchemaType extends string, 
    SchemaVersion extends string, 
    Data
> extends Omit<Artifact, 'schema_type' | 'schema_version' | 'data'> {
    schema_type: SchemaType;
    schema_version: SchemaVersion;
    data: Data;
}
```

**Benefits of TypedArtifact**:
- **Type Safety** - Compile-time validation of artifact data structures
- **IntelliSense** - Full IDE support for artifact properties
- **Runtime Validation** - Zod schema validation via ArtifactSchemaRegistry
- **Versioning** - Built-in support for schema evolution

### **Migration from Legacy Typing System**

The framework recently underwent a major typing refactoring to improve type safety and developer experience:

**What Changed**:
- **Removed `artifact.type` field** - Replaced with `schema_type` and `origin_type`
- **Removed `type_version` field** - Replaced with `schema_version`
- **Consolidated schema names** - Cleaner, more consistent naming (e.g., `brainstorm_idea_collection` → `brainstorm_collection`)
- **Introduced TypedArtifact** - Discriminated union types for compile-time safety
- **Centralized ArtifactSchemaRegistry** - Single source of truth for all schema validation

**Database Migration**:
```sql
-- Migration 20241201_008_refactor_artifact_types.ts
-- Added new columns
ALTER TABLE artifacts ADD COLUMN schema_type TEXT;
ALTER TABLE artifacts ADD COLUMN schema_version TEXT;
ALTER TABLE artifacts ADD COLUMN origin_type TEXT;

-- Migrated existing data
UPDATE artifacts SET schema_type = type, schema_version = type_version;
UPDATE artifacts SET origin_type = CASE 
  WHEN type = 'user_input' THEN 'user_input' 
  ELSE 'ai_generated' 
END;
```

**Code Migration Pattern**:
```typescript
// OLD: Legacy typing
interface OldArtifact {
  type: string;
  type_version: string;
  data: any;
}

// NEW: TypedArtifact system
interface NewArtifact {
  schema_type: TypedArtifact['schema_type'];
  schema_version: string;
  origin_type: 'ai_generated' | 'user_input';
  data: any; // Strongly typed based on schema_type
}

// Usage
const artifact: TypedArtifact = {
  schema_type: 'brainstorm_collection',
  schema_version: 'v1',
  origin_type: 'ai_generated',
  data: { ideas: [...], platform: '...', genre: '...' }
};
```

**Benefits of Migration**:
- **Stronger Type Safety** - Compile-time validation of artifact structures
- **Better Developer Experience** - IntelliSense and autocomplete for artifact properties
- **Centralized Validation** - Single ArtifactSchemaRegistry for all schema definitions
- **Cleaner Architecture** - Separation of concerns between schema structure and origin source

**Remaining Cleanup**:
The migration maintains backward compatibility by keeping the old `type` and `type_version` columns. Future work includes:
- Remove deprecated columns in a future migration
- Update remaining references to `artifact.type` in client code
- Complete migration of all `type_version` references to `schema_version`
- Standardize all schema validation to use ArtifactSchemaRegistry

### **The Immutability Principle**

**Core rule**: Once created, artifacts never change. All modifications create new artifacts.

**Why immutability**:
- **Complete history** - Never lose previous versions
- **Parallel experimentation** - Try different approaches simultaneously
- **Collaboration safety** - Multiple users can work without conflicts
- **Debugging power** - Trace any issue through the complete chain

**The one exception**: During streaming, AI can update artifacts in real-time for better UX, but this is carefully controlled and only for active generation processes.

### **Putting It All Together**

The framework creates a **living history** of content creation where:
- Every user action is preserved
- Every AI generation is tracked
- Every change can be understood and reversed
- Every improvement can be learned from

This enables applications that are not just functional, but continuously improving through the natural interaction between human creativity and machine intelligence.

## Core Paradigm: Artifact → Transform → Artifact

### The Fundamental Pattern

The Transform Artifact Framework is built on a single, powerful paradigm: **Artifact → Transform → Artifact**. Every data modification flows through this pattern, creating an immutable chain of transformations that preserves complete history while enabling flexible editing.

**Core Concept**:
```
Input Artifact(s) → Transform (Human or LLM) → Output Artifact(s)
```

This simple pattern underlies all data operations in the framework, from simple edits to complex AI-powered content generation.

### Why This Paradigm?

#### 1. **Immutability by Design**
Unlike traditional CRUD systems that overwrite data, every change creates new artifacts while preserving the original. This provides:

- **Complete Audit Trail** - Every version of every piece of content is preserved
- **Reproducible Operations** - Any sequence of transformations can be replayed exactly
- **Safe Experimentation** - Try different approaches without fear of losing previous work
- **Collaborative Safety** - Multiple users can work simultaneously without data corruption

#### 2. **Perfect for LLM Applications**
This paradigm is especially powerful for AI-powered applications:

**Data Collection Benefits**:
- **Human Preferences** - Capture exactly what users change and why
- **Correction Patterns** - Build datasets of AI outputs and human improvements
- **Context Preservation** - Maintain complete conversation and editing history
- **Training Data** - Automatic generation of high-quality human-feedback datasets

**AI Agent Benefits**:
- **Context Awareness** - Agents can see complete history when making decisions
- **Iterative Improvement** - Each generation builds on previous attempts
- **Rollback Capability** - Easily revert problematic AI changes
- **Branching Exploration** - Try multiple AI approaches simultaneously

#### 3. **Lineage-Driven Logic**
The framework derives application logic through lineage tree traversal:

**Latest Version Resolution**:
```typescript
// Always work with the most recent version
const effectiveArtifact = await resolveLatestVersion(originalArtifactId);
```

**Dependency Tracking**:
```typescript
// Understand what needs updating when something changes
const affectedArtifacts = await findDependentArtifacts(changedArtifactId);
```

**Conflict Resolution**:
```typescript
// Handle multiple edits intelligently
const mergedResult = await resolveBranchingEdits(conflictingArtifacts);
```

### The Streaming Exception

The framework maintains strict immutability with one carefully designed exception: **streaming updates**.

**Why the Exception?**
- **Real-time UX** - Users expect immediate feedback during AI generation
- **Performance** - Avoid creating thousands of intermediate artifacts during streaming
- **Resource Management** - Streaming generates massive amounts of transient data
- **Practical Necessity** - The intermediate steps aren't valuable to preserve

**How It Works**:
```typescript
// During streaming, output artifacts can be updated in-place
if (transform.streaming_status === 'active') {
  await updateArtifactInPlace(outputArtifact, newChunk);
} else {
  // Normal immutable operation
  await createNewArtifact(transformedData);
}
```

**Safe Streaming**:
- Only **pending** transforms can update their output artifacts
- Only **leaf-level** artifacts (no dependents) can be streamed
- Stream completion **finalizes** the artifact as immutable
- **Human transforms** to user_input artifacts can stream for live editing

### Transform Types & Triggers

Building on the conceptual foundation above, transforms are triggered through specific mechanisms:

#### **Machine Transforms (LLM/AI)**
Triggered by AI agents, API calls, or automated processes:
```typescript
const machineTransform = {
  type: 'llm',
  trigger: 'agent_request',
  input_artifacts: [userRequest, contextArtifacts],
  model: 'gpt-4',
  prompt_template: 'content_generation',
  streaming_status: 'active'
};
```

#### **Human Transforms (User Edits)**
Triggered by direct user interactions through edit interfaces:
```typescript
const humanTransform = {
  type: 'human', 
  trigger: 'user_edit',
  input_artifacts: [originalContent],
  edit_path: '/items/0/title',
  user_id: 'user-123',
  streaming_status: 'completed'
};
```

**Key Implementation Detail**: Human transforms are typically triggered through edit interfaces (like those in `artifactRoutes.ts`) that allow users to modify specific fields or sections of AI-generated content, creating new `user_input` artifacts while preserving the original AI-generated versions.

### Practical Benefits

#### For Development Teams
- **Simplified Debugging** - Trace any issue through the transformation chain
- **Clear Architecture** - Every operation follows the same pattern
- **Testing Confidence** - Deterministic operations with preserved test data
- **Feature Development** - New features naturally fit the transform pattern

#### For LLM Applications
- **Continuous Learning** - Automatic collection of human preference data
- **Context Preservation** - Complete conversation and editing history available
- **Quality Improvement** - Easy comparison of AI outputs with human corrections
- **Personalization** - Track individual user preferences and patterns

#### For Users
- **Undo/Redo** - Natural support for reverting any change
- **Branching Workflows** - Try different approaches without losing work
- **Collaboration** - See complete history of who changed what
- **AI Transparency** - Understand exactly what the AI modified

### Real-World Example: Human-Machine Collaboration

Consider a typical content creation workflow showing the interplay between human and machine transforms:

```
1. User Request Artifact ("Create a romance story about a chef")
   ↓ (MACHINE Transform - AI brainstorming)
2. AI-Generated Ideas Collection (3 story concepts)
   ↓ (HUMAN Transform - user selects idea #2 via edit interface)  
3. User-Selected Idea Artifact (origin_type: user_input)
   ↓ (MACHINE Transform - AI outline generation)
4. AI Story Outline Artifact (detailed plot, characters, episodes)
   ↓ (HUMAN Transform - user edits character name "John" → "Maria")
5. User-Refined Outline Artifact (origin_type: user_input)
   ↓ (MACHINE Transform - AI script generation)
6. AI Episode Script Artifact (full dialogue and scenes)
   ↓ (HUMAN Transform - user refines dialogue in specific scenes)
7. User-Polished Script Artifact (origin_type: user_input)
```

**What this demonstrates**:
- **Alternating Intelligence** - AI handles generation, humans handle refinement
- **Preserved History** - Every AI version and human edit is kept
- **Contextual Improvement** - Each AI generation uses complete previous context
- **Granular Control** - Users can edit specific fields without losing other content
- **Quality Evolution** - Content gets progressively better through collaboration

**Lineage Benefits**:
- **Rollback** to any previous version (go back to step 4's AI outline)
- **Branching** to try different AI generations (alternative outlines from step 3)
- **Context** for future AI operations (complete editing history available)
- **Data Collection** of human preferences (what users actually change)
- **A/B Testing** - Compare different AI approaches using same human input

This paradigm transforms complex content creation workflows into simple, traceable, and continuously improving processes where human creativity and machine intelligence enhance each other.

## Core Architecture Principles

### 1. Implementation Requirements
- **ALWAYS respect the artifact → transform → artifact structure** when implementing data flow logic
- Every data modification MUST be tracked through transforms with proper input/output artifact relationships
- Use `TransformExecutor` for all data modifications that need traceability
- Transforms must specify type ('llm' or 'human'), execution context, and status
- **Streaming Exception Rule**: Only pending transforms can update their output artifacts in-place during streaming

### 2. Agent-Driven Operations
All major operations flow through a context-aware agent framework:
- **Tool-Based Decision Making** - Agents automatically select appropriate tools based on request analysis
- **Natural Language Interface** - Conversational interaction with intelligent routing
- **Context Enrichment** - Maintains project context and provides comprehensive background
- **Dual-Mode Operation** - Automatically detects generation vs editing requests

**Agent Workflow**:
```
User Request → Agent Analysis → Context Enrichment → Tool Selection → Execution → Artifact Creation
```

### 3. Lineage Resolution & Type System
**Technical Implementation**: Advanced graph traversal and type management for flexible editing while maintaining immutability.

**Lineage Resolution Algorithm**:
- **Latest Version Detection** - Automatically resolve to most recent artifact in edit chains
- **Branch Merging** - Handle multiple simultaneous edits to the same content
- **Collection Decomposition** - Break collections into individual artifacts for granular editing
- **Dependency Tracking** - Understand cascading effects of changes

**Dual-Type Architecture**:
- **Schema Types** (`schema_type`) - Define data structure (e.g., `brainstorm_collection`, `outline_settings`)
- **Origin Types** (`origin_type`) - Define creation source (`ai_generated`, `user_input`, `decomposed_from_collection`)
- **Editability Logic** - Use origin_type to determine edit permissions and UI behavior
- **Versioned Validation** - All transforms validated against Zod schemas via ArtifactSchemaRegistry
- **TypedArtifact System** - Discriminated union types for compile-time type safety

### 4. Hierarchical Context Architecture
**Parent-Child Context Pattern**: Use parent contexts with child contexts only when human transforms exist, avoiding complex data merging.

**Context Hierarchy Principles**:
- **Parent Context** - Chronicles artifact (for all stages) or collection artifacts (for all items)
- **Child Context** - Individual stage/item artifacts (only for stages/items that have human transforms)
- **Path-Based Field Access** - For unedited content, use parent context with specific paths (e.g., `stages[0]`)
- **Conditional Context Creation** - Child contexts should only exist when there's actual override data to manage

**Lineage-Based Context Selection**:
```typescript
// Determine which artifact to use based on lineage
const hasHumanTransform = useLineageResolution(parentArtifactId, itemPath);
const contextArtifactId = hasHumanTransform ? childArtifactId : parentArtifactId;
const contextPath = hasHumanTransform ? '$' : itemPath;
```

### 5. Data Flow Stability Principles
**Reference Stability**: Prevent infinite loops and focus loss in React components through careful dependency management.

**Critical Patterns**:
- **Avoid Reference Instability** - Never include computed values or new object references in `useCallback` dependencies
- **Use Ref Pattern** - Access current values via refs in debounced callbacks to prevent stale closures
- **Stabilize Context Values** - Memoize context values to prevent unnecessary provider re-renders
- **Component Memoization** - Use `React.memo` for components that receive frequently changing props

**Anti-Pattern Example**:
```typescript
// ❌ BAD - Creates infinite loop
const debouncedSave = useCallback(
  debounce((value) => onSave(value), 1000),
  [value, onSave] // value changes constantly, recreating function
);

// ✅ GOOD - Stable function with refs
const valueRef = useRef(value);
const onSaveRef = useRef(onSave);
valueRef.current = value;
onSaveRef.current = onSave;

const debouncedSave = useCallback(
  debounce(() => onSaveRef.current(valueRef.current), 1000),
  [] // Empty dependencies - function never recreated
);
```

### 6. Subscription-Based State Management
**Prevent React Re-renders**: Use subscription patterns for real-time data that changes frequently without triggering component re-renders.

**Subscription Context Pattern**:
```typescript
// Separate structural (stable) from content (changing) contexts
interface StructuralContext {
  subscribeToValue: (path: string, callback: (value: any) => void) => () => void;
  updateValue: (path: string, value: any) => void;
  getValue: (path: string) => any;
}

// Field components subscribe without triggering context re-renders
const useFieldSubscription = (path: string) => {
  const [value, setValue] = useState();
  const { subscribeToValue } = useContext(StructuralContext);
  
  useEffect(() => {
    return subscribeToValue(path, setValue);
  }, [path, subscribeToValue]);
  
  return value;
};
```

### 7. Click-to-Edit Interaction Pattern
**Seamless Editing Workflow**: Make entire interface elements clickable to create human transforms and enter edit mode.

**Implementation Pattern**:
- **Entire Cards Clickable** - Not just edit buttons, but entire read-only cards should be clickable
- **Human Transform Creation** - Click handlers create human transforms with appropriate derivation paths
- **Automatic Mode Switching** - Components automatically switch from read-only to editable based on artifact origin_type
- **Visual Feedback** - Clear indicators for read-only vs editable states

**Transform Creation Example**:
```typescript
const handleCreateEditableVersion = useCallback(async () => {
  projectData.createHumanTransform.mutate({
    transformName: 'edit_collection_item',
    sourceArtifactId: parentArtifactId,
    derivationPath: `$.items[${itemIndex}]`,
    fieldUpdates: {}
  });
}, [projectData, parentArtifactId, itemIndex]);
```

### 8. Field Name Consistency Principle
**Schema-UI Alignment**: Ensure UI field names exactly match artifact data structure field names.

**Critical Rule**: UI components must use the exact field names from the artifact schema, not assumed or convenient names.

**Common Mistake**:
```typescript
// ❌ BAD - UI uses 'content' but data has 'stageSynopsis'
<YJSTextAreaField path="content" />

// ✅ GOOD - UI matches data structure
<YJSTextAreaField path="stageSynopsis" />
```

**Validation Process**:
1. **Check Artifact Data** - Always verify actual field names in stored artifacts
2. **Match Schema Definitions** - Ensure UI field paths match Zod schema field names
3. **Test with Real Data** - Use actual artifact data for testing, not mock data
4. **Debug with API Calls** - Use `curl` or API inspection to verify data structure

## Database Architecture

**PostgreSQL + Electric SQL + Kysely**:
- **PostgreSQL 16** - Primary database with logical replication
- **Electric SQL** - Real-time synchronization with authenticated proxy
- **Kysely** - Type-safe database operations with auto-generated types

**Core Tables**:
```sql
-- Enhanced artifacts with dual-type system
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  schema_type TEXT NOT NULL,        -- Data structure type (e.g., 'brainstorm_collection')
  schema_version TEXT NOT NULL,     -- Schema version (e.g., 'v1')
  origin_type TEXT NOT NULL,        -- Creation source ('ai_generated', 'user_input')
  data TEXT NOT NULL,               -- JSON data validated by ArtifactSchemaRegistry
  streaming_status TEXT DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transform tracking with lineage
CREATE TABLE transforms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  streaming_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transform input/output relationships
CREATE TABLE transform_inputs (
  id TEXT PRIMARY KEY,
  transform_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  artifact_path TEXT DEFAULT '',
  FOREIGN KEY (transform_id) REFERENCES transforms(id),
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id)
);

CREATE TABLE transform_outputs (
  id TEXT PRIMARY KEY,
  transform_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  FOREIGN KEY (transform_id) REFERENCES transforms(id),
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id)
);

-- Human transforms with concurrent protection
CREATE TABLE human_transforms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  input_artifact_id TEXT NOT NULL,
  output_artifact_id TEXT NOT NULL,
  path TEXT NOT NULL,
  transform_name TEXT,
  CONSTRAINT unique_human_transform_per_artifact_path 
    UNIQUE (input_artifact_id, path)
);

-- Project-based access control
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects_users (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  PRIMARY KEY (project_id, user_id)
);

-- Chat messages for agent communication
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  event_type TEXT DEFAULT 'user_message',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Transform Execution Modes

The framework supports two distinct execution modes for AI-powered content generation and editing, each optimized for different use cases and providing different performance characteristics.

### 1. Full-Object Mode (完整对象模式)

**Use Case**: Creating new content from scratch or complete rewrites

**How It Works**:
- LLM generates complete new content objects
- Output artifact starts empty and gets progressively filled during streaming
- Used for brainstorming, outline generation, chronicles creation
- Template prompts ask for complete structured responses

**Example Templates**:
- `brainstorming` - Generates complete story idea collections
- `outline_settings` - Creates full character and story foundation
- `chronicles` - Produces complete chronological timelines

**Execution Flow**:
```typescript
// Full-object mode - starts with empty structure
executionMode: { mode: 'full-object' }

// Initial artifact data is empty/minimal
initialData = this.createInitialArtifactData(outputArtifactType);

// LLM generates complete content
finalArtifactData = config.transformLLMOutput 
  ? config.transformLLMOutput(llmOutput, input)
  : llmOutput;
```

### 2. Patch Mode (补丁模式)

**Use Case**: Making precise edits to existing content while preserving unchanged parts

**How It Works**:
- LLM generates JSON Patch operations (RFC 6902 standard)
- Output artifact starts with a copy of the original content
- Patches are applied incrementally during streaming
- Only modified fields change, preserving the rest of the content

**JSON Patch Operations**:
```json
{
  "patches": [
    {
      "op": "replace",
      "path": "/title", 
      "value": "新标题"
    },
    {
      "op": "replace",
      "path": "/body",
      "value": "改进后的故事内容..."
    }
  ]
}
```

**Example Usage**:
- `brainstorm_edit` - Precise story idea modifications
- User requests like "让这些故事更现代一些，加入一些科技元素"
- Maintains original structure while updating specific fields

**Execution Flow**:
```typescript
// Patch mode - starts with original content
executionMode: { 
  mode: 'patch', 
  originalArtifact: sourceContent 
}

// Initial artifact data is copy of original
initialData = deepClone(executionMode.originalArtifact);

// Apply patches during streaming
finalArtifactData = await this.applyPatchesToOriginal(
  llmOutput, 
  originalArtifact, 
  templateName, 
  retryCount
);
```

### 3. Patch Mode Fallback Mechanisms

**Multi-Layer Fallback Strategy**:
1. **JSON Patch (Primary)** - RFC 6902 standard operations
2. **Diff Format (Secondary)** - Text-based diff parsing
3. **Full Regeneration (Tertiary)** - Falls back to full-object mode

**Error Handling**:
- Invalid patches are caught and logged
- Failed patch applications trigger automatic retry
- Multiple retry attempts before falling back to full regeneration
- Comprehensive error tracking in transform metadata

**Patch Validation**:
```typescript
// Validate patch operations
const patchResults = applyPatch(originalCopy, patches);
const failedPatches = patchResults.filter(r => r.test === false);

if (failedPatches.length === 0) {
  // Success - use patched content
  return originalCopy;
} else {
  // Failure - trigger fallback
  throw new Error(`Failed to apply ${failedPatches.length} JSON patches`);
}
```

### 4. Mode Selection Logic

**Automatic Mode Detection**:
- **Full-Object Mode**: Used by default for generation tools
- **Patch Mode**: Explicitly enabled for editing tools with `extractSourceArtifacts`

**Template Design**:
- **Generation Templates**: Prompt for complete content structures
- **Edit Templates**: Prompt for JSON Patch operations with specific format requirements

**Performance Benefits**:
- **Patch Mode**: Faster processing, preserves unchanged content, better user experience
- **Full-Object Mode**: Simpler implementation, complete content control
- **Streaming Updates**: Both modes support real-time artifact updates during generation

**Metadata Tracking**:
```typescript
transformMetadata: {
  execution_mode: executionMode?.mode || 'full-object',
  method: 'unified_patch', // or 'full_generation'
  source_artifact_type: sourceArtifact.type,
  output_artifact_type: outputArtifactType,
  retry_count: retryCount,
  patch_success: boolean
}
```

### 5. Template Design Patterns

**Full-Object Templates**:
Templates designed for complete content generation with structured output schemas.

```typescript
// Example: brainstorming template
promptTemplate: `生成${numberOfIdeas}个故事创意...
请以JSON数组格式生成创意：
[
  {"title": "标题1", "body": "完整故事梗概1"},
  {"title": "标题2", "body": "完整故事梗概2"}
]`

outputSchema: z.array(IdeaSchema)
```

**Patch Mode Templates**:
Templates specifically designed to generate JSON Patch operations with explicit format requirements.

```typescript
// Example: brainstorm_edit template  
promptTemplate: `基于用户要求改进现有故事创意...
请以JSON补丁(JSON Patch)格式返回修改操作：
{
  "patches": [
    {
      "op": "replace",
      "path": "/title",
      "value": "改进标题"
    },
    {
      "op": "replace", 
      "path": "/body",
      "value": "改进后的完整故事梗概..."
    }
  ]
}`

outputSchema: JsonPatchOperationsSchema
```

**Key Template Differences**:
- **Output Format**: Full objects vs. patch operations
- **Context Handling**: New creation vs. modification of existing content
- **Prompt Structure**: Generation instructions vs. editing instructions
- **Schema Validation**: Complete content schemas vs. patch operation schemas
- **Error Recovery**: Schema validation failures vs. patch application failures

**Template Selection Logic**:
```typescript
// Automatic template selection based on tool type
if (config.extractSourceArtifacts && executionMode?.mode === 'patch') {
  // Use patch-mode template (e.g., 'brainstorm_edit')
  templateName = 'brainstorm_edit';
} else {
  // Use full-object template (e.g., 'brainstorming')  
  templateName = 'brainstorming';
}
```

### 6. Practical Usage Comparison

**When to Use Full-Object Mode**:
- ✅ Creating new content from scratch
- ✅ Complete rewrites or restructuring
- ✅ Initial brainstorming and ideation
- ✅ Generating structured data with multiple fields
- ✅ Complex content that requires full context understanding

**When to Use Patch Mode**:
- ✅ Making specific edits to existing content
- ✅ User requests for targeted improvements
- ✅ Preserving unchanged content structure
- ✅ Incremental refinements and adjustments
- ✅ Maintaining content consistency during edits

**Performance Characteristics**:

| Aspect | Full-Object Mode | Patch Mode |
|--------|------------------|------------|
| **Processing Speed** | Slower (complete generation) | Faster (targeted changes) |
| **Content Preservation** | None (complete replacement) | High (unchanged parts preserved) |
| **LLM Token Usage** | Higher (full content) | Lower (patches only) |
| **Error Recovery** | Schema validation | Patch application + fallback |
| **User Experience** | Complete refresh | Incremental updates |
| **Implementation Complexity** | Simple | Complex (fallback mechanisms) |

**Real-World Examples**:

```typescript
// Full-Object Mode Example
// User: "给我生成3个古装甜宠故事"
// Result: Complete new story collection

// Patch Mode Example  
// User: "让这些故事更现代一些，加入一些科技元素"
// Result: Targeted edits preserving story structure
```

**Development Guidelines**:
1. **Default to Full-Object** for new content creation tools
2. **Use Patch Mode** for editing and refinement tools
3. **Implement Fallback** mechanisms for patch mode reliability
4. **Test Both Modes** thoroughly with real user scenarios
5. **Monitor Performance** and adjust based on usage patterns

This dual-mode system provides optimal performance for both content creation and editing workflows, ensuring efficient AI operations while maintaining complete audit trails and user experience quality.

## Unified Streaming Framework & Caching

**Streaming Framework**: All agent tools use a unified streaming architecture with 90% reduction in boilerplate code and consistent behavior.

**Framework Benefits**:
- **Code Reduction** - Tools reduced from ~200 lines to ~30 lines of business logic
- **Consistent Behavior** - Identical streaming patterns, error handling, validation
- **Centralized Maintenance** - Bug fixes apply to all tools automatically
- **Type Safety** - Comprehensive Zod validation throughout pipeline

**Tool Implementation Pattern**:
```typescript
const config: StreamingTransformConfig<InputType, OutputType> = {
  templateName: 'template_name',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  prepareTemplateVariables: (input) => ({ /* business logic */ })
};

return executeStreamingTransform({ config, input, ...dependencies });
```

**Advanced Caching System**:
- **Transparent Caching** - Internal to service layer, parent code unaware
- **Full Streaming Progression Cache** - Caches complete streaming experience, not just final results
- **Deterministic Testing** - Fixed seeds ensure reproducible test results
- **Development-Only** - Disabled by default, explicitly enabled for tests
- **File-Based Storage** - SHA256 cache keys with model-aware invalidation

**Cache Performance**:
```
First Run:  Cache MISS → Saved 77 chunks to cache
Second Run: Cache HIT (77 chunks) → Near-instantaneous replay
```

## Electric SQL Integration

### Real-Time Synchronization
**Electric SQL** provides instant cross-client synchronization:
- **Authenticated Proxy** - All shape requests validated and user-scoped  
- **Project-Based Access** - Automatic filtering by user's project membership
- **Performance Optimized** - Efficient real-time data streaming
- **Type-Safe Hooks** - Generated TypeScript hooks for React integration

### Frontend Integration Pattern
```typescript
// Custom hook using Electric SQL + TanStack Query
export const useProjectData = (projectId: string) => {
  // Server state via TanStack Query
  const { data: project } = useQuery(['project', projectId], () => 
    apiService.getProject(projectId)
  );

  // Real-time sync via Electric SQL
  const { results: artifacts } = useShape({
    url: '/api/electric/v1/shape',
    table: 'artifacts', 
    where: `project_id = '${projectId}'`
  });

  // Client state via Zustand
  const { uiState, setUIState } = useProjectStore();

  return { project, artifacts, uiState };
};
```

### Optimistic State Implementation

Following the [Electric SQL write guide patterns](https://electric-sql.com/docs/guides/writes), the framework supports sophisticated optimistic state management for real-time collaborative applications:

**Concurrent Edit Handling**:
- **Queue-Based Saves** - Pending edits are queued during active saves to prevent data loss
- **Recursive Processing** - Queued values are automatically processed after current saves complete
- **No Lost Edits** - Latest user input is preserved even during rapid typing

**Smart State Synchronization**:
- **Edit Preservation** - Local edits are protected during optimistic state updates
- **Fresh Data Fetching** - Save operations always use current artifact data to prevent stale closures
- **Conditional Prop Syncing** - Props only update local state when not actively saving

**Race Condition Prevention**:
```typescript
// Example: Concurrent edit handling with queueing
if (savingRef.current) {
    pendingSaveRef.current = valueToSave; // Queue latest value
    return;
}

// After save completes, process any queued values
if (pendingSaveRef.current && pendingSaveRef.current !== valueToSave) {
    const queuedValue = pendingSaveRef.current;
    setTimeout(() => saveValue(queuedValue), 0); // Save queued value
}
```

**Benefits**:
- **Seamless UX** - Users can type continuously without interruption
- **Data Integrity** - No edits are lost during network operations
- **Real-time Collaboration** - Multiple users can edit simultaneously without conflicts

## Schema System

### Zod Schema Definitions
**ArtifactSchemaRegistry System**:
```typescript
// Centralized schema registry in src/common/schemas/artifacts.ts
export const ArtifactSchemaRegistry = {
  // Brainstorm schemas
  'brainstorm_collection': z.object({
    ideas: z.array(IdeaSchema),
    platform: z.string(),
    genre: z.string(),
    total_ideas: z.number()
  }),
  'brainstorm_idea': IdeaSchema,
  'brainstorm_input_params': BrainstormToolInputSchema,

  // Outline schemas
  'outline_settings_input': OutlineSettingsInputSchema,
  'outline_settings': OutlineSettingsOutputSchema,
  
  // Chronicles schemas
  'chronicles_input': ChroniclesInputSchema,
  'chronicles': ChroniclesOutputSchema,
} as const;

// Transform schemas with regex path patterns
export const TransformRegistry = {
  'outline_settings_generation': {
    pathPattern: '^\\$\\[outline_settings\\]$',
    inputSchema: OutlineSettingsInputSchema,
    outputSchema: OutlineSettingsOutputSchema,
    outputType: 'outline_settings'
  },
  'brainstorm_idea_edit': {
    pathPattern: '^\\$\\.ideas\\[\\d+\\]$',
    inputSchema: z.object({
      title: z.string(),
      body: z.string()
    }),
    outputSchema: z.object({
      title: z.string(),
      body: z.string()
    }),
    outputType: 'brainstorm_idea'
  }
} as const;
```

### Schema Transform Executor
**Complete validation and execution engine**:
```typescript
export class SchemaTransformExecutor {
  async executeTransform<T, U>(
    transformName: string,
    input: T,
    context: TransformContext
  ): Promise<TransformResult<U>> {
    // 1. Validate input against schema
    const transformDef = this.getTransformDefinition(transformName);
    const validatedInput = transformDef.inputSchema.parse(input);
    
    // 2. Execute transform with validation
    const result = await this.executeWithValidation(
      transformDef,
      validatedInput,
      context
    );
    
    // 3. Validate output against ArtifactSchemaRegistry
    const outputSchema = ArtifactSchemaRegistry[transformDef.outputType];
    return outputSchema.parse(result);
  }
  
  private getTransformDefinition(transformName: string) {
    const definition = TransformRegistry[transformName];
    if (!definition) {
      throw new Error(`Transform definition not found: ${transformName}`);
    }
    return definition;
  }
}
```

## Security & Access Control

### Project-Based Access Control
**Core Principle**: Access control managed through project membership, not direct user ownership.

```typescript
// All operations scoped to user's projects
async function validateProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const membership = await db
    .selectFrom('projects_users')
    .where('user_id', '=', userId)
    .where('project_id', '=', projectId)
    .executeTakeFirst();
    
  return !!membership;
}

// Always use artifactRepo.userHasProjectAccess(userId, projectId) to validate access
// Never filter artifacts directly by user_id
```

### Authentication Requirements
- **ALL AI/LLM endpoints MUST require authentication** using `requireAuth` middleware
- **ALL data operations MUST be scoped to authenticated user** (`project_id` filtering)
- Use HTTP-only cookies for JWT tokens to prevent XSS attacks
- Validate user ownership before allowing access to any resource
- Room IDs must include user ID for WebSocket security: `room-{user_id}-{timestamp}-{random}`

### Debug Authentication
- **For development/testing**: Use debug token `debug-auth-token-script-writer-dev` in Authorization header
- Debug token bypasses JWT validation and authenticates as test-user-1
- Example: `Authorization: Bearer debug-auth-token-script-writer-dev`
- **NEVER use debug token in production** - only for local development and testing

## Lineage Resolution System

### Graph Traversal Algorithm
**Always Edit Latest Version**:
```typescript
export async function resolveEffectiveArtifacts(
  inputArtifactIds: string[],
  projectId: string
): Promise<ArtifactWithLineage[]> {
  
  // 1. Build complete lineage graph
  const graph = await buildLineageGraph(projectId);
  
  // 2. For each input artifact, find the latest effective version
  const resolvedArtifacts = [];
  
  for (const artifactId of inputArtifactIds) {
    // Find leaf artifacts that derive from this input
    const leafArtifacts = findLeafArtifacts(graph, artifactId);
    
    if (leafArtifacts.length > 0) {
      // Use the most recent leaf artifact
      const latestLeaf = leafArtifacts.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      
      resolvedArtifacts.push(latestLeaf);
    } else {
      // No derivatives, use original
      resolvedArtifacts.push(await getArtifact(artifactId));
    }
  }
  
  return resolvedArtifacts;
}
```

**Lineage Resolution Examples**:
```
Simple Chain:
Artifact A → Human Transform → Artifact B (leaf)
User edits A → System resolves to B → User edits latest version

Complex Branching:
Collection → [Item 1] → Human Edit → User Input → AI Edit → Enhanced Item (leaf)
          → [Item 2] → AI Edit → Enhanced Item (leaf)
          → [Item 3] → (unchanged, references original)
```

## Development Patterns

### Repository Pattern
**Data Access Layer**:
```typescript
export class ArtifactRepository {
  constructor(private db: Database) {}
  
  async createArtifact(data: CreateArtifactData): Promise<Artifact> {
    return this.db
      .insertInto('artifacts')
      .values({
        id: generateId(),
        project_id: data.projectId,
        schema_type: data.schemaType,
        origin_type: data.originType,
        data: JSON.stringify(data.data),
        created_at: new Date().toISOString()
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
```

### Service Layer Pattern
**Business Logic Orchestration**:
```typescript
export class ProjectService {
  constructor(
    private artifactRepo: ArtifactRepository,
    private transformRepo: TransformRepository,
    private chatService: ChatService
  ) {}
  
  async createProject(userId: string, data: CreateProjectData): Promise<Project> {
    // 1. Create project
    const project = await this.createProjectRecord(userId, data);
    
    // 2. Set up initial artifacts
    await this.initializeProjectArtifacts(project.id);
    
    // 3. Create welcome chat message
    await this.chatService.addSystemMessage(project.id, 'Welcome to your new project!');
    
    return project;
  }
}
```

## Testing Framework

### React Component Testing Architecture

The Transform Artifact Framework includes a comprehensive testing system specifically designed for React components with YJS integration, real-time collaboration, and complex artifact management scenarios.

**Framework Benefits**:
- **🚀 Fast Execution** - Mocked dependencies eliminate external service calls
- **🎯 Realistic Test Data** - Tests use patterns that match actual component behavior
- **🔄 Deterministic Results** - Consistent test outcomes across environments
- **📊 Comprehensive Coverage** - Tests cover rendering, interaction, and state management
- **🐞 Better Debugging** - Clear separation of concerns with focused test scenarios

### Testing Environment Setup

**Dependencies and Configuration**:
```bash
# Install testing dependencies
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# Vitest configuration for React testing
# vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
    setupFiles: ['src/__tests__/setup.ts']
  }
});
```

**Test Setup File**:
```typescript
// src/__tests__/setup.ts
import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Global test configuration
beforeEach(() => {
  vi.clearAllMocks();
});
```

### YJS Component Testing Patterns

**Mock Architecture for YJS Components**:
```typescript
// Mock the YJS context and hooks
const mockUpdateField = vi.fn();
const mockValue = vi.fn();
const mockIsInitialized = vi.fn();

// Mock the YJS context
vi.mock('../../../contexts/YJSArtifactContext', () => ({
    YJSArtifactProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useYJSField: vi.fn((path: string) => ({
        value: mockValue(path),
        updateValue: mockUpdateField,
        isInitialized: mockIsInitialized(path)
    }))
}));

// Mock Ant Design components for simpler testing
vi.mock('antd', async () => {
    const actual = await vi.importActual('antd');
    
    const MockInput = ({ value, onChange, placeholder, ...props }: any) => (
        <input
            data-testid="input"
            value={value || ''}
            onChange={(e) => onChange?.(e)}
            placeholder={placeholder}
            {...props}
        />
    );
    
    const MockTextArea = ({ value, onChange, placeholder, rows, ...props }: any) => (
        <textarea
            data-testid="textarea"
            value={value || ''}
            onChange={(e) => onChange?.(e)}
            placeholder={placeholder}
            rows={rows}
            {...props}
        />
    );
    
    return {
        ...actual,
        Input: MockInput,
        Spin: ({ children, ...props }: any) => (
            <div data-testid="spin" {...props}>
                {children}
            </div>
        )
    };
});
```

### Component Testing Categories

**1. Rendering Tests**
Verify components render correctly with different props and states:
```typescript
describe('YJSTextField Rendering', () => {
    it('renders correctly with mocked data', () => {
        mockValue.mockReturnValue('Test Title');
        
        render(<YJSTextField path="title" placeholder="Enter title" />);

        const input = screen.getByTestId('input');
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute('placeholder', 'Enter title');
    });

    it('handles empty values gracefully', () => {
        mockValue.mockReturnValue('');
        
        render(<YJSTextField path="title" placeholder="Enter title" />);

        const input = screen.getByTestId('input');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue('');
    });
});
```

**2. Interaction Tests**
Test user interactions and component behavior:
```typescript
describe('YJSTextField Interactions', () => {
    it('calls updateValue when input changes', async () => {
        mockValue.mockReturnValue('Initial Value');
        
        render(<YJSTextField path="title" placeholder="Enter title" />);

        const input = screen.getByTestId('input');
        
        // Simulate user typing
        fireEvent.change(input, { target: { value: 'New Title' } });

        // Wait for debounced update
        await waitFor(() => {
            expect(mockUpdateField).toHaveBeenCalled();
        }, { timeout: 1500 });
    });
});
```

**3. Integration Tests**
Test multiple components working together:
```typescript
describe('Component Integration', () => {
    it('can render multiple components together', () => {
        mockValue.mockImplementation((path: string) => {
            switch (path) {
                case 'title': return 'Test Title';
                case 'description': return 'Test Description';
                default: return '';
            }
        });

        render(
            <div>
                <YJSTextField path="title" placeholder="Title" />
                <YJSTextAreaField path="description" placeholder="Description" />
            </div>
        );

        expect(screen.getByTestId('input')).toBeInTheDocument();
        expect(screen.getByTestId('textarea')).toBeInTheDocument();
    });
});
```

**4. Error Handling Tests**
Test edge cases and error scenarios:
```typescript
describe('Error Handling', () => {
    it('handles undefined values gracefully', () => {
        mockValue.mockReturnValue(undefined);
        
        render(<YJSTextField path="title" placeholder="Enter title" />);

        const input = screen.getByTestId('input');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue('');
    });

    it('handles null values gracefully', () => {
        mockValue.mockReturnValue(null);
        
        render(<YJSTextField path="title" placeholder="Enter title" />);

        const input = screen.getByTestId('input');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue('');
    });
});
```

### Mock Validation Tests

**Ensure mocks work correctly**:
```typescript
describe('Mock Validation', () => {
    it('validates that mocks are working correctly', () => {
        mockValue.mockReturnValue('test-value');
        mockIsInitialized.mockReturnValue(true);
        
        expect(mockValue('test-path')).toBe('test-value');
        expect(mockIsInitialized('test-path')).toBe(true);
    });

    it('validates that mock functions are called with correct parameters', () => {
        mockValue.mockReturnValue('test');
        
        render(<YJSTextField path="title" placeholder="Test" />);
        
        expect(mockValue).toHaveBeenCalledWith('title');
        expect(mockIsInitialized).toHaveBeenCalledWith('title');
    });
});
```

### Advanced Testing Patterns

**Testing Debounced Operations**:
```typescript
describe('Debounced Operations', () => {
    it('handles rapid input changes with debouncing', async () => {
        mockValue.mockReturnValue('');
        
        render(<YJSTextField path="title" placeholder="Enter title" />);
        const input = screen.getByTestId('input');
        
        // Simulate rapid typing
        fireEvent.change(input, { target: { value: 'T' } });
        fireEvent.change(input, { target: { value: 'Te' } });
        fireEvent.change(input, { target: { value: 'Test' } });
        
        // Should only call updateValue once after debounce
        await waitFor(() => {
            expect(mockUpdateField).toHaveBeenCalledTimes(1);
            expect(mockUpdateField).toHaveBeenCalledWith('title', 'Test');
        }, { timeout: 1500 });
    });
});
```

**Testing Complex Component States**:
```typescript
describe('Complex Component States', () => {
    it('handles loading states correctly', () => {
        mockIsInitialized.mockReturnValue(false);
        
        render(<YJSTextField path="title" placeholder="Enter title" />);
        
        // Component should show loading state when not initialized
        expect(screen.getByTestId('spin')).toBeInTheDocument();
    });

    it('transitions from loading to ready state', () => {
        mockIsInitialized.mockReturnValue(true);
        mockValue.mockReturnValue('Ready value');
        
        render(<YJSTextField path="title" placeholder="Enter title" />);
        
        const input = screen.getByTestId('input');
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue('Ready value');
    });
});
```

### File Organization

**Test File Structure**:
```
src/
├── client/
│   └── transform-artifact-framework/
│       └── __tests__/
│           ├── YJSField.test.tsx           # YJS component tests
│           ├── ArtifactEditor.test.tsx     # Artifact editor tests
│           ├── LineageResolution.test.tsx  # Lineage resolution tests
│           └── README.md                   # Testing documentation
```

### Running Tests

**Test Execution Commands**:
```bash
# Run all tests
npm test -- --run

# Run specific test file
npm test -- --run src/client/transform-artifact-framework/__tests__/YJSField.test.tsx

# Run tests in watch mode (for development)
npm test

# Run tests with coverage
npm test -- --coverage
```

### Testing Best Practices

**1. Mock Strategy**:
- **Isolate External Dependencies** - Mock YJS context, Ant Design components, and API calls
- **Focus on Component Logic** - Test component behavior, not implementation details
- **Use Realistic Mock Data** - Mock responses should match actual data structures
- **Maintain Mock Consistency** - Keep mocks simple and predictable

**2. Test Organization**:
- **Group Related Tests** - Use `describe` blocks to organize test categories
- **Clear Test Names** - Test names should describe expected behavior
- **Setup and Teardown** - Use `beforeEach` and `afterEach` for consistent test state
- **Avoid Test Interdependence** - Each test should be independent

**3. Assertion Strategy**:
- **Test User-Visible Behavior** - Focus on what users see and interact with
- **Use Semantic Queries** - Prefer `getByRole`, `getByLabelText` over `getByTestId`
- **Test Accessibility** - Ensure components are accessible and properly labeled
- **Verify State Changes** - Test that interactions produce expected state changes

**4. Performance Considerations**:
- **Mock Heavy Operations** - Mock expensive operations like API calls and complex computations
- **Use Fake Timers** - For testing debounced operations and timeouts
- **Cleanup Resources** - Ensure proper cleanup to prevent memory leaks
- **Parallel Test Execution** - Structure tests to run independently in parallel

### Integration with Framework Components

**Testing Artifact Editor Components**:
```typescript
describe('ArtifactEditor Integration', () => {
    it('creates human transforms when editing', async () => {
        const mockCreateTransform = vi.fn();
        
        render(
            <ArtifactEditor
                artifactId="test-artifact"
                transformName="edit_transform"
                fields={[
                    { field: 'title', component: 'input' },
                    { field: 'content', component: 'textarea' }
                ]}
                onTransition={mockCreateTransform}
            />
        );
        
        // Test editing workflow
        const editButton = screen.getByRole('button', { name: /edit/i });
        fireEvent.click(editButton);
        
        await waitFor(() => {
            expect(mockCreateTransform).toHaveBeenCalled();
        });
    });
});
```

**Testing Lineage Resolution**:
```typescript
describe('Lineage Resolution Testing', () => {
    it('resolves to latest artifact version', () => {
        const mockLineageData = {
            latestArtifactId: 'latest-artifact-123',
            hasLineage: true,
            depth: 2
        };
        
        // Mock lineage resolution hook
        vi.mock('../hooks/useLineageResolution', () => ({
            useLineageResolution: () => mockLineageData
        }));
        
        render(<ComponentUsingLineage sourceArtifactId="original-artifact" />);
        
        // Verify component uses latest artifact
        expect(screen.getByText('latest-artifact-123')).toBeInTheDocument();
    });
});
```

This comprehensive testing framework ensures that Transform Artifact Framework applications maintain high quality, reliability, and user experience while supporting complex real-time collaboration and artifact management scenarios.

## Development Tools

### TypeScript Script Execution
- **ALWAYS use `./run-ts` when running TypeScript Node.js scripts** - never use `npx tsx` or `node` directly
- The `./run-ts` script handles proper TypeScript configuration, dotenv loading, and module resolution
- Example: `./run-ts src/server/test-script.ts` instead of `npx tsx src/server/test-script.ts`
- run-ts can only run typescript files. DO NOT run inline scripts. Always write down the script in TS file(s).

### Database Operations
- Use `ArtifactRepository` and `TransformRepository` for data access
- Run migrations with `npm run migrate`
- Use `./run-ts src/server/scripts/migrate.ts` for migrations
- Unique constraint `unique_human_transform_per_artifact_path` prevents concurrent editing race conditions

### File Structure
```
src/
├── client/                 # React frontend
│   ├── components/        # UI components with streaming support
│   ├── hooks/            # Custom hooks including streaming hooks
│   ├── services/         # API services
│   └── types/            # Frontend-specific types
├── common/               # Shared types and interfaces
│   ├── streaming/        # Streaming interfaces
│   └── schemas/         # Zod validation schemas
└── server/               # Express backend
    ├── routes/           # API routes (domain-focused)
    ├── services/         # Business logic with transform execution
    ├── repositories/     # Data access layer (artifacts/transforms)
    └── middleware/       # Authentication and validation
```

## Example Implementation

Here's a complete example showing how to implement a generation and editing system using the framework:

**1. Define Schemas** (in `src/common/schemas/`):
```typescript
export const ContentInputSchema = z.object({
  title: z.string(),
  requirements: z.string(),
  format: z.enum(['article', 'summary', 'outline']),
  context: z.string().optional()
});

export const ContentOutputSchema = z.object({
  title: z.string(),
  content: z.string(),
  metadata: z.object({
    word_count: z.number(),
    generated_at: z.string()
  })
});

export type ContentInput = z.infer<typeof ContentInputSchema>;
export type ContentOutput = z.infer<typeof ContentOutputSchema>;
```

**2. Create Tool** (in `src/server/tools/`):
```typescript
export function createContentTool(
  transformRepo: TransformRepository,
  artifactRepo: ArtifactRepository,
  projectId: string,
  userId: string,
  options: { enableCaching?: boolean } = {}
): StreamingToolDefinition<ContentInput, ContentResult> {
  
  const config: StreamingTransformConfig<ContentInput, ContentOutput> = {
    templateName: 'content_generation',
    inputSchema: ContentInputSchema,
    outputSchema: ContentOutputSchema,
    prepareTemplateVariables: (input: ContentInput) => ({
      title: input.title,
      requirements: input.requirements,
      format: input.format,
      context: input.context || ''
    })
  };

  return {
    name: 'generate_content',
    description: 'Generate content based on requirements',
    inputSchema: ContentInputSchema,
    outputSchema: ContentResultSchema,
    execute: async (params: ContentInput): Promise<ContentResult> => {
      const result = await executeStreamingTransform({
        config,
        input: params,
        transformRepo,
        artifactRepo,
        projectId,
        userId,
        options
      });

      return {
        artifactId: result.outputArtifact.id,
        transformId: result.transform.id,
        status: 'completed'
      };
    }
  };
}
```

**3. Frontend Hook** (following the `useProjectData.ts` pattern):
```typescript
export const useContentGeneration = (projectId: string) => {
  // Real-time artifact synchronization via Electric SQL
  const { results: artifacts } = useShape({
    url: '/api/electric/v1/shape',
    table: 'artifacts',
    where: `project_id = '${projectId}' AND schema_type = 'content'`,
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  // Project data via TanStack Query
  const { data: project } = useQuery(['project', projectId], () =>
    apiService.getProject(projectId)
  );

  // Chat integration for agent communication
  const { sendMessage } = useChatMessages(projectId);

  const generateContent = async (input: ContentInput) => {
    await sendMessage({
      role: 'user',
      content: `Generate content: ${JSON.stringify(input)}`,
      event_type: 'generation_request'
    });
  };

  return {
    project,
    artifacts: artifacts || [],
    generateContent
  };
};
```

**4. UI Component**:
```typescript
export const ContentGenerator: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { artifacts, generateContent } = useContentGeneration(projectId);
  const [form] = Form.useForm();

  const handleGenerate = async (values: ContentInput) => {
    await generateContent(values);
  };

  return (
    <div>
      <Form form={form} onFinish={handleGenerate} layout="vertical">
        <Form.Item name="title" label="Title" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="requirements" label="Requirements" rules={[{ required: true }]}>
          <TextArea rows={4} />
        </Form.Item>
        <Form.Item name="format" label="Format" rules={[{ required: true }]}>
          <Select>
            <Option value="article">Article</Option>
            <Option value="summary">Summary</Option>
            <Option value="outline">Outline</Option>
          </Select>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">Generate Content</Button>
        </Form.Item>
      </Form>

      <div style={{ marginTop: '24px' }}>
        <h3>Generated Content</h3>
        {artifacts.map(artifact => {
          const content = JSON.parse(artifact.data);
          return (
            <Card key={artifact.id} style={{ marginBottom: '16px' }}>
              <Typography.Title level={4}>{content.title}</Typography.Title>
              <Typography.Paragraph>{content.content}</Typography.Paragraph>
              <Typography.Text type="secondary">
                Words: {content.metadata.word_count}
              </Typography.Text>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
```

This example demonstrates the complete framework lifecycle: schema definition, tool creation, frontend integration with Electric SQL, and UI components. The framework handles all complex aspects (streaming, caching, lineage, validation) while application code focuses on domain-specific business logic.

## Advanced Frontend Integration

### Project Data Hook (`useProjectData`)

The `useProjectData` hook from `ProjectDataContext` provides access to all raw artifacts and transforms with real-time Electric SQL synchronization:

```typescript
// Basic usage - get all project data
const useContentViewer = (projectId: string) => {
  const projectData = useProjectData();

  // Access raw data from Electric SQL
  const { 
    artifacts,           // All artifacts in the project
    transforms,          // All transforms (LLM and human)  
    humanTransforms,     // Human-specific transforms with derivation paths
    transformInputs,     // Transform input relationships
    transformOutputs,    // Transform output relationships
    isLoading,          // Loading state
    error               // Error state
  } = projectData;

  // Mutations for data modification
  const {
    createHumanTransform,  // Create human edits
    updateArtifact,        // Update artifact data
    mutationStates         // Track mutation status
  } = projectData;

  // Find specific artifact types
  const brainstormCollections = artifacts.filter(a => 
    a.schema_type === 'brainstorm_collection'
  );

  const outlineArtifacts = artifacts.filter(a => 
    a.schema_type === 'outline'
  );

  // Check for active transforms
  const activeTransforms = transforms.filter(t => 
    t.streaming_status === 'streaming'
  );

  return {
    brainstormCollections,
    outlineArtifacts,
    activeTransforms,
    isLoading,
    error
  };
};
```

**Advanced Project Data Usage - Transform Tracking:**
```typescript
const useTransformHistory = (artifactId: string) => {
  const projectData = useProjectData();

  const transformHistory = useMemo(() => {
    // Find all transforms that produced this artifact
    const producingTransforms = projectData.transformOutputs
      .filter(output => output.artifact_id === artifactId)
      .map(output => {
        const transform = projectData.transforms.find(t => t.id === output.transform_id);
        const humanTransform = projectData.humanTransforms.find(ht => ht.transform_id === output.transform_id);
        
        return {
          transform,
          humanTransform,
          type: transform?.type,
          createdAt: transform?.created_at
        };
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return producingTransforms;
  }, [artifactId, projectData.transforms, projectData.transformOutputs, projectData.humanTransforms]);

  return transformHistory;
};
```

### Lineage Resolution Hook (`useLineageResolution`)

The `useLineageResolution` hook provides intelligent artifact resolution following the artifact → transform → artifact paradigm:

```typescript
// Basic lineage resolution - find latest version of an artifact
const useLatestArtifactVersion = (sourceArtifactId: string, path: string = '$') => {
  const lineageResult = useLineageResolution({
    sourceArtifactId,
    path,
    options: { enabled: !!sourceArtifactId }
  });

  return {
    latestArtifactId: lineageResult.latestArtifactId,
    hasBeenEdited: lineageResult.hasLineage,
    editDepth: lineageResult.depth,
    isLoading: lineageResult.isLoading,
    error: lineageResult.error
  };
};

// Advanced usage - resolve specific collection item
const useBrainstormIdeaResolution = (collectionId: string, ideaIndex: number) => {
  const path = `$.ideas[${ideaIndex}]`;
  
  const {
    latestArtifactId,
    resolvedPath,
    lineagePath,
    depth,
    hasLineage,
    isLoading,
    error
  } = useLineageResolution({
    sourceArtifactId: collectionId,
    path,
    options: { enabled: !!collectionId }
  });

  // Determine edit status
  const editStatus = useMemo(() => {
    if (depth === 0) return 'original';
    if (hasLineage) return 'edited';
    return 'unknown';
  }, [depth, hasLineage]);

  return {
    ideaArtifactId: latestArtifactId,
    editStatus,
    editDepth: depth,
    lineageChain: lineagePath,
    isLoading,
    error
  };
};
```

**UI Implementation with Lineage Resolution:**
```typescript
const BrainstormIdeaCard: React.FC<{ collectionId: string, ideaIndex: number }> = ({ 
  collectionId, 
  ideaIndex 
}) => {
  const projectData = useProjectData();
  
  // Resolve to latest version of this idea
  const {
    ideaArtifactId,
    editStatus,
    editDepth,
    isLoading
  } = useBrainstormIdeaResolution(collectionId, ideaIndex);

  // Get the actual artifact data
  const ideaArtifact = projectData.getArtifactById(ideaArtifactId);
  const ideaData = ideaArtifact ? JSON.parse(ideaArtifact.data) : null;

  if (isLoading) {
    return <Skeleton active />;
  }

  return (
    <Card 
      className={editStatus === 'edited' ? 'border-green-500' : 'border-blue-500'}
      title={
        <div className="flex items-center gap-2">
          <span>{ideaData?.title || `创意 ${ideaIndex + 1}`}</span>
          {editStatus === 'edited' && (
            <Tag color="green">已编辑 ({editDepth} 次)</Tag>
          )}
          {editStatus === 'original' && (
            <Tag color="blue">AI生成</Tag>
          )}
        </div>
      }
    >
      <p>{ideaData?.body}</p>
      
      {/* Show edit lineage */}
      {editDepth > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          编辑历史: {editDepth} 个版本
        </div>
      )}
    </Card>
  );
};
```

### Effective Brainstorm Ideas Hook

For complex scenarios involving collections and individual edits:

```typescript
const useBrainstormIdeasWithResolution = () => {
  // Get all effective brainstorm ideas using principled lineage resolution
  const { ideas, isLoading, error } = useEffectiveBrainstormIdeas();
  
  // Convert to UI-friendly format
  const latestIdeas = useLatestBrainstormIdeas();

  const organizedIdeas = useMemo(() => {
    return latestIdeas.map((idea, index) => ({
      ...idea,
      displayIndex: index,
      isFromCollection: idea.originalArtifactId !== idea.artifactId,
      editLevel: idea.artifactPath === '$' ? 'standalone' : 'collection-item'
    }));
  }, [latestIdeas]);

  return {
    ideas: organizedIdeas,
    totalCount: organizedIdeas.length,
    editedCount: organizedIdeas.filter(idea => idea.isFromCollection).length,
    isLoading,
    error
  };
};
```

### Artifact Editor Component (`ArtifactEditor`)

The `ArtifactEditor` provides a comprehensive editing interface that respects the immutability paradigm:

```typescript
// Basic usage - edit a brainstorm idea
const BrainstormIdeaEditor: React.FC<{ artifactId: string }> = ({ artifactId }) => {
  const [activeArtifactId, setActiveArtifactId] = useState(artifactId);

  return (
    <ArtifactEditor
      artifactId={activeArtifactId}
      transformName="brainstorm_idea_edit" // Transform schema name
      fields={[
        { field: 'title', component: 'input', maxLength: 100, placeholder: '输入创意标题' },
        { field: 'body', component: 'textarea', rows: 6, placeholder: '详细描述创意内容' }
      ]}
      onTransition={(newArtifactId) => {
        // When user clicks to edit, transition to the new editable artifact
        setActiveArtifactId(newArtifactId);
      }}
      onSaveSuccess={() => {
        message.success('保存成功');
      }}
      statusLabel="创意内容"
      statusColor="blue"
      className="mb-4"
    />
  );
};

// Advanced usage - edit collection item with path resolution
const CollectionItemEditor: React.FC<{ 
  collectionId: string, 
  itemIndex: number 
}> = ({ collectionId, itemIndex }) => {
  const [editingArtifactId, setEditingArtifactId] = useState<string | null>(null);
  const itemPath = `$.ideas[${itemIndex}]`;

  // Resolve to latest version
  const { latestArtifactId } = useLineageResolution({
    sourceArtifactId: collectionId,
    path: itemPath,
    options: { enabled: true }
  });

  const targetArtifactId = editingArtifactId || latestArtifactId || collectionId;

  return (
    <ArtifactEditor
      artifactId={targetArtifactId}
      sourceArtifactId={collectionId}  // Original collection
      path={itemPath}                  // Path within collection
      transformName="collection_item_edit"
      fields={[
        { field: 'title', component: 'input', maxLength: 100 },
        { field: 'body', component: 'textarea', rows: 4 }
      ]}
      onTransition={(newArtifactId) => {
        // User started editing - switch to the new editable artifact
        setEditingArtifactId(newArtifactId);
      }}
      onSaveSuccess={() => {
        message.success('创意已更新');
      }}
      className="collection-item-editor"
    />
  );
};
```

**Complex Artifact Editor - Multi-field with Validation:**
```typescript
const OutlineEditor: React.FC<{ outlineId: string }> = ({ outlineId }) => {
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validateField = useCallback((field: string, value: string) => {
    const errors: Record<string, string> = {};
    
    if (field === 'title' && value.length < 5) {
      errors.title = '标题至少需要5个字符';
    }
    
    if (field === 'synopsis' && value.length < 50) {
      errors.synopsis = '简介至少需要50个字符';
    }

    setValidationErrors(prev => ({ ...prev, ...errors }));
    return Object.keys(errors).length === 0;
  }, []);

  return (
    <div className="outline-editor-container">
      <ArtifactEditor
        artifactId={outlineId}
        transformName="outline_edit"
        fields={[
          { 
            field: 'title', 
            component: 'input', 
            maxLength: 200,
            placeholder: '输入故事标题'
          },
          { 
            field: 'synopsis', 
            component: 'textarea', 
            rows: 8,
            placeholder: '输入故事简介'
          },
          { 
            field: 'genre', 
            component: 'input', 
            maxLength: 50,
            placeholder: '例如：现代甜宠、古装复仇'
          }
        ]}
        onSaveSuccess={() => {
          message.success('大纲已保存');
          setValidationErrors({});
        }}
        statusLabel="故事大纲"
        statusColor="purple"
        className="outline-editor"
      />
      
      {Object.keys(validationErrors).length > 0 && (
        <Alert
          type="warning"
          message="验证错误"
          description={
            <ul>
              {Object.entries(validationErrors).map(([field, error]) => (
                <li key={field}>{error}</li>
              ))}
            </ul>
          }
          className="mt-2"
        />
      )}
    </div>
  );
};
```

### Complete Integration Example

Here's a comprehensive example showing how all components work together:

```typescript
const ProjectWorkspace: React.FC<{ projectId: string }> = ({ projectId }) => {
  const projectData = useProjectData();
  const { workflowNodes } = useWorkflowNodes();
  const { ideas: effectiveIdeas } = useEffectiveBrainstormIdeas();

  // Track active editing states
  const [activeEditingSessions, setActiveEditingSessions] = useState<Set<string>>(new Set());

  const handleStartEditing = useCallback((artifactId: string) => {
    setActiveEditingSessions(prev => new Set(prev).add(artifactId));
  }, []);

  const handleFinishEditing = useCallback((artifactId: string) => {
    setActiveEditingSessions(prev => {
      const newSet = new Set(prev);
      newSet.delete(artifactId);
      return newSet;
    });
  }, []);

  if (projectData.isLoading) {
    return <Spin size="large" />;
  }

  return (
    <div className="project-workspace">
      {/* Workflow Progress */}
      <Card title="项目进度" className="mb-6">
        <div className="flex items-center gap-4">
          {workflowNodes.map((node, index) => (
            <div key={node.id} className="flex items-center">
              <div 
                className={`px-3 py-2 rounded ${
                  node.isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {node.title}
              </div>
              {index < workflowNodes.length - 1 && (
                <ArrowRightOutlined className="mx-2 text-gray-400" />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Brainstorm Ideas Section */}
      <Card title="创意想法" className="mb-6">
        <Row gutter={[16, 16]}>
          {effectiveIdeas.map((idea, index) => {
            const isEditing = activeEditingSessions.has(idea.artifactId);
            
            return (
              <Col xs={24} md={12} lg={8} key={`${idea.artifactId}-${idea.artifactPath}`}>
                <ArtifactEditor
                  artifactId={idea.artifactId}
                  sourceArtifactId={idea.originalArtifactId}
                  path={idea.artifactPath}
                  transformName="brainstorm_idea_edit"
                  fields={[
                    { field: 'title', component: 'input', maxLength: 100 },
                    { field: 'body', component: 'textarea', rows: 4 }
                  ]}
                  onTransition={(newArtifactId) => {
                    handleStartEditing(newArtifactId);
                  }}
                  onSaveSuccess={() => {
                    handleFinishEditing(idea.artifactId);
                    message.success(`创意 ${index + 1} 已保存`);
                  }}
                  statusLabel={`创意 ${index + 1}`}
                  statusColor={isEditing ? "green" : "blue"}
                  className="h-full"
                />
              </Col>
            );
          })}
        </Row>
      </Card>

      {/* Show active mutations */}
      {projectData.mutationStates.artifacts.size > 0 && (
        <Card title="保存状态" size="small">
          <div className="text-sm text-gray-600">
            正在保存 {projectData.mutationStates.artifacts.size} 个更改...
          </div>
        </Card>
      )}
    </div>
  );
};
```

These examples demonstrate the complete integration of the Transform Artifact Framework's frontend components, showing how lineage resolution, project data management, and artifact editing work together to provide a seamless user experience while maintaining the immutable artifact → transform → artifact paradigm.

## Centralized Action Items System

The framework supports a sophisticated centralized action system that separates content editing from workflow actions, providing a clean and intuitive user experience for applications with complex linear workflows.

### Design Philosophy

**Main Area for Editing** - The primary content area is dedicated to editing and viewing content, especially large text fields and complex data structures

**Bottom Actions for Workflow** - All workflow actions (buttons, forms, parameters) are centralized in a bottom section for consistent user experience

**Linear Progression** - Actions follow strict linear workflow progression based on artifact lineage and project state

**Smart State Management** - Actions automatically appear/disappear based on current project state and available artifacts

### Action Items Architecture

**Centralized Action Management**:
- **ActionItemsSection Component** - Sticky bottom section that displays all available actions
- **Action Computation Logic** - `computeParamsAndActions()` function analyzes project state and determines available actions
- **Global State Management** - Action store with localStorage persistence for form data and selections
- **Linear Workflow Detection** - Automatic stage detection based on artifact lineage analysis

**Action Components Pattern**:
```typescript
// Base interface for all action components
interface BaseActionProps {
  projectId: string;
  onSuccess: (result: any) => void;
  onError: (error: Error) => void;
}

// Action item definition
interface ActionItem {
  id: string;
  type: 'form' | 'button' | 'selection';
  title: string;
  description?: string;
  component: React.ComponentType<BaseActionProps>;
  props: Record<string, any>;
  enabled: boolean;
  priority: number;
}

// Computed actions result
interface ComputedActions {
  actions: ActionItem[];
  currentStage: string;
  hasActiveTransforms: boolean;
}
```

**Smart Action Logic**:
- **Leaf Node Detection** - Actions only appear when artifacts are "leaf nodes" (no descendants in transform chain)
- **Dependency Validation** - Each action validates required predecessor artifacts exist
- **Loading State Management** - Actions hide during active transforms to prevent conflicts
- **Error State Handling** - Failed transforms show retry options and error messages

**Form Data Persistence**:
- **Auto-Save Drafts** - All form data automatically saved to localStorage with project scoping
- **Selection State** - User selections persist across page refreshes
- **Form Validation** - Real-time validation with helpful error messages
- **Optimistic Updates** - Form submissions use optimistic state management

### Implementation Pattern

**Action Computation Function**:
```typescript
export const computeParamsAndActions = (projectData: ProjectDataContextType): ComputedActions => {
  const currentStage = detectCurrentStage(projectData);
  const hasActiveTransforms = checkActiveTransforms(projectData);
  
  if (hasActiveTransforms) {
    return { actions: [], currentStage, hasActiveTransforms: true };
  }
  
  const actions = generateActionsForStage(currentStage, projectData);
  return { actions, currentStage, hasActiveTransforms: false };
};

// Stage detection based on artifact lineage
const detectCurrentStage = (projectData: ProjectDataContextType): string => {
  // Analyze artifact lineage to determine current workflow stage
  const leafArtifacts = findLeafArtifacts(projectData.artifacts, projectData.transformInputs);
  const artifactTypes = leafArtifacts.map(a => a.schema_type);
  
  // Return appropriate stage based on available artifacts
  if (artifactTypes.includes('final_output')) return 'completed';
  if (artifactTypes.includes('processed_content_')) return 'processing';
  if (artifactTypes.includes('user_input')) return 'input_ready';
  return 'initial';
};
```

**Action Component Example**:
```typescript
export const ExampleActionComponent: React.FC<BaseActionProps> = ({ 
  projectId, onSuccess, onError 
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({});

  const handleAction = async () => {
    setLoading(true);
    try {
      const result = await executeAction(projectId, formData);
      onSuccess(result);
    } catch (error) {
      onError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space>
      <Form onFinish={handleAction}>
        <Form.Item name="parameter" rules={[{ required: true }]}>
          <Input placeholder="Enter parameter" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Execute Action
          </Button>
        </Form.Item>
      </Form>
    </Space>
  );
};
```

**ActionItemsSection Component**:
```typescript
export const ActionItemsSection: React.FC<{ projectId: string }> = ({ projectId }) => {
  const projectData = useProjectData();
  const actionItemsStore = useActionItemsStore();
  
  const { actions, currentStage, hasActiveTransforms } = useMemo(() => 
    computeParamsAndActions(projectData),
    [projectData]
  );
  
  if (hasActiveTransforms) {
    return (
      <div className="action-items-loading">
        <Spin /> Processing...
      </div>
    );
  }
  
  return (
    <div className="action-items-section">
      <div className="current-stage">
        Current Stage: {currentStage}
      </div>
      {actions.map(action => (
        <ActionItemRenderer 
          key={action.id} 
          action={action}
          projectId={projectId}
          onSuccess={(result) => {
            message.success('Action completed successfully');
          }}
          onError={(error) => {
            message.error(`Action failed: ${error.message}`);
          }}
        />
      ))}
    </div>
  );
};
```

### Benefits

- **Consistent UX** - All actions follow the same visual and behavioral patterns
- **Reduced Cognitive Load** - Users always know where to find actions (bottom of screen)
- **Preserved Editing** - Main content area remains focused on editing and viewing
- **Workflow Guidance** - Clear progression through linear workflow stages
- **State Persistence** - No lost form data or selections during navigation
- **Framework Agnostic** - Can be adapted to any workflow with artifact lineage

### Development Guidelines

**Action Component Guidelines**:
- **Keep Actions Small** - Action components should focus on buttons, forms, and immediate parameters
- **Avoid Large Text Editing** - Large text fields belong in the main content area, not action items
- **Use BaseActionProps** - All action components must extend `BaseActionProps` interface
- **Validate Prerequisites** - Check for required artifacts before enabling actions
- **Handle Loading States** - Show loading indicators during action execution
- **Provide Clear Feedback** - Use success/error callbacks for user feedback

**Main Area vs Action Items**:
- **Main Area**: Large text editing, complex data structures, detailed content viewing
- **Action Items**: Workflow buttons, parameter forms, immediate action controls

## YJS Integration for Real-time Collaboration

The Transform Artifact Framework integrates YJS (Yjs) for real-time collaborative editing while maintaining the immutable artifact → transform → artifact paradigm.

### Architecture Integration

**Hybrid Approach**:
- **Artifacts remain immutable** - YJS operates on temporary collaborative documents
- **Transform creation** - Collaborative changes trigger artifact updates via transforms
- **Audit trail preservation** - All changes tracked through transform system
- **Conflict resolution** - YJS handles real-time conflicts, transforms handle persistence

### YJS Document Structure

```typescript
// YJS document mirrors artifact structure
const doc = new Y.Doc();
const yMap = doc.getMap('content');
const yText = doc.getText('description');
const yArray = doc.getArray('items');

// Sync with artifact data
yMap.set('title', artifact.data.title);
yText.insert(0, artifact.data.description);
```

### Database Schema for YJS

```sql
-- YJS document storage per artifact
CREATE TABLE artifact_yjs_documents (
  id SERIAL PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id),
  room_id TEXT NOT NULL UNIQUE,
  document_state BYTEA, -- Encoded YJS document state
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- YJS updates (for Electric SQL streaming)
CREATE TABLE artifact_yjs_updates (
  id SERIAL PRIMARY KEY,
  room_id TEXT NOT NULL,
  project_id TEXT NOT NULL, -- For access control
  update BYTEA NOT NULL,
  client_id TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- YJS awareness (user presence)
CREATE TABLE artifact_yjs_awareness (
  client_id TEXT,
  room_id TEXT NOT NULL,
  project_id TEXT NOT NULL, -- For access control
  update BYTEA NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, room_id)
);
```

### YJS Context Provider System

**Context-Based Architecture**: The framework uses a context-based approach for YJS integration:

```typescript
// Context provider for artifact-level YJS management
<YJSArtifactProvider artifactId={artifactId}>
  <YJSTextField path="title" placeholder="输入标题..." />
  <YJSArrayField path="themes" placeholder="每行一个主题..." />
  <YJSTextField path="characters.male_lead.name" placeholder="男主姓名..." />
</YJSArtifactProvider>
```

**Key Features**:
- **Path-based field access**: JSON path support (e.g., `"characters.male_lead.name"`)
- **Optimistic updates**: Immediate UI updates with automatic conflict resolution
- **Smart merging**: Combines YJS data with local optimistic updates
- **Safe defaults**: Returns empty arrays/strings for undefined paths
- **Error handling**: Graceful handling of malformed data and path errors

### YJS Field Components

**Specialized YJS Components**:
- **YJSTextField**: Click-to-edit text input with debounced auto-save
- **YJSTextAreaField**: Multi-line text editing with auto-sizing
- **YJSArrayField**: Array editing with textarea (one item per line)
- **Keyboard shortcuts**: Enter to save, Escape to cancel
- **Visual feedback**: Hover states, loading indicators, collaborative mode indicators

### Collaborative Transform Pattern

```typescript
// YJS changes trigger transform creation
yText.observe((event) => {
  if (event.transaction.local) {
    // Local change - create human transform
    createHumanTransform({
      sourceArtifactId: artifact.id,
      changes: extractChanges(event),
      collaborativeSession: doc.guid
    });
  }
});
```

### Benefits for Framework Applications

- **Real-time UX** - Immediate visual feedback during collaboration
- **Preserved Immutability** - Artifact history remains complete
- **Scalable Collaboration** - Support for multiple simultaneous editors
- **Framework Compatibility** - Works with existing transform patterns

### YJS-Enhanced Frontend Components

**Collaborative Artifact Editor**:
```typescript
const CollaborativeArtifactEditor = ({ artifactId, field }) => {
  const { doc, provider, isConnected } = useYJSArtifact(artifactId);
  const yText = doc.getText(field);
  
  return (
    <YJSTextEditor
      yText={yText}
      placeholder="Start typing..."
      onSave={(content) => {
        // Create transform when collaboration session ends
        createHumanTransform({
          sourceArtifactId: artifactId,
          fieldUpdates: { [field]: content }
        });
      }}
    />
  );
};
```

### Implementation Status

**Completed Features**:
- ✅ Complete YJS infrastructure (database, backend services, frontend hooks)
- ✅ Context-based editing with path-based field editing and optimistic updates
- ✅ Real-time synchronization via YJS documents syncing with Electric SQL
- ✅ Major component migrations (BrainstormInputEditor, SingleBrainstormIdeaEditor, OutlineSettingsDisplay)
- ✅ Authentication with proper project-based access control
- ✅ Bug fixes for infinite loops and Electric proxy issues

**Architecture Decision**: Context-based approach instead of direct YJS integration provides:
- **Simpler component API**: Path-based field access instead of YJS document manipulation
- **Better error handling**: Context handles malformed data and missing paths
- **Optimistic updates**: Immediate UI feedback with automatic conflict resolution
- **Unified state**: Single context manages all YJS operations for an artifact
- **Developer experience**: Easy to use, no YJS knowledge required for component authors

## Summary

The Transform Artifact Framework provides a complete foundation for sophisticated data transformation applications with intelligent agent orchestration, immutable artifact management, real-time collaboration via YJS, and enterprise-grade development tooling. Applications built on this framework benefit from automatic lineage tracking, type-safe operations, advanced caching, and seamless real-time collaborative editing while maintaining focus on domain-specific business logic. 