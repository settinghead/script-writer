# Authentication System Implementation Plan

## Overview
Implement a complete JWT-based authentication system with extensible provider architecture for the script-writer application.

## Database Schema

### 1. Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,           -- UUID
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active'   -- active, inactive, suspended
);
```

### 2. Auth Providers Table
```sql
CREATE TABLE auth_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  provider_type TEXT NOT NULL,    -- 'dropdown', 'wechat', 'weibo', 'sms', etc.
  provider_user_id TEXT,          -- external user ID for the provider
  provider_data JSON,             -- flexible JSON field for provider-specific data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id),
  UNIQUE(provider_type, provider_user_id)
);
```

### 3. Sessions Table (Optional - for JWT blacklisting)
```sql
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,            -- JWT token ID (jti claim)
  user_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
);
```

## Backend Implementation

### 1. JWT Authentication Middleware
- Create `src/server/middleware/auth.ts`
- Validate JWT tokens from HTTP-only cookies
- Extract user info and attach to request object
- Handle token expiration and invalid tokens

### 2. Authentication Routes
- `POST /auth/login` - Handle login for different providers
- `POST /auth/logout` - Invalidate JWT token
- `GET /auth/me` - Get current user info
- `GET /auth/test-users` - Get list of test users for dropdown

### 3. Database Helpers
- Create `src/server/database/auth.ts`
- User CRUD operations
- Provider management
- Session management

### 4. JWT Configuration
- Add `jsonwebtoken` dependency
- Configure JWT secret from environment variables
- Set appropriate expiration times (7 days default)

## Frontend Implementation

### 1. Authentication Context
- Create `src/client/contexts/AuthContext.tsx`
- Manage authentication state globally
- Provide login, logout, and user info functions
- Handle token refresh logic

### 2. Authentication Hooks
- Create `src/client/hooks/useAuth.ts`
- Convenient hook to access auth context
- Handle authentication status checks

### 3. Login Page
- Create `src/client/components/LoginPage.tsx`
- Simple dropdown with test users (xiyang, xiaolin, giselle)
- Handle login submission
- Redirect after successful login

### 4. Protected Route Component
- Create `src/client/components/ProtectedRoute.tsx`
- Wrap main application routes
- Redirect to login if not authenticated

### 5. User Dropdown in Header
- Update `src/client/App.tsx`
- Add user icon dropdown in header
- Show user info and logout option when logged in
- Show login button when not logged in

### 6. HTTP Client Updates
- Update API calls to include authentication
- Handle 401 responses and redirect to login
- Add request interceptors for automatic token handling

## Test Users Setup

Create three test users in database initialization:
1. **xiyang** - id: `test-user-xiyang`
2. **xiaolin** - id: `test-user-xiaolin` 
3. **giselle** - id: `test-user-giselle`

Each with provider_type: 'dropdown'

## Security Considerations

### 1. JWT Configuration
- Use strong secret key (256-bit minimum)
- Set reasonable expiration times
- Include necessary claims (sub, iat, exp, jti)

### 2. Cookie Security
- HTTP-only cookies for production
- Secure flag for HTTPS environments
- SameSite configuration
- Proper domain settings

### 3. CORS Configuration
- Configure CORS for localhost development
- Proper credentials handling

## Development Workflow

### Phase 1: Backend Foundation
1. Add JWT dependencies
2. Create database schema and migrations
3. Implement authentication middleware
4. Create authentication routes
5. Protect `/llm-api/*` endpoints

### Phase 2: Frontend Foundation
1. Create authentication context and hooks
2. Implement login page
3. Create protected route wrapper
4. Update main app routing

### Phase 3: UI Integration
1. Update header with user dropdown
2. Handle authentication state in existing components
3. Add logout functionality
4. Error handling and user feedback

### Phase 4: Testing & Polish
1. Test authentication flow
2. Handle edge cases (expired tokens, network errors)
3. Add loading states
4. Improve user experience

## Future Extensibility

The provider-based architecture allows easy addition of:
- **WeChat Login**: Add wechat provider with openid/unionid
- **Weibo Login**: Add weibo provider with uid
- **SMS Login**: Add sms provider with phone number
- **Password Login**: Add password provider with hashed passwords
- **OAuth Providers**: Add oauth providers with external tokens

## Environment Variables

Add to `.env`:
```
JWT_SECRET=your-super-secret-jwt-key-256-bits-minimum
JWT_EXPIRES_IN=7d
COOKIE_DOMAIN=localhost
```

## Dependencies to Add

Backend:
- `jsonwebtoken` and `@types/jsonwebtoken`
- `cookie-parser` and `@types/cookie-parser`

Frontend:
- No additional dependencies needed (using existing React context)

## Error Handling

### Backend
- Standardized error responses for auth failures
- Proper HTTP status codes (401, 403, 422)
- Rate limiting for login attempts

### Frontend  
- User-friendly error messages
- Automatic retry for network errors
- Graceful handling of authentication failures

This plan ensures a robust, secure, and extensible authentication system that meets all the specified requirements while maintaining code quality and user experience. 