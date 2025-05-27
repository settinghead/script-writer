# Script Writer

A collaborative script writing application with AI assistance and real-time collaboration features.

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
- **Ideation and plot generation** 
- **Chat interface** for AI interactions
- **Genre-based content generation**

### 👥 Collaboration
- **Real-time collaborative editing** using Yjs
- **WebSocket-based synchronization**
- **Multi-user cursor tracking**

### 🎨 User Interface
- **Modern dark theme** with Ant Design components
- **Responsive design** for desktop and mobile
- **Tabbed interface** (Ideation, Chat, Script Editor)
- **User dropdown** with profile info and logout

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
- **SQLite** database for users, sessions, and content
- **JWT authentication** with session management
- **DeepSeek AI integration** for content generation
- **Yjs WebSocket server** for real-time collaboration

### Frontend  
- **React 19** with TypeScript
- **Ant Design** component library
- **React Router** for navigation
- **Authentication context** for state management
- **Protected routes** requiring login

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active'
);
```

#### Auth Providers Table
```sql
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
```

#### Sessions Table
```sql
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
- `POST /api/ideations/create_run_and_generate_plot` - Generate plot ideas
- `POST /api/ideations/:id/generate_plot` - Generate plot for existing run

### Content Management
- `GET /api/ideations` - List ideation runs
- `GET /api/ideations/:id` - Get specific ideation run
- `POST /api/scripts` - Create new script document
- `GET /api/scripts/:id` - Get script document

## Security Features

- **HTTP-only cookies** prevent XSS attacks
- **JWT tokens** with expiration and session tracking
- **CORS configuration** for cross-origin requests
- **Input validation** on all endpoints
- **Session cleanup** for expired tokens
- **Provider-based architecture** for secure auth extensibility

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

#### Authentication System
The application uses a **JWT-based authentication system** with the following key components:

- **HTTP-only cookies** for secure token storage
- **Provider-based architecture** supporting multiple auth methods
- **Session management** with database-tracked tokens
- **Middleware protection** for all AI/LLM endpoints

#### Database Design
```sql
-- Users table with extensible user management
CREATE TABLE users (
  id TEXT PRIMARY KEY,           -- UUID
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active'
);

-- Flexible provider system for multiple auth methods
CREATE TABLE auth_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  provider_type TEXT NOT NULL,    -- 'dropdown', 'wechat', 'weibo', 'sms'
  provider_user_id TEXT,
  provider_data TEXT,             -- JSON for provider-specific data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id),
  UNIQUE(provider_type, provider_user_id)
);

-- Session tracking for JWT tokens
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,            -- JWT token ID (jti claim)
  user_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
);
```

#### Collaborative Script Editor Architecture
The script editor is built using **Slate.js** with **YJS** for real-time collaboration:

- **Slate.js**: Rich text editor with custom script elements
- **YJS**: Conflict-free replicated data types for collaboration
- **WebSocket**: Real-time synchronization between clients
- **Custom Node Types**: Scene headings, character names, dialogue, etc.

### 🔧 Development Patterns

#### Authentication Middleware Pattern
```typescript
// Protect routes with authentication
app.post("/llm-api/chat/completions", authMiddleware.authenticate, handler);

// Optional authentication for public endpoints
app.get("/api/public", authMiddleware.optionalAuth, handler);

// Access user in protected routes
const user = authMiddleware.getCurrentUser(req);
```

#### Provider Extension Pattern
To add new authentication providers:

1. **Create provider handler** in `src/server/routes/auth.ts`
2. **Add provider logic** to login endpoint switch statement
3. **Create provider entry** in `auth_providers` table
4. **Update frontend** login options

Example WeChat provider:
```typescript
case 'wechat':
  // Verify WeChat OAuth token
  const wechatUser = await verifyWeChatToken(data.code);
  user = await authDB.getUserByProvider('wechat', wechatUser.openid);
  if (!user) {
    // Create new user from WeChat data
    user = await createUserFromWeChat(wechatUser);
  }
  break;
```

#### YJS Integration Pattern
```typescript
// Set up collaborative document
const yDoc = new Y.Doc();
const sharedType = yDoc.get('slate', Y.XmlText);

// Connect to WebSocket provider
const provider = new WebsocketProvider(
  `ws://${window.location.host}/yjs`,
  `script-${roomId}`,
  yDoc
);

// Create Slate editor with YJS binding
const editor = withYjs(createEditor(), sharedType);
```

### 🛡️ Security Implementation

#### JWT Token Security
- **HTTP-only cookies** prevent XSS token theft
- **SameSite** and **Secure** flags for CSRF protection
- **Short expiration** (7 days) with session tracking
- **Token blacklisting** via session deletion

#### Input Validation
- All API endpoints validate required parameters
- SQL injection prevention via parameterized queries
- XSS prevention via proper React rendering
- CORS configuration for development/production

#### Environment Security
```env
# Required security variables
JWT_SECRET=256-bit-minimum-secret-key
JWT_EXPIRES_IN=7d
COOKIE_DOMAIN=localhost

# API keys
DEEPSEEK_API_KEY=your-api-key
```

### 🎨 UI/UX Architecture

#### Component Hierarchy
```
App (AuthProvider)
├── LoginPage (full-screen, no layout)
└── AppContent (protected routes with layout)
    ├── Header (user dropdown, navigation)
    ├── TabNavigation (desktop)
    ├── MobileDrawer (mobile)
    └── Routes
        ├── IdeationTab (protected)
        ├── ChatTab (protected)
        └── ScriptTab (protected)
            ├── ChatPanel (30% width)
            └── CollaborativeEditor (70% width)
```

#### Responsive Design
- **Desktop**: Tab navigation, resizable panels
- **Mobile**: Drawer menu, stacked layout
- **Breakpoint**: 768px width threshold

#### Theme Integration
- **Ant Design dark theme** as base
- **Custom color palette** with brand blue (#1890ff)
- **Consistent spacing** using Ant Design tokens

### 🔄 Real-time Collaboration

#### YJS Document Structure
```typescript
// Slate.js nodes stored as YJS structure
interface YjsSlateDoc {
  content: Y.XmlText;           // Main document content
  cursors: Y.Map<CursorData>;   // User cursor positions
  metadata: Y.Map<any>;         // Document metadata
}
```

#### Conflict Resolution
- **Operational Transform**: YJS handles conflicting edits automatically
- **Cursor Synchronization**: Real-time cursor sharing between users
- **Document Persistence**: In-memory storage with planned database backup

#### WebSocket Server
```typescript
// Room-based document management
const documents = new Map<string, Y.Doc>();

// Handle WebSocket upgrade for YJS
httpServer.on('upgrade', (request, socket, head) => {
  if (request.url?.startsWith('/yjs')) {
    const roomId = request.url.slice(5);
    setupWSConnection(ws, req, { docName: roomId });
  }
});
```

### 🤖 AI Integration

#### LLM Request Flow
1. **User request** → Chat panel or script editor
2. **Authentication check** → JWT validation
3. **Context gathering** → Current script content
4. **LLM processing** → DeepSeek API call
5. **Response parsing** → Extract edit operations
6. **YJS application** → Apply edits to collaborative document

#### Edit Operation Format
```typescript
interface EditOperation {
  position: number;    // Character position in document
  insert?: string;     // Text to insert
  delete?: number;     // Number of characters to delete
}

// LLM response format
{
  "edits": [
    { "position": 123, "insert": "New dialogue here" },
    { "position": 456, "delete": 10 }
  ],
  "explanation": "Enhanced character motivation"
}
```

### 📝 Script Editor Features

#### Custom Node Types
```typescript
// Script-specific elements
type ScriptElement = 
  | 'scene-heading'    // INT. COFFEE SHOP - DAY
  | 'character'        // JOHN
  | 'dialogue'         // What are you doing here?
  | 'action'          // John walks to the window
  | 'transition';     // FADE IN:
```

#### Formatting Rules
- **Scene headings**: ALL CAPS, bold
- **Character names**: ALL CAPS, centered
- **Dialogue**: Indented margins
- **Action**: Standard paragraph format

### 🧪 Testing Strategy

#### Authentication Testing
```bash
# Test login flow
curl -X POST -d '{"provider":"dropdown","username":"xiyang"}' \
  -H "Content-Type: application/json" \
  -c cookies.txt http://localhost:4600/auth/login

# Test protected endpoint
curl -b cookies.txt http://localhost:4600/llm-api/chat/completions
```

#### Collaboration Testing
- **Multi-browser testing** for real-time sync
- **Network interruption** handling
- **Concurrent editing** conflict resolution

### 🚀 Deployment Considerations

#### Environment Configuration
```env
# Production settings
NODE_ENV=production
JWT_SECRET=production-secret-256-bits
COOKIE_DOMAIN=yourdomain.com
DEEPSEEK_API_KEY=production-key
```

#### Database Migration
- SQLite for development
- PostgreSQL recommended for production
- Migration scripts for table creation
- Backup strategy for YJS documents

#### WebSocket Scaling
- Consider Redis adapter for multi-server YJS
- Load balancer sticky sessions
- Document persistence strategy

### 🔮 Extension Points

#### Adding New Auth Providers
1. Update `AuthProvider` enum in types
2. Add case to login route handler
3. Implement provider-specific verification
4. Update frontend login UI

#### Custom Script Elements
1. Define new element type in Slate types
2. Add rendering logic in `ScriptElements.tsx`
3. Update editor toolbar with new options
4. Add keyboard shortcuts

#### AI Enhancement
1. Custom LLM prompts for different script types
2. Genre-specific writing assistance
3. Character consistency checking
4. Automated formatting suggestions

### 📚 Key Dependencies

#### Core Frameworks
- **React 19**: Latest React with concurrent features
- **TypeScript**: Full type safety
- **Express.js**: Backend API server
- **Vite**: Fast development build tool

#### Authentication
- **jsonwebtoken**: JWT token management
- **cookie-parser**: HTTP cookie handling
- **bcrypt**: Password hashing (for future providers)

#### Collaboration
- **slate** & **slate-react**: Rich text editor
- **yjs**: CRDT for collaboration
- **y-websocket**: WebSocket transport for YJS
- **ws**: WebSocket server implementation

#### UI/UX
- **antd**: Component library with dark theme
- **react-router-dom**: Client-side routing
- **react-resizable**: Resizable panels

### ⚠️ Important Notes

1. **Database Initialization**: Tables are created automatically on first run
2. **JWT Secret**: Must be 256-bit minimum for production security
3. **WebSocket Ports**: Ensure firewall allows WebSocket connections
4. **Memory Usage**: YJS documents stored in memory - implement persistence
5. **Rate Limiting**: Add rate limiting for production deployment
6. **CORS**: Configure properly for production domain
7. **Error Handling**: All API endpoints include comprehensive error handling
8. **Session Cleanup**: Expired sessions are cleaned up automatically

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