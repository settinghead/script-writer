# Script Writer

A collaborative script writing application with AI assistance, real-time collaboration, and project-based workflow management with comprehensive data traceability features.

## Features

### 🔐 Authentication System
- **JWT-based authentication** with HTTP-only cookies for security
- **Test user login** via dropdown selection (xiyang, xiaolin)
- **Extensible provider architecture** ready for future integrations:
  - WeChat login
  - Weibo login  
  - SMS login
  - Password-based login
- **Protected API endpoints** - All AI/LLM requests require authentication
- **Session management** with automatic cleanup

### 🤖 AI-Powered Features
- **Real-time JSON streaming** with RxJS-based architecture for partial response parsing
- **Script editing assistance** using DeepSeek AI
- **Project-based brainstorming and plot generation** with live streaming and progressive UI updates
- **Chat interface** for AI interactions
- **Genre-based content generation** with multi-column responsive display
- **Transform replay system** for reproducibility testing
- **Partial JSON parsing** with automatic repair and error recovery
- **Streaming progress indicators** with cancellation support
- **Automatic content filtering** - Removes `<think>...</think>` tags and code block wrappers from LLM outputs
- **去脸谱化 (De-stereotyping)** - AI prompts explicitly require avoiding stereotypical characters and plots

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
- **Real-time UI updates** with streaming data integration

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

### Frontend Architecture
- **React 19** with TypeScript
- **Modern State Management Architecture**:
  - **TanStack Query (React Query)** for server state management - handles fetching, caching, synchronizing, and updating data from backend APIs
  - **Zustand** for global client state management - lightweight store for UI state and assembled results of fetched/streamed data
  - **Unified data flow** - eliminates redundant API calls and provides single source of truth
- **Ant Design** component library with responsive multi-column layouts
- **React Router** for navigation with protected routes
- **RxJS streaming services** for real-time LLM JSON parsing
- **Generic streaming hooks** with automatic state management and cleanup

#### State Management Benefits
- **Single Source of Truth**: All components read from Zustand store, ensuring UI consistency
- **Performance**: TanStack Query's cache eliminates redundant API calls, making navigation faster
- **Separation of Concerns**: Components become declarative renderers of state, while hooks and store manage complex logic
- **Simplified Logic**: Complex `useEffect` chains replaced by declarative `useQuery` hooks
- **Scalability**: Adding new data types or views becomes a matter of adding a new query and store slice

### Backend
- **Express.js** server with TypeScript
- **SQLite** database with generalized artifacts/transforms system
- **JWT authentication** with session management
- **DeepSeek AI integration** for content generation
- **Yjs WebSocket server** for real-time collaboration
- **Unified streaming architecture** with database-backed state management

### Database Schema

The application uses a **project-based architecture** with a **generalized artifacts and transforms system** for complete data traceability:

#### Project Management Tables
```sql
-- Projects are the main organizational unit
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT DEFAULT 'script',  -- 'script', 'novel', etc.
  status TEXT DEFAULT 'active',        -- 'active', 'completed', 'archived'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Multi-user project collaboration
CREATE TABLE projects_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',          -- 'owner', 'editor', 'member', 'viewer'
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE(project_id, user_id)
);
```

#### Core Artifacts & Transforms Tables
```sql
-- Immutable artifacts store all data entities (now project-scoped)
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,            -- Changed from user_id to project_id
  type TEXT NOT NULL,                  -- 'brainstorm_params', 'brainstorm_ideas', 'outline_session', etc.
  type_version TEXT NOT NULL DEFAULT 'v1',
  data TEXT NOT NULL,                  -- JSON data for the artifact
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);

-- Transform operations (LLM calls, human actions) - also project-scoped
CREATE TABLE transforms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,            -- Changed from user_id to project_id
  type TEXT NOT NULL,                  -- 'llm' or 'human'
  type_version TEXT NOT NULL DEFAULT 'v1',
  status TEXT DEFAULT 'completed',
  execution_context TEXT,              -- JSON context data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);

-- Streaming chunks for real-time processing
CREATE TABLE transform_chunks (
  id TEXT PRIMARY KEY,
  transform_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transform_id) REFERENCES transforms (id) ON DELETE CASCADE
);

-- Many-to-many relationships
CREATE TABLE transform_inputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transform_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  input_role TEXT,
  FOREIGN KEY (transform_id) REFERENCES transforms (id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES artifacts (id)
);

CREATE TABLE transform_outputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transform_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  output_role TEXT,
  FOREIGN KEY (transform_id) REFERENCES transforms (id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES artifacts (id)
);
```

#### LLM-Specific Tables
```sql
-- LLM prompts (separate due to size)
CREATE TABLE llm_prompts (
  id TEXT PRIMARY KEY,
  transform_id TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  prompt_role TEXT DEFAULT 'primary',
  FOREIGN KEY (transform_id) REFERENCES transforms (id) ON DELETE CASCADE
);

-- LLM transform metadata
CREATE TABLE llm_transforms (
  transform_id TEXT PRIMARY KEY,
  model_name TEXT NOT NULL,
  model_parameters TEXT,
  raw_response TEXT,
  token_usage TEXT,               -- JSON with token counts
  FOREIGN KEY (transform_id) REFERENCES transforms (id) ON DELETE CASCADE
);

-- Human action tracking
CREATE TABLE human_transforms (
  transform_id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  interface_context TEXT,
  change_description TEXT,
  FOREIGN KEY (transform_id) REFERENCES transforms (id) ON DELETE CASCADE
);
```

#### Authentication Tables
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active'
);

CREATE TABLE auth_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  provider_user_id TEXT,
  provider_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id),
  UNIQUE(provider_type, provider_user_id)
);

CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
);
```

### Unified Streaming Architecture

The application features a **unified, database-backed streaming architecture** that eliminates caching-related issues and provides a single source of truth for both streaming and completed data.

#### Core Design Principles

1. **Single Source of Truth**: Database (artifacts/transforms) is the only authoritative data source
2. **Real-time Updates**: Database changes trigger events to connected clients via EventSource
3. **Unified Endpoints**: Single API endpoints serve both streaming and completed data states
4. **No Caching Layer**: Eliminates race conditions and stale data issues
5. **Project-Scoped Data**: All operations filtered by project membership and user permissions

#### Streaming State Management

```typescript
interface StreamingState {
  transformId: string;
  status: 'running' | 'completed' | 'failed';
  chunks: string[];        // Retrieved from transform_chunks table
  results: any[];          // Retrieved from completed artifacts
  progress: number;        // Calculated from chunks/expected
}
```

#### Architecture Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────►│  Single API  │────►│   Database  │
│             │◄────│   Endpoint   │◄────│ (Projects/  │
└─────────────┘     └──────────────┘     │ Artifacts/  │
      ▲                    │              │ Transforms) │
      │                    │              └─────────────┘
      │              ┌─────▼──────┐              │
      └──────────────│   Event    │◄─────────────┘
                     │ Broadcaster │   DB Changes
                     └────────────┘
```

## API Endpoints

### Authentication
- `POST /auth/login` - Login with provider credentials
- `POST /auth/logout` - Logout and invalidate session
- `GET /auth/me` - Get current user info
- `GET /auth/status` - Check authentication status
- `GET /auth/test-users` - Get list of test users
- `POST /auth/refresh` - Refresh authentication token

### Protected AI Endpoints (Require Authentication)
- `POST /llm-api/chat/completions` - Chat completions
- `POST /llm-api/script/edit` - Script editing assistance
- `POST /api/streaming/llm` - Generic LLM JSON streaming with template support

### Real-time Streaming Endpoints
- `GET /api/streaming/transform/:transformId` - Subscribe to transform streaming updates via EventSource
- `GET /api/streaming/status/:transformId` - Get current streaming status and progress
- `POST /api/streaming/cancel/:transformId` - Cancel active streaming operation

### Project Management (All Require Authentication)

#### Project Operations
- `GET /api/ideations` - List user's projects (renamed from ideations for backward compatibility)
- `GET /api/ideations/:id` - Get specific project details
- `POST /api/ideations/create` - Create new project
- `PUT /api/ideations/:id` - Update project details
- `DELETE /api/ideations/:id` - Delete project

#### Brainstorming & Content Generation
- `POST /api/ideations/:id/brainstorm/generate/stream` - Stream brainstorming ideas for project
- `POST /api/ideations/:id/outline/generate/stream` - Stream outline generation for project
- `POST /api/ideations/:id/episodes/generate/stream` - Stream episode generation for project

#### Legacy Endpoints (Maintained for Compatibility)
- `POST /api/brainstorm/generate/stream` - Stream brainstorming ideas with progressive JSON parsing

#### Script Management
- `GET /api/scripts` - List user's script documents
- `GET /api/scripts/:id` - Get user's specific script document
- `POST /api/scripts` - Create new script document
- `PUT /api/scripts/:id` - Update script name
- `DELETE /api/scripts/:id` - Delete script document

#### Real-time Collaboration
- `WebSocket /yjs?room={roomId}` - Join collaborative editing session (authenticated)

### Debug & Analytics Endpoints (Development/Admin)
- `GET /debug/artifacts` - List/filter user artifacts
- `GET /debug/transforms` - List user transforms  
- `GET /debug/transforms/:id` - Detailed transform view
- `GET /debug/artifacts/:id` - Individual artifact details
- `GET /debug/artifacts/:id/lineage` - Artifact lineage tracing
- `GET /debug/stats` - Database statistics
- `GET /debug/export` - Complete user data export
- `POST /debug/replay/transform/:id` - Replay specific transform
- `POST /debug/replay/workflow/:artifactId` - Replay entire workflow
- `GET /debug/stats/transforms` - Transform execution statistics
- `GET /debug/cache/stats` - Cache performance metrics
- `POST /debug/cache/clear` - Clear cache
- `GET /debug/search/artifacts` - Advanced artifact search
- `GET /debug/health` - System health check
- `GET /debug/performance` - Performance metrics

## Security Features

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
- **Provider-based architecture** for secure auth extensibility

## User Data Isolation

### Project-Based Data Organization
- **Projects**: Users can access projects they're members of based on role permissions
- **Artifacts & Transforms**: All data scoped to projects, with user role validation
- **WebSocket Connections**: Real-time editing sessions protected by project membership
- **Room Access Control**: Users can only join collaborative editing rooms for their projects

### Database-Level Security
- All content tables use `project_id` with user membership validation
- API endpoints filter all queries by user's project access
- WebSocket connections verify project membership before allowing access
- No cross-project data leakage possible through any endpoint

### Room ID Generation
- Script room IDs include user ID: `script-{user_id}-{timestamp}-{random}`
- Prevents guessing other users' room IDs
- Enables quick ownership verification for WebSocket connections

## Development

### Project Structure
```
src/
├── client/                 # React frontend
│   ├── components/        # React components with streaming UI
│   │   ├── ProjectsList.tsx     # Main project list (renamed from IdeationsList)
│   │   ├── DynamicStreamingUI.tsx # Unified streaming interface
│   │   └── shared/streaming/    # Reusable streaming components
│   ├── contexts/         # React contexts (Auth)
│   ├── hooks/           # Custom hooks including streaming hooks
│   │   ├── useProjectData.ts    # TanStack Query hooks for project data
│   │   └── useLLMStreamingWithStore.ts # Zustand-integrated streaming
│   ├── services/        # RxJS streaming services
│   │   ├── streaming/   # Generic LLM streaming base classes
│   │   └── implementations/ # Specific streaming implementations
│   ├── stores/         # Zustand stores
│   │   └── projectStore.ts    # Global project state management
│   └── types/           # TypeScript types
├── common/               # Shared frontend/backend types
│   ├── streaming/       # Streaming interfaces and types
│   └── llm/            # LLM template types
└── server/               # Express backend
    ├── database/        # Database helpers and migrations
    ├── middleware/      # Express middleware
    ├── routes/         # API routes including streaming endpoints
    │   └── ideations.ts # Project management endpoints (renamed for compatibility)
    ├── services/       # Business logic including streaming executors
    │   ├── ProjectService.ts    # Project CRUD and collaboration
    │   └── streaming/   # Streaming transform executors
    ├── repositories/    # Data access layer
    │   ├── ProjectRepository.ts # Project and user access management
    │   ├── ArtifactRepository.ts # Project-scoped artifact operations
    │   └── TransformRepository.ts # Project-scoped transform operations
    └── index.ts        # Server entry point
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server

## Recent Major Changes

### Project-Based Architecture Migration
The application has been completely restructured from a user-based to a project-based architecture:

#### Database Schema Changes
- **New Tables**: `projects` and `projects_users` for multi-user collaboration
- **Schema Migration**: `artifacts` and `transforms` tables now use `project_id` instead of `user_id`
- **Access Control**: Role-based permissions (owner, editor, member, viewer)
- **Data Relationships**: Proper foreign key constraints and cascade deletes

#### API Restructuring
- **Unified Project Endpoints**: `/api/ideations` now serves project management (backward compatible naming)
- **Removed Legacy System**: Eliminated old `/api/flows` endpoints and `FlowService`
- **Enhanced Security**: All endpoints validate project membership and user roles
- **Streaming Integration**: Project-scoped streaming with proper access control

#### Frontend Updates
- **Component Renaming**: `IdeationsList` → `ProjectsList` with updated interfaces
- **Data Flow**: Updated to use `ProjectSummary` instead of legacy `IdeationRun` types
- **UI Improvements**: Side-by-side project creation modal with better UX
- **Navigation**: Simplified project-centric navigation structure

#### Key Benefits
- **Multi-user Collaboration**: Teams can work together on projects with proper role management
- **Better Organization**: Clear project hierarchy (Project → Episodes → Scripts)
- **Simplified Data Model**: Eliminated complex flows system in favor of straightforward project structure
- **Enhanced Security**: Project-based access control with role validation
- **Future-Ready**: Architecture supports advanced collaboration features

### UI/UX Improvements
- **Streamlined Interface**: Removed confusing "故事灵感" (Story Inspiration) section from brainstorming
- **Dynamic Rendering**: Controls render eagerly as streamed JSON arrives, no predefined display order
- **Responsive Design**: Multi-column layouts adapt to content and screen size
- **Dark Theme Consistency**: Maintained dark theme throughout all components

### Development Philosophy
- **No Backward Compatibility**: Dev environment allows breaking changes for cleaner architecture
- **Immutable Artifacts**: LLM-generated content treated as immutable; user edits create new human artifacts
- **Debounced Auto-save**: All user edits automatically saved with debouncing
- **Zod Validation**: Schema-first approach with versioned artifact validation

## Future Enhancements

### Authentication Extensions
- **WeChat Login** - OAuth integration with WeChat
- **Weibo Login** - OAuth integration with Weibo  
- **SMS Authentication** - Phone number verification
- **Email/Password Login** - Traditional authentication
- **Two-Factor Authentication** - Enhanced security
- **OAuth2 Providers** - Google, GitHub, etc.

### Collaboration Features
- **Advanced Role Management** - Custom permissions and project templates
- **Real-time Notifications** - Project activity feeds and mentions
- **Version Control** - Branching and merging for collaborative writing
- **Comment System** - Inline comments and review workflows

### AI Enhancements
- **Multi-model Support** - Integration with multiple LLM providers
- **Custom Templates** - User-defined prompt templates and workflows
- **Content Analysis** - Advanced analytics and quality scoring
- **Export Formats** - Multiple output formats for scripts and outlines

## Developer Notes

### 🏗️ Modern Frontend Architecture

#### TanStack Query & Zustand Integration
The application uses a **modern state management architecture** that eliminates the inefficiencies of traditional React state patterns:

- **TanStack Query** manages all server state with intelligent caching, background updates, and error handling
- **Zustand** provides lightweight global state for UI state and assembled data
- **Unified Data Flow**: Components read from Zustand store, TanStack Query keeps server data synced
- **Performance Benefits**: Eliminates redundant API calls across components

```typescript
// Example: Project data fetching pattern
export const useProjectData = (projectId: string) => {
  const setOutline = useProjectStore(state => state.setOutline);
  
  // TanStack Query handles server state
  const { data: outlineData, isLoading } = useQuery({
    queryKey: ['projects', projectId, 'outline'],
    queryFn: () => apiService.getOutlineSession(projectId),
    enabled: !!projectId,
  });

  // Sync to Zustand store for global access
  useEffect(() => {
    if (outlineData) setOutline(projectId, outlineData);
  }, [outlineData, projectId, setOutline]);

  return { isLoading };
};

// Components simply select from store
const ProjectLayout = () => {
  const { isLoading } = useProjectData(projectId);
  const outline = useProjectStore(state => state.projects[projectId]?.outline);
  // Clean, declarative rendering
};
```

#### RxJS Streaming System
The application features a **generalized LLM JSON streaming framework** built on RxJS:

- **Generic Base Classes**: `LLMStreamingService<T>` provides reusable streaming logic
- **Partial JSON Parsing**: Real-time parsing with `jsonrepair` and regex fallbacks
- **Progressive UI Updates**: Multi-column responsive display with smooth animations
- **Template System**: Prompt templates with variable interpolation
- **State Management**: RxJS observables with React hooks integration
- **Error Recovery**: Automatic retry logic and graceful degradation
- **Store Integration**: Streaming data automatically synced with Zustand store

#### LLM Content Filtering System
The application includes a **centralized content filtering system** that automatically cleans LLM outputs:

- **Think Tag Removal**: Strips `<think>...</think>` tags (case-insensitive, multiline)
- **Code Block Cleanup**: Removes markdown code block wrappers (`\`\`\`json`, `\`\`\``)
- **Whitespace Normalization**: Trims leading/trailing whitespace
- **Streaming Integration**: Applied to both real-time streams and final outputs
- **Console Think Indicator**: Displays animated spinner when AI is in "thinking mode"

#### Project-Based Data Architecture
The application has evolved to a **project-centric data model**:

- **Multi-user Collaboration**: Projects support multiple users with role-based permissions
- **Complete Traceability**: Every operation tracked through project-scoped transforms
- **Access Control**: All data operations validate project membership and user roles
- **Simplified Navigation**: Clear hierarchy from projects to episodes to scripts

### 🔧 Development Patterns

#### Modern State Management Pattern
```typescript
// 1. Define query hooks with TanStack Query
export const useProjectData = (projectId: string) => {
  const setProject = useProjectStore(state => state.setProject);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => apiService.getProject(projectId),
    enabled: !!projectId,
  });

  // Sync to Zustand store
  useEffect(() => {
    if (data) setProject(projectId, data);
  }, [data, projectId, setProject]);

  return { isLoading, error };
};

// 2. Components select from store
const Component = () => {
  const { isLoading } = useProjectData(projectId);
  const project = useProjectStore(state => state.projects[projectId]);
  
  if (isLoading) return <Spin />;
  return <div>{project?.name}</div>;
};
```

#### Project Service Pattern
```typescript
// Create project with proper user association
const project = await projectService.createProject(userId, {
  name: 'New Script Project',
  description: 'A collaborative writing project',
  project_type: 'script'
});

// Add collaborators with roles
await projectService.addUserToProject(project.id, collaboratorId, 'editor');

// List user's projects with summary info
const projects = await projectService.listUserProjects(userId);
// Returns: { id, name, status, role, artifact_counts, current_phase }
```

#### Streaming Service Pattern
```typescript
// Create project-scoped streaming service
export class BrainstormingStreamingService extends LLMStreamingService<IdeaWithTitle> {
  validate(item: any): item is IdeaWithTitle {
    return typeof item.title === 'string' && typeof item.body === 'string';
  }
  
  parsePartial(content: string): IdeaWithTitle[] {
    // Custom parsing logic with error recovery
    return this.extractValidObjects(content);
  }
}

// Use with store integration and project context
const { status, items, start, stop } = useLLMStreamingWithStore(BrainstormingStreamingService, {
  projectId,
  dataType: 'brainstorm'
});
```

#### Artifact Creation Pattern
```typescript
// Create project-scoped artifacts
const projectArtifact = await artifactRepo.createArtifact(
  projectId,
  'brainstorm_params',
  { platform: 'douyin', genres: ['romance'], requirements: 'modern setting' }
);

// Track transform operations with project context
const { transform, outputArtifacts } = await transformExecutor.executeLLMTransform(
  projectId,
  inputArtifacts,
  prompt,
  variables,
  modelName,
  outputType
);
```

### 🛡️ Security Implementation

#### Project-Based Access Control
```typescript
// Validate project membership before operations
const hasAccess = await projectRepo.userHasProjectAccess(userId, projectId, 'editor');
if (!hasAccess) {
  throw new Error('Insufficient permissions for this project');
}

// Role-based operation validation
const userRole = await projectRepo.getUserProjectRole(userId, projectId);
if (userRole !== 'owner' && operation === 'delete') {
  throw new Error('Only project owners can delete projects');
}
```

#### Enhanced Data Isolation
- **Project-level security**: All operations filtered by project membership
- **Role-based permissions**: Different access levels for different operations
- **Transform-level security**: All operations validate project access
- **Debug endpoint protection**: Analytics data scoped to user's accessible projects

### 🔮 Extension Points

#### Adding New Project Types
```typescript
// 1. Extend project types
type ProjectType = 'script' | 'novel' | 'game_narrative' | 'podcast';

// 2. Add type-specific templates and workflows
const templates = {
  script: 'scriptGeneration',
  novel: 'novelWriting',
  game_narrative: 'gameStoryline'
};

// 3. Update UI to handle new project types
const ProjectTypeSelector = ({ onSelect }) => {
  const types = ['script', 'novel', 'game_narrative'];
  // Render selection UI
};
```

#### Adding New Collaboration Roles
```typescript
// Extend role system
type ProjectRole = 'owner' | 'editor' | 'reviewer' | 'viewer' | 'guest';

// Define role permissions
const rolePermissions = {
  owner: ['read', 'write', 'delete', 'manage_users'],
  editor: ['read', 'write'],
  reviewer: ['read', 'comment'],
  viewer: ['read'],
  guest: ['read_public']
};
```

#### Custom Streaming Services
```typescript
// Add new streaming service for project type
export class NovelStreamingService extends LLMStreamingService<Chapter> {
  // Implement novel-specific parsing and validation
}

// Register with project type
const streamingServices = {
  script: BrainstormingStreamingService,
  novel: NovelStreamingService,
  game_narrative: GameNarrativeStreamingService
};
```

### 📚 Key Dependencies

#### Core Framework Dependencies
- **React 19** with TypeScript for modern frontend development
- **Express.js** with TypeScript for backend API server
- **TanStack Query** for intelligent server state management with caching
- **Zustand** for lightweight global client state management
- **RxJS** for reactive streaming and state management
- **Ant Design** for comprehensive UI component library
- **AI SDK** with DeepSeek integration for LLM streaming

#### Database & Migration Dependencies
- **Knex.js** for database migrations and query building
- **SQLite** for development database
- **UUID** for generating unique identifiers

### ⚠️ Important Notes

1. **Project-Based Architecture**: All data operations now scoped to projects with proper access control
2. **Multi-user Collaboration**: Projects support multiple users with role-based permissions
3. **Backward Compatibility**: API endpoints maintain compatibility while using new project system
4. **No Data Migration**: Development environment allows clean slate approach
5. **Modern State Architecture**: TanStack Query + Zustand eliminates traditional React state management issues
6. **Unified Streaming Architecture**: Database-backed streaming eliminates caching complexities
7. **Enhanced Security**: Project membership validation on all operations
8. **Simplified UI**: Removed confusing elements, streamlined user experience
9. **Future-Ready**: Architecture supports advanced collaboration and multi-project features

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the established patterns:
   - Use project-based data operations with proper access control
   - Follow TanStack Query + Zustand state management patterns
   - Maintain the artifacts/transforms architecture for data operations
   - Ensure proper role-based permissions for new features
4. Test authentication flows and project collaboration
5. Ensure TypeScript types are properly defined
6. Submit a pull request

## License

[Add your license information here]