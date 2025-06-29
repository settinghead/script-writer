# Script Writer

A collaborative script writing application with AI assistance, real-time collaboration, and project-based workflow management with comprehensive data traceability through a schema-driven transform system and intelligent agent framework.

## Overview

Script Writer is a modern collaborative writing platform that combines AI-powered content generation with sophisticated editing workflows. The application features an intelligent agent system that can understand natural language requests and automatically generate or edit story content through a chat-based interface.

**Key Innovations**:
- **Dual-Mode Agent System** - Seamlessly switches between content generation and AI-powered editing
- **Advanced Lineage Tracking** - Complete audit trail of all content modifications with "always edit latest" principle  
- **Real-time Collaboration** - Electric SQL integration for instant synchronization across all clients
- **Schema-Driven Architecture** - Type-safe validation and transform system preventing data inconsistencies
- **Development-Optimized Caching** - Comprehensive caching system for rapid development iteration

## Key Features

### 🤖 Intelligent Agent Framework

**Core Architecture**: All major operations routed through a context-aware agent framework with tool-based decision making and natural language understanding.

**Agent Capabilities**:
- **Dual-Mode Operation** - Automatically detects generation vs editing requests and routes appropriately
- **Natural Language Interface** - ChatGPT-style conversation with bilingual support (English/Chinese)
- **Context Enrichment** - Maintains project context and provides comprehensive background for AI operations
- **Tool Orchestration** - Intelligent selection between specialized tools based on user intent

**Available Tools**:
- ✅ **Brainstorm Generation** - Creates new story ideas with real-time streaming updates
- ✅ **Brainstorm Editing** - AI-powered content modification with context awareness
- ✅ **Outline Generation** - Comprehensive story outlines with character development and episode structure
- ⚠️ **Episode Script Generation** - Legacy SSE-based, pending Electric SQL migration
- ✅ **Conversational Response** - General chat with project context

**AI-Powered Editing System**:
```
User: "让这些故事更现代一些，加入一些科技元素"
↓
Agent Analysis: Detects edit request, enriches with context
↓
Tool Selection: Chooses BrainstormEditTool over BrainstormTool
↓
Context Preparation: Current ideas + platform requirements + user instructions
↓
LLM Transform: Generates improved versions with modern tech elements
↓
Artifact Creation: Creates new artifacts with proper lineage tracking
↓
UI Update: Real-time display with edit indicators
```

### 🔄 Advanced Transform & Lineage System

**Design Philosophy**: Treat AI-generated content as immutable while providing unlimited editing flexibility through sophisticated lineage tracking and automatic "latest version" resolution.

**Core Principles**:
- **Immutable Artifacts** - Original AI content preserved as historical records
- **Lineage Resolution** - Always edit the most recent version through intelligent graph traversal
- **Individual Breakdown** - Collections automatically decomposed for granular editing
- **Complete Audit Trail** - Every modification tracked with timestamps and attribution

**Type System Innovation**:
- **Schema Types** (`schema_type`) - Define data structure (e.g., `brainstorm_collection_schema`)
- **Origin Types** (`origin_type`) - Define creation source (`ai_generated` vs `user_input`)
- **Clear Separation** - Eliminates type confusion that caused editability bugs
- **Zod Validation** - All transforms validated against versioned schemas

**Lineage Resolution Examples**:
```
Simple Chain:
Artifact A → Human Transform → Artifact B (leaf)
User edits A → System resolves to B → User edits latest version

Complex Branching:
Collection → [Idea 1] → Human Edit → User Input → AI Edit → Enhanced Idea (leaf)
          → [Idea 2] → AI Edit → Enhanced Idea (leaf)
          → [Idea 3] → (unchanged, references original)
```

### 🔄 Unified Streaming Framework & Caching

**Streaming Framework**: All AI tools use a unified streaming architecture with 90% reduction in boilerplate code and consistent behavior.

**Framework Benefits**:
- **Code Reduction** - Tools reduced from ~200 lines to ~30 lines of business logic
- **Consistent Behavior** - Identical streaming patterns, error handling, validation
- **Centralized Maintenance** - Bug fixes apply to all tools automatically
- **Type Safety** - Comprehensive Zod validation throughout pipeline

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

### 🔐 Authentication & Security

**Authentication System**:
- **JWT-based** with HTTP-only cookies for XSS protection
- **Test user login** via dropdown (xiyang, xiaolin)
- **Debug token** for development (`debug-auth-token-script-writer-dev`)
- **Extensible architecture** ready for WeChat, Weibo, SMS, password login

**Project-Based Access Control**:
- **Project Membership** - Access controlled through `projects_users` table
- **No Direct User Ownership** - Artifacts/transforms have `project_id`, not `user_id`
- **Electric SQL Proxy** - All real-time data automatically scoped to user's projects
- **API Protection** - All AI/LLM endpoints require authentication

### 💬 Real-Time Collaboration & Chat

**Chat Interface**:
- **ChatGPT-style** resizable sidebar (250px-600px) with mobile responsive design
- **Event-driven messaging** - 6 event types for comprehensive interaction tracking
- **Message sanitization** - Two-layer system preventing trade secret exposure
- **Project-scoped history** - Complete conversation context per project

**Real-Time Synchronization**:
- **Electric SQL integration** - Instant updates across all connected clients
- **Authenticated proxy** - All shape requests validated and user-scoped
- **Performance optimized** - Efficient real-time data streaming

### 🎨 Modern User Interface

**Design System**:
- **Modern dark theme** with Ant Design components throughout
- **Responsive design** for desktop and mobile
- **Chinese localization** - Fully translated for Chinese user base

**Advanced UI Features**:
- **Interactive Workflow Visualization** - Real-time project progress with intelligent navigation
- **Entity-Specific Mutation States** - Isolated save indicators prevent UI interference
- **Advanced Debounced Auto-Save** - Field-level debouncing with request cancellation
- **Dynamic Streaming UI** - Controls render eagerly as JSON data arrives
- **Edit History Visualization** - Visual indicators (📝 已编辑版本) for modified content

**Workflow Visualization**:
- **Right Sidebar Map** - Vertical workflow with real artifact data
- **Main Path Algorithm** - Intelligent detection of primary progression
- **Interactive Navigation** - Click nodes to scroll to project sections
- **Current Section Highlighting** - Dynamic highlighting with smooth transitions

### 📊 Development & Debugging Tools

**Raw Graph Visualization**:
- **Interactive debugging** - Complete artifact and transform lineage visualization
- **React Flow integration** - Pan, zoom, selection with hierarchical layout
- **Real-time updates** - Electric SQL integration for live graph updates
- **Access via** `?raw-graph=1` parameter or breadcrumb toggle

**Comprehensive Testing**:
- **Schema validation testing** - Complete transform system validation
- **Lineage resolution testing** - Complex graph traversal scenarios
- **Agent framework testing** - End-to-end workflow validation
- **Caching system testing** - Cache hit/miss behavior verification

## Architecture

### Core System Design

The application is built around three core architectural principles:

1. **Agent-Driven Operations** - All content modifications flow through intelligent agents
2. **Immutable Artifacts with Flexible Editing** - Original content preserved, edits create new versions
3. **Real-Time Collaboration** - Electric SQL enables instant synchronization

### Database Architecture

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
  schema_type TEXT NOT NULL,        -- Data structure type
  origin_type TEXT NOT NULL,        -- Creation source
  data TEXT NOT NULL,
  streaming_status TEXT DEFAULT 'completed'
);

-- Transform tracking with lineage
CREATE TABLE transforms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  streaming_status TEXT DEFAULT 'pending'
);

-- Human transforms with concurrent protection
CREATE TABLE human_transforms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  input_artifact_id TEXT NOT NULL,
  output_artifact_id TEXT NOT NULL,
  path TEXT NOT NULL,
  CONSTRAINT unique_human_transform_per_artifact_path 
    UNIQUE (input_artifact_id, path)
);
```

### Frontend Architecture

**React 19 + TypeScript**:
- **TanStack Query** - Server state management with intelligent caching
- **Zustand** - Global client state for UI interactions
- **Electric SQL React hooks** - Real-time data synchronization
- **Ant Design** - Component library with dark theme

**State Management Pattern**:
```typescript
// Server state via TanStack Query
const { data: artifacts } = useQuery(['artifacts', projectId]);

// Client state via Zustand  
const { chatSidebarWidth, setChatSidebarWidth } = useProjectStore();

// Real-time sync via Electric SQL
const { results: chatMessages } = useShape(chatMessagesShape);
```

### Backend Architecture

**Express.js + TypeScript**:
- **Unified Streaming Framework** - Consistent tool implementation pattern
- **Schema Transform Executor** - Validated transform execution
- **Agent Service** - Central orchestration with tool selection
- **Electric SQL Proxy** - Authenticated real-time data access

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

## Development

### Getting Started

```bash
# Start PostgreSQL + Electric SQL
docker compose up -d

# Install dependencies
npm install

# Run database migrations
npm run migrate

# Seed test users
npm run seed

# Start development server
npm run dev
```

### Available Scripts

**Database Management**:
- `npm run migrate` - Run database migrations
- `npm run migrate:down` - Roll back last migration
- `npm run seed` - Seed test users
- `npm run nuke` - ⚠️ Destroy and recreate database

**Testing**:
- `npm run test:schema` - Test schema transform system
- `./run-ts src/server/scripts/test-streaming-framework.ts` - Test unified streaming
- `./run-ts src/server/scripts/test-agent-flow-integration.ts` - Test complete workflows

**Development Tools**:
- `./run-ts <script>` - Run TypeScript scripts with proper configuration
- `psql -h localhost -U postgres -d script_writer` - Direct database access

### Project Structure

```
src/
├── client/                 # React frontend
│   ├── components/        # UI components
│   │   ├── chat/          # Chat interface
│   │   ├── shared/        # Reusable components
│   │   └── brainstorm/    # Feature-specific components
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API services
│   └── stores/            # Zustand stores
├── common/                # Shared types and schemas
│   ├── schemas/           # Zod validation schemas
│   └── utils/             # Shared utilities
└── server/                # Express backend
    ├── database/          # Database setup and migrations
    ├── services/          # Business logic
    ├── tools/             # Agent tools
    ├── repositories/      # Data access layer
    └── scripts/           # Development and testing scripts
```

### Testing Strategy

**Comprehensive Test Coverage**:
- **Schema Validation** - All artifact types validated against Zod schemas
- **Lineage Resolution** - Complex graph traversal scenarios
- **Agent Framework** - End-to-end workflow testing
- **Caching System** - Cache hit/miss behavior verification
- **Real-time Sync** - Electric SQL integration testing

## API Reference

### Authentication
- `POST /auth/login` - Login with provider credentials
- `GET /auth/me` - Get current user info
- `POST /auth/logout` - Logout and invalidate session

### Agent & Chat System
- `POST /api/projects/:id/agent` - Send general agent request
- `POST /api/chat/:projectId/messages` - Send user message to agent
- `GET /api/chat/:projectId/messages` - Get chat history (Electric SQL)

### Project Management
- `GET /api/projects` - List user's projects
- `POST /api/projects/create` - Create new project
- `GET /api/projects/:id` - Get project details

### Schema Transform System
- `POST /api/artifacts/:id/human-transform` - Execute human transform
- `POST /api/artifacts/:id/schema-transform` - Execute LLM transform
- `GET /api/artifacts` - List artifacts with filtering

### Electric SQL Proxy
- `GET /api/electric/v1/shape` - Authenticated proxy with user scoping

## Recent Major Changes

### Advanced Caching System Implementation ✅ COMPLETED

**Achievement**: Comprehensive caching system eliminating repeated LLM calls during development while maintaining identical streaming behavior.

**Key Features**:
- **Tool-Level Integration** - Caching parameters at factory level, not through AI SDK
- **Transparent Architecture** - Internal cache management with AI SDK-compatible interface
- **File-Based Storage** - SHA256 cache keys with model-aware invalidation
- **Deterministic Testing** - Fixed seeds for reproducible results

**Performance Results**:
- **BrainstormTool**: 77 chunks cached, near-instantaneous replay
- **BrainstormEditTool**: 33 chunks cached with lineage integration
- **OutlineTool**: 777 chunks cached for complex object generation

### Unified Streaming Framework ✅ COMPLETED

**Achievement**: 90% code reduction across all AI tools with consistent streaming behavior.

**Technical Benefits**:
- **Simplified Implementation** - Tools reduced from ~200 to ~30 lines
- **Centralized Maintenance** - Single framework for all streaming operations
- **Type Safety** - Comprehensive Zod validation throughout
- **Universal JSON Handling** - No distinction between collections/objects

### Advanced Artifact Type System ✅ COMPLETED

**Achievement**: Resolved fundamental type confusion causing editability bugs.

**Core Innovation**:
- **Dual-Type Architecture** - Separated schema types from origin types
- **Enhanced Database Schema** - Added `schema_type`, `origin_type` columns
- **Fixed Editability Logic** - Uses `origin_type` for editing permissions
- **Comprehensive Migration** - All artifact creation points updated

### Agent-Based Outline Generation ✅ COMPLETED

**Achievement**: Complete migration from legacy SSE to agent-based Electric SQL system.

**System Features**:
- **Seamless Integration** - "用这个灵感继续" workflow from brainstorm to outline
- **Comprehensive Schemas** - Character systems, story stages, selling points
- **Real-time Display** - Progressive outline rendering via Electric SQL
- **Legacy Cleanup** - Complete removal of SSE-based code

### Interactive Workflow Visualization ✅ COMPLETED

**Achievement**: Real-time project navigation with intelligent main path detection.

**Features**:
- **Data-Driven Nodes** - Actual artifact data instead of mock content
- **Interactive Navigation** - Click nodes to scroll to project sections
- **Current Section Highlighting** - Dynamic highlighting with smooth transitions
- **Mobile Responsive** - Slide-in drawer for mobile devices

### Entity-Specific Mutation State System ✅ COMPLETED

**Achievement**: Isolated save states preventing UI interference between editors.

**Technical Implementation**:
- **Entity-Specific Maps** - Separate mutation states per artifact
- **Request Cancellation** - AbortController integration for race condition prevention
- **Field-Level Debouncing** - Independent timeout tracking per form field
- **Automatic Cleanup** - Success states auto-clear after 2 seconds

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow established patterns:
   - Use schema-driven transforms for data modifications
   - Maintain immutable artifacts with lineage tracking
   - Use `./run-ts` for TypeScript scripts
   - Test with comprehensive validation
4. Run test suite
5. Submit pull request

## License

[Add your license information here]