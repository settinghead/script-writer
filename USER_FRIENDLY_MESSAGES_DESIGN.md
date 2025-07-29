# User-Friendly Messages System Design

## Overview

This document outlines the design for implementing a user-friendly messages system that works alongside the conversation refactor documented in [LLM_CONVERSATION_REFACTOR_PLAN.md](./LLM_CONVERSATION_REFACTOR_PLAN.md). The system maintains two parallel message streams:
1. **Raw messages** (`conversation_messages`) - Complete technical details for backend/debugging
2. **Display messages** (`conversation_messages_display`) - Fun, vague, user-friendly messages for frontend

## Design Goals

1. **IP Protection**: Hide internal agent/tool workings from frontend
2. **User Experience**: Provide engaging, non-technical progress updates
3. **Real-time Sync**: Mirror raw messages with display messages in real-time
4. **Multi-device Support**: Persist current conversation per project across devices
5. **Transactional Integrity**: Display messages always created/updated with raw messages

## Architecture

### Database Schema

```sql
-- User-friendly display messages table
CREATE TABLE conversation_messages_display (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    raw_message_id UUID NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')), -- Simplified roles
    content TEXT NOT NULL, -- User-friendly, vague content
    display_type TEXT DEFAULT 'message' CHECK (display_type IN ('message', 'thinking', 'progress')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(raw_message_id) -- One display message per raw message
);

-- Current conversation tracking per project
CREATE TABLE project_current_conversations (
    project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Remove status from conversations table
ALTER TABLE conversations DROP COLUMN IF EXISTS status;

-- Indexes for performance
CREATE INDEX idx_display_messages_conversation_id ON conversation_messages_display(conversation_id);
CREATE INDEX idx_display_messages_created_at ON conversation_messages_display(created_at);
```

### Message Mapping Strategy

Raw Message Type → Display Message:
- **User messages** → Direct copy (users see what they typed)
- **System messages** → Hidden (not shown to users)
- **Assistant messages** → Fun, contextual responses
- **Tool calls** → Progress indicators with creative messages:
  - `brainstorm_generation` → "✨ 创意火花四溅中..."
  - `outline_generation` → "📝 精心编织故事大纲..."
  - `chronicles_generation` → "⏰ 梳理时间线索..."
  - `episode_planning` → "🎬 规划精彩剧集..."
  - Generic tool → "🔧 努力工作中..."

### Frontend Architecture

```typescript
// Updated ChatContext to use display messages with conversation filtering
interface ChatContextType {
    currentConversationId: string | null;
    messages: ChatMessageDisplay[];
    isLoading: boolean;
    error: any;
    sendMessage: (content: string, conversationId: string) => void;
    createNewConversation: () => Promise<string>;
    setCurrentConversation: (conversationId: string) => void;
}

// Electric SQL subscription with conversation filtering
const chatMessagesConfig = {
    table: 'conversation_messages_display',
    where: `conversation_id = '${currentConversationId}'`
};
```

### Backend Message Creation Flow

```typescript
// Transactional message creation
async function createMessageWithDisplay(
    conversationId: string,
    role: MessageRole,
    content: string,
    options: MessageOptions
): Promise<{ rawMessageId: string; displayMessageId: string }> {
    return await db.transaction().execute(async (trx) => {
        // 1. Create raw message
        const rawMessage = await trx.insertInto('conversation_messages')...
        
        // 2. Create display message
        const displayContent = generateUserFriendlyContent(role, content, options);
        const displayMessage = await trx.insertInto('conversation_messages_display')...
        
        return { rawMessageId, displayMessageId };
    });
}
```

## Implementation Plan

### Phase 1: Database Setup ✅
- [ ] Create migration for `conversation_messages_display` table
- [ ] Create migration for `project_current_conversations` table
- [ ] Remove status column from conversations table
- [ ] Add indexes for performance
- [ ] Run migration: `./run-ts src/server/scripts/migrate.ts`

### Phase 2: Backend Implementation ✅
- [ ] Create `UserFriendlyMessageGenerator` service
  - [ ] Message mapping logic
  - [ ] Creative progress messages
  - [ ] Tool name obfuscation
- [ ] Update `ConversationManager` 
  - [ ] Add transactional `createMessageWithDisplay`
  - [ ] Add `updateMessageWithDisplay` for streaming
  - [ ] Add current conversation management functions
- [ ] Update `StreamingWrappers`
  - [ ] Create display messages alongside raw messages
  - [ ] Update display messages during streaming
- [ ] Update `ChatService`
  - [ ] Add conversation ID parameter to `sendUserMessage`
  - [ ] Manage current conversation per project

### Phase 3: Frontend Updates ✅
- [ ] Update `ChatContext.tsx`
  - [ ] Add current conversation state management
  - [ ] Update Electric SQL subscription with conversation filter
  - [ ] Add `createNewConversation` function
  - [ ] Require conversation ID in `sendMessage`
- [ ] Update `apiService.ts`
  - [ ] Add conversation ID parameter to `sendChatMessage`
  - [ ] Add `getCurrentConversation` endpoint
  - [ ] Add `createNewConversation` endpoint
- [ ] Update `AssistantChatSidebar.tsx`
  - [ ] Use current conversation from context
  - [ ] Update "New Conversation" to create and switch

### Phase 4: Message Generation ✅
- [ ] Implement creative message templates
- [ ] Add progress indicators for different tool types
- [ ] Implement Chinese-friendly messages
- [ ] Test message generation for all scenarios

### Phase 5: Testing & Validation ✅
- [ ] Write tests for transactional message creation
- [ ] Test conversation switching
- [ ] Test multi-device sync
- [ ] Test Electric SQL filtering
- [ ] Run full test suite: `npm test -- --run`
- [ ] Verify build: `npm run build`

## Message Examples

### Tool Call Progress Messages
```javascript
const TOOL_MESSAGES = {
    'brainstorm_generation': [
        "✨ 创意火花四溅中...",
        "🎨 灵感正在酝酿...",
        "💡 捕捉精彩创意..."
    ],
    'outline_generation': [
        "📝 精心编织故事大纲...",
        "🏗️ 构建剧情框架...",
        "📖 雕琢故事细节..."
    ],
    'chronicles_generation': [
        "⏰ 梳理时间线索...",
        "📅 编排剧情节奏...",
        "🗓️ 整理故事脉络..."
    ],
    'episode_planning': [
        "🎬 规划精彩剧集...",
        "📺 设计分集结构...",
        "🎭 安排剧情高潮..."
    ]
};
```

### Streaming Updates
- Start: "🤔 思考中..."
- Progress: "✍️ 创作中..." 
- Complete: Full response text
- Error: "😅 哎呀，出了点小问题，再试一次吧！"

## API Changes

### Updated sendChatMessage
```typescript
// Before
async sendChatMessage(projectId: string, content: string, metadata?: any): Promise<any>

// After
async sendChatMessage(
    projectId: string, 
    conversationId: string, // Now required
    content: string, 
    metadata?: any
): Promise<any>
```

### New Conversation Management APIs
```typescript
// Get current conversation for project
GET /api/projects/:projectId/current-conversation

// Set current conversation for project
PUT /api/projects/:projectId/current-conversation
Body: { conversationId: string }

// Create new conversation and set as current
POST /api/projects/:projectId/conversations/new
```

## Migration Strategy

1. **Deploy database migrations** first
2. **Update backend** to create display messages (backward compatible)
3. **Update frontend** to use new conversation system
4. **Verify Electric SQL** sync is working
5. **Monitor** for any issues

## Success Criteria

1. ✅ All raw messages have corresponding display messages
2. ✅ Frontend shows only user-friendly messages
3. ✅ Current conversation persists across devices
4. ✅ Real-time updates work via Electric SQL
5. ✅ No technical details exposed in frontend
6. ✅ `npm run build` passes
7. ✅ `npm test -- --run` passes

## Notes

- Display messages are ALWAYS created in the same transaction as raw messages
- Tool names and technical details are never exposed in display messages
- Current conversation is project-scoped, not user-scoped (all users see same conversation)
- Future enhancement: conversation history UI can list all conversations
- Message creativity can be enhanced over time without breaking compatibility