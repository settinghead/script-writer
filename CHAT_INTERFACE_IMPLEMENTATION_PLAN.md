# Chat Interface Implementation Plan

## Overview

This plan outlines the implementation of a user-AI chat interface for the script-writer application, similar to ChatGPT + Canvas. The system will integrate with the existing agent framework, provide real-time chat history, and maintain security by separating raw messages from user-facing display messages.

## Architecture Analysis

### Current State
- **Agent Framework**: `AgentService.ts` and `StreamingAgentFramework.ts` already handle tool calls and streaming
- **Electric SQL**: Real-time sync with authenticated proxy pattern in `electricProxy.ts`
- **Project-based Access**: All data scoped by `project_id` via `projects_users` table
- **Database**: PostgreSQL with Kysely migrations, following established patterns
- **Frontend**: React with TanStack Query + Zustand, `ProjectDataContext.tsx` for unified data management

### Requirements Analysis
1. **Replace existing sidebar** with chat interface
2. **Agent-driven**: All messages go through agent framework for tool decision-making
3. **Two-layer message system**: Raw messages (backend) + sanitized display messages (frontend)
4. **Single-user chat**: One conversation history per project
5. **Security**: No trade secrets or detailed tool parameters exposed to frontend
6. **Real-time sync**: Electric SQL integration for live updates

## Implementation Plan

### Phase 1: Database Schema & Types (Day 1)

#### 1.1 Create Chat Messages Tables
Create migration `20241201_005_add_chat_messages.ts`:

```sql
-- Raw messages table (backend only, not exposed via Electric)
CREATE TABLE chat_messages_raw (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  content TEXT NOT NULL,
  tool_name TEXT, -- For tool messages
  tool_parameters JSONB, -- Raw tool parameters (sensitive)
  tool_result JSONB, -- Raw tool results (sensitive)
  metadata JSONB, -- Additional context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Display messages table (Electric SQL synced, user-facing)
CREATE TABLE chat_messages_display (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  display_type TEXT DEFAULT 'message' CHECK (display_type IN ('message', 'tool_summary', 'thinking')),
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'streaming', 'completed', 'failed')),
  raw_message_id TEXT REFERENCES chat_messages_raw(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 1.2 Update Electric Proxy
Add `chat_messages_display` to allowed tables in `electricProxy.ts`:
```typescript
case 'chat_messages_display':
    finalWhereClause = existingWhere
        ? `(${existingWhere}) AND (${userScopedWhere})`
        : userScopedWhere;
    break;
```

#### 1.3 Create Zod Schemas
Add to `src/common/schemas/`:

```typescript
// src/common/schemas/chatMessages.ts
export const ChatMessageRawSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  role: z.enum(['user', 'assistant', 'tool', 'system']),
  content: z.string(),
  tool_name: z.string().optional(),
  tool_parameters: z.record(z.any()).optional(),
  tool_result: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.string()
});

export const ChatMessageDisplaySchema = z.object({
  id: z.string(),
  project_id: z.string(),
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string(),
  display_type: z.enum(['message', 'tool_summary', 'thinking']),
  status: z.enum(['pending', 'streaming', 'completed', 'failed']),
  raw_message_id: z.string().optional(),
  created_at: z.string()
});
```

#### 1.4 Update Database Types
Run `npm run db:generate-types` to update Kysely types.

### Phase 2: Backend Repository & Service Layer (Day 2)

#### 2.1 Create ChatMessageRepository
```typescript
// src/server/repositories/ChatMessageRepository.ts
export class ChatMessageRepository {
  // Raw messages (internal use only)
  async createRawMessage(projectId: string, role: string, content: string, ...): Promise<ChatMessageRaw>
  async getRawMessages(projectId: string): Promise<ChatMessageRaw[]>
  
  // Display messages (Electric SQL synced)
  async createDisplayMessage(projectId: string, role: string, content: string, ...): Promise<ChatMessageDisplay>
  async updateDisplayMessage(id: string, updates: Partial<ChatMessageDisplay>): Promise<void>
  async getDisplayMessages(projectId: string): Promise<ChatMessageDisplay[]>
  
  // Message sanitization
  async sanitizeAndCreateDisplayMessage(rawMessage: ChatMessageRaw): Promise<ChatMessageDisplay>
}
```

#### 2.2 Create ChatService
```typescript
// src/server/services/ChatService.ts
export class ChatService {
  constructor(
    private chatRepo: ChatMessageRepository,
    private agentService: AgentService,
    private transformRepo: TransformRepository,
    private artifactRepo: ArtifactRepository
  ) {}

  async sendUserMessage(projectId: string, userId: string, content: string): Promise<void> {
    // 1. Create raw user message
    // 2. Create display user message  
    // 3. Trigger agent processing
    // 4. Handle streaming responses
    // 5. Create sanitized display messages for agent responses
  }

  private async processAgentResponse(agentResult: any, projectId: string): Promise<void> {
    // Convert agent responses to sanitized display messages
    // Handle tool calls with vague, user-friendly descriptions
  }
}
```

#### 2.3 Update AgentService Integration
Modify `AgentService.ts` to create chat messages:
```typescript
// In runBrainstormAgent method
async runBrainstormAgent(projectId: string, userId: string, request: AgentBrainstormRequest) {
  // Create system message for agent start
  await this.chatRepo.createRawMessage(projectId, 'system', 'Agent processing request', {...});
  
  // ... existing logic ...
  
  // Create display messages for user-facing updates
  await this.chatRepo.createDisplayMessage(projectId, 'assistant', 'I\'m working on generating some creative ideas for you...', 'thinking');
}
```

### Phase 3: API Routes & Integration (Day 3)

#### 3.1 Create Chat Routes
```typescript
// src/server/routes/chatRoutes.ts
export function createChatRoutes(
  authMiddleware: any,
  chatService: ChatService
) {
  const router = express.Router();

  // Send user message (triggers agent processing)
  router.post('/:projectId/messages', authMiddleware.authenticate, async (req, res) => {
    const { content } = req.body;
    const user = authMiddleware.getCurrentUser(req);
    await chatService.sendUserMessage(req.params.projectId, user.id, content);
    res.json({ success: true });
  });

  // Get chat history (display messages only)
  router.get('/:projectId/messages', authMiddleware.authenticate, async (req, res) => {
    // This will be handled by Electric SQL on frontend
    res.json({ message: 'Use Electric SQL subscription for real-time messages' });
  });

  return router;
}
```

#### 3.2 Update Server Index
Add chat routes to `src/server/index.ts`:
```typescript
import { createChatRoutes } from './routes/chatRoutes';

// ... existing code ...
app.use('/api/chat', createChatRoutes(authMiddleware, chatService));
```

### Phase 4: Frontend Chat Components (Day 4)

#### 4.1 Create Chat Message Components
```typescript
// src/client/components/chat/ChatMessage.tsx
interface ChatMessageProps {
  message: ChatMessageDisplay;
  isStreaming?: boolean;
}

// src/client/components/chat/ChatMessageList.tsx
// Renders list of messages with auto-scroll

// src/client/components/chat/ChatInput.tsx
// Input field with send button and loading states
```

#### 4.2 Create Main Chat Sidebar with Resizable Support
```typescript
// src/client/components/chat/ChatSidebar.tsx
import React, { useState, useEffect } from 'react';
import { ResizableBox } from 'react-resizable';
import 'react-resizable/css/styles.css';

export const ChatSidebar: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { messages, sendMessage, isLoading } = useChatMessages(projectId);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobile) {
    // Mobile: Fixed width sidebar
    return (
      <div className="chat-sidebar-mobile">
        <div className="chat-header">
          <h3>AI Assistant</h3>
        </div>
        <ChatMessageList messages={messages} />
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    );
  }

  // Desktop: Resizable sidebar
  return (
    <ResizableBox
      width={350}
      height={Infinity}
      minConstraints={[250, Infinity]}
      maxConstraints={[600, Infinity]}
      resizeHandles={['e']}
      className="chat-sidebar-resizable"
      axis="x"
      handle={
        <div 
          className="chat-resize-handle" 
          style={{
            width: '5px',
            height: '100%',
            background: '#404040',
            cursor: 'col-resize',
            position: 'absolute',
            right: 0,
            top: 0,
            zIndex: 1
          }} 
        />
      }
    >
      <div className="chat-sidebar">
        <div className="chat-header">
          <h3>AI Assistant</h3>
        </div>
        <ChatMessageList messages={messages} />
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </ResizableBox>
  );
};
```

#### 4.3 Create Chat Hooks
```typescript
// src/client/hooks/useChatMessages.ts
export const useChatMessages = (projectId: string) => {
  // Electric SQL subscription to chat_messages_display
  // Mutation for sending messages
  // Real-time message streaming
};
```

### Phase 5: ProjectDataContext Integration (Day 5)

#### 5.1 Add Chat Messages to ProjectDataContext
Update `src/client/contexts/ProjectDataContext.tsx`:
```typescript
// Add Electric SQL subscription for chat_messages_display
const chatMessagesConfig = useMemo(() => ({
  ...electricConfig,
  params: {
    table: 'chat_messages_display',
    where: projectWhereClause,
  },
  // ... error handling
}), [electricConfig, projectWhereClause]);

const { data: chatMessages, isLoading: chatMessagesLoading } = useShape<ElectricChatMessage>(chatMessagesConfig);

// Add to context value
const contextValue: ProjectDataContextType = {
  // ... existing data
  chatMessages: chatMessages || [],
  
  // ... existing selectors
  getChatMessages: () => chatMessages?.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) || [],
  
  // ... existing mutations
  sendChatMessage: sendChatMessageMutation,
};
```

#### 5.2 Create Chat-specific Hooks
```typescript
// src/client/hooks/useChatMessages.ts
export const useChatMessages = (projectId: string) => {
  const { getChatMessages, sendChatMessage } = useProjectData();
  
  return {
    messages: getChatMessages(),
    sendMessage: sendChatMessage.mutate,
    isLoading: sendChatMessage.isPending
  };
};
```

### Phase 6: Replace Sidebar in ProjectLayout (Day 6)

#### 6.1 Update ProjectLayout Component
Replace the existing sidebar in `src/client/components/ProjectLayout.tsx`:
```typescript
import { ChatSidebar } from './chat/ChatSidebar';

const ProjectLayout: React.FC = () => {
  // ... existing code ...

  return (
    <ProjectDataProvider projectId={projectId!}>
      <Layout style={{ height: '100%', overflow: 'hidden' }}>
        {/* Replace Sider with resizable chat sidebar */}
        <ChatSidebar projectId={projectId!} />
        <Content style={{ padding: '24px', overflowY: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </ProjectDataProvider>
  );
};
```

#### 6.2 Add CSS for Resizable Chat Sidebar
Add to `src/client/index.css`:
```css
/* Chat Sidebar Resizable Styles */
.chat-sidebar-resizable {
  height: 100% !important; /* Override react-resizable inline style */
  background: #1f1f1f;
  border-right: 1px solid #404040;
}

.chat-sidebar {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.chat-sidebar-mobile {
  width: 100%;
  background: #1f1f1f;
  border-right: 1px solid #404040;
  display: flex;
  flex-direction: column;
}

.chat-header {
  padding: 16px;
  border-bottom: 1px solid #404040;
  background: #2a2a2a;
  flex-shrink: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.chat-input-container {
  padding: 16px;
  border-top: 1px solid #404040;
  flex-shrink: 0;
}

.chat-resize-handle:hover {
  background: #606060 !important;
}

/* Mobile responsiveness for chat */
@media (max-width: 768px) {
  .chat-sidebar-resizable {
    position: static;
    width: 100% !important;
    height: 300px !important;
    border-right: none;
    border-bottom: 1px solid #404040;
  }
  
  .project-layout-with-chat {
    flex-direction: column;
  }
}

/* Chat message styling */
.chat-message {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 8px;
}

.chat-message.user {
  background: #1890ff;
  color: white;
  margin-left: 20%;
}

.chat-message.assistant {
  background: #262626;
  color: #d9d9d9;
  margin-right: 20%;
}

.chat-message.tool {
  background: #52c41a;
  color: white;
  margin-right: 30%;
  font-style: italic;
}

.chat-message-timestamp {
  font-size: 12px;
  opacity: 0.7;
  margin-top: 4px;
}
```

### Phase 7: Message Sanitization & Security (Day 7)

#### 7.1 Implement Message Sanitization
```typescript
// src/server/services/MessageSanitizer.ts
export class MessageSanitizer {
  static sanitizeToolCall(toolName: string, parameters: any, result: any): string {
    switch (toolName) {
      case 'brainstorm':
        return `I've generated some creative story ideas based on your request.`;
      case 'outline':
        return `I've created a detailed story outline for you.`;
      case 'script':
        return `I've written a script based on your specifications.`;
      default:
        return `I've completed a task to help with your project.`;
    }
  }

  static sanitizeAgentThinking(content: string): string {
    // Remove sensitive information, keep user-friendly progress updates
    return `I'm analyzing your request and determining the best approach...`;
  }
}
```

#### 7.2 Update Electric Proxy Security
Ensure `electricProxy.ts` never exposes `chat_messages_raw` table:
```typescript
case 'chat_messages_raw':
    res.status(403).json({ error: 'Access denied to raw message data' });
    return;
```

### Phase 8: Testing & Polish (Day 8)

#### 8.1 Create Test Scripts
```typescript
// src/server/scripts/test-chat-system.ts
// Test message creation, sanitization, and Electric sync
```

#### 8.2 Integration Testing
- Test agent integration with chat messages
- Test real-time message sync
- Test message sanitization
- Test project-based access control

#### 8.3 UI Polish
- Message animations and transitions
- Loading states and error handling
- Auto-scroll to new messages
- Message timestamps and status indicators

## Success Metrics

1. **Functionality**: Users can send messages and receive agent responses
2. **Security**: No sensitive tool data exposed to frontend
3. **Real-time**: Messages sync instantly via Electric SQL
4. **Performance**: Chat interface loads quickly and responds smoothly
5. **Integration**: Agent framework seamlessly creates chat messages

## Risk Mitigation

### Database Migration Risks
- **Risk**: Migration fails on existing data
- **Mitigation**: Test migration on copy of production data first

### Electric SQL Sync Conflicts
- **Risk**: Message ordering issues or sync conflicts
- **Mitigation**: Use timestamp-based ordering, implement conflict resolution

### Agent Integration Complexity
- **Risk**: Agent responses don't translate well to chat format
- **Mitigation**: Start with simple message types, iterate based on testing

### Performance Concerns
- **Risk**: Large chat histories impact performance
- **Mitigation**: Implement message pagination, cleanup old messages

## Implementation Timeline

- **Day 1**: Database schema, types, and migrations
- **Day 2**: Backend repositories and services
- **Day 3**: API routes and server integration
- **Day 4**: Frontend chat components
- **Day 5**: ProjectDataContext integration
- **Day 6**: Replace sidebar in ProjectLayout
- **Day 7**: Security and message sanitization
- **Day 8**: Testing, polish, and deployment

## Post-Implementation Enhancements

1. **Message Search**: Add search functionality for chat history
2. **Message Reactions**: Allow users to react to agent messages
3. **Export Chat**: Allow users to export chat history
4. **Message Threading**: Group related messages together
5. **Voice Input**: Add voice-to-text for message input
6. **Message Templates**: Quick-send common requests

## Development Commands

```bash
# Database operations
npm run migrate                    # Run new chat migration
npm run db:generate-types         # Update Kysely types

# Testing
./run-ts src/server/scripts/test-chat-system.ts

# Development
npm run dev                       # Start with new chat interface
``` 