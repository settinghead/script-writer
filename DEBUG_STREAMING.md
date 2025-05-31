# Streaming Debug Logging Guide

## Overview

Comprehensive debug logging has been added throughout the streaming system to diagnose issues with content persistence during page refreshes. The logging covers:

1. **Frontend Components** - OutlineTab state changes and session loading
2. **Streaming Services** - EventSource connections and data flow  
3. **Backend Endpoints** - Transform status and active job detection
4. **Caching System** - Data persistence and retrieval

## Debug Log Prefixes

All logs are prefixed with their component for easy filtering:

- `[OutlineTab]` - React component state and lifecycle
- `[LLMStreamingService]` - EventSource connection and data parsing
- `[useLLMStreaming]` - React hook state management
- `[SSE Endpoint]` - Backend streaming endpoint
- `[StreamingCache]` - In-memory cache operations  
- `[OutlineRoutes]` - Active job detection API

## Testing Instructions

### To Reproduce the Bug:

1. **Start a new outline generation**:
   ```bash
   # Open browser console
   # Navigate to /new-outline
   # Enter content and start generation
   ```

2. **During streaming (mid-generation)**:
   ```bash
   # Wait for some content to appear
   # Refresh the page (F5 or Ctrl+R)
   # Check console for debug logs
   ```

3. **Expected Behavior vs Bug**:
   - **Expected**: Content should persist and streaming should resume
   - **Bug**: Content is lost, must wait for completion and refresh again

### Key Log Patterns to Watch:

#### On Page Refresh:
```
[OutlineTab] Component initialized - ID: <sessionId>, transformId: <transformId>
[OutlineTab] Loading session for ID: <sessionId>
[OutlineTab] Loaded session data: {...}
[useLLMStreaming] Hook initialized with transformId: <transformId>
[LLMStreamingService] Connecting to transform <transformId>
```

#### Active Job Detection:
```
[OutlineRoutes] Active job check for session <sessionId> by user <userId>
[OutlineRoutes] Active transform search result: {...}
```

#### Streaming Cache:
```
[StreamingCache] Retrieved X chunks for transform <transformId>
[StreamingCache] Transform <transformId> completion status: true/false
```

#### EventSource Connection:
```
[LLMStreamingService] EventSource connection opened for transform <transformId>
[LLMStreamingService] Message X received for transform <transformId>
[SSE Endpoint] Sending X cached chunks to client
```

## Expected Issues to Investigate:

### 1. **Undefined Streaming Error**
- Look for: `[OutlineTab] Streaming error occurred: { streamingError: undefined }`
- This suggests error propagation issues in the RxJS stream

### 2. **Missing Cached Data**
- Look for: `[StreamingCache] Retrieved 0 chunks for transform <transformId>`
- This indicates cache is empty when it should contain data

### 3. **Transform Status Mismatch**
- Look for: Transform status vs actual completion state
- Check if transforms are marked 'running' when they should be 'completed'

### 4. **EventSource Connection Issues**
- Look for: Connection errors or missing messages
- Check if EventSource properly reconnects to existing streams

## Console Filter Commands

To filter logs in browser console:

```javascript
// Show only streaming-related logs
console.log = ((originalLog) => (...args) => {
    if (args.some(arg => typeof arg === 'string' && 
        (arg.includes('[OutlineTab]') || arg.includes('[LLMStreaming') || 
         arg.includes('[useLLMStreaming]') || arg.includes('streaming')))) {
        originalLog.apply(console, args);
    }
})(console.log);

// Show only error logs
console.error = ((originalError) => (...args) => {
    originalError.apply(console, ['🔴 ERROR:', ...args]);
})(console.error);

// Show only cache logs
// Filter browser console for "[StreamingCache]"
```

## Data Flow Debugging

The expected data flow during page refresh:

1. **Component Initialization**
   ```
   OutlineTab → useLLMStreaming → LLMStreamingService
   ```

2. **Active Job Detection**
   ```
   loadSession() → checkActiveStreamingJob() → Backend API
   ```

3. **Stream Reconnection**
   ```
   EventSource connection → SSE Endpoint → StreamingCache
   ```

4. **Data Recovery**
   ```
   Cached chunks → RxJS pipeline → UI update
   ```

## Post-Testing Analysis

After reproducing the bug, analyze:

1. **Where does the data flow break?**
2. **Are transforms properly marked as 'running' vs 'completed'?**
3. **Is the StreamingCache retaining data between requests?**
4. **Are EventSource connections properly established?**
5. **Do UI components receive the cached data?**

## Cleanup

To remove debug logging after investigation:
```bash
# Search and remove console.log statements with these prefixes:
grep -r "console\.log.*\[OutlineTab\]" src/
grep -r "console\.log.*\[LLMStreaming" src/
grep -r "console\.log.*\[SSE Endpoint\]" src/
``` 