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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

[Add your license information here]