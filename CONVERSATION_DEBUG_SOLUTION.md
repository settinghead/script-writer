# RawChatMessages Debugging - Root Cause & Solution

## 🔍 **Issues Identified**

### 1. Assistant Messages Always Empty
**Symptom**: Assistant messages show `status: completed` but `content: EMPTY STRING`

### 2. No Tool Call Messages  
**Symptom**: No messages with `role='tool'` exist in the database

## 🎯 **Root Cause: LLM API Authentication Failure**

After comprehensive debugging, the root cause is:
- **LLM API calls are failing** with "Incorrect API key provided"
- **Failures are silent** - no errors logged in conversation system
- **Empty streams returned** - streaming completes but with no content
- **Tool calls can't execute** - depend on LLM responses that never come

## 📊 **Evidence**

```bash
# API Test Results:
🔍 Checking LLM configuration...
Environment variables:
  LLM_API_KEY: Set (sk-0f2af57...)
  DASHSCOPE_API_KEY: NOT SET  
  LLM_BASE_URL: https://dashscope.aliyuncs.com/compatible-mode/v1

🚀 Testing direct API call...
❌ API call failed: Incorrect API key provided.
```

## 🛠️ **Solutions Required**

### 1. Fix LLM Authentication 

**Option A: Update API Key**
```bash
# Set valid DashScope API key
export LLM_API_KEY="sk-valid-key-here"
# OR
export DASHSCOPE_API_KEY="sk-valid-key-here"
```

**Option B: Use Different Provider**
```bash
# Switch to OpenAI or other provider
export LLM_PROVIDER="openai"
export LLM_API_KEY="sk-openai-key"
export LLM_BASE_URL="https://api.openai.com/v1"
```

### 2. Improve Error Handling

The streaming system needs better error logging:

```typescript
// In StreamingWrappers.ts - catch API auth errors
try {
    const result = await streamText(enhancedParams);
    // ... streaming logic
} catch (error) {
    console.error('[StreamingWrappers] LLM API call failed:', error);
    
    // Update message with error status
    await updateMessageWithDisplay(assistantMessageId, {
        content: '',
        status: 'failed' as any,
        errorMessage: error instanceof Error ? error.message : 'LLM API call failed'
    });
    
    throw error; // Re-throw so caller knows about failure
}
```

### 3. Fix Cache Hit Logic

The cache hit logic was fixed to properly return cached content:

```typescript
// Fixed: checkCacheHit now returns cached content
async function checkCacheHit(contentHash: string, projectId: string): Promise<{ 
    hit: boolean; 
    cachedTokens: number; 
    cachedContent?: string 
}> {
    // ... implementation now includes cachedContent
}
```

### 4. Add Tool Call Tracking

Tool calls from AI SDK need to be logged to conversation_messages:

```typescript
// In tool execution - log tool calls
await createMessageWithDisplay(conversationId, 'tool', JSON.stringify(toolResult), {
    toolName: toolDef.name,
    toolCallId: toolCallId,
    toolParameters: params,
    toolResult: result
});
```

## ✅ **Immediate Action Items**

1. **Fix API authentication** - Set valid LLM_API_KEY
2. **Test streaming again** - Run debug script to verify fix
3. **Improve error handling** - Add proper error logging to streaming
4. **Implement tool tracking** - Ensure tool calls create conversation messages

## 🧪 **Testing Steps**

```bash
# 1. Fix API key
export LLM_API_KEY="your-valid-key"

# 2. Test basic API connection  
./run-ts -e "/* API test code */"

# 3. Test conversation streaming
./run-ts src/server/scripts/debug-conversation-streaming.ts

# 4. Check RawChatMessages UI
# - Assistant messages should now have content
# - Tool messages should appear when tools are used
```

## 📈 **Expected Results After Fix**

1. **Assistant messages will have content** - LLM responses will be captured
2. **Tool call messages will appear** - `role='tool'` messages in database  
3. **RawChatMessages UI will be populated** - Full conversation history visible
4. **Cache hits will work properly** - Cached content will be returned
5. **Error messages will be logged** - Failed API calls will be visible

## 🔄 **Long-term Improvements**

1. **API key validation** - Check API key validity on startup
2. **Fallback providers** - Support multiple LLM providers  
3. **Better error UI** - Show API errors in chat interface
4. **Monitoring** - Track API success rates and errors
5. **Tool call visualization** - Enhanced tool call display in UI

---

**Status**: Root cause identified, solutions documented  
**Priority**: High - Core functionality blocked by auth issue  
**Estimated Fix Time**: 1-2 hours after API key resolution 