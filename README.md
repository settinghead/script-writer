# Script Writer

A collaborative script writing application with AI assistance, real-time collaboration, and project-based workflow management with comprehensive data traceability through a schema-driven transform system.

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
- **Schema-driven artifact editing** with complete transform lineage tracking
- **Real-time streaming** with progressive UI updates as content arrives
- **Script editing assistance** using DeepSeek AI
- **Genre-based content generation** with multi-column responsive display
- **Transform replay system** for reproducibility testing
- **Partial JSON parsing** with automatic repair and error recovery
- **Streaming progress indicators** with cancellation support
- **去脸谱化 (De-stereotyping)** - AI prompts explicitly require avoiding stereotypical characters and plots
- **Automatic content filtering** - Removes `<think>...</think>` tags and code block wrappers from LLM outputs

### 🔄 Schema-Driven Transform System
- **Immutable artifacts** - All data modifications tracked through versioned transforms
- **Complete lineage tracking** - Full audit trail from original AI-generated content to user edits
- **Zod schema validation** - Type-safe artifact definitions with runtime validation
- **Path-based editing** - Granular field-level and object-level editing capabilities
- **Transform instantiation registry** - Extensible system for defining new transform types
- **Automatic artifact versioning** - Creates new artifact versions while preserving history
- **User input artifacts** - Seamless transition from AI-generated to user-modified content
- **Concurrent editing protection** - Database-level unique constraints prevent race conditions

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
- **Schema-based artifact editor** with debounced auto-save
- **Smooth typing experience** with local state management
- **Subtle save indicators** - Non-intrusive feedback with checkmarks and spinners
- **User dropdown** with profile info and logout
- **Modern state management** with TanStack Query for server state and Zustand for client state

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
- Docker and Docker Compose (for PostgreSQL + Electric SQL)

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

# PostgreSQL + Electric SQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=script_writer
DB_USER=postgres
DB_PASSWORD=password
ELECTRIC_URL=http://localhost:3000
```

4. Start PostgreSQL and Electric SQL:
```bash
docker compose up -d
```

5. Run database migrations:
```bash
npm run migrate
```

6. Start the development server:
```bash
npm run dev
```

7. Open your browser and navigate to `http://localhost:4600`

### First Login

1. You'll be redirected to the login page
2. Select one of the test users from the dropdown:
   - **Xi Yang** (xiyang)
   - **Xiao Lin** (xiaolin) 
3. Click "登录" to log in
4. You'll be redirected to the main application

## Architecture

### Core Architecture: Schema-Driven Transforms

The application is built around a **schema-driven transform system** that provides complete data traceability and type safety.

#### Artifacts & Transforms Flow
```
AI Generation → Original Artifact (immutable)
     ↓
User Edit → Human Transform → Derived Artifact (user_input)
     ↓
Further Edits → Update Derived Artifact (in-place)
```

#### Key Components

**1. Artifact System**
- **Immutable original artifacts** - AI-generated content never changes
- **Versioned derived artifacts** - User modifications create new artifact versions
- **Type-safe schemas** - Zod validation ensures data integrity
- **Complete metadata** - Full context and lineage tracking

**2. Transform System**
- **Human transforms** - Track all user modifications with timestamps
- **LLM transforms** - Record AI generation parameters and results
- **Transform instantiation** - Schema-validated transform execution
- **Path-based editing** - Support for field-level (`[0].title`) and object-level (`[0]`) modifications

**3. Schema Validation**
```typescript
// Example artifact schema
const BrainstormIdeaCollectionSchema = z.object({
  ideas: z.array(z.object({
    title: z.string(),
    body: z.string()
  }))
});

// Transform definition with path patterns
const editBrainstormIdeaTransform = {
  name: 'edit_brainstorm_idea',
  inputType: 'brainstorm_idea_collection',
  targetType: 'brainstorm_idea',
  pathPattern: /^\[\d+\]$/,  // Matches [0], [1], etc.
  instantiationFunction: 'createBrainstormIdeaFromBrainstormIdea'
};
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
- **Server-Sent Events** for real-time streaming updates
- **Yjs WebSocket server** for real-time collaboration

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
    const response = await fetch(`/api/artifacts/${artifactId}/schema-transform`, {
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

### Schema Transform System
- `POST /api/artifacts/:id/schema-transform` - Execute schema-validated transform
- `GET /api/artifacts` - List artifacts with filtering and search
- `GET /api/artifacts/:id` - Get specific artifact with metadata
- `GET /api/transforms/human` - List human transforms with lineage

### Project Management (All Require Authentication)
- `GET /api/projects` - List user's projects
- `GET /api/projects/:id` - Get specific project details
- `POST /api/projects/create` - Create new project
- `PUT /api/projects/:id` - Update project details
- `DELETE /api/projects/:id` - Delete project

### Content Generation
- `POST /api/brainstorm/generate/stream` - Generate brainstorm ideas with streaming
- `POST /api/outline/generate/stream` - Generate story outline with streaming
- `POST /api/episodes/generate/stream` - Generate episode content with streaming
- `POST /api/scripts/generate/stream` - Generate script content with streaming

### Electric SQL Proxy (Authenticated)
- `GET /api/electric/v1/shape` - Authenticated proxy to Electric SQL with automatic user scoping

### Real-time Collaboration
- `WebSocket /yjs?room={roomId}` - Join collaborative editing session (authenticated)

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
│   │   ├── shared/        # Shared components
│   │   │   ├── ArtifactEditor.tsx        # Schema-based artifact editor
│   │   │   ├── EditableField.tsx         # Auto-saving editable fields
│   │   │   └── streaming/                # Dynamic streaming UI components
│   │   ├── BrainstormingResults.tsx      # Brainstorm display with editing
│   │   ├── OutlineResults.tsx            # Outline display with editing
│   │   └── ProjectLayout.tsx             # Main project interface
│   ├── hooks/             # Custom hooks
│   │   ├── useProjectData.ts             # TanStack Query hooks
│   │   ├── useStreamingLLM.ts            # Streaming LLM integration
│   │   └── useDebounce.ts                # Debounced auto-save
│   ├── services/          # API services
│   │   └── apiService.ts  # Centralized API client
│   └── stores/            # Zustand stores
│       └── projectStore.ts # Global project state management
├── common/                # Shared frontend/backend types
│   ├── config/            # Configuration
│   │   └── electric.ts    # Electric SQL configuration
│   ├── schemas/           # Zod schemas
│   │   ├── artifacts.ts   # Artifact type definitions
│   │   └── transforms.ts  # Transform definitions with path patterns
│   ├── streaming/         # Streaming interfaces
│   └── types.ts          # Common type definitions
└── server/                # Express backend
    ├── database/          # Database setup
    │   ├── connection.ts  # Kysely database connection
    │   ├── types.ts       # Generated Kysely types
    │   └── migrations/    # Database migrations
    ├── routes/            # API routes
    │   ├── artifactRoutes.ts # Schema transform API
    │   ├── brainstormRoutes.ts # Brainstorming endpoints
    │   ├── electricProxy.ts # Electric SQL authenticated proxy
    │   └── auth.ts        # Authentication routes
    ├── services/          # Business logic
    │   ├── SchemaTransformExecutor.ts # Core transform execution
    │   ├── TransformInstantiationRegistry.ts # Transform registry
    │   └── templates/     # LLM prompt templates
    ├── repositories/      # Data access layer
    │   ├── ArtifactRepository.ts # Artifact CRUD operations
    │   └── TransformRepository.ts # Transform tracking
    └── scripts/           # Development and testing scripts
        ├── test-schema-system.ts # Schema system testing
        └── debug-users.ts # User management utilities
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run migrate` - Run database migrations
- `npm run migrate:down` - Roll back last migration
- `npm run migrate:status` - Show migration status
- `npm run seed` - Seed test users
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
```

## Schema Transform System Deep Dive

### Transform Definitions

Transform definitions specify how artifacts can be modified:

```typescript
// Field-level editing (e.g., editing just the title)
export const editBrainstormIdeaFieldTransform: TransformDefinition = {
  name: 'edit_brainstorm_idea_field',
  inputType: 'brainstorm_idea_collection',
  targetType: 'user_input',
  pathPattern: /^\[\d+\]\.(title|body)$/,
  instantiationFunction: 'createUserInputFromBrainstormIdeaCollection'
};

// Object-level editing (e.g., editing entire idea)
export const editBrainstormIdeaTransform: TransformDefinition = {
  name: 'edit_brainstorm_idea', 
  inputType: 'brainstorm_idea_collection',
  targetType: 'brainstorm_idea',
  pathPattern: /^\[\d+\]$/,
  instantiationFunction: 'createBrainstormIdeaFromBrainstormIdea'
};
```

### Transform Execution Flow

1. **Path Validation** - Verify edit path matches transform pattern
2. **Schema Validation** - Validate input data against Zod schemas  
3. **Transform Instantiation** - Execute registered instantiation function
4. **Artifact Creation** - Create new derived artifact or update existing
5. **Lineage Tracking** - Record transform relationship in database
6. **Electric Sync** - Real-time updates automatically synced to all connected clients

### Artifact Editor Integration

The `ArtifactEditor` component provides seamless editing with real-time sync:

```typescript
// Automatic transform selection based on path
function getTransformName(artifactType: string, path: string): string {
  if (path.match(/^\[\d+\]$/)) {
    return 'edit_brainstorm_idea';  // Object-level
  }
  if (path.match(/^\[\d+\]\.(title|body)$/)) {
    return 'edit_brainstorm_idea_field';  // Field-level
  }
  throw new Error(`No transform found for path: ${path}`);
}

// Debounced auto-save with visual feedback
const editMutation = useMutation({
  mutationFn: executeSchemaTransform,
  onSuccess: () => {
    showSavedCheckmark();
    // Electric SQL automatically syncs changes - no manual refetch needed
  }
});
```


## Recent Major Changes

### PostgreSQL + Electric SQL Migration
- **Complete database migration** from SQLite to PostgreSQL with logical replication
- **Electric SQL integration** for real-time synchronization with authenticated proxy pattern
- **Kysely adoption** for type-safe database operations with auto-generated types
- **Streaming artifact support** with unified `data` field and `streaming_status` for real-time updates
- **User data isolation** enforced at proxy level with automatic WHERE clause injection

### Schema-Driven Transform System Implementation
- **Complete transform lineage tracking** - Full audit trail from AI generation to user edits
- **Zod schema validation** - Type-safe artifact definitions with runtime validation
- **Path-based editing system** - Support for granular field-level and object-level modifications
- **Transform instantiation registry** - Extensible system for defining new transform types
- **Immutable artifact architecture** - Original AI content preserved, user edits create derived artifacts
- **Concurrent editing protection** - Database-level unique constraints prevent race conditions
- **Comprehensive testing framework** - Full test suite validates all transform functionality

### User Experience Improvements
- **Smooth typing experience** - Local state management prevents React re-render issues
- **Debounced auto-save** - Automatic saving with 500ms debounce to prevent excessive API calls
- **Subtle visual feedback** - Non-intrusive save indicators with spinners and checkmarks
- **Seamless content transition** - Proper artifact loading when switching between original and derived content
- **Enhanced error handling** - Graceful handling of schema validation and transform errors
- **Real-time collaboration** - Electric SQL enables instant updates across all connected clients

### Authentication & Security Enhancements
- **Electric SQL proxy authentication** - All real-time data access authenticated and user-scoped
- **Debug token workflow** - Development authentication maintained with Electric integration
- **Session-based security** - HTTP-only cookies with automatic session validation
- **Project-based isolation** - Users can only access their own projects and data
- **Concurrent editing safety** - Database constraints prevent data corruption from simultaneous edits

### Database Architecture Updates
- **Enhanced artifact metadata** - Comprehensive context and lineage information
- **Streaming status tracking** - Real-time progress and status fields for all operations
- **Optimized queries** - Efficient artifact and transform retrieval patterns with Kysely
- **Electric-optimized views** - Database views designed for efficient real-time synchronization
- **PostgreSQL triggers** - Automatic timestamp updates and data consistency

### Frontend Architecture Improvements
- **React hooks compliance** - Fixed critical hooks order violations that caused render errors
- **Improved state management** - Better separation of server state, client state, and local UI state
- **Enhanced TypeScript safety** - Strict typing throughout with proper prop validation
- **Modern component patterns** - Consistent use of modern React patterns and best practices
- **Electric SQL integration** - Real-time hooks for seamless data synchronization

## Testing

### Schema System Testing
```bash
# Run comprehensive schema transform tests
npm run test:schema

# Test specific scenarios
./run-ts src/server/scripts/test-schema-fix.ts

# Test Electric SQL integration
./run-ts src/server/scripts/test-electric-auth.ts
```

The test suite validates:
- **Transform path validation** - Ensures only valid paths are accepted
- **Schema validation** - Verifies data integrity throughout transform process
- **Artifact creation and updates** - Tests both new artifact creation and existing artifact updates
- **Lineage tracking** - Validates complete transform relationship recording
- **Error handling** - Tests graceful handling of invalid inputs and edge cases
- **Electric SQL sync** - Validates real-time updates and user data isolation
- **Concurrent editing protection** - Tests database-level race condition prevention

## Docker & Deployment

### Development Environment
```yaml
# docker-compose.yaml
name: "script_writer_electric"
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: script_writer
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    command:
      - postgres
      - -c
      - wal_level=logical  # Required for Electric SQL
      - -c
      - max_replication_slots=10
      - -c
      - max_wal_senders=10

  electric:
    image: electricsql/electric:latest
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/script_writer
      ELECTRIC_WRITE_TO_PG_MODE: direct_writes
      AUTH_MODE: insecure
      ELECTRIC_INSECURE: "true"  # Development only
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
```

### Key Benefits of Current Architecture

1. **Real-time by Default**: Electric SQL handles all real-time updates automatically
2. **Type Safety**: Kysely provides compile-time type checking with auto-generated types
3. **Authentication Security**: Proxy pattern ensures all data access is authenticated and user-scoped
4. **Performance**: Database-level sync is more efficient than application-level SSE
5. **Scalability**: Electric handles concurrent users with low latency and memory usage
6. **Developer Experience**: Simplified real-time development with automatic sync
7. **Graph Structure Preserved**: Maintains artifact → transform → artifact flow for complex workflows
8. **Concurrent Editing Safety**: Database constraints prevent data corruption from simultaneous edits

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
4. Run the test suite to ensure functionality
5. Submit a pull request

## License

[Add your license information here]