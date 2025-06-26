# Script Writer

A collaborative script writing application with AI assistance, real-time collaboration, and project-based workflow management with comprehensive data traceability through a schema-driven transform system and intelligent agent framework.

## Features

### 🔐 Authentication System
- **JWT-based authentication** with HTTP-only cookies for security
- **Test user login** via dropdown selection (xiyang, xiaolin)
- **Debug token support** for development (`debug-auth-token-script-writer-dev`)
- **Extensible provider architecture** ready for future integrations:
  - WeChat login
  - Weibo login  
  - SMS login
  - Password-based login
- **Protected API endpoints** - All AI/LLM requests require authentication
- **Session management** with automatic cleanup

### 🤖 Advanced Agent-Driven AI Framework

The application features a sophisticated **dual-mode agent system** that handles both content generation and intelligent editing through natural language chat interactions.

#### Core Agent Architecture
- **Intelligent agent system** - All major operations routed through context-aware agent framework with tool-based decision making
- **Dual-mode operation** - Agent seamlessly switches between generation mode (creating new content) and editing mode (modifying existing content)
- **Real-time chat interface** - ChatGPT-style conversation interface with resizable sidebar for natural interaction
- **Event-based messaging** - Comprehensive event system tracking user messages, agent thinking, tool calls, and responses
- **Contextual awareness** - Agent maintains project context and can reference previous work across different stages
- **Bilingual support** - Intelligent keyword detection for both English and Chinese user requests

#### Agent Tools & Capabilities
- ✅ **Brainstorm Generation Tool** - Creates new story ideas based on user requirements
- ✅ **Brainstorm Edit Tool** - AI-powered editing of existing ideas through natural language instructions
- ⚠️ **Outline Tool** - Legacy SSE-based implementation, needs Electric SQL migration
- ⚠️ **Episode Script Tool** - Legacy SSE-based implementation, needs Electric SQL migration
- ✅ **Conversational Response** - General purpose chat responses with project context

#### AI-Powered Content Editing System

**Design Rationale**: Traditional content editing requires users to manually modify text fields. Our AI-powered editing system allows users to describe desired changes in natural language, and the agent automatically applies sophisticated edits while maintaining content quality and consistency.

**Key Features**:
- **Natural language editing** - Users can say "make the stories more modern" or "add more romance elements"
- **Context-aware modifications** - Agent understands project background and maintains story coherence
- **Bulk editing support** - Can edit multiple story ideas simultaneously with consistent changes
- **Quality preservation** - Maintains 去脸谱化 (de-stereotyping) principles and platform-specific requirements
- **Complete audit trail** - All AI edits tracked through LLM transforms with full lineage

**Editing Flow**:
```
User: "让这些故事更现代一些，加入一些科技元素"
↓
Agent Analysis: Detects edit request, enriches with context
↓
Tool Selection: Chooses BrainstormEditTool over BrainstormTool
↓
Context Preparation: Provides current ideas + platform requirements + user instructions
↓
LLM Transform: Generates improved versions with modern tech elements
↓
Artifact Creation: Creates new artifacts with proper lineage tracking
↓
UI Update: Real-time display of edited content with edit indicators
```



### 🔄 Advanced Entity-Specific Mutation State Management

#### Isolated Status Tracking System

**Design Problem Solved**: Traditional mutation systems share status across all components, causing visual interference where saving one item shows spinners/checkmarks on all items. Our entity-specific system provides complete isolation.

**Architecture**:
```typescript
// Entity-specific mutation state maps
interface MutationStateMap {
    artifacts: Map<string, EntityMutationState>;
    transforms: Map<string, EntityMutationState>;
    humanTransforms: Map<string, EntityMutationState>;
}

// Direct map access for performance
const isArtifactPending = useIsPending('artifacts', artifactId);
const isArtifactSuccess = useIsSuccess('artifacts', artifactId);
```

**Key Features**:
- **Complete Isolation** - Each artifact's mutation state is completely independent
- **Performance Optimized** - Direct map access instead of function calls for faster lookups
- **Automatic Cleanup** - Success states auto-clear after 2 seconds to prevent stale UI
- **Type Safety** - Full TypeScript support with proper entity type validation
- **Real-time Updates** - Electric SQL integration provides instant state synchronization

#### Advanced Debounced Save with Request Cancellation

**Optimization Problem**: Rapid typing can trigger multiple overlapping save requests, causing race conditions and unnecessary server load.

**Technical Solution**:
```typescript
// Multi-level cancellation system
const abortControllerRef = useRef<AbortController | null>(null);
const debouncedTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

// Cancel previous requests when user types
const debouncedSave = useCallback((fieldUpdates, field) => {
    // Cancel existing timeout for this field
    const existingTimeout = debouncedTimeoutsRef.current.get(field);
    if (existingTimeout) clearTimeout(existingTimeout);
    
    // Cancel any pending HTTP request
    if (abortControllerRef.current) abortControllerRef.current.abort();
    
    // Create new save operation with fresh AbortController
    const timeout = setTimeout(() => {
        // Execute save with cancellation protection
    }, 500);
}, []);
```

**Benefits**:
- **Race Condition Prevention** - AbortController cancels stale requests before new ones start
- **Performance Optimization** - Eliminates unnecessary API calls during rapid typing
- **Resource Management** - Proper cleanup of timeouts and controllers on component unmount
- **User Experience** - Smooth typing without save request interference
- **Field-Level Tracking** - Independent debouncing per form field for optimal responsiveness

### 🔄 Advanced Schema-Driven Transform System with Lineage Resolution

#### Immutable Artifact Architecture with Individual Breakdown

**Design Philosophy**: The system treats AI-generated content as immutable while providing flexible editing capabilities through a sophisticated artifact breakdown and lineage tracking system.

- **Lineage Resolution** - Complex algorithm resolves the "latest version" of any content piece across multiple editing rounds
- **Path-based Editing** - Support for both field-level (`[0].title`) and object-level (`[0]`) modifications
- **Mixed Editing Workflows** - Seamlessly handle chains like: Original → Human Edit → AI Edit → Human Edit

#### Simplified ArtifactEditor with Automatic Mode Detection

**Design Simplification**: Removed complex mode configuration in favor of intelligent automatic detection based on artifact type and transform state.

**Automatic Mode Detection Logic**:
- **User Input Artifacts** (`user_input`) - Always editable if fields are configured
- **LLM Output Artifacts** - Show clickable preview; clicking creates human transform for editing
- **Existing Transforms** - If user has already clicked to edit, show editable interface
- **Fallback** - Default to readonly display

**Benefits of Simplification**:
- **Reduced Complexity** - No more manual mode configuration required
- **Intuitive Behavior** - Editing state determined by content type and user actions
- **Consistent UX** - Predictable editing workflow across all artifact types
- **Maintainable Code** - Fewer configuration options reduce potential for errors

#### Transform Types & Lineage Flow
```
Original Collection (brainstorm_idea[])
├── [0] → Human Transform → User Input → LLM Transform → Brainstorm Idea
├── [1] → LLM Transform → Brainstorm Idea → Human Transform → User Input  
└── [2] → (unchanged, references original collection)
```

**Transform Categories**:
- **Human Transforms** - Track manual user modifications with timestamps and user attribution
- **LLM Transforms** - Record AI-powered edits with complete context and parameters
- **Schema Validation** - All transforms validated against Zod schemas for type safety
- **Concurrent Protection** - Database-level unique constraints prevent editing race conditions

#### Lineage Resolution Algorithm

**Problem Solved**: When a user wants to edit idea `[1]` from a brainstorm collection, the system must determine if they should edit the original artifact or a more recent version created through previous edits.

**Resolution Process**:
1. **Graph Construction** - Build complete artifact→transform→artifact relationship graph
2. **Path Traversal** - Follow lineage chains from source artifact through all transforms
3. **Latest Version Detection** - Identify the most recently created artifact for the specified path
4. **UI Integration** - Pass resolved artifact ID to editing components

**Benefits**:
- **Always Edit Latest** - Users never accidentally overwrite newer versions
- **Complete History** - Full audit trail preserved for all editing rounds
- **Performance Optimized** - Efficient graph traversal with caching for large lineage chains
- **UI Transparency** - Visual indicators show when content has been edited

### 💬 Comprehensive Chat Interface System
- **Real-time chat interface** replacing traditional sidebar with ChatGPT-style conversation
- **Resizable chat panel** (250px-600px width) with responsive mobile layout
- **Event-driven messaging** - 6 event types: user_message, agent_thinking_start/end, agent_tool_call, agent_response, agent_error
- **Message sanitization** - Two-layer system with raw backend messages and sanitized display messages
- **Electric SQL integration** - Real-time message synchronization across all connected clients
- **Project-scoped chat history** - One conversation per project with complete context preservation
- **Security-first design** - No trade secrets or sensitive tool parameters exposed to frontend
- **Chinese language interface** - Fully translated UI for Chinese users with bilingual keyword support
- **Thinking states** - Visual feedback showing agent processing time and completion status

### 👥 Collaboration & Project Management
- **Project-based workflow** - Organize work into projects with episodes and scripts
- **Multi-user project collaboration** with role-based access control
- **Real-time data synchronization** using Electric SQL
- **Project phase tracking** - From ideation through episode generation to script completion

### 🎨 User Interface
- **Modern dark theme** with Ant Design components throughout
- **Responsive design** for desktop and mobile with adaptive chat layout
- **Project-centric navigation** with unified layout and chat integration
- **ChatGPT-style interface** - Resizable chat sidebar (250px-600px) replacing traditional sidebars
- **Dynamic streaming UI** - Controls render eagerly as JSON data arrives
- **Advanced artifact editor** with intelligent mutation state management and optimized debounced auto-save
- **Entity-specific status indicators** - Isolated save states prevent UI interference between different editors
- **Optimized save cancellation** - AbortController integration cancels pending requests when users type rapidly
- **Smooth typing experience** with local state management and intelligent debouncing
- **Real-time visual feedback** - Per-artifact spinners and checkmarks with automatic cleanup
- **Chinese language interface** - Fully localized UI for Chinese users
- **Real-time message updates** - Electric SQL powered chat synchronization
- **Edit history visualization** - Visual indicators (📝 已编辑版本) for modified content
- **User dropdown** with profile info and logout
- **Modern state management** with TanStack Query for server state and Zustand for client state

### 📊 Analytics & Debugging
- **Complete data traceability** through artifacts and transforms
- **Transform replay capabilities** for testing and analysis
- **Performance monitoring** with real-time state management and metrics
- **Advanced search** across all user data
- **Data export** for AI training and analysis
- **Comprehensive debugging tools** for development
- **Raw Graph Visualization** - Interactive debugging tool for visualizing complete artifact and transform lineage graphs

#### Raw Graph Debugging Feature

**Purpose**: Provides developers and advanced users with a comprehensive visualization of the complete artifact and transform lineage system for debugging complex data relationships and workflow analysis.

**Access**: Available on any project page by adding `?raw-graph=1` query parameter or clicking the "显示原始图谱"/"隐藏原始图谱" toggle button in the breadcrumb area.

**Technical Implementation**:
- **React Flow Integration** - Uses React Flow library for interactive graph visualization with pan, zoom, and selection capabilities
- **Hierarchical Layout** - Dagre algorithm provides left-to-right hierarchical positioning of nodes and edges
- **Real-time Data** - Integrates with Electric SQL for live updates as artifacts and transforms are created/modified
- **Performance Optimized** - Efficient graph processing with memoized calculations and intelligent caching

**Visual Features**:
- **Custom Node Types**:
  - **Artifact Nodes** (rectangles): Color-coded by type with connection handles and detailed tooltips showing complete JSON data
  - **Transform Nodes** (diamonds): 45° rotated diamonds with human/LLM icons and execution context tooltips
- **Connection System**:
  - **Blue Arrows** (🔵): Input relationships (artifact → transform)
  - **Green Arrows** (🟢): Output relationships (transform → artifact)  
  - **Yellow Arrows** (🟡): Lineage relationships (fallback connections)
- **Latest Artifact Highlighting** - Gold borders on leaf nodes in lineage chains
- **Interactive Controls**:
  - Filter toggles for artifacts, transforms, human transforms, and LLM transforms
  - Pan, zoom, and fit-to-view controls
  - Minimap for navigation in large graphs
  - Node selection and hover tooltips with technical details

**Fallback Edge Creation System**:
1. **Primary**: Uses `transform_inputs` and `transform_outputs` tables for formal transform relationships
2. **Secondary**: Uses `human_transforms` table relationships (`source_artifact_id` → `derived_artifact_id`)  
3. **Tertiary**: Uses lineage graph edges built from all available relationship data

**Use Cases**:
- **Debugging Complex Lineages** - Visualize how content flows through multiple editing rounds
- **Performance Analysis** - Identify bottlenecks in transform execution chains
- **Data Relationship Validation** - Verify that artifact relationships are correctly established
- **Workflow Understanding** - See complete picture of how user actions create data transformations
- **Development Support** - Essential tool for developers working on the transform system

**Example Visualization**:
```
[brainstorm_params] → [LLM Transform] → [brainstorm_idea[]]
                                              ↓
                                      [Human Transform] → [user_input]
                                              ↓
                                      [LLM Transform] → [brainstorm_idea] (LATEST)
```

This feature provides unprecedented visibility into the application's sophisticated data transformation system, making it invaluable for both development and advanced user analysis.

## Core Design Principles

### 🔗 Lineage Resolution: "Always Edit the Leaf" Principle

**Fundamental Rule**: The system ensures users always edit the most recent version of any content by automatically resolving lineage chains to their "leaf" (latest) artifacts.

#### Why This Matters
In collaborative editing environments with both human and AI modifications, content can evolve through multiple versions:
```
Original Story Idea → Human Edit → AI Enhancement → Human Refinement
                                                         ↑
                                                   (This is the "leaf")
```

Without lineage resolution, users might accidentally edit an outdated version, losing recent changes. Our system prevents this by:

1. **Automatic Leaf Detection** - When a user clicks "edit" on any content, the system traces the lineage chain to find the most recent version
2. **Transparent Resolution** - Users see visual indicators (📝 已编辑版本) when content has been modified from its original form
3. **Consistent Behavior** - Whether editing through chat commands or direct UI interaction, users always work with the latest version

#### Lineage Resolution Examples

**Simple Chain**:
```
Artifact A → Human Transform → Artifact B (leaf)
User clicks edit on A → System resolves to B → User edits B
```

**Complex Branching** (handled gracefully):
```
Artifact A → Human Transform → Artifact B → AI Transform → Artifact C (leaf)
         → AI Transform → Artifact D (separate branch)
User clicks edit on A → System resolves to C (most recent in main branch)
```

**Mixed Editing Workflows**:
```
Collection [Story1, Story2, Story3]
├── Story1 → Human Edit → User Input → AI Edit → Enhanced Story1 (leaf)
├── Story2 → AI Edit → Enhanced Story2 (leaf)  
└── Story3 → (unchanged, references original collection)
```

### 🤖 Agent-Driven Editing Philosophy

**Core Principle**: All content modifications flow through an intelligent agent system that maintains context awareness and quality consistency across all operations.

#### Dual-Mode Intelligence
The agent automatically detects user intent and routes requests appropriately:

- **Generation Mode**: "创建一些古装剧本" → Uses BrainstormTool to create new content
- **Editing Mode**: "让这些故事更现代" → Uses BrainstormEditTool to modify existing content with context enrichment

#### Context Enrichment for Edits
When editing existing content, the agent provides comprehensive context to the LLM:
- **Current Content**: All existing story ideas with full details
- **Project Background**: Platform requirements, genre specifications
- **User Instructions**: Specific modification requests
- **Quality Guidelines**: 去脸谱化 (de-stereotyping) principles and consistency rules

This ensures that AI edits are contextually appropriate and maintain story coherence across all modifications.

### 🔄 Immutable Artifacts with Flexible Editing

**Design Philosophy**: Treat AI-generated content as immutable historical records while providing unlimited editing flexibility through derived artifacts.

#### Key Principles

1. **Original Artifacts Never Change** - AI-generated content is preserved exactly as created for audit trails and rollback capabilities

2. **Derived Artifacts for Modifications** - All edits (human or AI) create new artifacts linked through transforms, maintaining complete history

3. **Individual Breakdown Strategy** - Collections automatically decomposed into individual artifacts for granular editing without affecting other items

4. **Path-Based Editing** - Support both field-level (`[0].title`) and object-level (`[0]`) modifications with proper lineage tracking

#### Benefits
- **Complete Audit Trail** - Every change tracked with timestamps, user attribution, and context
- **Rollback Capability** - Can trace back to any previous version in the lineage chain  
- **Concurrent Editing Protection** - Database constraints prevent race conditions and data loss
- **Performance Optimization** - Only load and process relevant content portions for editing
- **Collaboration Support** - Multiple users can edit different parts simultaneously without conflicts

### 🎯 Schema-Driven Type Safety

**Principle**: All data transformations validated against Zod schemas to prevent runtime errors and ensure data integrity.

#### Implementation
- **Artifact Schemas** - Every artifact type has a versioned Zod schema defining its structure
- **Transform Validation** - All transform inputs and outputs validated before execution
- **Frontend-Backend Consistency** - Shared schemas ensure UI and API always agree on data structure
- **Migration Support** - Schema versioning allows for safe data structure evolution

This eliminates the entire class of "data structure mismatch" errors that plague traditional systems.

## Architecture

### Core Architecture: Agent-Driven System with Advanced Transform Lineage

The application is built around an **intelligent dual-mode agent framework** that seamlessly handles both content generation and AI-powered editing, combined with a **sophisticated lineage resolution system** that maintains complete data traceability across complex editing workflows.

#### Advanced Agent Framework Architecture
```
User Chat Message → Agent Analysis → Mode Detection → Tool Selection → Execution → Response
                                   ↓                    ↓
                            [Generation Mode]    [Editing Mode]
                                   ↓                    ↓
                            [Brainstorm Tool]    [Brainstorm Edit Tool]
                            [Outline Tool]      [Context Enrichment]
                            [Script Tool]       [Bulk Processing]
                            [Conversational Response]
```

**Agent Intelligence Features**:
- **Mode Detection** - Automatically distinguishes between generation requests ("创建一些故事") and edit requests ("让故事更现代")
- **Context Enrichment** - For edit requests, agent provides current content context and detailed editing instructions to LLM
- **Bulk Operation Support** - Can process multiple ideas simultaneously with consistent editing approach
- **Quality Assurance** - Maintains 去脸谱化 (de-stereotyping) principles and platform-specific requirements across all operations

#### Advanced Artifact & Transform System with Lineage Resolution

**Design Philosophy**: Support complex editing workflows where users and AI can collaborate on content through multiple rounds of modifications, while maintaining complete traceability and always presenting the latest version.

**Artifact Hierarchy**:
```
brainstorm_idea[] (original AI generation)
├── Individual Breakdown
│   ├── brainstorm_idea (extracted individual ideas)
│   └── user_input (human-edited versions)
├── Transform Lineage
│   ├── human_transform (manual edits)
│   └── llm_transform (AI-powered edits)
└── Lineage Resolution
    ├── Graph traversal algorithm
    └── Latest version detection
```

**Complex Lineage Example**:
```
Collection ABC123 → [1] → Human Edit → User Input DEF456
                         ↓
                    LLM Edit → Brainstorm Idea GHI789
                         ↓
                    Human Edit → User Input JKL012

Resolution: When user wants to edit idea [1], system returns JKL012 (latest version)
```

#### Lineage Resolution Algorithm

**Core Problem**: In complex editing workflows, determining which artifact represents the "current" version of content requires sophisticated graph traversal.

**Technical Implementation**:
```typescript
interface LineageNode {
  artifactId: string;
  transformId?: string;
  path?: string;
  depth: number;
  isLeaf: boolean;
}

// Build complete lineage graph
function buildLineageGraph(artifacts, transforms, inputs, outputs): LineageGraph

// Find latest version of content at specific path
function findLatestArtifact(sourceArtifactId, path?, graph): Artifact | null

// Get complete editing history
function getLineagePath(artifactId, graph): LineageNode[]
```

**Performance Characteristics**:
- **Graph Construction**: ~10ms for typical project data
- **Resolution Query**: <1ms for individual artifact lookup
- **Scalability**: Handles 100+ node lineage chains efficiently
- **Caching**: Intelligent caching for frequently accessed lineages

#### Key Components

**1. Advanced Artifact System**
- **Immutable original artifacts** - AI-generated content never changes
- **Individual artifact breakdown** - Collections automatically decomposed for granular editing
- **Versioned derived artifacts** - User and AI modifications create new artifact versions
- **Type-safe schemas** - Zod validation ensures data integrity across all artifact types
- **Complete metadata** - Full context and lineage tracking with performance optimization

**2. Enhanced Transform System**
- **Human transforms** - Track all manual user modifications with timestamps and user attribution
- **LLM transforms** - Record AI-powered edits with complete context, parameters, and reasoning
- **Transform instantiation** - Schema-validated transform execution with error handling
- **Path-based editing** - Support for field-level (`[0].title`) and object-level (`[0]`) modifications
- **Lineage tracking** - Complete relationship recording for complex editing workflows

**3. Schema Validation & Type Safety**
```typescript
// Enhanced artifact schemas
const BrainstormIdeaCollectionSchema = z.object({
  ideas: z.array(z.object({
    title: z.string(),
    body: z.string(),
    metadata: z.object({
      platform: z.string(),
      genre: z.string()
    }).optional()
  }))
});

// LLM transform definitions
const LLMTransformDefinitionSchema = z.object({
  name: z.literal('llm_edit_brainstorm_idea'),
  inputType: z.enum([ 'brainstorm_idea', 'user_input']),
  outputType: z.literal('brainstorm_idea'),
  pathPattern: z.string().regex(/^\[\d+\]$/),
  templateName: z.literal('brainstorm_edit')
});
```

### Database Architecture

The application uses **PostgreSQL** with **Electric SQL** for real-time synchronization and **Kysely** for type-safe database operations.

#### Database Schema
```sql
-- Core users and authentication
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Projects and collaboration
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT DEFAULT 'script',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects_users (
  id SERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id)
);

-- Core artifacts with streaming support
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  type_version TEXT NOT NULL DEFAULT 'v1',
  data TEXT NOT NULL,
  metadata TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Electric streaming field
  streaming_status TEXT DEFAULT 'completed' CHECK (streaming_status IN ('streaming', 'completed', 'failed', 'cancelled'))
);

-- Transform tracking with lineage
CREATE TABLE transforms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  type_version TEXT NOT NULL DEFAULT 'v1',
  status TEXT DEFAULT 'running',
  execution_context TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Electric streaming fields
  streaming_status TEXT DEFAULT 'pending' CHECK (streaming_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  progress_percentage DECIMAL(5,2) DEFAULT 0.00,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 2
);

-- Human transforms with concurrent editing protection
CREATE TABLE human_transforms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  input_artifact_id TEXT NOT NULL REFERENCES artifacts(id),
  output_artifact_id TEXT NOT NULL REFERENCES artifacts(id),
  transform_name TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_human_transform_per_artifact_path UNIQUE (input_artifact_id, path)
);

-- Chat messages system (two-layer architecture)
CREATE TABLE chat_messages_raw (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  content TEXT NOT NULL,
  tool_name TEXT,
  tool_parameters JSONB,
  tool_result JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_messages_display (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  display_type TEXT DEFAULT 'message' CHECK (display_type IN ('message', 'tool_summary', 'thinking')),
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'streaming', 'completed', 'failed')),
  raw_message_id TEXT REFERENCES chat_messages_raw(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat events for event-driven messaging
CREATE TABLE chat_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('user_message', 'agent_thinking_start', 'agent_thinking_end', 'agent_tool_call', 'agent_response', 'agent_error')),
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### Kysely Benefits
- **Type Safety**: Auto-generated types from schema prevent runtime errors
- **Performance**: More efficient queries than Knex, optimized for Electric's real-time patterns
- **Developer Experience**: Better IntelliSense, compile-time query validation
- **Electric Integration**: Database-level sync works seamlessly with Kysely's query patterns

### Electric SQL Integration

Electric SQL provides real-time database synchronization with **authenticated proxy pattern**:

#### Authentication Flow
1. **Frontend Request**: Client makes shape request to `/api/electric/v1/shape`
2. **Auth Validation**: Proxy extracts JWT from HTTP-only cookie, validates session
3. **User Scoping**: Proxy adds `WHERE project_id IN (user's projects)` to shape query
4. **Electric Proxy**: Validated request forwarded to Electric with user scoping
5. **Real-time Sync**: Electric streams user-scoped data back through proxy
6. **Auto-Updates**: Frontend receives real-time updates for user's data only

#### Security Features
- **User Data Isolation**: All Electric shape requests automatically scoped to authenticated user's projects
- **Proxy validates JWT tokens** and sessions on every request
- **Database-level WHERE clauses** prevent cross-user data access
- **Debug Token Support**: Development workflow maintained with `debug-auth-token-script-writer-dev`
- **Session Management**: Existing session lifecycle maintained (7-day expiry)

### Frontend Architecture
- **React 19** with TypeScript
- **TanStack Query (React Query)** for server state management
- **Zustand** for global client state management
- **Ant Design** component library with responsive multi-column layouts
- **React Router** for navigation with protected routes
- **Schema-based artifact editor** with real-time validation
- **Electric SQL React hooks** for real-time data synchronization

### Backend Architecture
- **Express.js** server with TypeScript
- **PostgreSQL** database with **Kysely** for type-safe database operations
- **Electric SQL** for real-time database synchronization with authenticated proxy
- **Schema Transform Executor** for validated transform execution
- **Transform Instantiation Registry** for extensible transform definitions
- **Legacy SSE endpoints** for outline and episode script generation (pending migration)

### Frontend State Management

The application uses a **modern state management architecture**:

- **TanStack Query** manages all server state with intelligent caching
- **Zustand** provides lightweight global state for UI state
- **Local component state** for typing and editing interactions
- **Unified Data Flow**: Components read from stores, mutations update server state

```typescript
// Example: Schema-validated artifact editing
const editMutation = useMutation({
  mutationFn: async ({ path, newData }: EditRequest) => {
    const response = await fetch(`/api/artifacts/${artifactId}/human-transform`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        newData,
        transformName: getTransformName(artifactType, path)
      })
    });
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['artifacts']);
    onSaveSuccess?.();
  }
});
```

## API Endpoints

### Authentication
- `POST /auth/login` - Login with provider credentials
- `POST /auth/logout` - Logout and invalidate session
- `GET /auth/me` - Get current user info
- `GET /auth/status` - Check authentication status

### Advanced Schema Transform System
- `POST /api/artifacts/:id/human-transform` - Execute schema-validated human transform
- `POST /api/artifacts/:id/schema-transform` - Execute schema-validated LLM transform (used by agent tools)
- `GET /api/artifacts` - List artifacts with filtering, search, and lineage information
- `GET /api/artifacts/:id` - Get specific artifact with complete metadata and lineage path
- `GET /api/transforms/human` - List human transforms with lineage relationships
- `GET /api/transforms/llm` - List LLM transforms with execution context and results

### Enhanced Agent & Chat System (All Require Authentication)
- `POST /api/projects/:id/agent` - Send general agent request (handles both generation and editing)
- `POST /api/chat/:projectId/messages` - Send user message to agent (triggers tool selection and execution)
- `GET /api/chat/:projectId/messages` - Get chat history (via Electric SQL subscription)
- `DELETE /api/chat/:projectId/messages/:messageId` - Delete specific message
- **Agent Tools**: 
  - ✅ Brainstorm Generation (creates new story ideas)
  - ✅ Brainstorm Editing (AI-powered modification of existing ideas)
  - ⚠️ Outline Generation (legacy SSE-based, needs Electric SQL migration)
  - ⚠️ Episode Script Generation (legacy SSE-based, needs Electric SQL migration)
  - ✅ Conversational Response (general chat with project context)

### Project Management (All Require Authentication)
- `GET /api/projects` - List user's projects
- `GET /api/projects/:id` - Get specific project details with artifact summaries
- `POST /api/projects/create` - Create new project
- `PUT /api/projects/:id` - Update project details
- `DELETE /api/projects/:id` - Delete project and all associated artifacts

### Electric SQL Proxy (Authenticated)
- `GET /api/electric/v1/shape` - Authenticated proxy to Electric SQL with automatic user scoping
- **Synced Tables**: `artifacts`, `transforms`, `chat_messages_display`, `chat_events`
- **Blocked Tables**: `chat_messages_raw` (backend only for security)

### Legacy SSE Endpoints (Pending Migration)
- `GET /api/outlines/stream` - Server-sent events for outline generation (requires Electric SQL migration)
- `GET /api/episodes/stream` - Server-sent events for episode script generation (requires Electric SQL migration)

## Security Features

### Authentication & Authorization
- **HTTP-only cookies** prevent XSS attacks
- **JWT tokens** with expiration and session tracking
- **User-scoped data access** - all queries automatically filtered by user_id
- **Project-based isolation** - users can only access their own projects
- **Debug token support** - Development workflow with `debug-auth-token-script-writer-dev`
- **Electric SQL proxy authentication** - All real-time data access authenticated and user-scoped

### Data Security
- **Input validation** on all endpoints with Zod schemas
- **SQL injection protection** through Kysely's type-safe query builder
- **CORS configuration** for cross-origin requests
- **Session cleanup** for expired tokens
- **Concurrent editing protection** - Database-level unique constraints prevent race conditions

### Project-Based Access Control Architecture

**IMPORTANT**: The application uses **project-based access control**, not direct user-based access control:

- **Artifacts and Transforms DO NOT have `user_id` fields**
- **All artifacts and transforms have `project_id` fields instead**
- **Access control is managed through project membership** via the `projects_users` table
- **Users can only access artifacts/transforms within projects they are members of**
- **Authentication middleware validates project membership before allowing access**

This architecture provides:
- **Multi-user collaboration** - Multiple users can work on the same project
- **Clean separation of concerns** - Project management is separate from content management
- **Scalable permissions** - Easy to add role-based permissions within projects
- **Data organization** - All content is naturally grouped by project

```sql
-- Correct access pattern: Filter by project membership
SELECT a.* FROM artifacts a
JOIN projects_users pu ON pu.project_id = a.project_id
WHERE pu.user_id = ? AND a.id = ?;

-- WRONG: Artifacts do not have user_id
SELECT * FROM artifacts WHERE user_id = ? AND id = ?; -- ❌ This column doesn't exist
```

## Development

### Project Structure
```
src/
├── client/                 # React frontend
│   ├── components/        # React components
│   │   ├── chat/          # Chat interface components
│   │   │   ├── ChatMessage.tsx           # Individual message with role-based styling
│   │   │   ├── ChatMessageList.tsx       # Message list with auto-scroll
│   │   │   ├── ChatInput.tsx             # Input with suggestions and shortcuts
│   │   │   ├── ChatSidebar.tsx           # Resizable chat sidebar (250px-600px)
│   │   │   └── ChatSidebarWrapper.tsx    # ChatProvider wrapper
│   │   ├── shared/        # Shared components
│   │   │   ├── ArtifactEditor.tsx        # Schema-based artifact editor
│   │   │   ├── EditableField.tsx         # Auto-saving editable fields
│   │   │   └── streaming/                # Dynamic streaming UI components
│   │   ├── BrainstormingResults.tsx      # Brainstorm display with editing
│   │   ├── OutlineResults.tsx            # Outline display with editing (legacy)
│   │   └── ProjectLayout.tsx             # Main project interface with chat
│   ├── contexts/          # React contexts
│   │   ├── ChatContext.tsx               # Chat state management
│   │   └── ProjectDataContext.tsx        # Project data management
│   ├── hooks/             # Custom hooks
│   │   ├── useChatMessages.ts            # Chat message operations
│   │   ├── useProjectData.ts             # TanStack Query hooks
│   │   ├── useStreamingLLM.ts            # Streaming LLM integration
│   │   ├── useMutationState.ts           # Entity-specific mutation state hooks
│   │   └── useDebounce.ts                # Debounced auto-save
│   ├── services/          # API services
│   │   └── apiService.ts  # Centralized API client
│   ├── stores/            # Zustand stores
│   │   └── projectStore.ts # Global project state management
│   └── utils/             # Utility functions
│       └── chatEventProcessor.ts         # Event-driven message processing
├── common/                # Shared frontend/backend types
│   ├── config/            # Configuration
│   │   └── electric.ts    # Electric SQL configuration
│   ├── schemas/           # Zod schemas
│   │   ├── artifacts.ts   # Artifact type definitions
│   │   ├── transforms.ts  # Transform definitions with path patterns
│   │   └── chatMessages.ts # Chat message schemas
│   ├── streaming/         # Streaming interfaces
│   └── types.ts          # Common type definitions
└── server/                # Express backend
    ├── database/          # Database setup
    │   ├── connection.ts  # Kysely database connection
    │   ├── types.ts       # Generated Kysely types
    │   └── migrations/    # Database migrations
    ├── routes/            # API routes
    │   ├── artifactRoutes.ts # Schema transform API
    │   ├── chatRoutes.ts  # Chat and agent endpoints
    │   ├── electricProxy.ts # Electric SQL authenticated proxy
    │   ├── outlineRoutes.ts # Legacy SSE-based outline generation
    │   ├── episodes.ts    # Legacy SSE-based episode script generation
    │   └── auth.ts        # Authentication routes
    ├── services/          # Business logic
    │   ├── AgentService.ts                   # Central agent orchestrator
    │   ├── ChatService.ts                    # Chat message routing and processing
    │   ├── HumanTransformExecutor.ts         # Core transform execution
    │   ├── TransformInstantiationRegistry.ts # Transform registry
    │   ├── OutlineService.ts                 # Legacy SSE-based outline service
    │   ├── EpisodeGenerationService.ts       # Legacy SSE-based episode service
    │   └── templates/     # LLM prompt templates
    ├── repositories/      # Data access layer
    │   ├── ArtifactRepository.ts # Artifact CRUD operations
    │   ├── TransformRepository.ts # Transform tracking
    │   └── ChatMessageRepository.ts # Chat message operations
    └── scripts/           # Development and testing scripts
        ├── test-schema-system.ts # Schema system testing
        ├── test-chat-system.ts # Chat system testing
        ├── test-event-chat-system.ts # Event-driven chat testing
        └── debug-users.ts # User management utilities
```

### Available Scripts
- `npm run dev` - Start development server (includes legacy SSE endpoints)
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run migrate` - Run database migrations
- `npm run migrate:down` - Roll back last migration
- `npm run migrate:status` - Show migration status
- `npm run seed` - Seed test users
- `npm run nuke` - **⚠️ DESTROY database and re-seed** (stops containers, removes volumes, recreates everything)
- `npm run test:schema` - Test schema transform system
- `./run-ts <script>` - Run TypeScript scripts with proper configuration

### Development Workflow

#### Testing Schema Transforms
```bash
# Test the complete schema transform system
./run-ts src/server/scripts/test-schema-system.ts

# Test specific transform types
./run-ts src/server/scripts/test-artifact-editor.ts
```

#### Database Management
```bash
# Run database migrations
npm run migrate

# Seed test users
npm run seed

# Generate Kysely types from database schema
npm run db:generate-types

# Direct PostgreSQL access
psql -h localhost -U postgres -d script_writer -c "SELECT * FROM artifacts ORDER BY created_at DESC LIMIT 10;"
```

#### Electric SQL Development
```bash
# Start PostgreSQL + Electric SQL
docker compose up -d

# Check Electric SQL health
curl http://localhost:3000

# Test authenticated Electric proxy
curl -H "Authorization: Bearer debug-auth-token-script-writer-dev" \
  "http://localhost:4600/api/electric/v1/shape?table=artifacts&offset=-1"

# Note: Legacy SSE endpoints still available during migration:
# /api/outlines/stream - Outline generation
# /api/episodes/stream - Episode script generation
```

## Schema Transform System Deep Dive


### Enhanced Transform Execution Flow

1. **Request Analysis** - Agent determines if request is for generation or editing
2. **Lineage Resolution** - For edits, resolve latest version of target content
3. **Context Preparation** - Gather current content, project background, and user requirements
4. **Transform Selection** - Choose appropriate transform type (human vs LLM)
5. **Schema Validation** - Validate input data against Zod schemas
6. **Transform Execution** - Execute registered instantiation function or LLM template
7. **Artifact Creation** - Create new derived artifact with proper lineage tracking
8. **Electric Sync** - Real-time updates automatically synced to all connected clients
9. **UI Update** - Frontend displays updated content with edit indicators

### Advanced Artifact Editor with Lineage Integration

The enhanced `ArtifactEditor` and `DynamicBrainstormingResults` components provide seamless editing with intelligent lineage resolution:

```typescript


// Enhanced artifact editor with lineage support
<ArtifactEditor
  artifactId={resolvedArtifactId || idea.artifactId} // Always edit latest version
  path={`[${index}]`}
  transformName="edit_brainstorm_idea"
  onSave={() => {
    // Electric SQL automatically syncs changes
    showEditIndicator(index);
  }}
/>

// Visual lineage indicators
{hasLineage && (
  <Tag icon={<EditOutlined />} color="blue">
    📝 已编辑版本
  </Tag>
)}
```

### LLM Transform Template System

**Brainstorm Edit Template** - Comprehensive Chinese prompt for AI-powered story editing:

```typescript
export const BRAINSTORM_EDIT_TEMPLATE = `
你是一位专业的短剧编剧和故事策划师。请根据用户要求，对现有的故事创意进行优化和改进。

## 核心原则
1. **去脸谱化** - 避免刻板印象，创造立体、真实的角色
2. **平台适配** - 根据目标平台调整内容风格和节奏
3. **用户需求** - 严格按照用户的具体要求进行修改
4. **质量保证** - 保持故事的逻辑性和吸引力

## 当前故事信息
标题：{{originalTitle}}
内容：{{originalBody}}

## 用户修改要求
{{userRequirements}}

## Agent补充说明
{{agentInstructions}}

请输出改进后的故事创意，保持JSON格式：
{
  "title": "改进后的标题",
  "body": "改进后的详细内容，保持2000字左右的篇幅"
}
`;
```

## Recent Major Changes

### Electric SQL Migration Status

**✅ COMPLETED**: Brainstorm system fully migrated to Electric SQL with real-time synchronization
**⚠️ PENDING**: Outline and Episode Script generation still use legacy SSE architecture

**Migration Requirements for Remaining Systems**:
- **Outline Generation** - Migrate from SSE streaming to Electric SQL real-time updates
- **Episode Script Generation** - Migrate from SSE streaming to Electric SQL real-time updates  
- **Agent Integration** - Integrate outline/episode tools with the agent framework
- **UI Updates** - Update frontend components to use Electric SQL subscriptions instead of SSE

### Entity-Specific Mutation State System ✅ COMPLETED

**Major Achievement**: Implemented a sophisticated entity-specific mutation state management system that completely isolates save states between different artifact editors, eliminating visual interference and providing optimal user experience during concurrent editing operations.

#### Technical Implementation
- **Entity-Specific State Maps**: Created `MutationStateMap` with separate maps for artifacts, transforms, and human transforms
- **Direct Map Access**: Exposed mutation states directly as maps instead of getter functions for better performance
- **Utility Hooks**: Built `useMutationState.ts` with convenient hooks (`useIsPending`, `useIsSuccess`, `useIsError`)
- **Automatic State Cleanup**: Success states auto-clear after 2 seconds with interval-based cleanup
- **Type Safety**: Full TypeScript support with proper entity type validation

#### Advanced Request Cancellation System
- **AbortController Integration**: Cancels pending HTTP requests when users type rapidly to prevent race conditions
- **Field-Level Debouncing**: Independent timeout tracking per form field for optimal responsiveness
- **Multi-Level Cancellation**: Cancels both debounced timeouts and active HTTP requests
- **Resource Management**: Proper cleanup on component unmount to prevent memory leaks
- **Performance Optimization**: Eliminates unnecessary API calls during rapid typing sessions

#### User Experience Improvements
- **Isolated Status Indicators**: Spinners and checkmarks only appear for the specific artifact being edited
- **Smooth Typing Experience**: No interference between different editors on the same page
- **Real-time Visual Feedback**: Immediate spinner display with success checkmarks after save completion
- **Consistent Behavior**: Uniform status indication across all artifact types and editing contexts

**Files Modified**:
- `src/client/contexts/ProjectDataContext.tsx` - Added entity-specific mutation state management
- `src/client/components/shared/ArtifactEditor.tsx` - Integrated new state system with request cancellation
- `src/client/hooks/useMutationState.ts` - Created utility hooks for easy state access
- `src/common/types.ts` - Updated type definitions for mutation state interfaces

### Raw Graph Debugging Feature Implementation ✅ COMPLETED

**Major Achievement**: Implemented a comprehensive debugging visualization system that provides unprecedented visibility into the application's sophisticated artifact and transform lineage system, enabling developers to debug complex data relationships and understand workflow execution patterns.

#### Technical Implementation
- **React Flow Integration**: Built custom visualization using React Flow library with interactive pan, zoom, and selection capabilities
- **Custom Node Components**: 
  - **ArtifactNode**: Rectangular nodes with type-based color coding, connection handles, and detailed JSON tooltips
  - **TransformNode**: Diamond-shaped (45° rotated) nodes with human/LLM icons and execution context tooltips
- **Hierarchical Layout**: Implemented Dagre algorithm for automatic left-to-right node positioning and edge routing
- **Real-time Updates**: Electric SQL integration provides live graph updates as data changes
- **Performance Optimization**: Memoized graph processing with efficient batch operations for large datasets

#### Advanced Edge Creation System
- **Triple Fallback Architecture**: Robust edge creation system with three fallback mechanisms
  1. **Primary**: `transform_inputs`/`transform_outputs` tables for formal relationships
  2. **Secondary**: `human_transforms` table for direct artifact relationships
  3. **Tertiary**: Lineage graph edges from comprehensive relationship analysis
- **Connection Handles**: Proper React Flow handles enable edge connections between nodes
- **Visual Differentiation**: Color-coded arrows (blue for inputs, green for outputs, yellow for lineage)

#### User Experience Features
- **URL Parameter Access**: Toggle visualization with `?raw-graph=1` query parameter
- **Breadcrumb Integration**: Toggle button "显示原始图谱"/"隐藏原始图谱" in project layout
- **Interactive Controls**: Filter toggles for different node types, minimap, zoom controls
- **Latest Artifact Highlighting**: Gold borders on leaf nodes in lineage chains
- **Rich Tooltips**: Hover tooltips showing complete technical details and JSON data

#### Development Impact
- **Debugging Capability**: Essential tool for understanding complex lineage chains and transform execution
- **Data Validation**: Visual verification of artifact relationships and transform correctness
- **Performance Analysis**: Identify bottlenecks and optimization opportunities in data flows
- **Educational Value**: Helps developers understand the sophisticated transform system architecture

**Files Created/Modified**:
- `src/client/components/RawGraphVisualization.tsx` - Complete visualization component
- `src/client/components/ProjectLayout.tsx` - Toggle button integration
- `package.json` - Added `dagre` and `@types/dagre` dependencies

### AI-Powered Brainstorm Editing System (Latest Implementation)

**Major Achievement**: Implemented a complete AI-powered editing system that allows users to modify existing story ideas through natural language chat interactions, representing a significant advancement in content creation workflow.

#### Phase 1: LLM Edit Tool & Agent Integration ✅ COMPLETED
- **LLM Transform Definition**: Added `llm_edit_brainstorm_idea` transform with comprehensive Zod schema validation
- **Advanced Edit Template**: Sophisticated Chinese prompt template with 去脸谱化 (de-stereotyping) principles and platform-specific requirements
- **Multi-Input Brainstorm Edit Tool**: Handles `brainstorm_idea`, and `user_input` artifact types with intelligent path resolution
- **Enhanced Agent Service**: `runGeneralAgent` method with context enrichment, tool selection, and bilingual keyword detection
- **API Integration**: `/api/projects/:id/agent` endpoint for general agent requests with project access validation

**Technical Achievements**:
- **Context-Aware Editing**: Agent provides enriched context including current brainstorm ideas and project background
- **Bulk Processing**: Agent can edit multiple story ideas simultaneously with consistent modifications
- **Quality Assurance**: Maintains story coherence and platform-specific requirements across all edits
- **Complete Audit Trail**: All AI edits tracked through LLM transforms with full metadata

#### Phase 2: Advanced Lineage Resolution System ✅ COMPLETED
- **Sophisticated Graph Algorithm**: Pure functions for traversing complex artifact→transform→artifact chains
- **Performance Optimized**: 10ms graph construction, <1ms resolution queries, handles 100+ node chains
- **Comprehensive Test Coverage**: 9 test scenarios covering simple chains, branching lineages, and edge cases
- **LineageResolutionService**: Service layer integrating core algorithm with repository pattern

**Technical Innovations**:
- **Topological Sorting**: Efficient graph construction with proper dependency ordering
- **Path-Based Resolution**: Supports both field-level and object-level lineage tracking
- **Caching Strategy**: Intelligent caching for frequently accessed lineage paths
- **Error Recovery**: Graceful handling of broken chains and missing artifacts

#### Phase 3: UI Integration & Dynamic Lineage ✅ COMPLETED
- **Enhanced DynamicBrainstormingResults**: Integrated lineage resolution for always editing latest versions
- **React Hooks System**: `useLineageResolution`, `useMultipleLineageResolution`, and `useBrainstormLineageResolution`
- **Visual Edit Indicators**: 📝 "已编辑版本" badges for ideas that have been modified
- **Real-time Updates**: Electric SQL integration provides instant lineage updates across all clients

**User Experience Improvements**:
- **Transparent Editing**: Users always edit the most recent version without manual version management
- **Edit History Visualization**: Clear indicators showing which content has been modified
- **Seamless Workflow**: No interruption to existing manual editing capabilities
- **Performance Optimized**: Efficient batch resolution for multiple artifacts

### Advanced Agent Framework Architecture

**Design Philosophy**: Create an intelligent system that can seamlessly switch between content generation and sophisticated editing based on user intent, while maintaining complete context awareness and quality standards.

**Key Innovations**:
- **Dual-Mode Operation** - Agent automatically detects whether user wants to create new content or edit existing content
- **Context Enrichment** - For editing requests, agent provides comprehensive context including current content, project background, and detailed editing instructions
- **Tool Orchestration** - Intelligent selection between BrainstormTool (generation) and BrainstormEditTool (editing) based on request analysis
- **Quality Consistency** - Maintains 去脸谱化 principles and platform requirements across all operations

**Current Implementation Status**:
- ✅ **Brainstorm System** - Complete dual-mode implementation with generation and editing capabilities using Electric SQL
- ⚠️ **Outline System** - Legacy SSE-based implementation, requires Electric SQL migration and agent integration
- ⚠️ **Episode Script System** - Legacy SSE-based implementation, requires Electric SQL migration and agent integration

### Individual Artifact Breakdown Architecture

**Design Rationale**: Traditional systems store collections as monolithic artifacts, making granular editing difficult. Our breakdown approach automatically decomposes collections into individual artifacts while maintaining relationships through lineage tracking.

**Technical Implementation**:
- **Flexible Editing** - Users can edit individual ideas without affecting others in the collection
- **Lineage Preservation** - Complete relationship tracking from original collection through all individual modifications
- **UI Transparency** - Frontend seamlessly handles both collection and individual artifact displays

**Benefits**:
- **Granular Control** - Edit individual story ideas without affecting others
- **Performance Optimization** - Only load and process relevant content for editing
- **Collaboration Support** - Multiple users can edit different ideas simultaneously
- **Version Management** - Independent versioning for each story idea

### PostgreSQL + Electric SQL Migration ✅ PARTIALLY COMPLETED
- **Complete database migration** from SQLite to PostgreSQL with logical replication
- **Electric SQL integration** for real-time synchronization with authenticated proxy pattern
- **Kysely adoption** for type-safe database operations with auto-generated types
- **Brainstorm system migration** - Fully migrated to Electric SQL real-time updates
- **User data isolation** enforced at proxy level with automatic WHERE clause injection
- **⚠️ Pending migration**: Outline and Episode Script generation still use legacy SSE endpoints

### Enhanced User Experience & Security
- **ChatGPT-style interface** - Natural conversation flow with agent for all operations
- **Entity-specific mutation states** - Isolated save indicators prevent visual interference between editors
- **Advanced request cancellation** - AbortController integration prevents race conditions during rapid typing
- **Optimized debounced auto-save** - Field-level debouncing with intelligent timeout management
- **Real-time visual feedback** - Per-artifact status indicators with automatic cleanup
- **Enhanced error handling** - Graceful handling of schema validation and transform errors
- **Real-time collaboration** - Electric SQL enables instant updates across all connected clients
- **Chinese localization** - Complete UI translation for Chinese user base
- **Electric SQL proxy authentication** - All real-time data access authenticated and user-scoped
- **Chat message sanitization** - Two-layer system prevents trade secrets exposure to frontend

## Testing

### Comprehensive Testing Suite

The application includes extensive testing for all major systems:

```bash
# Advanced transform and lineage system testing
npm run test:schema
./run-ts src/server/scripts/test-schema-system.ts

# Agent framework and chat system testing  
./run-ts src/server/scripts/test-chat-system.ts
./run-ts src/server/scripts/test-event-chat-system.ts
./run-ts src/server/scripts/test-brainstorm-chat-flow.ts

# Brainstorm edit tool testing
./run-ts src/server/scripts/test-brainstorm-edit-tool.ts
./run-ts src/server/scripts/test-agent-brainstorm-edit.ts

# Lineage resolution testing
./run-ts src/server/scripts/test-lineage-resolution.ts

# Electric SQL integration testing
./run-ts src/server/scripts/test-electric-auth.ts
```

### Validation Coverage

The test suite comprehensively validates:

**Agent Framework Testing**:
- **Mode Detection** - Correctly distinguishes generation vs editing requests
- **Tool Selection** - Proper routing between BrainstormTool and BrainstormEditTool
- **Context Enrichment** - Agent provides appropriate context for editing operations
- **Bilingual Support** - Handles both English and Chinese user requests
- **Error Handling** - Graceful handling of invalid requests and tool failures

**Lineage Resolution Testing**:
- **Simple Chains** - Basic A→B→C lineage traversal
- **Branching Lineages** - Complex graphs with multiple edit paths
- **Performance** - Sub-millisecond resolution for typical use cases
- **Edge Cases** - Missing artifacts, broken chains, circular references
- **Concurrent Access** - Thread safety and data consistency

**Transform System Testing**:
- **Schema Validation** - All artifact types validated against Zod schemas
- **Path Resolution** - Field-level and object-level editing paths
- **LLM Transform Execution** - Complete end-to-end AI editing workflow
- **Human Transform Tracking** - Manual edit lineage and metadata
- **Concurrent Editing Protection** - Database constraint validation

**Integration Testing**:
- **End-to-End Workflows** - Complete user journey from chat to content modification
- **Real-time Sync** - Electric SQL updates across multiple clients
- **Authentication** - Project-based access control validation
- **UI Integration** - Frontend lineage resolution and edit indicators

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the established patterns:
   - **Use schema-driven transforms** for all data modifications
   - **Maintain immutable artifacts** with proper lineage tracking
   - **Follow TypeScript strict typing** throughout
   - **Use `./run-ts` for all TypeScript scripts** instead of `npx tsx`
   - **Test with comprehensive schema validation**
   - **Ensure Electric SQL integration** for real-time features
   - **Implement lineage resolution** for complex editing workflows
   - **Follow agent framework patterns** for new AI tools
4. Run the test suite to ensure functionality
5. Submit a pull request

## License

[Add your license information here]