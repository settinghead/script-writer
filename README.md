# Script Writer

A collaborative script writing application with AI assistance, real-time collaboration, and comprehensive data traceability features.

## Features

### 🔐 Authentication System
- **JWT-based authentication** with HTTP-only cookies for security
- **Test user login** via dropdown selection (xiyang, xiaolin, giselle)
- **Extensible provider architecture** ready for future integrations:
  - WeChat login
  - Weibo login  
  - SMS login
  - Password-based login
- **Protected API endpoints** - All AI/LLM requests require authentication
- **Session management** with automatic cleanup

### 🤖 AI-Powered Features
- **Script editing assistance** using DeepSeek AI
- **Ideation and plot generation** with full traceability
- **Chat interface** for AI interactions
- **Genre-based content generation**
- **Transform replay system** for reproducibility testing

### 👥 Collaboration
- **Real-time collaborative editing** using Yjs
- **WebSocket-based synchronization**
- **Multi-user cursor tracking**

### 🎨 User Interface
- **Modern dark theme** with Ant Design components
- **Responsive design** for desktop and mobile
- **Tabbed interface** (Ideation, Chat, Script Editor)
- **User dropdown** with profile info and logout

### 📊 Analytics & Debugging
- **Complete data traceability** through artifacts and transforms
- **Transform replay capabilities** for testing and analysis
- **Performance monitoring** with caching and metrics
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
# DeepSeek API Configuration
DEEPSEEK_API_KEY=your-deepseek-api-key-here

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
   - **Giselle** (giselle)
3. Click "登录" to log in
4. You'll be redirected to the main application

## Architecture

### Backend
- **Express.js** server with TypeScript
- **SQLite** database with generalized artifacts/transforms system
- **JWT authentication** with session management
- **DeepSeek AI integration** for content generation
- **Yjs WebSocket server** for real-time collaboration
- **Intelligent caching** for performance optimization

### Frontend  
- **React 19** with TypeScript
- **Ant Design** component library
- **React Router** for navigation
- **Authentication context** for state management
- **Protected routes** requiring login

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

### Content Management (All Require Authentication)

#### Ideation Management
- `GET /api/ideations` - List user's ideation runs
- `GET /api/ideations/:id` - Get user's specific ideation run
- `POST /api/ideations/create_run_with_ideas` - Create ideation run with initial ideas
- `POST /api/ideations/create_run_and_generate_plot` - Create and generate plot
- `POST /api/ideations/:id/generate_plot` - Generate plot for existing run
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
│   ├── components/        # React components
│   ├── contexts/         # React contexts (Auth)
│   ├── hooks/           # Custom hooks
│   └── types/           # TypeScript types
└── server/               # Express backend
    ├── database/        # Database helpers
    ├── middleware/      # Express middleware
    ├── routes/         # API routes
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

### 🏗️ Architecture Overview

#### Artifacts & Transforms System
The application has evolved from domain-specific tables to a **generalized artifacts and transforms architecture**:

- **Complete Traceability**: Every data modification tracked through transforms
- **Immutable Artifacts**: All data stored as versioned, immutable entities
- **Transform Chains**: Operations linked to show data flow and lineage
- **API Compatibility**: Existing endpoints maintained while using new system

#### Enhanced Analytics & Debugging
```typescript
// Transform replay for testing
const replayResult = await replayService.replayTransform(userId, transformId);

// Workflow analysis
const workflowChain = await replayService.replayWorkflow(userId, artifactId);

// Performance monitoring
const stats = await cacheService.getStats();
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

#### Caching Pattern
```typescript
// Intelligent caching with TTL
const cacheKey = CacheService.ideationRunKey(userId, sessionId);
const cached = cacheService.get<IdeationRun>(cacheKey);

if (!cached) {
  const data = await fetchFromDatabase();
  cacheService.set(cacheKey, data, 5 * 60 * 1000); // 5 minutes
  return data;
}
return cached;
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

#### New Dependencies Added
- **Enhanced data management**: Comprehensive artifact/transform repositories
- **Caching system**: In-memory cache with TTL and cleanup
- **Replay system**: Transform reproducibility testing
- **Analytics tools**: Performance monitoring and data export

#### Performance Dependencies
- **sqlite3**: Enhanced with optimized indexes and queries
- **Custom caching**: Memory-efficient with automatic cleanup
- **Transform tracking**: Minimal overhead with detailed logging

### ⚠️ Important Notes

1. **Database Evolution**: Old tables renamed to `legacy_*` for emergency recovery
2. **API Compatibility**: All existing endpoints work unchanged during transition
3. **Caching Strategy**: Intelligent TTL based on data volatility patterns
4. **Transform Replay**: Available for all LLM transforms for reproducibility
5. **Data Export**: Complete user data available for AI training purposes
6. **Performance Monitoring**: Built-in metrics for system health tracking
7. **Debug Tools**: Comprehensive debugging endpoints for development
8. **Memory Management**: Automatic cache cleanup and memory optimization

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the established patterns
4. Add tests for new authentication providers or script elements
5. Ensure TypeScript types are properly defined
6. Test authentication flows and real-time collaboration
7. Submit a pull request

## License

[Add your license information here]