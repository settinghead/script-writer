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
- SQLite (for local development)

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

# Database Configuration
DB_PATH=./ideations.db
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:4600`

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

#### Database Schema
```sql
-- Core artifacts table
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Transform tracking with lineage
CREATE TABLE human_transforms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  input_artifact_id TEXT NOT NULL,
  output_artifact_id TEXT NOT NULL,
  transform_name TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (input_artifact_id) REFERENCES artifacts(id),
  FOREIGN KEY (output_artifact_id) REFERENCES artifacts(id)
);
```

### Frontend Architecture
- **React 19** with TypeScript
- **TanStack Query (React Query)** for server state management
- **Zustand** for global client state management
- **Ant Design** component library with responsive multi-column layouts
- **React Router** for navigation with protected routes
- **Schema-based artifact editor** with real-time validation

### Backend Architecture
- **Express.js** server with TypeScript
- **SQLite** database with **Kysely** for type-safe database operations
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

### Real-time Collaboration
- `WebSocket /yjs?room={roomId}` - Join collaborative editing session (authenticated)

## Security Features

### Authentication & Authorization
- **HTTP-only cookies** prevent XSS attacks
- **JWT tokens** with expiration and session tracking
- **User-scoped data access** - all queries automatically filtered by user_id
- **Project-based isolation** - users can only access their own projects
- **Debug token support** - Development workflow with `debug-auth-token-script-writer-dev`

### Data Security
- **Input validation** on all endpoints with Zod schemas
- **SQL injection protection** through Kysely's type-safe query builder
- **CORS configuration** for cross-origin requests
- **Session cleanup** for expired tokens

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
./run-ts src/server/scripts/run-migration.ts

# Seed test users
./run-ts src/server/scripts/seed-test-users.ts

# Debug database state
sqlite3 ideations.db "SELECT * FROM artifacts ORDER BY created_at DESC LIMIT 10;"
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

### Artifact Editor Integration

The `ArtifactEditor` component provides seamless editing:

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
    refetchArtifacts();
  }
});
```

## Recent Major Changes

### Schema-Driven Transform System Implementation
- **Complete transform lineage tracking** - Full audit trail from AI generation to user edits
- **Zod schema validation** - Type-safe artifact definitions with runtime validation
- **Path-based editing system** - Support for granular field-level and object-level modifications
- **Transform instantiation registry** - Extensible system for defining new transform types
- **Immutable artifact architecture** - Original AI content preserved, user edits create derived artifacts
- **Comprehensive testing framework** - Full test suite validates all transform functionality

### User Experience Improvements
- **Smooth typing experience** - Local state management prevents React re-render issues
- **Debounced auto-save** - Automatic saving with 500ms debounce to prevent excessive API calls
- **Subtle visual feedback** - Non-intrusive save indicators with spinners and checkmarks
- **Seamless content transition** - Proper artifact loading when switching between original and derived content
- **Enhanced error handling** - Graceful handling of schema validation and transform errors

### Database Architecture Updates
- **Added transform_name column** - Better transform tracking and debugging capabilities
- **Enhanced artifact metadata** - Comprehensive context and lineage information
- **Optimized queries** - Efficient artifact and transform retrieval patterns
- **Migration from Knex to Kysely** - Type-safe database operations throughout

### Frontend Architecture Improvements
- **React hooks compliance** - Fixed critical hooks order violations that caused render errors
- **Improved state management** - Better separation of server state, client state, and local UI state
- **Enhanced TypeScript safety** - Strict typing throughout with proper prop validation
- **Modern component patterns** - Consistent use of modern React patterns and best practices

## Testing

### Schema System Testing
```bash
# Run comprehensive schema transform tests
npm run test:schema

# Test specific scenarios
./run-ts src/server/scripts/test-schema-fix.ts
```

The test suite validates:
- **Transform path validation** - Ensures only valid paths are accepted
- **Schema validation** - Verifies data integrity throughout transform process
- **Artifact creation and updates** - Tests both new artifact creation and existing artifact updates
- **Lineage tracking** - Validates complete transform relationship recording
- **Error handling** - Tests graceful handling of invalid inputs and edge cases

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the established patterns:
   - **Use schema-driven transforms** for all data modifications
   - **Maintain immutable artifacts** with proper lineage tracking
   - **Follow TypeScript strict typing** throughout
   - **Use `./run-ts` for all TypeScript scripts** instead of `npx tsx`
   - **Test with comprehensive schema validation**
4. Run the test suite to ensure functionality
5. Submit a pull request

## License

[Add your license information here]