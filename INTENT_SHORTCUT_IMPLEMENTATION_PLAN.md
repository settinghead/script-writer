# Intent Shortcut Implementation Plan

## Overview
Implement a system to bypass LLM calls for deterministic actions triggered by UI buttons, while maintaining the same conversation flow and message structure as if the LLM had processed the request.

## Core Principles

1. **Transparency**: From the outside perspective, shortcutted requests should be indistinguishable from LLM-processed requests
2. **Determinism**: All shortcuts must have clear input schemas and predictable parameter resolution
3. **Consistency**: All conversation messages, tool calls, and responses should be created as if the LLM ran
4. **Extensibility**: The system should easily support new intent types following the same pattern
5. **Testability**: Each component should be independently testable with comprehensive test coverage

## Architecture Design

### 1. Intent Detection Layer
- Intercept messages in `ChatService` before they reach `AgentService`
- Check for `metadata.intent` field matching supported shortcuts
- Route to appropriate shortcut handler or fallback to standard LLM flow

### 2. Intent Handlers
- Each intent maps to a specific handler that:
  - Resolves required parameters from canonical jsondocs
  - Constructs the tool call parameters
  - Executes the tool directly
  - Generates appropriate conversation messages

### 3. Parameter Resolution Algorithm
- Generic algorithm to find canonical jsondocs by schema_type
- Supports filtering by additional criteria (e.g., episode number)
- Returns the most recent canonical version

### 4. Message Generation
- Create user message (already handled)
- Create synthetic assistant "thinking" message
- Create tool call message
- Execute tool and capture result
- Create tool result message
- Create final assistant response message

## Supported Intents

Initial support for all `generate_` prefixed tools:
- `generate_灵感创意s` → Brainstorm generation
- `generate_大纲设定` → Outline settings generation
- `generate_人物小传` → Character chronicles generation
- `generate_分集结构` → Episode planning generation
- `generate_分集大纲` → Episode synopsis generation
- `generate_单集剧本` → Episode script generation

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Create `IntentShortcutService` class
- [ ] Add intent detection in `ChatService.sendUserMessage`
- [ ] Implement base intent handler interface
- [ ] Create parameter resolution utilities
- [ ] Add conversation message generation helpers
- [ ] Write unit tests for core components

### Phase 2: Intent Handlers
- [ ] Implement `BrainstormGenerationIntent` handler
- [ ] Implement `OutlineSettingsIntent` handler
- [ ] Implement `ChroniclesIntent` handler
- [ ] Implement `EpisodePlanningIntent` handler
- [ ] Implement `EpisodeSynopsisIntent` handler
- [ ] Implement `EpisodeScriptIntent` handler
- [ ] Write integration tests for each handler

### Phase 3: Parameter Resolution
- [ ] Create `CanonicalJsondocResolver` utility
- [ ] Implement schema_type based lookup
- [ ] Add support for additional filtering criteria
- [ ] Handle edge cases (missing jsondocs, multiple candidates)
- [ ] Write comprehensive tests for resolution logic

### Phase 4: Message Generation
- [ ] Create message template system for each intent
- [ ] Implement synthetic assistant responses
- [ ] Ensure proper message ordering and timestamps
- [ ] Add streaming simulation for consistency
- [ ] Test message generation flows

### Phase 5: Integration & Testing
- [ ] Update frontend to use `intent` field instead of `action`
- [ ] Add feature flag for gradual rollout
- [ ] Create end-to-end tests
- [ ] Performance testing (ensure shortcuts are faster)
- [ ] Update documentation

## Testing Strategy

### 1. Unit Tests
- Intent detection logic
- Parameter resolution for each schema type
- Message generation templates
- Individual intent handlers

### 2. Integration Tests
- Full shortcut flow for each intent
- Conversation message creation and ordering
- Tool execution with mocked responses
- Error handling scenarios

### 3. End-to-End Tests
- Frontend button clicks trigger correct intents
- Messages appear in chat UI correctly
- Generated jsondocs are properly created
- Performance comparison vs LLM path

### 4. Test Scenarios
- Happy path for each intent type
- Missing canonical jsondocs
- Invalid metadata parameters
- Concurrent intent executions
- Intent with ongoing conversation context

## TypeScript Typing Strategy

### 1. Zod-First Approach
- **Define all data structures using Zod schemas first**
- **Infer TypeScript types from Zod schemas** using `z.infer<typeof Schema>`
- **Use Zod enums for constants** like intent types

### 2. Schema Definitions
```typescript
import { z } from 'zod';

// Define intent types as Zod enum
export const IntentTypeSchema = z.enum([
    'generate_brainstorm',
    'generate_outline_settings',
    'generate_chronicles',
    'generate_episode_planning',
    'generate_episode_synopsis',
    'generate_episode_script'
]);

// Infer TypeScript type from Zod schema
export type IntentType = z.infer<typeof IntentTypeSchema>;

// Define intent context schema
export const IntentContextSchema = z.object({
    intent: IntentTypeSchema,
    metadata: z.record(z.any()),
    content: z.string(),
    conversationId: z.string(),
    projectId: z.string(),
    userId: z.string()
});

export type IntentContext = z.infer<typeof IntentContextSchema>;

// Define handler parameter schemas
export const IntentHandlerParamsSchema = z.object({
    jsondocs: z.array(z.string()), // Array of jsondoc IDs
    episodeNumber: z.number().optional(),
    userRequirements: z.string().optional()
});

export type IntentHandlerParams = z.infer<typeof IntentHandlerParamsSchema>;
```

### 3. Benefits
- **Runtime validation**: Validate incoming data at API boundaries
- **Type safety**: TypeScript types automatically stay in sync with runtime validation
- **Single source of truth**: Schema defines both validation and types
- **Better error messages**: Zod provides clear validation error messages
- **Composability**: Schemas can be composed and extended easily

### 4. Usage Pattern
```typescript
// In intent handler
class EpisodeScriptIntentHandler implements IntentHandler {
    async resolveParameters(context: IntentContext): Promise<IntentHandlerParams> {
        // Validate context first
        const validatedContext = IntentContextSchema.parse(context);
        
        // Resolve parameters...
        const params = {
            jsondocs: await this.findRequiredJsondocs(validatedContext.projectId),
            episodeNumber: validatedContext.metadata.episodeNumber
        };
        
        // Validate output before returning
        return IntentHandlerParamsSchema.parse(params);
    }
}
```

## Technical Implementation Details

### 1. Intent Detection (ChatService modification)
```typescript
// In sendUserMessage function
if (request.metadata?.intent && IntentShortcutService.supportsIntent(request.metadata.intent)) {
    // Shortcut path
    await intentShortcutService.handleIntent({
        intent: request.metadata.intent,
        metadata: request.metadata,
        content: request.content,
        conversationId,
        projectId,
        userId
    });
} else {
    // Standard LLM path
    await agentService.runGeneralAgent(...);
}
```

### 2. Intent Handler Interface
```typescript
interface IntentHandler {
    intentType: string;
    
    // Resolve parameters from metadata and canonical jsondocs
    resolveParameters(context: IntentContext): Promise<any>;
    
    // Get the tool name to execute
    getToolName(): string;
    
    // Generate assistant messages
    getAssistantMessages(): {
        thinking: string;
        completion: string;
    };
}
```

### 3. Parameter Resolution Algorithm
```typescript
async function findCanonicalJsondocsByType(
    projectId: string,
    schemaType: string,
    additionalFilters?: Record<string, any>
): Promise<JsondocData[]> {
    // 1. Get canonical jsondocs from CanonicalJsondocService
    // 2. Filter by schema_type
    // 3. Apply additional filters if provided
    // 4. Return sorted by creation date (newest first)
}
```

### 4. Message Flow Example (Episode Script Generation)
```
1. User clicks "Generate Episode Script" button
2. Frontend sends: {
     content: "生成第1集剧本",
     metadata: {
       intent: "generate_episode_script",
       episodeNumber: 1
     }
   }
3. IntentShortcutService intercepts
4. Creates messages:
   - User: "生成第1集剧本"
   - Assistant: "🎬 正在为您创作第1集剧本..."
   - Tool Call: generate_单集剧本 with resolved parameters
   - Tool Result: { outputJsondocId: "...", ... }
   - Assistant: "✅ 第1集剧本已生成完成！"
```

## Testing Strategy

### 1. Unit Tests
- Intent detection logic
- Parameter resolution for each schema type
- Message generation templates
- Individual intent handlers

### 2. Integration Tests
- Full shortcut flow for each intent
- Conversation message creation and ordering
- Tool execution with mocked responses
- Error handling scenarios

### 3. End-to-End Tests
- Frontend button clicks trigger correct intents
- Messages appear in chat UI correctly
- Generated jsondocs are properly created
- Performance comparison vs LLM path

### 4. Test Scenarios
- Happy path for each intent type
- Missing canonical jsondocs
- Invalid metadata parameters
- Concurrent intent executions
- Intent with ongoing conversation context

## Success Criteria

1. **Functionality**
   - All generate_ tools have working shortcuts
   - Messages appear identical to LLM-generated ones
   - Tools execute with correct parameters

2. **Performance**
   - Shortcuts execute in < 1 second (vs ~5-10s for LLM)
   - No additional database queries beyond necessary

3. **Quality**
   - 100% test coverage for new code
   - `npm run build` passes
   - `npm test -- --run` passes
   - No regression in existing functionality

4. **Maintainability**
   - Clear documentation for adding new intents
   - Consistent patterns across all handlers
   - Logging for debugging and monitoring

## Migration Plan

1. **Clean Replacement**
   - Remove all references to `action` field from frontend components
   - Replace with new `intent` field in all action buttons
   - No deprecation period - immediate cutover
   - Delete old action-based code paths entirely

2. **Implementation Steps**
   - Update all frontend components in a single PR
   - Replace ChatService logic completely
   - Remove any legacy code that handled `action` field
   - Ensure all tests pass with new implementation

3. **Rollout Strategy**
   - Feature flag: `ENABLE_INTENT_SHORTCUTS` for testing only
   - Once tested, remove feature flag and make it the default
   - No gradual rollout - all intents go live together
   - Monitor for issues but no fallback to old system

## Future Enhancements

1. **Analytics**
   - Track shortcut usage vs LLM usage
   - Measure performance improvements
   - Identify new shortcut opportunities

2. **Advanced Shortcuts**
   - Support for `improve_` intents with edit patterns
   - Batch operations (generate multiple episodes)
   - Conditional logic based on project state

3. **Developer Experience**
   - CLI tool to generate new intent handlers
   - Automated tests for intent registration
   - Visual debugging tools for message flow 