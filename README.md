# Script Writer

A collaborative script writing application with AI assistance, real-time collaboration, and project-based workflow management with comprehensive data traceability features.

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

### 🤖 AI-Powered Features

#### New Architecture: Electric SQL + Streaming Agent Framework
- **Real-time sync** with Electric SQL for instant UI updates
- **Streaming Agent Framework** with pluggable tool system for extensible AI workflows
- **Project-based brainstorming** with Electric real-time sync and progressive UI updates
- **Modular tool system** supporting custom AI workflows and transforms
- **Type-safe streaming** with Zod validation and comprehensive error recovery
- **去脸谱化 (De-stereotyping)** - AI prompts explicitly require avoiding stereotypical characters and plots

#### Legacy Architecture: SSE-based Streaming (Being Phased Out)
- **Real-time JSON streaming** with RxJS-based architecture for partial response parsing
- **Script editing assistance** using DeepSeek AI
- **Chat interface** for AI interactions
- **Genre-based content generation** with multi-column responsive display
- **Transform replay system** for reproducibility testing
- **Partial JSON parsing** with automatic repair and error recovery
- **Streaming progress indicators** with cancellation support
- **Automatic content filtering** - Removes `<think>...</think>` tags and code block wrappers from LLM outputs

### 👥 Collaboration & Project Management
- **Project-based workflow** - Organize work into projects with episodes and scripts
- **Multi-user project collaboration** with role-based access control
- **Real-time collaborative editing** using Yjs
- **WebSocket-based synchronization**
- **Multi-user cursor tracking**
- **Project phase tracking** - From ideation through episode generation to script completion

### 🎨 User Interface
- **Modern dark theme** with Ant Design components
- **Responsive design** for desktop and mobile
- **Project-centric navigation** with unified layout
- **Dynamic streaming UI** - Controls render eagerly as JSON data arrives
- **User dropdown** with profile info and logout
- **Modern state management** with TanStack Query for server state and Zustand for client state
- **Unified project layout** with collapsible sections for outline and episodes
- **Real-time UI updates** with Electric SQL synchronization

### 📊 Analytics & Debugging
- **Complete data traceability** through artifacts and transforms
- **Transform replay capabilities** for testing and analysis
- **Performance monitoring** with real-time state management and metrics
- **Advanced search** across all user data
- **Data export** for AI training and analysis
- **Comprehensive debugging tools** for development

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Docker and Docker Compose (for Electric SQL)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd script-writer
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Copy and edit .env file
cp .env.example .env
```

Required environment variables:
```env
# LLM API Configuration
LLM_API_KEY=your-deepseek-api-key-here
LLM_BASE_URL=...
LLM_MODEL_NAME=...

# JWT Authentication Configuration  
JWT_SECRET=your-super-secret-jwt-key-256-bits-minimum
JWT_EXPIRES_IN=7d
COOKIE_DOMAIN=localhost

# Server Configuration
PORT=4600

# Electric SQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=script_writer
DB_USER=postgres
DB_PASSWORD=password
ELECTRIC_URL=http://localhost:3000
```

4. Start Electric SQL and PostgreSQL:
```bash
docker compose up -d
```

5. Start the development server:
```bash
npm run dev
```

6. Open your browser and navigate to `http://localhost:4600`

### First Login

1. You'll be redirected to the login page
2. Select one of the test users from the dropdown:
   - **Xi Yang** (xiyang)
   - **Xiao Lin** (xiaolin) 
3. Click "登录" to log in
4. You'll be redirected to the main application

## Architecture

### New Architecture: Electric SQL + Streaming Agents

The application is migrating to a modern architecture combining Electric SQL for real-time sync with a Streaming Agent Framework for AI workflows.

#### Electric SQL Integration
- **Real-time database sync** from PostgreSQL to frontend with sub-100ms updates
- **Authenticated proxy pattern** for secure user-scoped data access
- **Automatic conflict resolution** and offline support
- **User isolation** - all data automatically scoped to authenticated user's projects

#### Streaming Agent Framework
- **Pluggable tool system** for extensible AI workflows
- **Real-time streaming** with live progress updates
- **Type-safe execution** with Zod validation
- **Result management** with persistent storage and unique IDs
- **Multi-step workflows** supporting complex AI agent interactions

```typescript
// Example: Brainstorm tool integration
const brainstormToolDef = createBrainstormToolDefinition();
const result = await runStreamingAgent({
  userRequest: "Create story ideas for TikTok videos...",
  toolDefinitions: [brainstormToolDef],
  onStreamChunk: (chunk) => {
    // Real-time UI updates via Electric sync
  },
  onResultId: (resultId) => {
    // Store result ID for later retrieval
  }
});
```

#### Database Schema (PostgreSQL + Electric)
```sql
-- Projects with multi-user collaboration
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT DEFAULT 'script',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced artifacts with Electric streaming support
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  streaming_status TEXT DEFAULT 'completed',
  streaming_progress DECIMAL(5,2) DEFAULT 100.00,
  partial_data JSONB -- Real-time streaming data
);

-- Electric-optimized view for brainstorming flows
CREATE VIEW brainstorm_flows AS
SELECT 
  p.id as project_id,
  t.id as transform_id,
  t.streaming_status as transform_status,
  a.streaming_progress,
  a.partial_data
FROM projects p
JOIN transforms t ON t.project_id = p.id
LEFT JOIN artifacts a ON a.transform_id = t.id
WHERE t.type = 'llm';
```

### Legacy Architecture: SSE-based Streaming (Being Phased Out)

The application previously used Server-Sent Events (SSE) for real-time updates. This is being replaced by Electric SQL.

#### Frontend Architecture (Legacy)
- **React 19** with TypeScript
- **TanStack Query (React Query)** for server state management
- **Zustand** for global client state management
- **Ant Design** component library with responsive multi-column layouts
- **React Router** for navigation with protected routes
- **RxJS streaming services** for real-time LLM JSON parsing (being replaced)

#### Backend (Legacy)
- **Express.js** server with TypeScript
- **SQLite** database (migrating to PostgreSQL)
- **Knex.js** for database operations (migrating to Kysely)
- **Server-Sent Events** for real-time updates (being replaced by Electric)
- **Yjs WebSocket server** for real-time collaboration

### Frontend State Management

The application uses a **modern state management architecture** that eliminates inefficiencies:

- **TanStack Query** manages all server state with intelligent caching
- **Zustand** provides lightweight global state for UI state
- **Electric useShape hooks** for real-time database synchronization
- **Unified Data Flow**: Components read from stores, Electric keeps data synced

```typescript
// Modern pattern: Electric + Zustand integration
export function useElectricBrainstorm(projectId: string) {
  const { data: flows, isLoading } = useShape({
    url: '/api/electric/v1/shape',
    params: {
      table: 'brainstorm_flows',
      where: `project_id = '${projectId}'`
    }
  });

  return {
    ideas: flows?.[0]?.partial_data?.ideas || [],
    status: flows?.[0]?.transform_status || 'idle',
    progress: flows?.[0]?.streaming_progress || 0,
    isLoading
  };
}
```

## API Endpoints

### Authentication
- `POST /auth/login` - Login with provider credentials
- `POST /auth/logout` - Logout and invalidate session
- `GET /auth/me` - Get current user info
- `GET /auth/status` - Check authentication status

### Electric SQL Proxy (New)
- `GET /api/electric/v1/shape` - Authenticated Electric SQL proxy for real-time sync
- Automatic user scoping and project-based access control
- Real-time streaming of database changes

### Streaming Agent Framework (New)
- `POST /api/agent/stream` - Execute streaming agent with tool selection
- `GET /api/results/:resultId` - Retrieve agent execution results
- `POST /api/brainstorm/create-project` - Create project and start brainstorming
- `POST /api/brainstorm/start` - Start brainstorming for existing project

### Project Management (All Require Authentication)
- `GET /api/projects` - List user's projects
- `GET /api/projects/:id` - Get specific project details
- `POST /api/projects/create` - Create new project
- `PUT /api/projects/:id` - Update project details
- `DELETE /api/projects/:id` - Delete project

### Legacy SSE Endpoints (Being Phased Out)
- `GET /api/streaming/transform/:transformId` - Subscribe to transform streaming updates
- `POST /api/streaming/llm` - Generic LLM JSON streaming
- `POST /api/projects/:id/brainstorm/generate/stream` - Legacy brainstorming endpoint

### Real-time Collaboration
- `WebSocket /yjs?room={roomId}` - Join collaborative editing session (authenticated)

## Security Features

### Electric SQL Security
- **Authenticated proxy pattern** - All Electric requests go through authentication proxy
- **Automatic user scoping** - Database queries automatically filtered by user's project access
- **Project-based isolation** - Users can only access data from their projects
- **Debug token support** - Development workflow with `debug-auth-token-script-writer-dev`

### Project-Based Access Control
- **Multi-user projects** with role-based permissions (owner, editor, member, viewer)
- **Project membership validation** for all API endpoints
- **Cross-project data isolation** - users can only access projects they're members of
- **Collaborative editing** with proper room ownership verification

### Enhanced Security
- **HTTP-only cookies** prevent XSS attacks
- **JWT tokens** with expiration and session tracking
- **CORS configuration** for cross-origin requests
- **Input validation** on all endpoints
- **Session cleanup** for expired tokens

## Development

### Project Structure
```
src/
├── client/                 # React frontend
│   ├── components/        # React components with Electric sync
│   │   ├── ProjectBrainstormPage.tsx   # Electric-powered brainstorming
│   │   ├── DynamicStreamingUI.tsx      # Legacy streaming interface
│   │   └── shared/streaming/           # Legacy streaming components
│   ├── hooks/             # Custom hooks
│   │   ├── useElectricBrainstorm.ts    # Electric sync hooks
│   │   ├── useProjectData.ts           # TanStack Query hooks
│   │   └── useLLMStreamingWithStore.ts # Legacy streaming hooks
│   ├── services/          # API services
│   │   ├── streaming/     # Legacy RxJS streaming services
│   │   └── implementations/ # Legacy streaming implementations
│   └── stores/            # Zustand stores
│       └── projectStore.ts # Global project state management
├── common/                # Shared frontend/backend types
│   ├── config/electric.ts # Electric SQL configuration
│   ├── streaming/         # Legacy streaming interfaces
│   └── llm/              # LLM template types
└── server/                # Express backend
    ├── database/          # Database setup
    │   ├── schema.sql     # PostgreSQL schema for Electric
    │   ├── types.ts       # Generated Kysely types
    │   └── connection.ts  # Database connection (Kysely + PostgreSQL)
    ├── routes/            # API routes
    │   ├── electricProxy.ts # Electric SQL authentication proxy
    │   ├── brainstormRoutes.ts # New brainstorming endpoints
    │   └── ideations.ts   # Legacy project endpoints
    ├── services/          # Business logic
    │   ├── BrainstormService.ts # Electric-integrated brainstorming
    │   ├── StreamingAgentFramework.ts # Agent orchestration
    │   └── streaming/     # Legacy streaming executors
    ├── tools/             # Streaming agent tools
    │   └── BrainstormTool.ts # Brainstorming tool definition
    └── transforms/        # Transform implementations
        └── ideation-stream.ts # Brainstorming transform logic
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `docker compose up` - Start Electric SQL and PostgreSQL

### Development with Electric SQL

1. **Start Electric and PostgreSQL**:
```bash
docker compose up -d
```

2. **Verify Electric is running**:
```bash
curl http://localhost:3000/v1/shape?table=projects&offset=-1
```

3. **Test authentication**:
```bash
./run-ts src/server/scripts/test-electric-auth.ts
```

4. **Monitor Electric logs**:
```bash
docker compose logs -f electric
```

## Migration Status: SSE → Electric SQL

The application is currently in a **hybrid state** during migration from SSE to Electric SQL:

### ✅ Completed
- **Electric SQL setup** with PostgreSQL and Docker Compose
- **Authentication proxy** for secure, user-scoped access
- **Database schema** optimized for Electric sync
- **Frontend Electric hooks** (`useElectricBrainstorm`)
- **Streaming Agent Framework** with tool system
- **Dependencies** updated with Electric SQL packages

### 🚧 In Progress
- **Backend service migration** from SSE to Electric updates
- **Database migration** from SQLite + Knex to PostgreSQL + Kysely
- **Frontend component updates** to use Electric exclusively

### ❌ To Be Removed
- **Legacy SSE infrastructure** (JobBroadcaster, StreamingTransformExecutor)
- **RxJS streaming services** (replaced by Electric)
- **Complex caching layers** (eliminated by Electric's real-time sync)
- **SQLite database** (migrated to PostgreSQL)

### Migration Benefits
- **70%+ code reduction** by eliminating SSE complexity
- **Sub-100ms updates** with Electric's real-time sync
- **Simplified architecture** - single trigger endpoints + Electric sync
- **Better collaboration** with real-time multi-user sync
- **Enhanced security** with automatic user scoping

## Streaming Agent Framework

The application features a **Streaming Agent Framework** that enables AI agents to use specialized tools for content generation.

### Core Components

#### StreamingAgentFramework.ts
- **Generic tool system** supporting any tool that implements `StreamingToolDefinition`
- **Real-time streaming** with live updates during tool execution
- **Result management** with global in-memory storage and unique result IDs
- **Multi-step execution** supporting complex workflows

#### Tool System
```typescript
interface StreamingToolDefinition<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  executeFunction: (input: TInput) => Promise<AsyncIterable<Partial<TOutput>>>;
}

// Example: Brainstorm tool
const brainstormToolDef = createBrainstormToolDefinition();
const result = await runStreamingAgent({
  userRequest: "Create story ideas for TikTok videos...",
  toolDefinitions: [brainstormToolDef],
  onStreamChunk: (chunk) => console.log('Streaming:', chunk),
  onResultId: (id) => console.log('Result ID:', id)
});
```

#### Agent Execution Flow
1. **Request Processing** - Natural language user request
2. **Tool Selection** - LLM analyzes request and selects appropriate tool
3. **Parameter Extraction** - Extract necessary parameters from request
4. **Tool Execution** - Execute tool with real-time streaming
5. **Result Storage** - Store results with unique IDs for retrieval

### Testing Framework
```bash
# Test the complete agent flow
./run-ts src/server/scripts/test-agent-flow.ts
```

## Recent Major Changes

### Electric SQL Integration
- **Real-time sync** replacing Server-Sent Events for better performance
- **Authenticated proxy pattern** ensuring secure, user-scoped data access
- **PostgreSQL migration** from SQLite for better Electric compatibility
- **Simplified streaming** - database updates automatically sync to frontend

### Streaming Agent Framework
- **Modular tool system** for extensible AI workflows
- **Type-safe execution** with comprehensive Zod validation
- **Real-time progress** with streaming chunk updates
- **Result persistence** with unique ID-based retrieval

### Project-Based Architecture
- **Multi-user collaboration** with role-based permissions
- **Enhanced security** with project membership validation
- **Simplified data model** eliminating complex flow systems
- **Better organization** with clear project hierarchy

## Future Enhancements

### Electric SQL Completion
- **Complete SSE removal** and migration to Electric-only architecture
- **Advanced real-time features** like presence indicators and live cursors
- **Offline support** with Electric's built-in sync capabilities
- **Performance optimization** with Electric's caching and batching

### Agent Framework Extensions
- **Multi-tool workflows** with agents using multiple tools in sequence
- **Conditional logic** and branching based on intermediate results
- **Custom tool development** framework for domain-specific workflows
- **Integration APIs** for external tool and service connections

### Collaboration Features
- **Advanced role management** with custom permissions
- **Real-time notifications** and activity feeds
- **Version control** with branching and merging capabilities
- **Comment system** with inline reviews and discussions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the established patterns:
   - **Use Electric SQL** for new real-time features
   - **Follow Streaming Agent Framework** patterns for AI workflows
   - **Maintain project-based access control** for all operations
   - **Use TypeScript** with proper type definitions
4. Test with Electric SQL and authentication flows
5. Submit a pull request

## License

[Add your license information here]