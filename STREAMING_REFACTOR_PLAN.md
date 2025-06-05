# 🚀 Streaming Refactor Plan: Migration to AI SDK `streamObject`

## 📊 **Complete Codebase Survey Results**

Based on comprehensive analysis, here's the current "dumb way" streaming implementation:

### **Backend Streaming Infrastructure (2,800+ lines)**

#### **Core Streaming Services**
- **`StreamingTransformExecutor`** (1,500+ lines) - Manual chunk batching and SSE broadcasting
- **`JobBroadcaster`** (120 lines) - Manual SSE message handling  
- **`LLMStreamingService`** (443+ lines) - Complex RxJS streaming base class
- **Template-based streaming** (800+ lines) - Manual prompt rendering and JSON parsing

#### **Manual Streaming Endpoints**
- **`/api/streaming/llm`** - Generic streaming endpoint with manual pumping
- **`/api/brainstorm/generate/stream`** - Direct `streamText` with manual chunk processing
- **`/api/streaming/transform/:transformId`** - SSE endpoint for transform streaming
- **`/llm-api/script/edit`** - Collaborative editing with streaming

#### **Custom Streaming Services (1,200+ lines total)**
- **`OutlineStreamingService`** (288 lines) - Complex JSON parsing with `jsonrepair`
- **`ScriptStreamingService`** (200+ lines) - Multi-strategy parsing with regex fallbacks  
- **`EpisodeStreamingService`** (180+ lines) - Array element extraction and validation
- **`BrainstormingStreamingService`** (150+ lines) - Idea parsing with artifact ID mapping

### **Frontend Streaming Infrastructure (800+ lines)**

#### **Custom Hooks**
- **`useLLMStreaming`** (102 lines) - Complex RxJS integration with EventSource
- **`useStreamingLLM`** (201 lines) - Manual chunk parsing and state management
- **`useStreamingOutline`** / **`useStreamingBrainstorm`** - Service-specific wrappers

#### **Streaming Components**  
- **`DynamicStreamingUI`** (140+ lines) - Complex field detection and rendering
- **`StreamingFieldDetector`** (53+ lines) - JSON path extraction and partial parsing
- **`OutlineTab`** / **`ProjectLayout`** - Multiple streaming integrations

#### **Context Management**
- **`EpisodeContext`** (389+ lines) - Complex state management with streaming updates

### **Shared Infrastructure (400+ lines)**

#### **Manual JSON Utilities**
- **`textCleaning.ts`** (274 lines) - `jsonrepair`, think tag removal, JSON extraction
- **`JSONStreamable`** interface - Abstract parsing contract
- **Template rendering** - Manual prompt construction with variable replacement

#### **Database Integration**
- **Transform chunks storage** - Manual chunk persistence in SQLite
- **SSE state management** - Custom connection tracking and cleanup

---

## 🎯 **Anti-Patterns & Complexity Hotspots**

### **Major Code Smells**

1. **Manual JSON Boundary Detection** (200+ lines across services)
```typescript
// ❌ Complex regex-based parsing
const objectStart = processableContent.indexOf('{');
const arrayStart = processableContent.indexOf('[');
// ... 50+ lines of boundary detection logic
```

2. **jsonrepair Everywhere** (15+ imports)
```typescript
// ❌ Error-prone repair strategies  
const repaired = jsonrepair(processableContent);
const parsed = JSON.parse(repaired);
```

3. **Manual Stream Pumping** (300+ lines total)
```typescript
// ❌ Complex manual chunk processing
const pump = () => {
  reader.read().then(({ done, value }) => {
    // ... complex state management
  });
};
```

4. **RxJS Complexity Explosion** (400+ lines)
```typescript
// ❌ Over-engineered observable chains
const streaming$ = sourceContentForStatus$.pipe(
  take(1), mapTo('streaming' as const), shareReplay(1)
);
```

### **Critical Dependencies**
- **`jsonrepair`** - External dependency for fixing malformed JSON
- **`rxjs`** - Complex reactive patterns for streaming state
- **Custom SSE** - Manual Server-Sent Events implementation
- **Transform chunks** - Database storage for partial streaming data

---

## 🚀 **Migration Plan to AI SDK `streamObject`**

### **Phase 1: Backend Core Migration (Week 1)**

#### **1.1 Replace Template-Based Streaming**
**Replace:** All manual template streaming in `StreamingTransformExecutor`
**With:** Direct `streamObject` calls

```typescript
// ✅ New streamObject approach
import { streamObject } from 'ai';
import { z } from 'zod';

// Replace 1,500+ lines with:
export async function streamOutline(prompt: string, schema: z.ZodSchema) {
  const { partialObjectStream } = streamObject({
    model: openai('gpt-4'),
    schema,
    prompt
  });

  return partialObjectStream;
}
```

**Files to modify:**
- `src/server/services/streaming/StreamingTransformExecutor.ts` ⭐ **HIGH PRIORITY**
- `src/server/services/templates/TemplateService.ts`
- Template files: `brainstorming.ts`, `outline.ts`, `episodeSynopsisGeneration.ts`, `scriptGeneration.ts`

#### **1.2 Simplify Streaming Endpoints**
**Replace:** Manual pump functions and SSE complexity
**With:** Native AI SDK streaming responses

```typescript
// ✅ Simplified endpoint
app.post('/api/outline/stream', async (req, res) => {
  const { partialObjectStream } = streamObject({
    model: openai('gpt-4'),
    schema: OutlineSchema,
    prompt: buildPrompt(req.body)
  });

  // AI SDK handles all streaming automatically
  return streamObject.toDataStreamResponse();
});
```

**Benefits:**
- **90% reduction** in streaming endpoint code
- **Eliminate** `JobBroadcaster` and manual SSE
- **Native** error handling and completion events

### **Phase 2: Schema Migration (Week 1)**

#### **2.1 Create Zod Schemas**
**Replace:** Scattered TypeScript interfaces  
**With:** Centralized Zod schemas for validation and type generation

```typescript
// ✅ Single source of truth
export const OutlineSchema = z.object({
  title: z.string(),
  genre: z.string(),
  selling_points: z.array(z.string()),
  satisfaction_points: z.array(z.string()),
  characters: z.array(CharacterSchema),
  synopsis_stages: z.array(SynopsisStageSchema)
});

export type Outline = z.infer<typeof OutlineSchema>;
```

**Create new file:** `src/common/schemas/streaming.ts`
**Benefits:**
- **Automatic** TypeScript type generation
- **Runtime** validation of streamed objects
- **Schema evolution** with versioning support

#### **2.2 Template to Schema Mapping**
**Migrate:** Template output formats to Zod schemas

| Current Template | Output Format | New Zod Schema |
|------------------|---------------|----------------|
| `brainstorming` | `json_array` | `IdeaArraySchema` |
| `outline` | `json` | `OutlineSchema` |
| `episode_synopsis_generation` | `json_array` | `EpisodeArraySchema` |
| `script_generation` | `json` | `ScriptSchema` |

### **Phase 3: Frontend Simplification (Week 2)**

#### **3.1 Replace Complex Services**
**Replace:** All `*StreamingService` classes (800+ lines)
**With:** AI SDK React hooks

```typescript
// ✅ Replace 288-line OutlineStreamingService with:
import { useObject } from 'ai/react';

function OutlineTab() {
  const { object, isLoading, error } = useObject({
    api: '/api/outline/stream',
    schema: OutlineSchema,
  });

  // object is automatically typed and updates progressively!
  return <OutlineDisplay outline={object} />;
}
```

**Files to delete:**
- `src/client/services/implementations/OutlineStreamingService.ts` (288 lines)
- `src/client/services/implementations/ScriptStreamingService.ts` (200+ lines)
- `src/client/services/implementations/EpisodeStreamingService.ts` (180+ lines)
- `src/client/services/implementations/BrainstormingStreamingService.ts` (150+ lines)
- `src/client/services/streaming/LLMStreamingService.ts` (443+ lines)

#### **3.2 Simplify Custom Hooks**
**Replace:** Complex RxJS-based hooks
**With:** Simple AI SDK hook wrappers

```typescript
// ✅ Replace 102-line useLLMStreaming with:
export function useStreamingOutline(prompt: string) {
  return useObject({
    api: '/api/outline/stream',
    schema: OutlineSchema,
    body: { prompt }
  });
}
```

**Files to simplify:**
- `src/client/hooks/useLLMStreaming.ts` (102 lines → 10 lines)
- `src/client/hooks/useStreamingLLM.ts` (201 lines → delete)
- `src/client/hooks/useStreamingOutline.ts` (14 lines → 5 lines)
- `src/client/hooks/useStreamingBrainstorm.ts` (42 lines → 5 lines)

#### **3.3 Update Components**
**Simplify:** Component streaming integration

```typescript
// ✅ Simplified component
function OutlineTab() {
  const { object: outline, isLoading } = useStreamingOutline(prompt);
  
  return (
    <div>
      {isLoading && <Spinner />}
      {outline && <OutlineDisplay outline={outline} />}
    </div>
  );
}
```

**Files to update:**
- `src/client/components/OutlineTab.tsx`
- `src/client/components/ProjectLayout.tsx`  
- `src/client/contexts/EpisodeContext.tsx`
- `src/client/components/DynamicOutlineResults.tsx`

### **Phase 4: Infrastructure Cleanup (Week 2)**

#### **4.1 Remove Custom Infrastructure**
**Delete:** Manual streaming infrastructure

**Files to delete:**
- `src/server/services/streaming/JobBroadcaster.ts` (120 lines)
- `src/client/services/streaming/LLMStreamingService.ts` (443 lines)
- `src/common/streaming/interfaces.ts` (JSONStreamable)
- `src/common/utils/textCleaning.ts` (274 lines - partial, keep non-streaming utils)
- `src/client/components/shared/streaming/` (entire directory)

#### **4.2 Database Schema Updates**
**Simplify:** Remove custom chunk storage

```sql
-- ✅ Remove transform_chunks table (no longer needed)
DROP TABLE IF EXISTS transform_chunks;

-- ✅ Simplify transforms table 
ALTER TABLE transforms DROP COLUMN chunk_count;
ALTER TABLE transforms DROP COLUMN last_chunk_at;
```

#### **4.3 Dependency Cleanup**
**Remove:** Unused dependencies

```json
// ✅ Remove from package.json
{
  "dependencies": {
    // Remove these:
    // "jsonrepair": "^3.12.0",
    // "rxjs": "^7.8.2"  (if not used elsewhere)
  }
}
```

### **Phase 5: Feature Preservation (Week 3)**

#### **5.1 Maintain SSE for Non-LLM Features**
**Keep:** WebSocket/SSE for collaborative editing and job status

```typescript
// ✅ Keep existing infrastructure for:
- CollaborativeEditor.tsx (YJS WebSocket)
- Job status updates (non-streaming)
- User notifications
```

#### **5.2 Preserve Advanced Features**
**Migrate:** Advanced streaming features to AI SDK patterns

```typescript
// ✅ Thinking indicators with AI SDK
const { object, isLoading } = useObject({
  api: '/api/outline/stream',
  schema: OutlineSchema,
  onProgress: (partialObject) => {
    // Handle partial updates for thinking indicators
  }
});
```

#### **5.3 Error Handling Migration**
**Replace:** Custom error handling with AI SDK patterns

```typescript
// ✅ Built-in error handling
const { object, error, isLoading } = useObject({
  api: '/api/outline/stream',
  schema: OutlineSchema,
  onError: (error) => {
    // AI SDK provides structured error handling
  }
});
```

---

## 📊 **Impact Assessment**

### **Code Reduction**
| Component | Current Lines | New Lines | Reduction |
|-----------|---------------|-----------|-----------|
| Backend streaming | 2,800+ | 400 | **86%** |
| Frontend streaming | 800+ | 80 | **90%** |
| Shared utilities | 400+ | 50 | **88%** |
| **Total** | **4,000+** | **530** | **87%** |

### **Dependency Elimination**
- ❌ **`jsonrepair`** - No longer needed with `streamObject`
- ❌ **Complex RxJS** - Replaced with simple React hooks  
- ❌ **Custom SSE** - Native AI SDK streaming
- ❌ **Manual JSON parsing** - Built-in schema validation

### **Performance Benefits**
- **Faster parsing** - No jsonrepair overhead
- **Better error handling** - Schema validation catches issues early
- **Reduced bundle size** - Eliminate large dependencies
- **Type safety** - Compile-time validation with Zod schemas

### **Developer Experience**
- **Simpler debugging** - No complex RxJS chains
- **Better IntelliSense** - Automatic type inference
- **Faster development** - Less boilerplate code
- **Easier testing** - Standard React hook patterns

---

## 🛠 **Implementation Strategy**

### **Week 1: Core Backend Migration**
1. **Day 1-2:** Create Zod schemas for all streaming objects
2. **Day 3-4:** Replace `StreamingTransformExecutor` with `streamObject`
3. **Day 5:** Update streaming endpoints to use AI SDK

### **Week 2: Frontend Migration**  
1. **Day 1-2:** Replace streaming services with AI SDK hooks
2. **Day 3-4:** Update components to use new hooks
3. **Day 5:** Remove complex streaming infrastructure

### **Week 3: Cleanup & Testing**
1. **Day 1-2:** Delete unused files and dependencies
2. **Day 3-4:** Comprehensive testing of all streaming features  
3. **Day 5:** Performance optimization and documentation

### **Risk Mitigation**
- **Feature flags** - Enable gradual rollout
- **Parallel implementation** - Keep old system during migration
- **Comprehensive testing** - Verify all streaming scenarios
- **Rollback plan** - Maintain ability to revert changes

---

## 🎯 **Success Metrics**

### **Technical Metrics**
- **87% code reduction** in streaming infrastructure
- **Zero** `jsonrepair` dependencies
- **<100ms** first paint improvement
- **100%** type safety with Zod schemas

### **Developer Metrics**  
- **50% faster** feature development
- **90% fewer** streaming-related bugs
- **100%** of new developers can understand streaming code
- **Zero** complex RxJS knowledge required

### **Business Metrics**
- **Maintained** all existing streaming features
- **Improved** error handling and user experience
- **Reduced** maintenance overhead
- **Increased** development velocity

---

## 📋 **Migration Checklist**

### **Pre-Migration**
- [ ] Backup current streaming implementation
- [ ] Document all existing streaming features
- [ ] Create comprehensive test suite
- [ ] Set up feature flags for gradual rollout

### **Phase 1: Backend**
- [ ] Create Zod schemas for all streaming objects
- [ ] Replace `StreamingTransformExecutor` core logic
- [ ] Update template services to use `streamObject`
- [ ] Modify streaming endpoints
- [ ] Test backend streaming functionality

### **Phase 2: Frontend**
- [ ] Install AI SDK React dependencies
- [ ] Replace streaming services with hooks
- [ ] Update components to use new hooks
- [ ] Remove RxJS dependencies
- [ ] Test frontend streaming integration

### **Phase 3: Cleanup**
- [ ] Delete unused streaming files
- [ ] Remove unnecessary dependencies
- [ ] Update database schema
- [ ] Clean up configuration files
- [ ] Final testing and documentation

### **Post-Migration**
- [ ] Performance monitoring
- [ ] User feedback collection  
- [ ] Bug tracking and resolution
- [ ] Documentation updates
- [ ] Team training on new patterns

---

This refactor plan will transform the codebase from a complex, error-prone manual streaming implementation to a clean, maintainable solution using AI SDK's native `streamObject` capabilities. The 87% code reduction will significantly improve maintainability while preserving all existing functionality. 