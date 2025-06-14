# Script Writer

A collaborative script writing application with AI assistance, real-time collaboration, and comprehensive data traceability features.

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
- **Ideation and plot generation** with live streaming and progressive UI updates
- **Chat interface** for AI interactions
- **Genre-based content generation** with multi-column responsive display
- **Transform replay system** for reproducibility testing
- **Partial JSON parsing** with automatic repair and error recovery
- **Streaming progress indicators** with cancellation support
- **Automatic content filtering** - Removes `<think>...</think>` tags and code block wrappers from LLM outputs

### 👥 Collaboration
- **Real-time collaborative editing** using Yjs
- **WebSocket-based synchronization**
- **Multi-user cursor tracking**

### 🎨 User Interface
- **Modern dark theme** with Ant Design components
- **Responsive design** for desktop and mobile
- **Tabbed interface** (Ideation, Chat, Script Editor)
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

The application uses a **generalized artifacts and transforms system** for complete data traceability:

#### Core Artifacts & Transforms Tables
```sql
-- Immutable artifacts store all data entities
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,              -- 'ideation_session', 'brainstorm_params', etc.
  type_version TEXT NOT NULL DEFAULT 'v1',
  data TEXT NOT NULL,              -- JSON data for the artifact
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Transform operations (LLM calls, human actions)
CREATE TABLE transforms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,              -- 'llm' or 'human'
  type_version TEXT NOT NULL DEFAULT 'v1',
  status TEXT DEFAULT 'completed',
  execution_context TEXT,          -- JSON context data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
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
│             │◄────│   Endpoint   │◄────│ (Artifacts/ │
└─────────────┘     └──────────────┘     │ Transforms) │
      ▲                    │              └─────────────┘
      │                    │                     │
      │              ┌─────▼──────┐              │
      └──────────────│   Event    │◄─────────────┘
                     │ Broadcaster │   DB Changes
                     └────────────┘
```

#### Benefits

- **Simplicity**: Single source of truth, no cache invalidation complexity
- **Real-time**: Instant updates via event broadcasting 
- **Consistency**: Same data structure for all streaming states
- **Performance**: Optimized database queries, no redundant cache operations
- **Reliability**: Eliminates race conditions and stale data issues

#### Implementation Details

The `UnifiedStreamingService` provides a single interface for both streaming and completed data:

```typescript
// Returns complete state regardless of streaming status
const ideationData = await unifiedStreamingService.getIdeationRun(userId, sessionId);

// Includes both completed artifacts and real-time streaming chunks
const streamingState = {
  status: transform.status,
  ideas: completedArtifacts,      // From artifacts table
  streamingData: {
    transformId: transform.id,
    chunks: streamingChunks,      // From transform_chunks table
    progress: calculateProgress(chunks)
  }
};
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

### Content Management (All Require Authentication)

#### Ideation Management
- `GET /api/ideations` - List user's ideation runs
- `GET /api/ideations/:id` - Get user's specific ideation run
- `POST /api/ideations/create_run_with_ideas` - Create ideation run with initial ideas
- `POST /api/ideations/create_run_and_generate_plot` - Create and generate plot
- `POST /api/ideations/:id/generate_plot` - Generate plot for existing run
- `POST /api/ideations/:id/generate_plot/stream` - Stream plot generation with real-time updates
- `POST /api/brainstorm/generate/stream` - Stream brainstorming ideas with progressive JSON parsing
- `DELETE /api/ideations/:id` - Delete user's ideation run

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

- **HTTP-only cookies** prevent XSS attacks
- **JWT tokens** with expiration and session tracking
- **CORS configuration** for cross-origin requests
- **Input validation** on all endpoints
- **Session cleanup** for expired tokens
- **Provider-based architecture** for secure auth extensibility

## User Data Isolation

### Complete User Separation
- **Scripts**: Each user can only access their own script documents
- **Ideations**: Each user can only see their own ideation runs and generated content
- **WebSocket Connections**: Real-time editing sessions are protected by user authentication
- **Room Access Control**: Users can only join collaborative editing rooms for their own scripts

### Database-Level Security
- All content tables include `user_id` foreign key constraints
- API endpoints filter all queries by authenticated user ID
- WebSocket connections verify room ownership before allowing access
- No cross-user data leakage possible through any endpoint

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
    ├── database/        # Database helpers
    ├── middleware/      # Express middleware
    ├── routes/         # API routes including streaming endpoints
    ├── services/       # Business logic including streaming executors
    └── index.ts        # Server entry point
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests

## Future Enhancements

The authentication system is designed to be extensible. Planned features include:

- **WeChat Login** - OAuth integration with WeChat
- **Weibo Login** - OAuth integration with Weibo  
- **SMS Authentication** - Phone number verification
- **Email/Password Login** - Traditional authentication
- **Two-Factor Authentication** - Enhanced security
- **Role-based Access Control** - User permissions
- **OAuth2 Providers** - Google, GitHub, etc.

## Developer Notes

### 🏗️ Modern Frontend Architecture

#### TanStack Query & Zustand Integration
The application uses a **modern state management architecture** that eliminates the inefficiencies of traditional React state patterns:

- **TanStack Query** manages all server state with intelligent caching, background updates, and error handling
- **Zustand** provides lightweight global state for UI state and assembled data
- **Unified Data Flow**: Components read from Zustand store, TanStack Query keeps server data synced
- **Performance Benefits**: Eliminates redundant API calls across components like `ProjectLayout` and `ScriptLayout`

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

#### Query Key Strategy
```typescript
export const projectKeys = {
  all: ['projects'] as const,
  detail: (projectId: string) => [...projectKeys.all, projectId] as const,
  outline: (projectId: string) => [...projectKeys.detail(projectId), 'outline'] as const,
  stages: (projectId: string) => [...projectKeys.detail(projectId), 'stages'] as const,
  episodes: (stageId: string) => [...projectKeys.all, 'episodes', stageId] as const,
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

```typescript
// Usage pattern for any LLM JSON streaming with store integration
const { status, items, error, start, stop } = useLLMStreamingWithStore(ServiceClass, {
  projectId,
  dataType: 'outline'
});

// Start streaming with template - data automatically flows to store
await start({
  artifactIds: [],
  templateId: 'brainstorming',
  templateParams: { genre: 'romance', platform: 'tiktok' }
});
```

#### Artifacts & Transforms System
The application has evolved from domain-specific tables to a **generalized artifacts and transforms architecture**:

- **Complete Traceability**: Every data modification tracked through transforms
- **Immutable Artifacts**: All data stored as versioned, immutable entities
- **Transform Chains**: Operations linked to show data flow and lineage
- **API Compatibility**: Existing endpoints maintained while using new system

#### LLM Content Filtering System
The application includes a **centralized content filtering system** that automatically cleans LLM outputs:

```typescript
// Centralized cleaning utilities in src/common/utils/textCleaning.ts
import { cleanLLMContent, removeThinkTags, removeCodeBlockWrappers } from '../../common/utils/textCleaning';

// Automatic filtering applied at multiple levels:
// 1. Server-side streaming (TransformExecutor)
// 2. Client-side streaming services  
// 3. Database storage (UnifiedStreamingService)

// Example usage:
const cleanedContent = cleanLLMContent(rawLLMOutput);
// Removes: <think>reasoning</think>, ```json wrappers, extra whitespace

// Console spinner for think mode indication
const { ConsoleSpinner, processStreamingContent } = await import('../../common/utils/textCleaning');
const spinner = ConsoleSpinner.getInstance();

// During streaming, automatically detect think mode and show spinner
const { isThinking, thinkingStarted, thinkingEnded } = processStreamingContent(
    currentContent, 
    previousContent
);

if (thinkingStarted) {
    spinner.start('AI thinking'); // Shows: ⠋ AI thinking...
} else if (thinkingEnded) {
    spinner.stop(); // Clears spinner line
}
```

**Filtering Features:**
- **Think Tag Removal**: Strips `<think>...</think>` tags (case-insensitive, multiline)
- **Code Block Cleanup**: Removes markdown code block wrappers (`\`\`\`json`, `\`\`\``)
- **Whitespace Normalization**: Trims leading/trailing whitespace
- **Streaming Integration**: Applied to both real-time streams and final outputs
- **Consistent Processing**: Same cleaning logic across all LLM interaction points
- **Console Think Indicator**: Displays animated spinner when AI is in "thinking mode" during streaming

#### Enhanced Analytics & Debugging
```typescript
// Transform replay for testing
const replayResult = await replayService.replayTransform(userId, transformId);

// Workflow analysis
const workflowChain = await replayService.replayWorkflow(userId, artifactId);

// Real-time performance monitoring
const streamingStatus = await unifiedStreamingService.getStreamingState(transformId);
const transformStats = await replayService.getTransformStats(userId);
```

#### Data Export for AI Training
```typescript
// Complete user data export
const userData = await artifactRepo.exportUserData(userId);

// Transform statistics with token usage
const llmStats = await replayService.getTransformStats(userId);
```

### 🔧 Development Patterns

#### Modern State Management Pattern
```typescript
// 1. Define query hooks with TanStack Query
export const useProjectData = (projectId: string) => {
  const setOutline = useProjectStore(state => state.setOutline);
  
  const { data, isLoading, error } = useQuery({
    queryKey: projectKeys.outline(projectId),
    queryFn: () => apiService.getOutlineSession(projectId),
    enabled: !!projectId,
  });

  // Sync to Zustand store
  useEffect(() => {
    if (data) setOutline(projectId, data);
  }, [data, projectId, setOutline]);

  return { isLoading, error };
};

// 2. Components select from store
const Component = () => {
  const { isLoading } = useProjectData(projectId);
  const outline = useProjectStore(state => state.projects[projectId]?.outline);
  
  if (isLoading) return <Spin />;
  return <div>{outline?.title}</div>;
};
```

#### Streaming Service Pattern
```typescript
// Create specialized streaming service
export class BrainstormingStreamingService extends LLMStreamingService<IdeaWithTitle> {
  validate(item: any): item is IdeaWithTitle {
    return typeof item.title === 'string' && typeof item.body === 'string';
  }
  
  parsePartial(content: string): IdeaWithTitle[] {
    // Custom parsing logic with error recovery
    return this.extractValidObjects(content);
  }
}

// Use with store integration
const { status, items, start, stop } = useLLMStreamingWithStore(BrainstormingStreamingService, {
  projectId,
  dataType: 'brainstorm'
});
```

#### Artifact Creation Pattern
```typescript
// Create typed artifacts
const sessionArtifact = await artifactRepo.createArtifact(
  userId,
  'ideation_session',
  { id: sessionId, status: 'active' } as IdeationSessionV1
);

// Track transform operations  
const { transform, outputArtifacts } = await transformExecutor.executeLLMTransform(
  userId,
  inputArtifacts,
  prompt,
  variables,
  modelName,
  outputType
);
```

#### Real-time Data Pattern
```typescript
// Database-backed real-time state management
const ideationData = await unifiedStreamingService.getIdeationRun(userId, sessionId);

// Streaming state management
const streamingState = await unifiedStreamingService.getStreamingState(transformId);
if (streamingState.status === 'running') {
  console.log(`Progress: ${streamingState.progress}%, Chunks: ${streamingState.chunks.length}`);
}

// Add streaming chunks to persistent storage
await unifiedStreamingService.addStreamingChunk(transformId, chunkData);
```

#### Transform Replay Pattern
```typescript
// Test reproducibility
const replayResult = await replayService.replayTransform(userId, transformId);
const similarity = replayResult.differences?.similarity_score || 0;

// Validate system consistency
if (similarity < 0.8) {
  console.warn('Transform replay shows significant differences');
}
```

### 🛡️ Security Implementation

#### Enhanced Data Isolation
- **Transform-level security**: All operations filtered by user ID
- **Artifact lineage protection**: Users can only access their own data chains
- **Debug endpoint protection**: Analytics data scoped to authenticated user

#### Performance Security
```typescript
// Rate limiting for expensive operations
const rateLimiter = new Map<string, number>();
const userKey = `user:${userId}:replay`;
const lastCall = rateLimiter.get(userKey) || 0;

if (Date.now() - lastCall < 5000) { // 5 second cooldown
  throw new Error('Rate limit exceeded for replay operations');
}
```

### 🔮 Extension Points

#### Adding New State to the Store
```typescript
// 1. Extend the Zustand store
interface ProjectStoreState {
  // ... existing state
  newFeature: Record<string, NewFeatureData>;
  setNewFeature: (projectId: string, data: NewFeatureData) => void;
}

// 2. Create TanStack Query hook
export const useNewFeatureData = (projectId: string) => {
  const setNewFeature = useProjectStore(state => state.setNewFeature);
  
  const { data, isLoading } = useQuery({
    queryKey: ['projects', projectId, 'newFeature'],
    queryFn: () => apiService.getNewFeature(projectId),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (data) setNewFeature(projectId, data);
  }, [data, projectId, setNewFeature]);

  return { isLoading };
};

// 3. Use in components
const Component = () => {
  const { isLoading } = useNewFeatureData(projectId);
  const newFeature = useProjectStore(state => state.projects[projectId]?.newFeature);
  // ...
};
```

#### Adding New Streaming Services
1. **Extend base class** with type-specific validation and parsing
2. **Create custom hook** with service configuration  
3. **Add template** to backend template system
4. **Update component** to use streaming hook with store integration

```typescript
// Example: Custom streaming service
export class OutlineStreamingService extends LLMStreamingService<OutlineItem> {
  // Implement abstract methods for outline-specific parsing
}

// Create hook with store integration
export function useStreamingOutline(projectId: string) {
  return useLLMStreamingWithStore(OutlineStreamingService, { 
    projectId,
    dataType: 'outline'
  });
}
```

#### Adding New Artifact Types
1. **Define TypeScript interface** with version suffix (e.g., `NewTypeV1`)
2. **Add to artifact type union** in `src/server/types/artifacts.ts`
3. **Create transform logic** in appropriate service
4. **Update validation** if needed

#### Custom Transform Types
```typescript
// Example: Adding a new transform type
await transformExecutor.executeCustomTransform(
  userId,
  inputArtifacts,
  'external_api',
  outputArtifacts,
  {
    api_endpoint: 'https://api.example.com',
    parameters: { model: 'custom-v1' }
  }
);
```

#### Analytics Extensions
```typescript
// Custom metrics collection
const customMetrics = {
  user_engagement: await calculateEngagementScore(userId),
  content_quality: await analyzeContentQuality(artifacts),
  system_performance: await getPerformanceMetrics()
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

#### State Management Dependencies
- **@tanstack/react-query** ^5.80.6 - Server state management with caching
- **@tanstack/react-query-devtools** ^5.80.6 - Development tools for debugging queries
- **zustand** ^5.0.5 - Minimal, fast, and scalable state management

#### Streaming & Real-time Dependencies
- **jsonrepair** for robust JSON parsing and error recovery
- **WebSocket** via Yjs for collaborative editing
- **Server-Sent Events** for LLM response streaming
- **Custom RxJS operators** for partial JSON parsing and debouncing

### ⚠️ Important Notes

1. **Modern State Architecture**: TanStack Query + Zustand eliminates traditional React state management issues
2. **Single Source of Truth**: Zustand store provides consistent state across all components
3. **Intelligent Caching**: TanStack Query handles background updates, cache invalidation, and optimistic updates
4. **Streaming Integration**: All streaming services automatically sync with the global store
5. **Performance Optimized**: Eliminates redundant API calls through intelligent query caching
6. **Developer Experience**: React Query Devtools and simple Zustand patterns improve debugging
7. **Scalable Patterns**: Easy to extend with new data types and streaming services
8. **Unified Streaming Architecture**: Database-backed streaming eliminates caching complexities and race conditions
9. **Database Evolution**: Complete migration from caching layer to persistent streaming chunks
10. **API Compatibility**: All existing endpoints maintained while using new unified streaming backend
11. **Transform Replay**: Available for all LLM transforms for reproducibility and debugging
12. **Data Export**: Complete user data available for AI training purposes
13. **Real-time Performance**: Built-in metrics and streaming state monitoring
14. **Debug Tools**: Comprehensive debugging endpoints for development and analytics
15. **Memory Management**: Efficient streaming with automatic cleanup and garbage collection
16. **Streaming Architecture**: RxJS-based services provide consistent streaming patterns across all LLM features
17. **JSON Parsing**: Robust error recovery with multiple parsing strategies and `jsonrepair` integration
18. **UI Animations**: Smooth transitions with proper cleanup to prevent memory leaks and infinite loops

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the established patterns:
   - Use TanStack Query for new server state requirements
   - Add new client state to the Zustand store
   - Follow the streaming service patterns for LLM integrations
   - Maintain the artifacts/transforms architecture for data operations
4. Add tests for new authentication providers or script elements
5. Ensure TypeScript types are properly defined
6. Test authentication flows and real-time collaboration
7. Submit a pull request

## License

[Add your license information here]