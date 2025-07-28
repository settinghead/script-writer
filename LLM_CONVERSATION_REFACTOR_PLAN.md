# LLM Conversation System Refactoring Plan

## Overview

This document outlines a comprehensive refactoring of the LLM conversation system to support context caching, better conversation management, and improved traceability. The refactoring introduces a conversation-first approach where all LLM interactions must be associated with a conversation context.

## Design Goals

1. **Enable Context Caching**: Leverage Alibaba Cloud's Context Cache feature to reduce costs and improve response times by reusing common conversation prefixes
2. **Conversation-Centric Architecture**: Every LLM interaction must belong to a conversation session
3. **Complete History Tracking**: Store all messages (system, user, assistant, tool) with full parameters for replay and analysis
4. **Immutable History**: Messages are immutable except for the last assistant message during streaming
5. **Transform Association**: Link transforms to specific conversation messages for better lineage tracking
6. **Tool Call Tracking**: Comprehensive tracking of tool calls with parameters and results
7. **UI Enhancement**: Better conversation visualization with filtering and search capabilities
8. **Future-Proof Design**: Support for conversation branching and advanced features

## Design Principles

1. **No Backward Compatibility**: This refactoring removes all legacy code without backward compatibility. Old tables, classes, and patterns will be completely deleted and replaced. No migration layers or deprecated code paths will be maintained.

2. **Functional + Closure + TypeScript Patterns**: The implementation strongly favors functional programming patterns with closures and comprehensive TypeScript typing. No classes should be used - prefer functions, interfaces, and closures for state management and behavior encapsulation.

3. **Continuous Build Integrity**: Every phase must maintain a passing `npm run build`. By completion, all tests must pass with `npm test -- --run`. No broken builds are acceptable during the refactoring process.

## Architecture Design

### Core Concepts

1. **Conversation**: A session containing multiple messages. For tools, each invocation is a new conversation. For agents, the entire session is one conversation.
2. **Message**: An immutable record of communication (system/user/assistant/tool) with full LLM parameters
3. **Tool Call**: A special type of message representing tool invocations with parameters and results
4. **Transform Association**: Links transforms to the conversation and specific message that triggered them

### Database Schema

```sql
-- Drop old tables (no backward compatibility)
DROP TABLE IF EXISTS chat_messages_raw CASCADE;
DROP TABLE IF EXISTS chat_messages_display CASCADE;
DROP TABLE IF EXISTS chat_conversations CASCADE;

-- New conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('agent', 'tool')), -- conversation type
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
    metadata JSONB DEFAULT '{}', -- flexible metadata storage
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- New messages table (replaces chat_messages_raw)
CREATE TABLE conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
    content TEXT NOT NULL,
    
    -- Tool-specific fields
    tool_name TEXT, -- for tool calls
    tool_call_id TEXT, -- from LLM
    tool_parameters JSONB, -- tool input parameters
    tool_result JSONB, -- tool execution result
    
    -- LLM parameters (stored per message for flexibility)
    model_name TEXT,
    temperature NUMERIC,
    top_p NUMERIC,
    max_tokens INTEGER,
    seed INTEGER,
    
    -- Caching support
    content_hash TEXT, -- hash of full conversation up to this point
    cache_hit BOOLEAN DEFAULT FALSE,
    cached_tokens INTEGER DEFAULT 0,
    
    -- Status tracking
    status TEXT DEFAULT 'completed' CHECK (status IN ('streaming', 'completed', 'failed')),
    error_message TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced transforms table (add conversation tracking)
ALTER TABLE transforms 
ADD COLUMN conversation_id UUID REFERENCES conversations(id),
ADD COLUMN trigger_message_id UUID REFERENCES conversation_messages(id);

-- Indexes for performance
CREATE INDEX idx_conversations_project_id ON conversations(project_id);
CREATE INDEX idx_conversations_type ON conversations(type);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);

CREATE INDEX idx_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX idx_messages_role ON conversation_messages(role);
CREATE INDEX idx_messages_tool_name ON conversation_messages(tool_name);
CREATE INDEX idx_messages_content_hash ON conversation_messages(content_hash);
CREATE INDEX idx_messages_created_at ON conversation_messages(created_at);

CREATE INDEX idx_transforms_conversation_id ON transforms(conversation_id);
CREATE INDEX idx_transforms_trigger_message_id ON transforms(trigger_message_id);
```

### Functional API Design

```typescript
// Core conversation management functions (no classes)
type ConversationId = string;
type MessageId = string;

// Create or resume conversation
async function createConversation(
    projectId: string,
    type: 'agent' | 'tool',
    metadata?: Record<string, any>
): Promise<ConversationId>

async function resumeConversation(
    conversationId: ConversationId
): Promise<ConversationContext>

// Conversation context with bound streaming functions
interface ConversationContext {
    conversationId: ConversationId;
    projectId: string;
    
    // Bound streaming functions that automatically track messages
    streamText: (params: StreamTextParams) => Promise<StreamTextResult>;
    streamObject: <T>(params: StreamObjectParams<T>) => Promise<StreamObjectResult<T>>;
    
    // Message management
    addMessage: (message: ConversationMessage) => Promise<MessageId>;
    getMessages: () => Promise<ConversationMessage[]>;
    updateLastMessage: (content: string, status?: MessageStatus) => Promise<void>;
}

// Parameters for streaming functions
interface StreamTextParams {
    messages: Array<{ role: string; content: string }>; // conversation history
    system?: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    seed?: number;
    tools?: Record<string, any>;
}

interface StreamObjectParams<T> {
    messages: Array<{ role: string; content: string }>;
    schema: z.ZodSchema<T>;
    system?: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    seed?: number;
}
```

### Implementation Strategy

The implementation uses closures to bind conversation context to streaming functions:

```typescript
// src/server/conversation/ConversationManager.ts
export async function createConversation(
    projectId: string, 
    type: 'agent' | 'tool',
    metadata?: Record<string, any>
): Promise<ConversationId> {
    const { db } = await import('../database/connection.js');
    
    const result = await db
        .insertInto('conversations')
        .values({
            project_id: projectId,
            type,
            metadata: JSON.stringify(metadata || {}),
            status: 'active'
        })
        .returning('id')
        .executeTakeFirst();
    
    return result!.id;
}

export async function resumeConversation(
    conversationId: ConversationId
): Promise<ConversationContext> {
    const { db } = await import('../database/connection.js');
    
    // Verify conversation exists
    const conversation = await db
        .selectFrom('conversations')
        .selectAll()
        .where('id', '=', conversationId)
        .executeTakeFirst();
    
    if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
    }
    
    // Load existing messages
    const messages = await db
        .selectFrom('conversation_messages')
        .selectAll()
        .where('conversation_id', '=', conversationId)
        .orderBy('created_at', 'asc')
        .execute();
    
    // Create context with bound functions
    return createConversationContext(conversation, messages);
}

function createConversationContext(
    conversation: Conversation,
    existingMessages: ConversationMessage[]
): ConversationContext {
    const { conversationId, projectId } = conversation;
    
    // Bound streamText function
    const streamText = async (params: StreamTextParams) => {
        // Save user/system messages before streaming
        await savePreStreamingMessages(conversationId, params.messages);
        
        // Calculate content hash for caching
        const contentHash = calculateContentHash(existingMessages, params);
        
        // Create wrapper around AI SDK streamText
        const { streamText: aiStreamText } = await import('ai');
        const model = await getLLMModel();
        
        // Create assistant message placeholder
        const assistantMessageId = await createStreamingMessage(
            conversationId, 
            'assistant',
            params
        );
        
        // Stream with automatic message tracking
        const result = await aiStreamText({
            model,
            ...params,
            // Add context caching headers if supported
            experimental_contextCache: {
                contentHash,
                conversationId
            }
        });
        
        // Wrap stream to track content
        return wrapStreamForTracking(result, assistantMessageId, conversationId);
    };
    
    // Similar for streamObject...
    
    return {
        conversationId,
        projectId,
        streamText,
        streamObject,
        addMessage,
        getMessages,
        updateLastMessage
    };
}
```

## Implementation Phases

### Phase 1: Database & Core Infrastructure (Complete Legacy Removal)
- [ ] **DESTRUCTIVE**: Drop all old tables immediately (chat_messages_raw, chat_messages_display, chat_conversations) - NO BACKWARD COMPATIBILITY
- [ ] Create migration for new database schema with conversations and conversation_messages tables
- [ ] Update transforms table with conversation tracking columns
- [ ] Implement functional ConversationManager module (NO CLASSES)
- [ ] Create pure functions for content hash calculation
- [ ] Build functional streaming wrappers using closures for context binding
- [ ] Remove all file-based caching infrastructure
- [ ] **BUILD CHECK**: Ensure `npm run build` passes after each step

### Phase 2: Refactor Existing Code (Functional Rewrite)
- [ ] **COMPLETE REWRITE**: Replace AgentService class with functional conversation-aware streaming
- [ ] **COMPLETE REWRITE**: Replace ChatService class with functional conversation creators
- [ ] **COMPLETE REWRITE**: Update all tool implementations to use functional conversation paradigm
- [ ] Modify StreamingTransformExecutor to use functional conversation tracking
- [ ] Update transform creation functions to link with conversations
- [ ] **DELETE**: Remove ChatMessageRepository class entirely - no replacement needed
- [ ] **BUILD CHECK**: Ensure `npm run build` passes after each major rewrite

### Phase 3: UI Updates
- [ ] Update AssistantChatSidebar - replace "clear" with "new conversation"
- [ ] Rewrite RawChatMessages component with conversation dropdown
- [ ] Add message type filters (human/assistant/tool)
- [ ] Display conversation metadata
- [ ] Show cache hit indicators
- [ ] Add conversation status indicators
- [ ] **BUILD CHECK**: Ensure `npm run build` passes after UI changes

### Phase 4: Context Caching Integration
- [ ] Implement content hash calculation algorithm
- [ ] Add cache hit detection and tracking
- [ ] Update streaming wrappers to detect cached tokens
- [ ] Add metrics for cache effectiveness
- [ ] Test with Alibaba Cloud Context Cache
- [ ] **BUILD CHECK**: Ensure `npm run build` passes with caching integration

### Phase 5: Testing & Migration
- [ ] Write comprehensive tests for conversation management
- [ ] Test streaming with conversation context
- [ ] Verify transform associations
- [ ] Test conversation reconstruction
- [ ] Performance testing with caching
- [ ] **BUILD CHECK**: Ensure `npm run build` passes
- [ ] **TEST CHECK**: Ensure `npm test -- --run` passes completely

## Key Files to Modify

### New Files
- `src/server/conversation/ConversationManager.ts` - Core conversation logic
- `src/server/conversation/StreamingWrappers.ts` - Wrapped streaming functions
- `src/server/conversation/ContentHasher.ts` - Hash calculation for caching
- `src/server/database/migrations/[timestamp]_conversation_refactor.ts` - Migration

### Modified Files
- `src/server/transform-jsondoc-framework/AgentService.ts` - Use conversation-aware streaming
- `src/server/transform-jsondoc-framework/ChatService.ts` - Create conversations
- `src/server/transform-jsondoc-framework/StreamingTransformExecutor.ts` - Track conversations
- `src/server/tools/*.ts` - All tools updated for new paradigm
- `src/client/components/chat/AssistantChatSidebar.tsx` - New conversation button
- `src/client/components/RawChatMessages.tsx` - Complete rewrite
- `src/server/routes/chatRoutes.ts` - New conversation endpoints

### Deleted Files (Complete Legacy Removal)
- `src/server/transform-jsondoc-framework/ChatMessageRepository.ts` - Replaced by functional conversation management
- `src/server/transform-jsondoc-framework/CachedLLMService.ts` - Replaced by DB-based caching functions
- `src/server/transform-jsondoc-framework/StreamCache.ts` - File-based caching completely removed
- All existing database tables: `chat_messages_raw`, `chat_messages_display`, `chat_conversations` - No migration, dropped entirely

## Example Usage

```typescript
// Agent-level conversation (one conversation for entire session)
const conversationId = await createConversation(projectId, 'agent');
const context = await resumeConversation(conversationId);

// Use bound streaming functions
const result = await context.streamText({
    messages: [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: userRequest }
    ],
    temperature: 0.7,
    tools: agentTools
});

// Tool-level conversation (new conversation per invocation)
const toolConversationId = await createConversation(projectId, 'tool', {
    toolName: 'brainstorm_ideas',
    parentConversationId: conversationId // link to agent conversation
});

const toolContext = await resumeConversation(toolConversationId);
const toolResult = await toolContext.streamObject({
    messages: [...],
    schema: BrainstormOutputSchema
});
```

## Success Criteria

1. All LLM interactions go through conversation-aware **functions** (no classes)
2. Complete message history with parameters is stored
3. Transforms are properly linked to conversations and trigger messages
4. Context caching reduces costs by 40%+ for repeated prefixes
5. UI shows clear conversation management and filtering
6. System supports future conversation branching
7. **`npm run build` passes at every phase** - no broken builds throughout refactoring
8. **`npm test -- --run` passes completely** - all tests working with new architecture
9. **ZERO legacy code remains** - complete removal of old chat system
10. **Functional paradigm enforced** - no classes, pure functions with closures and TypeScript types

## Notes

- Electric SQL sync is NOT needed for conversation tables (backend-only)
- Failed messages are stored but excluded from history reconstruction
- Streaming updates modify the same message row with timestamp tracking
- Content hash includes full conversation history + current parameters
- Tool calls within agents create sub-conversations linked to parent

## Additional Implementation Details (Initially Overlooked)

### Real-Time Streaming Architecture

The system uses **Server-Sent Events (SSE)** for real-time streaming, not WebSockets:

```typescript
// SSE event types for tool streaming
type StreamingEventType = 
    | 'status'      // Tool loading/processing status
    | 'rawText'     // Raw LLM text chunks (for debugging)
    | 'eagerPatches'// Early patch results during streaming
    | 'pipelineResults' // Processed pipeline data
    | 'chunk'       // Standard data chunks
    | 'result'      // Final result
    | 'error';      // Error events

// Admin routes will need SSE setup
res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
});
```

### Caching Strategy Transition

Current system uses **file-based caching** via StreamCache. Need to transition to DB-based:

```typescript
// Current: File-based StreamCache
class StreamCache {
    private cacheDir: string = './cache/llm-streams';
    async getCachedStream(cacheKey: string): Promise<CachedStreamChunk[]>
}

// New: DB-based caching in conversation_messages
interface ConversationMessage {
    content_hash: string;     // Key for cache lookup
    cache_hit: boolean;       // Was this a cache hit?
    cached_tokens: number;    // Number of cached tokens (from Alibaba)
}
```

### Error Handling & Retry Mechanisms

Preserve sophisticated retry logic from StreamingTransformExecutor:

```typescript
interface RetryConfig {
    maxRetries: number;      // Default: 3
    backoffStrategy: 'exponential' | 'linear';
    maxBackoffMs: number;    // Default: 10000 (10 seconds)
}

// Error types with user-friendly messages
enum LLMErrorType {
    CONTENT_FILTER = 'inappropriate content',
    RATE_LIMIT = 'rate limit',
    NETWORK = 'network',
    AUTH = 'authentication',
    MODEL_ERROR = 'model',
    STREAMING = 'stream'
}

// Conversation context needs retry support
interface ConversationContext {
    // ... existing fields ...
    retryConfig?: RetryConfig;
    onError?: (error: LLMError) => string; // User-friendly message generator
}
```

### Middleware Pattern Integration

Support for middleware like UserContext and reasoning models:

```typescript
// Middleware support in conversation context
interface ConversationContext {
    // ... existing fields ...
    middleware?: LanguageModelV1Middleware[];
    
    // Helper to add middleware
    addMiddleware: (middleware: LanguageModelV1Middleware) => void;
}

// Common middleware
const userContextMiddleware = createUserContextMiddleware({
    originalUserRequest: string,
    projectId: string,
    userId: string,
    timestamp: string
});

const reasoningMiddleware = extractReasoningMiddleware({ 
    tagName: 'think' 
});
```

### Non-Persistent/Dry-Run Mode

Support testing without database writes:

```typescript
interface ConversationOptions {
    persist: boolean;  // Default: true
    // When false, no DB writes, useful for testing
}

// Dry-run conversation context
const testContext = await createConversation(projectId, 'tool', {
    toolName: 'brainstorm_ideas',
    dryRun: true  // No DB writes
});
```

### Model Configuration & Selection

Dynamic model selection and configuration:

```typescript
interface ModelConfig {
    provider: 'openai' | 'anthropic' | 'alibaba';
    modelName: string;
    supportsReasoning?: boolean;
    supportsCaching?: boolean;
    // Model-specific features
}

// Conversation-level model selection
interface ConversationContext {
    // ... existing fields ...
    setModel: (config: ModelConfig) => void;
    getModelCapabilities: () => ModelCapabilities;
}
```

### Transform Status Tracking

Enhanced status tracking for streaming transforms:

```typescript
// Additional transform status fields
interface Transform {
    // ... existing fields ...
    streaming_status?: 'pending' | 'streaming' | 'completed' | 'failed';
    progress_percentage?: number;
    chunk_count?: number;
    last_chunk_at?: Date;
}
```

### Message Versioning for Streaming

Handle streaming updates without breaking immutability:

```typescript
// Message versions table for streaming history
CREATE TABLE message_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES conversation_messages(id),
    content TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

// Track streaming updates
interface StreamingMessageUpdate {
    messageId: string;
    content: string;
    chunkIndex: number;
    timestamp: Date;
}
```

### Tool Result Tracking

Comprehensive tool call and result tracking:

```typescript
interface ToolCallMessage extends ConversationMessage {
    role: 'tool';
    tool_name: string;
    tool_call_id: string;      // From LLM
    tool_parameters: Record<string, any>;
    tool_result?: {
        success: boolean;
        data?: any;
        error?: string;
        execution_time_ms: number;
    };
}
```

## Updated Implementation Phases

### Phase 1.5: Streaming & Middleware Infrastructure
- [ ] Implement SSE streaming helpers
- [ ] Create middleware integration system
- [ ] Build retry mechanism with exponential backoff
- [ ] Add dry-run mode support
- [ ] Implement message versioning for streaming
- [ ] **BUILD CHECK**: Ensure `npm run build` passes after infrastructure changes

### Phase 2.5: Migration from File Cache to DB Cache
- [ ] Create cache migration utilities
- [ ] Implement DB-based cache lookup
- [ ] Add cache metrics tracking
- [ ] Migrate existing file caches to DB
- [ ] Remove StreamCache dependency
- [ ] **BUILD CHECK**: Ensure `npm run build` passes after cache migration

### Phase 3.5: Enhanced Error Handling
- [ ] Implement error classification system
- [ ] Create user-friendly error messages
- [ ] Add retry UI indicators
- [ ] Build error recovery flows
- [ ] Add conversation failure recovery
- [ ] **BUILD CHECK**: Ensure `npm run build` passes with error handling
- [ ] **TEST CHECK**: Ensure error handling tests pass with `npm test -- --run`

## Performance Considerations

1. **Message Batching**: Batch message inserts during streaming to reduce DB load
2. **Cache Warming**: Pre-populate cache for common prefixes
3. **Connection Pooling**: Ensure proper DB connection management
4. **SSE Keep-Alive**: Implement heartbeat for long-running streams
5. **Lazy Loading**: Load conversation history on-demand

## Security Considerations

1. **Conversation Isolation**: Ensure users can only access their conversations
2. **Parameter Sanitization**: Clean LLM parameters before storage
3. **Tool Call Validation**: Verify tool permissions per conversation
4. **Rate Limiting**: Per-conversation rate limits
5. **Audit Trail**: Track all conversation access 