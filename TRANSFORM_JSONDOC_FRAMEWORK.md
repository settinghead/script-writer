# Transform Jsondoc Framework

A comprehensive data transformation and jsondoc management framework with intelligent agent orchestration, real-time collaboration, and complete audit trail capabilities built on PostgreSQL + Electric SQL + TypeScript.

## Overview

The Transform Jsondoc Framework provides a sophisticated foundation for applications requiring intelligent content processing, immutable data management, and real-time collaboration capabilities.

**Key Features**:
- **Intelligent Agent Orchestration** - Context-aware agents with tool-based decision making
- **Immutable Jsondoc Management** - Complete audit trail with flexible editing capabilities  
- **Real-time Synchronization** - Electric SQL integration for instant cross-client updates
- **Schema-Driven Architecture** - Type-safe operations with Zod validation throughout
- **Advanced Caching System** - Development-optimized streaming response caching
- **Comprehensive Testing Framework** - React component testing with YJS collaboration mocking

## Core Concepts

### Understanding Jsondocs and Transforms

At its heart, the framework operates on two fundamental concepts that work together to create a complete data transformation system:

#### **Jsondocs: The Data Containers**
Think of jsondocs as **immutable snapshots of content** at specific points in time. Like taking a photograph, once an jsondoc is created, it never changes. This could be:

- **A user's initial story idea** - "I want a romance story about a chef"
- **AI-generated content** - A detailed story outline created by an AI model
- **User-edited content** - The same outline after the user modified character names
- **Processed data** - A script generated from the outline

Each jsondoc contains:
- **The actual data** (story text, character details, etc.)
- **Metadata** about when it was created and by what process
- **Type information** that defines its structure and purpose

#### **Transforms: The Change Agents**
Transforms are **the processes that create new jsondocs from existing ones**. They're like functions that take input jsondocs and produce output jsondocs, but with complete tracking of what happened and why.

The framework recognizes two fundamentally different types of transforms:

### **Human Transforms: When People Edit Content**

**What they are**: Human transforms occur when a person directly edits, modifies, or derives content from existing jsondocs through user interfaces.

**How they work**:
- User sees AI-generated content in an editing interface
- User makes changes (edit text, select options, modify fields)
- System creates a new "user_input" jsondoc with the changes
- The original AI-generated jsondoc remains unchanged
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
Result: New jsondoc with user's version + transform tracking the change
```

**Technical implementation**:
```typescript
// Human transform triggered by edit interface
const humanTransform = {
  type: 'human',
  trigger: 'user_edit',
  input_jsondocs: [originalAIContent],
  edit_path: '/characters/0/name',
  user_id: 'user-123',
  streaming_status: 'completed'
};
```

### **Machine Transforms: When AI Processes Content**

**What they are**: Machine transforms occur when AI models, algorithms, or automated processes generate new content from existing jsondocs.

**How they work**:
- System analyzes existing jsondocs (user requirements, previous content)
- AI model processes the input using prompts and context
- AI generates new content (stories, outlines, scripts)
- System creates new "ai_generated" jsondocs with the output
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
Result: New "ai_generated" jsondoc + transform tracking the process
```

**Technical implementation**:
```typescript
// Machine transform triggered by AI agent
const machineTransform = {
  type: 'llm',
  trigger: 'agent_request',
  input_jsondocs: [userRequest, contextJsondocs],
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

Every jsondoc has an `origin_type` that indicates how it was created:

- **`ai_generated`** - Created by machine transforms (LLM, algorithms)
- **`user_input`** - Created by human transforms (direct user edits)
- **`decomposed_from_collection`** - Extracted from larger jsondocs for individual editing

**Why origin types matter**:
- **Edit permissions** - Only user_input jsondocs can be directly modified
- **UI behavior** - Different interfaces for AI vs human content
- **Data collection** - Track human preferences and corrections
- **Quality control** - Prevent accidental corruption of AI outputs

### **Schema Types: Understanding Content Structure**

Jsondocs also have `schema_type` that defines their data structure:

- **`brainstorm_collection`** - Multiple story ideas grouped together
- **`brainstorm_idea`** - Individual story idea
- **`brainstorm_input_params`** - Parameters for brainstorm generation
- **`outline_settings`** - Detailed story structure with characters and plot
- **`outline_settings_input`** - Input parameters for outline generation
- **`chronicles`** - Chronological story timeline
- **`chronicles_input`** - Input parameters for chronicles generation

**Why schema types matter**:
- **Validation** - Ensure data integrity and type safety via JsondocSchemaRegistry
- **UI generation** - Automatically create appropriate editing interfaces
- **Transform compatibility** - Match inputs/outputs correctly
- **Evolution** - Version schemas as requirements change

### **TypedJsondoc System**

The framework uses a sophisticated TypeScript typing system with `TypedJsondoc`:

```typescript
// TypedJsondoc is a discriminated union based on schema_type
export type TypedJsondoc =
    | JsondocWithData<'brainstorm_collection', 'v1', BrainstormIdeaCollectionV1>
    | JsondocWithData<'brainstorm_idea', 'v1', BrainstormIdeaV1>
    | JsondocWithData<'brainstorm_input_params', 'v1', BrainstormParamsV1>
    | JsondocWithData<'outline_settings', 'v1', OutlineSettingsV1>
    | JsondocWithData<'chronicles', 'v1', ChroniclesV1>
    // ... more types

// Each jsondoc has strongly typed data based on its schema_type
export interface JsondocWithData<
    SchemaType extends string, 
    SchemaVersion extends string, 
    Data
> extends Omit<Jsondoc, 'schema_type' | 'schema_version' | 'data'> {
    schema_type: SchemaType;
    schema_version: SchemaVersion;
    data: Data;
}
```

**Benefits of TypedJsondoc**:
- **Type Safety** - Compile-time validation of jsondoc data structures
- **IntelliSense** - Full IDE support for jsondoc properties
- **Runtime Validation** - Zod schema validation via JsondocSchemaRegistry
- **Versioning** - Built-in support for schema evolution

### **Migration from Legacy Typing System**

The framework recently underwent a major typing refactoring to improve type safety and developer experience:

**What Changed**:
- **Removed `jsondoc.type` field** - Replaced with `schema_type` and `origin_type`
- **Removed `type_version` field** - Replaced with `schema_version`
- **Consolidated schema names** - Cleaner, more consistent naming (e.g., `brainstorm_idea_collection` → `brainstorm_collection`)
- **Introduced TypedJsondoc** - Discriminated union types for compile-time safety
- **Centralized JsondocSchemaRegistry** - Single source of truth for all schema validation

**Database Migration**:
```sql
-- Migration 20241201_008_refactor_jsondoc_types.ts
-- Added new columns
ALTER TABLE jsondocs ADD COLUMN schema_type TEXT;
ALTER TABLE jsondocs ADD COLUMN schema_version TEXT;
ALTER TABLE jsondocs ADD COLUMN origin_type TEXT;

-- Migrated existing data
UPDATE jsondocs SET schema_type = type, schema_version = type_version;
UPDATE jsondocs SET origin_type = CASE 
  WHEN type = 'user_input' THEN 'user_input' 
  ELSE 'ai_generated' 
END;
```

**Code Migration Pattern**:
```typescript
// OLD: Legacy typing
interface OldJsondoc {
  type: string;
  type_version: string;
  data: any;
}

// NEW: TypedJsondoc system
interface NewJsondoc {
  schema_type: TypedJsondoc['schema_type'];
  schema_version: string;
  origin_type: 'ai_generated' | 'user_input';
  data: any; // Strongly typed based on schema_type
}

// Usage
const jsondoc: TypedJsondoc = {
  schema_type: 'brainstorm_collection',
  schema_version: 'v1',
  origin_type: 'ai_generated',
  data: { ideas: [...], platform: '...', genre: '...' }
};
```

**Benefits of Migration**:
- **Stronger Type Safety** - Compile-time validation of jsondoc structures
- **Better Developer Experience** - IntelliSense and autocomplete for jsondoc properties
- **Centralized Validation** - Single JsondocSchemaRegistry for all schema definitions
- **Cleaner Architecture** - Separation of concerns between schema structure and origin source

**Remaining Cleanup**:
The migration maintains backward compatibility by keeping the old `type` and `type_version` columns. Future work includes:
- Remove deprecated columns in a future migration
- Update remaining references to `jsondoc.type` in client code
- Complete migration of all `type_version` references to `schema_version`
- Standardize all schema validation to use JsondocSchemaRegistry

### **The Immutability Principle**

**Core rule**: Once created, jsondocs never change. All modifications create new jsondocs.

**Why immutability**:
- **Complete history** - Never lose previous versions
- **Parallel experimentation** - Try different approaches simultaneously
- **Collaboration safety** - Multiple users can work without conflicts
- **Debugging power** - Trace any issue through the complete chain

**The one exception**: During streaming, AI can update jsondocs in real-time for better UX, but this is carefully controlled and only for active generation processes.

### **Putting It All Together**

The framework creates a **living history** of content creation where:
- Every user action is preserved
- Every AI generation is tracked
- Every change can be understood and reversed
- Every improvement can be learned from

This enables applications that are not just functional, but continuously improving through the natural interaction between human creativity and machine intelligence.

## Core Paradigm: Jsondoc → Transform → Jsondoc

### The Fundamental Pattern

The Transform Jsondoc Framework is built on a single, powerful paradigm: **Jsondoc → Transform → Jsondoc**. Every data modification flows through this pattern, creating an immutable chain of transformations that preserves complete history while enabling flexible editing.

**Core Concept**:
```
Input Jsondoc(s) → Transform (Human or LLM) → Output Jsondoc(s)
```

This simple pattern underlies all data operations in the framework, from simple edits to complex AI-powered content generation.

### Why This Paradigm?

#### 1. **Immutability by Design**
Unlike traditional CRUD systems that overwrite data, every change creates new jsondocs while preserving the original. This provides:

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
const effectiveJsondoc = await resolveLatestVersion(originalJsondocId);
```

**Dependency Tracking**:
```typescript
// Understand what needs updating when something changes
const affectedJsondocs = await findDependentJsondocs(changedJsondocId);
```

**Conflict Resolution**:
```typescript
// Handle multiple edits intelligently
const mergedResult = await resolveBranchingEdits(conflictingJsondocs);
```

### The Streaming Exception

The framework maintains strict immutability with one carefully designed exception: **streaming updates**.

**Why the Exception?**
- **Real-time UX** - Users expect immediate feedback during AI generation
- **Performance** - Avoid creating thousands of intermediate jsondocs during streaming
- **Resource Management** - Streaming generates massive amounts of transient data
- **Practical Necessity** - The intermediate steps aren't valuable to preserve

**How It Works**:
```typescript
// During streaming, output jsondocs can be updated in-place
if (transform.streaming_status === 'active') {
  await updateJsondocInPlace(outputJsondoc, newChunk);
} else {
  // Normal immutable operation
  await createNewJsondoc(transformedData);
}
```

**Safe Streaming**:
- Only **pending** transforms can update their output jsondocs
- Only **leaf-level** jsondocs (no dependents) can be streamed
- Stream completion **finalizes** the jsondoc as immutable
- **Human transforms** to user_input jsondocs can stream for live editing

### Transform Types & Triggers

Building on the conceptual foundation above, transforms are triggered through specific mechanisms:

#### **Machine Transforms (LLM/AI)**
Triggered by AI agents, API calls, or automated processes:
```typescript
const machineTransform = {
  type: 'llm',
  trigger: 'agent_request',
  input_jsondocs: [userRequest, contextJsondocs],
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
  input_jsondocs: [originalContent],
  edit_path: '/items/0/title',
  user_id: 'user-123',
  streaming_status: 'completed'
};
```

**Key Implementation Detail**: Human transforms are typically triggered through edit interfaces (like those in `jsondocRoutes.ts`) that allow users to modify specific fields or sections of AI-generated content, creating new `user_input` jsondocs while preserving the original AI-generated versions.

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
1. User Request Jsondoc ("Create a romance story about a chef")
   ↓ (MACHINE Transform - AI brainstorming)
2. AI-Generated Ideas Collection (3 story concepts)
   ↓ (HUMAN Transform - user selects idea #2 via edit interface)  
3. User-Selected Idea Jsondoc (origin_type: user_input)
   ↓ (MACHINE Transform - AI outline generation)
4. AI Story Outline Jsondoc (detailed plot, characters, episodes)
   ↓ (HUMAN Transform - user edits character name "John" → "Maria")
5. User-Refined Outline Jsondoc (origin_type: user_input)
   ↓ (MACHINE Transform - AI script generation)
6. AI Episode Script Jsondoc (full dialogue and scenes)
   ↓ (HUMAN Transform - user refines dialogue in specific scenes)
7. User-Polished Script Jsondoc (origin_type: user_input)
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
- **ALWAYS respect the jsondoc → transform → jsondoc structure** when implementing data flow logic
- Every data modification MUST be tracked through transforms with proper input/output jsondoc relationships
- Use `TransformExecutor` for all data modifications that need traceability
- Transforms must specify type ('llm' or 'human'), execution context, and status
- **Streaming Exception Rule**: Only pending transforms can update their output jsondocs in-place during streaming

### 2. Agent-Driven Operations
All major operations flow through a context-aware agent framework:
- **Tool-Based Decision Making** - Agents automatically select appropriate tools based on request analysis
- **Natural Language Interface** - Conversational interaction with intelligent routing
- **Context Enrichment** - Maintains project context and provides comprehensive background
- **Dual-Mode Operation** - Automatically detects generation vs editing requests

**Agent Workflow**:
```
User Request → Agent Analysis → Context Enrichment → Tool Selection → Execution → Jsondoc Creation
```

### 3. Lineage Resolution & Type System
**Technical Implementation**: Advanced graph traversal and type management for flexible editing while maintaining immutability.

**Lineage Resolution Algorithm**:
- **Latest Version Detection** - Automatically resolve to most recent jsondoc in edit chains
- **Branch Merging** - Handle multiple simultaneous edits to the same content
- **Collection Decomposition** - Break collections into individual jsondocs for granular editing
- **Dependency Tracking** - Understand cascading effects of changes

**Dual-Type Architecture**:
- **Schema Types** (`schema_type`) - Define data structure (e.g., `brainstorm_collection`, `outline_settings`)
- **Origin Types** (`origin_type`) - Define creation source (`ai_generated`, `user_input`, `decomposed_from_collection`)
- **Editability Logic** - Use origin_type to determine edit permissions and UI behavior
- **Versioned Validation** - All transforms validated against Zod schemas via JsondocSchemaRegistry
- **TypedJsondoc System** - Discriminated union types for compile-time type safety

### 4. Hierarchical Context Architecture
**Parent-Child Context Pattern**: Use parent contexts with child contexts only when human transforms exist, avoiding complex data merging.

**Context Hierarchy Principles**:
- **Parent Context** - Chronicles jsondoc (for all stages) or collection jsondocs (for all items)
- **Child Context** - Individual stage/item jsondocs (only for stages/items that have human transforms)
- **Path-Based Field Access** - For unedited content, use parent context with specific paths (e.g., `stages[0]`)
- **Conditional Context Creation** - Child contexts should only exist when there's actual override data to manage

**Lineage-Based Context Selection**:
```typescript
// Determine which jsondoc to use based on lineage
const hasHumanTransform = useLineageResolution(parentJsondocId, itemPath);
const contextJsondocId = hasHumanTransform ? childJsondocId : parentJsondocId;
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
- **Automatic Mode Switching** - Components automatically switch from read-only to editable based on jsondoc origin_type
- **Visual Feedback** - Clear indicators for read-only vs editable states

**Transform Creation Example**:
```typescript
const handleCreateEditableVersion = useCallback(async () => {
  projectData.createHumanTransform.mutate({
    transformName: 'edit_collection_item',
    sourceJsondocId: parentJsondocId,
    derivationPath: `$.items[${itemIndex}]`,
    fieldUpdates: {}
  });
}, [projectData, parentJsondocId, itemIndex]);
```

### 8. Field Name Consistency Principle
**Schema-UI Alignment**: Ensure UI field names exactly match jsondoc data structure field names.

**Critical Rule**: UI components must use the exact field names from the jsondoc schema, not assumed or convenient names.

**Common Mistake**:
```typescript
// ❌ BAD - UI uses 'content' but data has 'stageSynopsis'
<YJSTextAreaField path="content" />

// ✅ GOOD - UI matches data structure
<YJSTextAreaField path="stageSynopsis" />
```

**Validation Process**:
1. **Check Jsondoc Data** - Always verify actual field names in stored jsondocs
2. **Match Schema Definitions** - Ensure UI field paths match Zod schema field names
3. **Test with Real Data** - Use actual jsondoc data for testing, not mock data
4. **Debug with API Calls** - Use `curl` or API inspection to verify data structure

## Database Architecture

**PostgreSQL + Electric SQL + Kysely**:
- **PostgreSQL 16** - Primary database with logical replication
- **Electric SQL** - Real-time synchronization with authenticated proxy
- **Kysely** - Type-safe database operations with auto-generated types

**Core Tables**:
```sql
-- Enhanced jsondocs with dual-type system
CREATE TABLE jsondocs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  schema_type TEXT NOT NULL,        -- Data structure type (e.g., 'brainstorm_collection')
  schema_version TEXT NOT NULL,     -- Schema version (e.g., 'v1')
  origin_type TEXT NOT NULL,        -- Creation source ('ai_generated', 'user_input')
  data TEXT NOT NULL,               -- JSON data validated by JsondocSchemaRegistry
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
  jsondoc_id TEXT NOT NULL,
  jsondoc_path TEXT DEFAULT '',
  FOREIGN KEY (transform_id) REFERENCES transforms(id),
  FOREIGN KEY (jsondoc_id) REFERENCES jsondocs(id)
);

CREATE TABLE transform_outputs (
  id TEXT PRIMARY KEY,
  transform_id TEXT NOT NULL,
  jsondoc_id TEXT NOT NULL,
  FOREIGN KEY (transform_id) REFERENCES transforms(id),
  FOREIGN KEY (jsondoc_id) REFERENCES jsondocs(id)
);

-- Human transforms with concurrent protection
CREATE TABLE human_transforms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  input_jsondoc_id TEXT NOT NULL,
  output_jsondoc_id TEXT NOT NULL,
  path TEXT NOT NULL,
  transform_name TEXT,
  CONSTRAINT unique_human_transform_per_jsondoc_path 
    UNIQUE (input_jsondoc_id, path)
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
- Output jsondoc starts empty and gets progressively filled during streaming
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

// Initial jsondoc data is empty/minimal
initialData = this.createInitialJsondocData(outputJsondocType);

// LLM generates complete content
finalJsondocData = config.transformLLMOutput 
  ? config.transformLLMOutput(llmOutput, input)
  : llmOutput;
```

### 2. Patch Mode (补丁模式)

**Use Case**: Making precise edits to existing content while preserving unchanged parts

**How It Works**:
- LLM generates JSON Patch operations (RFC 6902 standard)
- Output jsondoc starts with a copy of the original content
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
  originalJsondoc: sourceContent 
}

// Initial jsondoc data is copy of original
initialData = deepClone(executionMode.originalJsondoc);

// Apply patches during streaming
finalJsondocData = await this.applyPatchesToOriginal(
  llmOutput, 
  originalJsondoc, 
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
- **Patch Mode**: Explicitly enabled for editing tools with `extractSourceJsondocs`

**Template Design**:
- **Generation Templates**: Prompt for complete content structures
- **Edit Templates**: Prompt for JSON Patch operations with specific format requirements

**Performance Benefits**:
- **Patch Mode**: Faster processing, preserves unchanged content, better user experience
- **Full-Object Mode**: Simpler implementation, complete content control
- **Streaming Updates**: Both modes support real-time jsondoc updates during generation

**Metadata Tracking**:
```typescript
transformMetadata: {
  execution_mode: executionMode?.mode || 'full-object',
  method: 'unified_patch', // or 'full_generation'
  source_jsondoc_type: sourceJsondoc.type,
  output_jsondoc_type: outputJsondocType,
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
if (config.extractSourceJsondocs && executionMode?.mode === 'patch') {
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

## Template System Architecture

**Schema-Driven Template System**: The framework provides an intelligent template variable system that eliminates manual coordination and reduces boilerplate by 70%.

### Core Template Components

**1. TemplateVariableService**:
- **Default Processing** - Automatically detects jsondoc fields and extracts content
- **YAML Formatting** - Human-readable YAML instead of JSON.stringify for all template variables
- **Custom Override Support** - Tools can provide custom template variable functions while leveraging defaults
- **Schema-Driven Titles** - Extracts human-readable field titles from Zod schema `.describe()` fields

**2. SchemaDescriptionParser**:
- **Intelligent Title Extraction** - Uses punctuation-based heuristics to extract clean titles from Zod descriptions
- **Fallback Handling** - Graceful degradation for schemas without descriptions
- **Consistent Formatting** - Standardized title formatting across all tools

**3. JsondocReference Schema**:
- **Structured References** - Replaces loose `sourceJsondocId` fields with structured objects
- **Rich Metadata** - Includes jsondocId, description, and schemaType for better context
- **Type Safety** - Compile-time validation of jsondoc references

### Template Variable System

**Before (Manual Coordination)**:
```typescript
// Required changes across 7+ files for adding one variable
prepareTemplateVariables: async (input, executionContext) => {
  const sourceJsondoc = await executionContext.jsondocRepo.getJsondoc(input.sourceJsondocId);
  const parsedData = JSON.parse(sourceJsondoc.data);
  
  return {
    title: parsedData.title,
    body: parsedData.body,
    platform: input.platform,
    genre: input.genre,
    otherRequirements: input.otherRequirements // NEW FIELD - manual coordination needed
  };
}
```

**After (Schema-Driven Automation)**:
```typescript
// Adding new field requires only schema change
const InputSchema = z.object({
  jsondocs: z.array(JsondocReferenceSchema),
  platform: z.string(),
  genre: z.string(),
  otherRequirements: z.string() // NEW FIELD - automatically handled
});

// Automatic template variable generation
// %%jsondocs%% - YAML-formatted jsondoc content
// %%params%% - YAML-formatted input parameters
```

### Schema-Driven Template Revolution

The Transform Jsondoc Framework's template system represents a fundamental shift from manual coordination to schema-driven automation, eliminating the most common source of developer friction in LLM-powered applications.

#### The Problem: Manual Template Coordination

**Traditional LLM application development** suffers from a pervasive coordination problem:

```typescript
// 1. Define input schema (schemas/tool-input.ts)
const ToolInputSchema = z.object({
  platform: z.string(),
  genre: z.string(),
  requirements: z.string(),
  // Adding new field requires coordination across 7+ files
  newField: z.string()
});

// 2. Update template variables function (tools/tool.ts)
prepareTemplateVariables: async (input, context) => {
  return {
    platform: input.platform,
    genre: input.genre,
    requirements: input.requirements,
    newField: input.newField // MANUAL: Must remember to add this
  };
}

// 3. Update template file (templates/tool-template.md)
// Platform: {{platform}}
// Genre: {{genre}}
// Requirements: {{requirements}}
// New Field: {{newField}}   // MANUAL: Must remember to add this

// 4. Update frontend form (components/ToolForm.tsx)
<Form.Item name="newField">  // MANUAL: Must remember to add this
  <Input />
</Form.Item>

// 5. Update type definitions (types/tool-types.ts)
// 6. Update validation logic (validation/tool-validation.ts)  
// 7. Update documentation (docs/tool-api.md)
```

**The Coordination Nightmare**:
- **7+ files** must be updated for a single new parameter
- **Manual synchronization** required across schema, template, frontend, and documentation
- **Easy to forget** updating one of the files, causing runtime errors
- **Inconsistent formatting** between different tools and templates
- **No type safety** between schema definitions and template variables
- **Duplicate logic** for extracting jsondoc content across multiple tools

#### The Solution: Schema-Driven Automation

**The new template system** eliminates manual coordination through intelligent schema analysis:

```typescript
// 1. ONLY change required - update schema with rich descriptions
const ToolInputSchema = z.object({
  platform: z.string().describe("Target platform (e.g., 抖音, 快手, 小红书)"),
  genre: z.string().describe("Story genre (e.g., 现代甜宠, 古装复仇)"),
  requirements: z.string().describe("Additional requirements and constraints"),
  newField: z.string().describe("New field description") // ONLY CHANGE NEEDED
});

// 2. Automatic template variable generation
// %%jsondocs%% - YAML-formatted jsondoc content (auto-generated)
// %%params%% - YAML-formatted input parameters (auto-generated)

// 3. Template automatically includes new field
// Parameters:
// %%params%%
// 
// Content:
// %%jsondocs%%

// 4. Frontend automatically validates and displays new field
// 5. Documentation automatically updates
// 6. Type safety automatically enforced
// 7. Consistent YAML formatting across all tools
```

#### Technical Implementation Details

**1. Automatic Schema Analysis**:
```typescript
// TemplateVariableService automatically processes schemas
export class TemplateVariableService {
  async generateTemplateVariables<T>(
    input: T,
    inputSchema: z.ZodSchema<T>,
    executionContext: ExecutionContext
  ): Promise<TemplateVariables> {
    
    // Automatic jsondoc processing
    const jsondocs = await this.processJsondocs(input.jsondocs, executionContext);
    
    // Automatic parameter processing with schema-driven titles
    const params = this.processParameters(input, inputSchema);
    
    return {
      jsondocs: this.formatAsYaml(jsondocs),
      params: this.formatAsYaml(params)
    };
  }
  
  private processParameters<T>(input: T, schema: z.ZodSchema<T>): Record<string, any> {
    const shape = schema._def.shape();
    const processed: Record<string, any> = {};
    
    for (const [key, fieldSchema] of Object.entries(shape)) {
      if (key !== 'jsondocs') { // Skip jsondocs - handled separately
        processed[key] = input[key];
      }
    }
    
    return processed;
  }
}
```

**2. Intelligent Title Extraction**:
```typescript
// SchemaDescriptionParser extracts human-readable titles
export class SchemaDescriptionParser {
  extractTitle(description: string): string {
    // "Target platform (e.g., 抖音, 快手, 小红书)" → "Target platform"
    // "Story genre (e.g., 现代甜宠, 古装复仇)" → "Story genre"
    
    const beforeParen = description.split('(')[0].trim();
    const beforeDash = beforeParen.split(' - ')[0].trim();
    const beforeColon = beforeDash.split(':')[0].trim();
    
    return beforeColon || description;
  }
}
```

**3. Structured Jsondoc References**:
```typescript
// JsondocReference schema provides rich metadata
const JsondocReferenceSchema = z.object({
  jsondocId: z.string().min(1, 'Jsondoc ID is required'),
  description: z.string().min(1, 'Description is required'),
  schemaType: z.string().min(1, 'Schema type is required')
});

// Automatic processing in templates
const jsondocContent = await this.processJsondocs([
  {
    jsondocId: "jsondoc-123",
    description: "User story requirements",
    schemaType: "brainstorm_input_params"
  }
], executionContext);

// Results in clean YAML:
// User story requirements (brainstorm_input_params):
//   platform: 抖音
//   genre: 现代甜宠
//   requirements: 需要去脸谱化的现代都市故事
```

#### Benefits Achieved

**1. Developer Productivity (70% Boilerplate Reduction)**:
```typescript
// OLD: Adding a parameter required 7+ file changes
// NEW: Adding a parameter requires 1 schema change

// Before: ~50 lines of boilerplate per tool
prepareTemplateVariables: async (input, context) => {
  const sourceJsondoc = await context.jsondocRepo.getJsondoc(input.sourceJsondocId);
  const parsedData = JSON.parse(sourceJsondoc.data);
  
  return {
    title: parsedData.title,
    body: parsedData.body,
    platform: input.platform,
    genre: input.genre,
    requirements: input.requirements,
    selectedIdeas: parsedData.ideas?.map((idea, index) => 
      `创意${index + 1}: ${idea.title}\n${idea.body}`
    ).join('\n\n') || ''
  };
}

// After: ~5 lines of schema definition
const InputSchema = z.object({
  jsondocs: z.array(JsondocReferenceSchema),
  platform: z.string().describe("Target platform"),
  genre: z.string().describe("Story genre"),
  requirements: z.string().describe("Additional requirements")
});
```

**2. Type Safety & Validation**:
```typescript
// Automatic compile-time validation
const validatedInput = inputSchema.parse(input); // Throws if invalid

// Automatic runtime validation
if (!validatedInput.platform) {
  throw new Error('Platform is required');
}

// Automatic template variable validation
const templateVars = await service.generateTemplateVariables(
  validatedInput,
  inputSchema,
  executionContext
);
```

**3. Consistent YAML Formatting**:
```yaml
# Before: Inconsistent JSON.stringify output
{"platform":"douyin","genre":"modern_romance","requirements":"去脸谱化的现代都市故事"}

# After: Human-readable YAML
platform: douyin
genre: modern_romance  
requirements: 去脸谱化的现代都市故事
```

**4. Rich Metadata & Context**:
```yaml
# Automatic jsondoc processing with rich context
User Requirements (brainstorm_input_params):
  platform: 抖音
  genre: 现代甜宠
  requirements: 需要去脸谱化，避免刻板印象

Selected Story Ideas (brainstorm_collection):
  ideas:
    - title: 科技公司的甜宠恋爱
      body: 女程序员与产品经理的现代爱情故事...
    - title: 咖啡店的意外邂逅
      body: 独立咖啡店主与投资人的都市浪漫...
```

#### Advanced Usage: Custom Template Variables

**For complex scenarios**, tools can still provide custom template variable functions while leveraging the default service:

```typescript
const customTemplateVariables: CustomTemplateVariableFunction = async (
  input, inputSchema, executionContext, defaultService
) => {
  // Use default processing for most fields
  const defaultVars = await defaultService.generateTemplateVariables(
    input, inputSchema, executionContext
  );
  
  // Add custom processing for complex fields
  const sourceJsondoc = await executionContext.jsondocRepo.getJsondoc(
    input.jsondocs[0].jsondocId
  );
  const parsedData = JSON.parse(sourceJsondoc.data);
  
  const customParams = {
    ...defaultVars.params,
    selectedIdeasText: parsedData.ideas?.map((idea, index) => 
      `创意${index + 1}: ${idea.title}\n${idea.body}`
    ).join('\n\n') || ''
  };
  
  return {
    jsondocs: defaultVars.jsondocs,
    params: defaultService.formatAsYaml(customParams)
  };
};
```

#### Migration Path

**Existing tools** can be gradually migrated to the new system:

```typescript
// Step 1: Update schema with descriptions
const OldInputSchema = z.object({
  sourceJsondocId: z.string(),
  platform: z.string(),
  genre: z.string()
});

const NewInputSchema = z.object({
  jsondocs: z.array(JsondocReferenceSchema),
  platform: z.string().describe("Target platform (e.g., 抖音, 快手)"),
  genre: z.string().describe("Story genre (e.g., 现代甜宠, 古装复仇)")
});

// Step 2: Remove prepareTemplateVariables function
// (Automatic processing takes over)

// Step 3: Update templates to use %%jsondocs%% and %%params%%
// Old: Platform: {{platform}}
// New: Parameters: %%params%%
```

#### Framework Evolution

**The schema-driven approach** represents a fundamental evolution in LLM application development:

**Traditional Approach**:
- Manual coordination across multiple files
- Duplicate logic for similar operations
- Inconsistent formatting and validation
- High maintenance burden
- Error-prone development process

**Schema-Driven Approach**:
- Single source of truth (schema definitions)
- Automatic code generation and validation
- Consistent formatting and behavior
- Low maintenance burden
- Self-documenting and type-safe

**Future Enhancements**:
- **Automatic frontend generation** from schemas
- **Documentation generation** from schema descriptions
- **API endpoint generation** from tool definitions
- **Test case generation** from schema examples
- **Internationalization** support via schema descriptions

This template system revolution eliminates the most common source of developer friction in LLM applications while providing superior type safety, consistency, and maintainability. The result is a development experience where adding new parameters truly requires only schema changes, making the framework both more powerful and easier to use.

### Schema Migration Pattern

**New Input Schema Format**:
```typescript
// OLD: Direct jsondoc ID references
const OldInputSchema = z.object({
  sourceJsondocId: z.string(),
  platform: z.string(),
  genre: z.string()
});

// NEW: Structured jsondoc references
const NewInputSchema = z.object({
  jsondocs: z.array(z.object({
    jsondocId: z.string().min(1, 'Jsondoc ID is required'),
    description: z.string().min(1, 'Description is required'),
    schemaType: z.string().min(1, 'Schema type is required')
  })),
  platform: z.string(),
  genre: z.string()
});
```

### Custom Template Variable Functions

**Advanced Usage**: Tools can provide custom template variable functions while still leveraging the default service:

```typescript
const customTemplateVariables: CustomTemplateVariableFunction = async (
    input, inputSchema, executionContext, defaultService
) => {
    // Custom logic for complex data extraction
    const sourceJsondoc = await executionContext.jsondocRepo.getJsondoc(input.jsondocs[0].jsondocId);
    const parsedData = JSON.parse(sourceJsondoc.data);
    
    // Use default processing for jsondocs
    const jsondocsYaml = await defaultService.getDefaultJsondocProcessing(input.jsondocs, executionContext);
    
    // Custom parameters with complex logic
    const customParams = {
        platform: input.platform,
        genre: input.genre,
        numberOfIdeas: input.numberOfIdeas,
        selectedIdeasText: parsedData.ideas?.map((idea: any, index: number) => 
            `创意${index + 1}: ${idea.title}\n${idea.body}`
        ).join('\n\n') || ''
    };
    
    return {
        jsondocs: jsondocsYaml,
        params: defaultService.formatAsYaml(customParams)
    };
};

// Tool registration with custom function
ToolRegistry.getInstance().registerTool({
    name: 'brainstorm_edit',
    description: 'Edit and improve existing brainstorm ideas',
    inputSchema: BrainstormEditInputSchema,
    templatePath: 'brainstorm_edit',
    customTemplateVariables
});
```

### Template Design Patterns

**Generation Templates (%%params%% focus)**:
```typescript
// Template for creating new content
const generationTemplate = `
创建中国短剧故事创意，要求：

参数：
%%params%%

请生成符合要求的故事创意...
`;
```

**Edit Templates (%%jsondocs%% + %%params%% focus)**:
```typescript
// Template for editing existing content
const editTemplate = `
基于现有内容进行改进：

现有内容：
%%jsondocs%%

改进要求：
%%params%%

请按照要求改进内容...
`;
```

### Benefits Achieved

**Developer Productivity**:
- **70% Boilerplate Reduction** - Adding parameters now requires only schema changes
- **Eliminated Manual Coordination** - No more changes across 7+ files for one variable
- **Consistent YAML Formatting** - Human-readable template variables throughout
- **Type Safety** - Compile-time validation of all template inputs

**Maintainability**:
- **Centralized Logic** - All template processing in TemplateVariableService
- **Schema-Driven Automation** - Templates automatically adapt to schema changes
- **Custom Override Support** - Complex tools can still provide custom logic
- **Intelligent Title Extraction** - Automatic field titles from schema descriptions

**Template Quality**:
- **YAML over JSON** - More readable template variables for LLM processing
- **Rich Context** - Structured jsondoc references with metadata
- **Consistent Formatting** - Standardized variable presentation
- **Schema Validation** - Runtime validation of all template inputs

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
  const { results: jsondocs } = useShape({
    url: '/api/electric/v1/shape',
    table: 'jsondocs', 
    where: `project_id = '${projectId}'`
  });

  // Client state via Zustand
  const { uiState, setUIState } = useProjectStore();

  return { project, jsondocs, uiState };
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
- **Fresh Data Fetching** - Save operations always use current jsondoc data to prevent stale closures
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
**JsondocSchemaRegistry System**:
```typescript
// Centralized schema registry in src/common/schemas/jsondocs.ts
export const JsondocSchemaRegistry = {
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
    
    // 3. Validate output against JsondocSchemaRegistry
    const outputSchema = JsondocSchemaRegistry[transformDef.outputType];
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

// Always use jsondocRepo.userHasProjectAccess(userId, projectId) to validate access
// Never filter jsondocs directly by user_id
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
export async function resolveEffectiveJsondocs(
  inputJsondocIds: string[],
  projectId: string
): Promise<JsondocWithLineage[]> {
  
  // 1. Build complete lineage graph
  const graph = await buildLineageGraph(projectId);
  
  // 2. For each input jsondoc, find the latest effective version
  const resolvedJsondocs = [];
  
  for (const jsondocId of inputJsondocIds) {
    // Find leaf jsondocs that derive from this input
    const leafJsondocs = findLeafJsondocs(graph, jsondocId);
    
    if (leafJsondocs.length > 0) {
      // Use the most recent leaf jsondoc
      const latestLeaf = leafJsondocs.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      
      resolvedJsondocs.push(latestLeaf);
    } else {
      // No derivatives, use original
      resolvedJsondocs.push(await getJsondoc(jsondocId));
    }
  }
  
  return resolvedJsondocs;
}
```

**Lineage Resolution Examples**:
```
Simple Chain:
Jsondoc A → Human Transform → Jsondoc B (leaf)
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
export class JsondocRepository {
  constructor(private db: Database) {}
  
  async createJsondoc(data: CreateJsondocData): Promise<Jsondoc> {
    return this.db
      .insertInto('jsondocs')
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
    private jsondocRepo: JsondocRepository,
    private transformRepo: TransformRepository,
    private chatService: ChatService
  ) {}
  
  async createProject(userId: string, data: CreateProjectData): Promise<Project> {
    // 1. Create project
    const project = await this.createProjectRecord(userId, data);
    
    // 2. Set up initial jsondocs
    await this.initializeProjectJsondocs(project.id);
    
    // 3. Create welcome chat message
    await this.chatService.addSystemMessage(project.id, 'Welcome to your new project!');
    
    return project;
  }
}
```

## Testing Framework

### React Component Testing Architecture

The Transform Jsondoc Framework includes a comprehensive testing system specifically designed for React components with YJS integration, real-time collaboration, and complex jsondoc management scenarios.

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
vi.mock('../../../contexts/YJSJsondocContext', () => ({
    YJSJsondocProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
│   └── transform-jsondoc-framework/
│       └── __tests__/
│           ├── YJSField.test.tsx           # YJS component tests
│           ├── JsondocEditor.test.tsx     # Jsondoc editor tests
│           ├── LineageResolution.test.tsx  # Lineage resolution tests
│           └── README.md                   # Testing documentation
```

### Running Tests

**Test Execution Commands**:
```bash
# Run all tests
npm test -- --run

# Run specific test file
npm test -- --run src/client/transform-jsondoc-framework/__tests__/YJSField.test.tsx

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

**Testing Jsondoc Editor Components**:
```typescript
describe('JsondocEditor Integration', () => {
    it('creates human transforms when editing', async () => {
        const mockCreateTransform = vi.fn();
        
        render(
            <JsondocEditor
                jsondocId="test-jsondoc"
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
    it('resolves to latest jsondoc version', () => {
        const mockLineageData = {
            latestJsondocId: 'latest-jsondoc-123',
            hasLineage: true,
            depth: 2
        };
        
        // Mock lineage resolution hook
        vi.mock('../hooks/useLineageResolution', () => ({
            useLineageResolution: () => mockLineageData
        }));
        
        render(<ComponentUsingLineage sourceJsondocId="original-jsondoc" />);
        
        // Verify component uses latest jsondoc
        expect(screen.getByText('latest-jsondoc-123')).toBeInTheDocument();
    });
});
```

This comprehensive testing framework ensures that Transform Jsondoc Framework applications maintain high quality, reliability, and user experience while supporting complex real-time collaboration and jsondoc management scenarios.

## Development Tools

### TypeScript Script Execution
- **ALWAYS use `./run-ts` when running TypeScript Node.js scripts** - never use `npx tsx` or `node` directly
- The `./run-ts` script handles proper TypeScript configuration, dotenv loading, and module resolution
- Example: `./run-ts src/server/test-script.ts` instead of `npx tsx src/server/test-script.ts`
- run-ts can only run typescript files. DO NOT run inline scripts. Always write down the script in TS file(s).

### Database Operations
- Use `JsondocRepository` and `TransformRepository` for data access
- Run migrations with `npm run migrate`
- Use `./run-ts src/server/scripts/migrate.ts` for migrations
- Unique constraint `unique_human_transform_per_jsondoc_path` prevents concurrent editing race conditions

### Debug Facility & Tool Registry

**Comprehensive Debug System**: The framework provides a complete debug facility for inspecting and testing tool behavior during development.

**ToolRegistry System**:
- **Centralized Tool Management** - All tools registered in a single registry for debug access
- **Tool Metadata** - Complete tool information including schemas, templates, and custom functions
- **Debug UI Integration** - Tools accessible through web-based debug interface

**Debug Backend Endpoints**:
```typescript
// Get all available tools
GET /api/admin/tools
Response: {
  success: true,
  tools: [
    {
      name: "brainstorm_generation",
      description: "Generate story ideas for Chinese short dramas",
      inputSchema: { /* Zod schema definition */ },
      templatePath: "brainstorming",
      hasCustomTemplateVariables: false
    }
  ]
}

// Generate prompt for specific tool
POST /api/admin/tools/:toolName/prompt
Request: {
  toolName: "brainstorm_generation",
  jsondocs: [
    {
      jsondocId: "jsondoc-123",
      description: "User requirements",
      schemaType: "brainstorm_input_params"
    }
  ],
  additionalParams: { platform: "douyin", genre: "modern_romance" }
}
Response: {
  success: true,
  tool: { name: "brainstorm_generation", description: "...", templatePath: "..." },
  input: { /* validated input */ },
  templateVariables: {
    jsondocs: "# Jsondoc Content\n...",
    params: "platform: douyin\ngenre: modern_romance\n..."
  },
  fieldTitles: { platform: "Platform", genre: "Genre" },
  prompt: "Template Variables:\n%%jsondocs%%:\n...\n%%params%%:\n..."
}

// Get project jsondocs for selection
GET /api/admin/jsondocs/:projectId
Response: {
  success: true,
  jsondocs: [
    {
      id: "jsondoc-123",
      schemaType: "brainstorm_input_params",
      schemaVersion: "v1",
      originType: "user_input",
      createdAt: "2024-01-01T00:00:00Z",
      dataPreview: "Platform: douyin, Genre: modern_romance..."
    }
  ]
}
```

**Debug UI Features**:
- **Tool Selection Interface** - Dropdown to select any registered tool
- **Jsondoc Selection** - Multi-select for choosing input jsondocs
- **Parameter Editor** - JSON editor for additional parameters
- **Prompt Inspection** - View complete generated prompts with template variables
- **Schema Viewer** - Inspect tool input/output schemas
- **Real-time Validation** - Immediate feedback on input validation errors

**Usage Examples**:
```typescript
// Register tool with debug facility
ToolRegistry.getInstance().registerTool({
    name: 'content_generation',
    description: 'Generate content based on requirements',
    inputSchema: ContentInputSchema,
    templatePath: 'content_generation',
    customTemplateVariables: customFunction
});

// Access debug UI
// Navigate to: /?raw-context=1
// Select tool, choose jsondocs, set parameters
// View generated prompts and template variables
```

**Debug Authentication**:
- **Development Mode** - Use debug token `debug-auth-token-script-writer-dev`
- **Project Scoping** - Debug operations respect project-based access control
- **Safe Testing** - Debug operations are read-only and don't modify data

**Benefits**:
- **Rapid Development** - Test tools without full application setup
- **Prompt Engineering** - Inspect and refine template variables
- **Schema Validation** - Verify input/output schemas work correctly
- **Tool Integration** - Ensure tools integrate properly with framework
- **Template Debugging** - Debug template variable generation and formatting

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
    ├── repositories/     # Data access layer (jsondocs/transforms)
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
  jsondocRepo: JsondocRepository,
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
        jsondocRepo,
        projectId,
        userId,
        options
      });

      return {
        jsondocId: result.outputJsondoc.id,
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
  // Real-time jsondoc synchronization via Electric SQL
  const { results: jsondocs } = useShape({
    url: '/api/electric/v1/shape',
    table: 'jsondocs',
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
    jsondocs: jsondocs || [],
    generateContent
  };
};
```

**4. UI Component**:
```typescript
export const ContentGenerator: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { jsondocs, generateContent } = useContentGeneration(projectId);
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
        {jsondocs.map(jsondoc => {
          const content = JSON.parse(jsondoc.data);
          return (
            <Card key={jsondoc.id} style={{ marginBottom: '16px' }}>
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

The `useProjectData` hook from `ProjectDataContext` provides access to all raw jsondocs and transforms with real-time Electric SQL synchronization:

```typescript
// Basic usage - get all project data
const useContentViewer = (projectId: string) => {
  const projectData = useProjectData();

  // Access raw data from Electric SQL
  const { 
    jsondocs,           // All jsondocs in the project
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
    updateJsondoc,        // Update jsondoc data
    mutationStates         // Track mutation status
  } = projectData;

  // Find specific jsondoc types
  const brainstormCollections = jsondocs.filter(a => 
    a.schema_type === 'brainstorm_collection'
  );

  const outlineJsondocs = jsondocs.filter(a => 
    a.schema_type === 'outline'
  );

  // Check for active transforms
  const activeTransforms = transforms.filter(t => 
    t.streaming_status === 'streaming'
  );

  return {
    brainstormCollections,
    outlineJsondocs,
    activeTransforms,
    isLoading,
    error
  };
};
```

**Advanced Project Data Usage - Transform Tracking:**
```typescript
const useTransformHistory = (jsondocId: string) => {
  const projectData = useProjectData();

  const transformHistory = useMemo(() => {
    // Find all transforms that produced this jsondoc
    const producingTransforms = projectData.transformOutputs
      .filter(output => output.jsondoc_id === jsondocId)
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
  }, [jsondocId, projectData.transforms, projectData.transformOutputs, projectData.humanTransforms]);

  return transformHistory;
};
```

### Lineage Resolution Hook (`useLineageResolution`)

The `useLineageResolution` hook provides intelligent jsondoc resolution following the jsondoc → transform → jsondoc paradigm:

```typescript
// Basic lineage resolution - find latest version of an jsondoc
const useLatestJsondocVersion = (sourceJsondocId: string, path: string = '$') => {
  const lineageResult = useLineageResolution({
    sourceJsondocId,
    path,
    options: { enabled: !!sourceJsondocId }
  });

  return {
    latestJsondocId: lineageResult.latestJsondocId,
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
    latestJsondocId,
    resolvedPath,
    lineagePath,
    depth,
    hasLineage,
    isLoading,
    error
  } = useLineageResolution({
    sourceJsondocId: collectionId,
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
    ideaJsondocId: latestJsondocId,
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
    ideaJsondocId,
    editStatus,
    editDepth,
    isLoading
  } = useBrainstormIdeaResolution(collectionId, ideaIndex);

  // Get the actual jsondoc data
  const ideaJsondoc = projectData.getJsondocById(ideaJsondocId);
  const ideaData = ideaJsondoc ? JSON.parse(ideaJsondoc.data) : null;

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
      isFromCollection: idea.originalJsondocId !== idea.jsondocId,
      editLevel: idea.jsondocPath === '$' ? 'standalone' : 'collection-item'
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

### Jsondoc Editor Component (`JsondocEditor`)

The `JsondocEditor` provides a comprehensive editing interface that respects the immutability paradigm:

```typescript
// Basic usage - edit a brainstorm idea
const BrainstormIdeaEditor: React.FC<{ jsondocId: string }> = ({ jsondocId }) => {
  const [activeJsondocId, setActiveJsondocId] = useState(jsondocId);

  return (
    <JsondocEditor
      jsondocId={activeJsondocId}
      transformName="brainstorm_idea_edit" // Transform schema name
      fields={[
        { field: 'title', component: 'input', maxLength: 100, placeholder: '输入创意标题' },
        { field: 'body', component: 'textarea', rows: 6, placeholder: '详细描述创意内容' }
      ]}
      onTransition={(newJsondocId) => {
        // When user clicks to edit, transition to the new editable jsondoc
        setActiveJsondocId(newJsondocId);
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
  const [editingJsondocId, setEditingJsondocId] = useState<string | null>(null);
  const itemPath = `$.ideas[${itemIndex}]`;

  // Resolve to latest version
  const { latestJsondocId } = useLineageResolution({
    sourceJsondocId: collectionId,
    path: itemPath,
    options: { enabled: true }
  });

  const targetJsondocId = editingJsondocId || latestJsondocId || collectionId;

  return (
    <JsondocEditor
      jsondocId={targetJsondocId}
      sourceJsondocId={collectionId}  // Original collection
      path={itemPath}                  // Path within collection
      transformName="collection_item_edit"
      fields={[
        { field: 'title', component: 'input', maxLength: 100 },
        { field: 'body', component: 'textarea', rows: 4 }
      ]}
      onTransition={(newJsondocId) => {
        // User started editing - switch to the new editable jsondoc
        setEditingJsondocId(newJsondocId);
      }}
      onSaveSuccess={() => {
        message.success('创意已更新');
      }}
      className="collection-item-editor"
    />
  );
};
```

**Complex Jsondoc Editor - Multi-field with Validation:**
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
      <JsondocEditor
        jsondocId={outlineId}
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

  const handleStartEditing = useCallback((jsondocId: string) => {
    setActiveEditingSessions(prev => new Set(prev).add(jsondocId));
  }, []);

  const handleFinishEditing = useCallback((jsondocId: string) => {
    setActiveEditingSessions(prev => {
      const newSet = new Set(prev);
      newSet.delete(jsondocId);
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
            const isEditing = activeEditingSessions.has(idea.jsondocId);
            
            return (
              <Col xs={24} md={12} lg={8} key={`${idea.jsondocId}-${idea.jsondocPath}`}>
                <JsondocEditor
                  jsondocId={idea.jsondocId}
                  sourceJsondocId={idea.originalJsondocId}
                  path={idea.jsondocPath}
                  transformName="brainstorm_idea_edit"
                  fields={[
                    { field: 'title', component: 'input', maxLength: 100 },
                    { field: 'body', component: 'textarea', rows: 4 }
                  ]}
                  onTransition={(newJsondocId) => {
                    handleStartEditing(newJsondocId);
                  }}
                  onSaveSuccess={() => {
                    handleFinishEditing(idea.jsondocId);
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
      {projectData.mutationStates.jsondocs.size > 0 && (
        <Card title="保存状态" size="small">
          <div className="text-sm text-gray-600">
            正在保存 {projectData.mutationStates.jsondocs.size} 个更改...
          </div>
        </Card>
      )}
    </div>
  );
};
```

These examples demonstrate the complete integration of the Transform Jsondoc Framework's frontend components, showing how lineage resolution, project data management, and jsondoc editing work together to provide a seamless user experience while maintaining the immutable jsondoc → transform → jsondoc paradigm.

## Centralized Action Items System

The framework supports a sophisticated centralized action system that separates content editing from workflow actions, providing a clean and intuitive user experience for applications with complex linear workflows.

### Design Philosophy

**Main Area for Editing** - The primary content area is dedicated to editing and viewing content, especially large text fields and complex data structures

**Bottom Actions for Workflow** - All workflow actions (buttons, forms, parameters) are centralized in a bottom section for consistent user experience

**Linear Progression** - Actions follow strict linear workflow progression based on jsondoc lineage and project state

**Smart State Management** - Actions automatically appear/disappear based on current project state and available jsondocs

### Action Items Architecture

**Centralized Action Management**:
- **ActionItemsSection Component** - Sticky bottom section that displays all available actions
- **Action Computation Logic** - `computeParamsAndActions()` function analyzes project state and determines available actions
- **Global State Management** - Action store with localStorage persistence for form data and selections
- **Linear Workflow Detection** - Automatic stage detection based on jsondoc lineage analysis

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
- **Leaf Node Detection** - Actions only appear when jsondocs are "leaf nodes" (no descendants in transform chain)
- **Dependency Validation** - Each action validates required predecessor jsondocs exist
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

// Stage detection based on jsondoc lineage
const detectCurrentStage = (projectData: ProjectDataContextType): string => {
  // Analyze jsondoc lineage to determine current workflow stage
  const leafJsondocs = findLeafJsondocs(projectData.jsondocs, projectData.transformInputs);
  const jsondocTypes = leafJsondocs.map(a => a.schema_type);
  
  // Return appropriate stage based on available jsondocs
  if (jsondocTypes.includes('final_output')) return 'completed';
  if (jsondocTypes.includes('processed_content_')) return 'processing';
  if (jsondocTypes.includes('user_input')) return 'input_ready';
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
- **Framework Agnostic** - Can be adapted to any workflow with jsondoc lineage

### Development Guidelines

**Action Component Guidelines**:
- **Keep Actions Small** - Action components should focus on buttons, forms, and immediate parameters
- **Avoid Large Text Editing** - Large text fields belong in the main content area, not action items
- **Use BaseActionProps** - All action components must extend `BaseActionProps` interface
- **Validate Prerequisites** - Check for required jsondocs before enabling actions
- **Handle Loading States** - Show loading indicators during action execution
- **Provide Clear Feedback** - Use success/error callbacks for user feedback

**Main Area vs Action Items**:
- **Main Area**: Large text editing, complex data structures, detailed content viewing
- **Action Items**: Workflow buttons, parameter forms, immediate action controls

## YJS Integration for Real-time Collaboration

The Transform Jsondoc Framework integrates YJS (Yjs) for real-time collaborative editing while maintaining the immutable jsondoc → transform → jsondoc paradigm.

### Architecture Integration

**Hybrid Approach**:
- **Jsondocs remain immutable** - YJS operates on temporary collaborative documents
- **Transform creation** - Collaborative changes trigger jsondoc updates via transforms
- **Audit trail preservation** - All changes tracked through transform system
- **Conflict resolution** - YJS handles real-time conflicts, transforms handle persistence

### YJS Document Structure

```typescript
// YJS document mirrors jsondoc structure
const doc = new Y.Doc();
const yMap = doc.getMap('content');
const yText = doc.getText('description');
const yArray = doc.getArray('items');

// Sync with jsondoc data
yMap.set('title', jsondoc.data.title);
yText.insert(0, jsondoc.data.description);
```

### Database Schema for YJS

```sql
-- YJS document storage per jsondoc
CREATE TABLE jsondoc_yjs_documents (
  id SERIAL PRIMARY KEY,
  jsondoc_id TEXT NOT NULL REFERENCES jsondocs(id),
  room_id TEXT NOT NULL UNIQUE,
  document_state BYTEA, -- Encoded YJS document state
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- YJS updates (for Electric SQL streaming)
CREATE TABLE jsondoc_yjs_updates (
  id SERIAL PRIMARY KEY,
  room_id TEXT NOT NULL,
  project_id TEXT NOT NULL, -- For access control
  update BYTEA NOT NULL,
  client_id TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- YJS awareness (user presence)
CREATE TABLE jsondoc_yjs_awareness (
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
// Context provider for jsondoc-level YJS management
<YJSJsondocProvider jsondocId={jsondocId}>
  <YJSTextField path="title" placeholder="输入标题..." />
  <YJSArrayField path="themes" placeholder="每行一个主题..." />
  <YJSTextField path="characters.male_lead.name" placeholder="男主姓名..." />
</YJSJsondocProvider>
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
      sourceJsondocId: jsondoc.id,
      changes: extractChanges(event),
      collaborativeSession: doc.guid
    });
  }
});
```

### Benefits for Framework Applications

- **Real-time UX** - Immediate visual feedback during collaboration
- **Preserved Immutability** - Jsondoc history remains complete
- **Scalable Collaboration** - Support for multiple simultaneous editors
- **Framework Compatibility** - Works with existing transform patterns

### YJS-Enhanced Frontend Components

**Collaborative Jsondoc Editor**:
```typescript
const CollaborativeJsondocEditor = ({ jsondocId, field }) => {
  const { doc, provider, isConnected } = useYJSJsondoc(jsondocId);
  const yText = doc.getText(field);
  
  return (
    <YJSTextEditor
      yText={yText}
      placeholder="Start typing..."
      onSave={(content) => {
        // Create transform when collaboration session ends
        createHumanTransform({
          sourceJsondocId: jsondocId,
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
- **Unified state**: Single context manages all YJS operations for an jsondoc
- **Developer experience**: Easy to use, no YJS knowledge required for component authors

## Summary

The Transform Jsondoc Framework provides a complete foundation for sophisticated data transformation applications with intelligent agent orchestration, immutable jsondoc management, real-time collaboration via YJS, and enterprise-grade development tooling. Applications built on this framework benefit from automatic lineage tracking, type-safe operations, advanced caching, and seamless real-time collaborative editing while maintaining focus on domain-specific business logic. 