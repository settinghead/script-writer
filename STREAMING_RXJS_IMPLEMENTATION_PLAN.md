# RxJS-Based Streaming Service Implementation Plan

## 🎯 **Objective**
Create a generalized LLM JSON streaming framework using RxJS that can handle any LLM request returning JSON, starting with refactoring the brainstorming feature as the first implementation.

## 🏗️ **Architecture Overview**

```
┌─────────────────┐                     ┌──────────────────┐
│   Frontend      │                     │    Backend       │
│                 │                     │                  │
│ StreamingService│◄─────HTTP Stream────┤ StreamingEndpoint│
│    (RxJS)       │                     │                  │
└────────┬────────┘                     └────────┬─────────┘
         │                                       │
         │                                       │
    ┌────▼─────┐                          ┌─────▼─────┐
    │ useStream│                          │ Transform │
    │   Hook   │                          │ Executor  │
    └──────────┘                          └───────────┘
                    
                    ┌──────────────┐
                    │ src/common   │
                    │ - Interfaces │
                    │ - Types      │
                    │ - Utilities  │
                    └──────────────┘
```

## 📁 **File Structure**

```
src/
├── common/                              # Shared between frontend and backend
│   ├── streaming/
│   │   ├── types.ts                    # Core streaming types
│   │   ├── interfaces.ts               # Streaming interfaces
│   │   └── constants.ts                # Shared constants
│   └── llm/
│       ├── types.ts                    # LLM-specific types
│       └── templates.ts                # Template interfaces
│
├── client/
│   ├── services/
│   │   ├── streaming/
│   │   │   ├── LLMStreamingService.ts  # Generic LLM streaming
│   │   │   ├── StreamingJSONParser.ts  # JSON parsing logic
│   │   │   └── operators/
│   │   │       ├── parsePartialJSON.ts
│   │   │       ├── detectCompletion.ts
│   │   │       └── index.ts
│   │   └── implementations/
│   │       ├── BrainstormingStreamingService.ts
│   │       └── OutlineStreamingService.ts
│   ├── hooks/
│   │   ├── useLLMStreaming.ts         # Generic streaming hook
│   │   └── useStreamingBrainstorm.ts  # Brainstorm-specific
│   └── components/
│       └── BrainstormingPanel.tsx      # Simplified component
│
└── server/
    ├── services/
    │   ├── streaming/
    │   │   ├── StreamingTransformExecutor.ts
    │   │   └── StreamingResponseHandler.ts
    │   └── templates/
    │       ├── TemplateService.ts
    │       └── templates/
    │           ├── brainstorming.template.ts
    │           └── outline.template.ts
    └── routes/
        └── streaming.ts                # Unified streaming routes
```

## 🔧 **Core Components**

### **1. Shared Types and Interfaces (src/common)**

```typescript
// src/common/streaming/types.ts
export interface StreamingRequest<TParams = any> {
  artifactIds: string[];              // Input artifact IDs
  templateId: string;                 // Template to use
  templateParams?: TParams;           // Additional params for template
  modelName?: string;                 // LLM model to use
  streamConfig?: StreamConfig;
}

export interface StreamConfig {
  debounceMs?: number;               // Debounce for parsing (default: 50)
  completionTimeoutMs?: number;      // Stability timeout (default: 2000)
  maxRetries?: number;               // Max retry attempts
}

export interface StreamingResponse<T> {
  status: 'idle' | 'streaming' | 'completed' | 'error';
  items: T[];
  rawContent?: string;
  error?: Error;
  metadata?: {
    tokensProcessed?: number;
    startTime?: number;
    endTime?: number;
  };
}

// src/common/streaming/interfaces.ts
export interface JSONStreamable<T> {
  validate(item: any): item is T;
  parsePartial(content: string): T[];
  cleanContent(content: string): string;
}

// src/common/llm/types.ts
export interface LLMTemplate {
  id: string;
  name: string;
  promptTemplate: string;
  outputFormat: 'json' | 'json_array' | 'text';
  responseWrapper?: string;           // e.g., '```json'
  variables: string[];               // Required template variables
}

export interface TemplateContext {
  artifacts: Record<string, any>;    // Artifact data by role/key
  params: Record<string, any>;       // Additional parameters
}
```

### **2. Backend Implementation**

```typescript
// src/server/services/streaming/StreamingTransformExecutor.ts
export class StreamingTransformExecutor {
  constructor(
    private artifactRepo: ArtifactRepository,
    private transformRepo: TransformRepository,
    private templateService: TemplateService
  ) {}

  async executeStreamingTransform(
    userId: string,
    request: StreamingRequest,
    res: Response
  ): Promise<void> {
    // 1. Load artifacts
    const artifacts = await this.loadArtifacts(userId, request.artifactIds);
    
    // 2. Build prompt from template
    const template = await this.templateService.getTemplate(request.templateId);
    const prompt = await this.templateService.renderTemplate(template, {
      artifacts: this.mapArtifactsToContext(artifacts),
      params: request.templateParams
    });
    
    // 3. Create transform record
    const transform = await this.createTransform(userId, artifacts, template);
    
    // 4. Stream LLM response
    const streamResponse = await this.streamLLMResponse(
      prompt,
      request.modelName || 'deepseek-chat',
      res
    );
    
    // 5. Handle completion and save artifacts
    streamResponse.on('complete', async (fullContent) => {
      await this.saveOutputArtifacts(transform, fullContent, template);
    });
  }
  
  private async streamLLMResponse(
    prompt: string,
    modelName: string,
    res: Response
  ): Promise<DataStreamResponse> {
    const result = await streamText({
      model: deepseekAI(modelName),
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });
    
    return createDataStreamResponse({
      stream: result.toDataStream(),
      res,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked'
      }
    });
  }
}

// src/server/services/templates/TemplateService.ts
export class TemplateService {
  private templates = new Map<string, LLMTemplate>();
  
  async renderTemplate(
    template: LLMTemplate,
    context: TemplateContext
  ): string {
    let prompt = template.promptTemplate;
    
    // Replace variables with context values
    for (const variable of template.variables) {
      const value = this.resolveVariable(variable, context);
      prompt = prompt.replace(`{${variable}}`, value);
    }
    
    return prompt;
  }
  
  private resolveVariable(path: string, context: TemplateContext): string {
    // Handle nested paths like "artifacts.brainstorm_params.genre"
    const parts = path.split('.');
    let value: any = context;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return value?.toString() || '';
  }
}
```

### **3. Frontend Implementation**

```typescript
// src/client/services/streaming/LLMStreamingService.ts
export abstract class LLMStreamingService<T> implements JSONStreamable<T> {
  protected abort$ = new Subject<void>();
  protected content$ = new Subject<string>();
  protected error$ = new Subject<Error>();
  
  // Observable streams
  readonly items$: Observable<T[]>;
  readonly status$: Observable<StreamingResponse<T>['status']>;
  readonly response$: Observable<StreamingResponse<T>>;
  
  constructor(protected config: StreamConfig = {}) {
    this.items$ = this.createItemsStream();
    this.status$ = this.createStatusStream();
    this.response$ = this.createResponseStream();
  }
  
  private createItemsStream(): Observable<T[]> {
    return this.content$.pipe(
      debounceTime(this.config.debounceMs || 50),
      map(content => this.parsePartial(this.cleanContent(content))),
      filter(items => items.length > 0),
      distinctUntilChanged((a, b) => 
        JSON.stringify(a) === JSON.stringify(b)
      ),
      takeUntil(this.abort$),
      shareReplay(1)
    );
  }
  
  private createStatusStream(): Observable<StreamingResponse<T>['status']> {
    const streaming$ = this.content$.pipe(mapTo('streaming' as const));
    const completed$ = this.content$.pipe(
      debounceTime(this.config.completionTimeoutMs || 2000),
      mapTo('completed' as const)
    );
    const error$ = this.error$.pipe(mapTo('error' as const));
    
    return merge(
      of('idle' as const),
      streaming$,
      completed$,
      error$
    ).pipe(
      distinctUntilChanged(),
      takeUntil(this.abort$)
    );
  }
  
  async start(request: StreamingRequest): Promise<void> {
    this.abort$.next(); // Cancel any existing stream
    
    try {
      const response = await fetch('/api/streaming/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`Streaming failed: ${response.statusText}`);
      }
      
      await this.consumeStream(response.body!.getReader());
    } catch (error) {
      this.error$.next(error as Error);
    }
  }
  
  stop(): void {
    this.abort$.next();
  }
  
  // Abstract methods for implementation
  abstract validate(item: any): item is T;
  abstract parsePartial(content: string): T[];
  abstract cleanContent(content: string): string;
}

// src/client/services/implementations/BrainstormingStreamingService.ts
export interface IdeaWithTitle {
  title: string;
  body: string;
}

export class BrainstormingStreamingService extends LLMStreamingService<IdeaWithTitle> {
  validate(item: any): item is IdeaWithTitle {
    return (
      typeof item === 'object' &&
      typeof item.title === 'string' &&
      typeof item.body === 'string' &&
      item.title.trim() !== '' &&
      item.body.trim() !== ''
    );
  }
  
  cleanContent(content: string): string {
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return cleaned;
  }
  
  parsePartial(content: string): IdeaWithTitle[] {
    const ideas: IdeaWithTitle[] = [];
    
    try {
      // Try to parse as complete JSON array
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.filter(item => this.validate(item));
      }
    } catch {
      // Try JSON repair
      try {
        const repaired = jsonrepair(content);
        const parsed = JSON.parse(repaired);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => this.validate(item));
        }
      } catch {
        // Extract individual objects
        const patterns = [
          /\{\s*"title"\s*:\s*"[^"]*"\s*,\s*"body"\s*:\s*"[^"]*"\s*\}/g,
          /\{\s*"body"\s*:\s*"[^"]*"\s*,\s*"title"\s*:\s*"[^"]*"\s*\}/g
        ];
        
        for (const pattern of patterns) {
          const matches = content.match(pattern);
          if (matches) {
            for (const match of matches) {
              try {
                const obj = JSON.parse(match);
                if (this.validate(obj)) {
                  ideas.push(obj);
                }
              } catch {
                // Skip invalid objects
              }
            }
          }
        }
      }
    }
    
    return ideas;
  }
}
```

### **4. React Hook Integration**

```typescript
// src/client/hooks/useLLMStreaming.ts
export function useLLMStreaming<T>(
  ServiceClass: new (config?: StreamConfig) => LLMStreamingService<T>,
  config?: StreamConfig
) {
  const [service] = useState(() => new ServiceClass(config));
  const [response, setResponse] = useState<StreamingResponse<T>>({
    status: 'idle',
    items: []
  });
  
  useEffect(() => {
    const subscription = service.response$.subscribe(setResponse);
    return () => subscription.unsubscribe();
  }, [service]);
  
  const start = useCallback(async (request: StreamingRequest) => {
    await service.start(request);
  }, [service]);
  
  const stop = useCallback(() => {
    service.stop();
  }, [service]);
  
  return {
    ...response,
    start,
    stop
  };
}

// src/client/hooks/useStreamingBrainstorm.ts
export function useStreamingBrainstorm() {
  return useLLMStreaming(BrainstormingStreamingService, {
    debounceMs: 50,
    completionTimeoutMs: 2000
  });
}
```

### **5. Updated BrainstormingPanel Component**

```typescript
const BrainstormingPanel: React.FC<BrainstormingPanelProps> = (props) => {
  const {
    items,
    status,
    error,
    start,
    stop
  } = useStreamingBrainstorm();
  
  const generateIdeas = async () => {
    const request: StreamingRequest = {
      artifactIds: [], // No input artifacts for brainstorming
      templateId: 'brainstorming',
      templateParams: {
        platform: selectedPlatform,
        genre: buildGenrePromptString(),
        requirements: requirements
      }
    };
    
    await start(request);
  };
  
  // Much simpler component with no complex state management
  return (
    <div>
      {/* Configuration UI */}
      
      <Button
        onClick={status === 'streaming' ? stop : generateIdeas}
        icon={status === 'streaming' ? <StopOutlined /> : <BulbOutlined />}
      >
        {status === 'streaming' ? '停止生成' : '开始头脑风暴'}
      </Button>
      
      {/* Streaming UI */}
      {status === 'streaming' && (
        <div>
          {items.map((idea, index) => (
            <IdeaCard key={index} idea={idea} index={index} />
          ))}
        </div>
      )}
      
      {/* Completed UI */}
      {status === 'completed' && (
        <IdeaSelection ideas={items} onSelect={onIdeaSelect} />
      )}
    </div>
  );
};
```

## 🔄 **Implementation Phases**

### **Phase 1: Core Infrastructure (Day 1)**
- [ ] Create shared types and interfaces in `src/common`
- [ ] Implement `LLMStreamingService` base class
- [ ] Create `StreamingTransformExecutor` for backend
- [ ] Set up template service and brainstorming template
- [ ] Create unified streaming endpoint

### **Phase 2: Brainstorming Migration (Day 1-2)**
- [ ] Implement `BrainstormingStreamingService`
- [ ] Create `useStreamingBrainstorm` hook
- [ ] Refactor `BrainstormingPanel` to use new service
- [ ] Update backend brainstorming endpoint
- [ ] Test end-to-end streaming flow

### **Phase 3: Generalization & Testing (Day 2-3)**
- [ ] Apply pattern to outline generation
- [ ] Apply pattern to plot generation
- [ ] Create comprehensive unit tests
- [ ] Add integration tests
- [ ] Performance testing

### **Phase 4: Advanced Features (Day 3-4)**
- [ ] Add retry logic with exponential backoff
- [ ] Implement request/response caching
- [ ] Add progress tracking and analytics
- [ ] Create debugging tools
- [ ] Documentation and examples

## 🧪 **Testing Strategy**

### **Unit Tests**
```typescript
describe('LLMStreamingService', () => {
  it('should handle partial JSON parsing', () => {
    const service = new BrainstormingStreamingService();
    const partial = '[{"title": "test", "body": "content"}, {"title": "incomp';
    const result = service.parsePartial(partial);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('test');
  });
});
```

### **Integration Tests**
```typescript
describe('Streaming Flow', () => {
  it('should stream from backend to frontend', async () => {
    const mockServer = setupMockStreamingServer();
    const { result } = renderHook(() => useStreamingBrainstorm());
    
    await act(async () => {
      await result.current.start({
        artifactIds: [],
        templateId: 'brainstorming',
        templateParams: { genre: 'romance' }
      });
    });
    
    await waitFor(() => {
      expect(result.current.status).toBe('completed');
      expect(result.current.items).toHaveLength(6);
    });
  });
});
```

## 📊 **Benefits of This Architecture**

### **1. Reusability**
- Generic `LLMStreamingService` for any JSON streaming
- Template system for different LLM use cases
- Shared types between frontend and backend

### **2. Maintainability**
- Clear separation of concerns
- No complex React hook dependencies
- Testable service layer

### **3. Extensibility**
- Easy to add new streaming endpoints
- Template-based prompt generation
- Pluggable JSON parsing strategies

### **4. Performance**
- Efficient RxJS operators
- Debounced parsing
- Automatic cleanup

## 🎯 **Success Metrics**

- [ ] Zero infinite loop errors
- [ ] 50% reduction in component complexity
- [ ] Reusable for all LLM streaming features
- [ ] <100ms parsing latency
- [ ] 90%+ test coverage
- [ ] Full backward compatibility

## 🚀 **Migration Strategy**

### **Step 1: Parallel Implementation**
- Build new system alongside existing
- Feature flag for switching

### **Step 2: Gradual Migration**
- Start with brainstorming
- Monitor performance and errors
- Gather user feedback

### **Step 3: Full Rollout**
- Apply to all streaming features
- Remove old implementation
- Update documentation

---

*This generalized approach provides a robust foundation for any LLM JSON streaming use case, starting with brainstorming as the proof of concept.* 