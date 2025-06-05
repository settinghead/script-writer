# Reasoning Mode Implementation Plan

## Overview
Add real-time reasoning indicators to all LLM generation streams (brainstorming, outline, synopsis, script) when reasoning-capable models are detected. Show indicators immediately when reasoning is detected, with no artificial delays.

## Backend Implementation

### 1. LLM Service Enhancement (`src/server/services/LlmService.ts`)

**Reasoning Model Detection:**
- Add `isReasoningModel()` function to detect models that support reasoning
- Known reasoning models: `deepseek-r1`, `deepseek-r1-distill`, any model with "r1" in name
- Return reasoning capability in model metadata

**AI SDK Integration:**
- Integrate `extractReasoningMiddleware` for reasoning models
- Wrap reasoning models with middleware automatically
- Extract reasoning tokens separately from main content

**SSE Event Enhancement:**
- Add new event types: `reasoning_start`, `reasoning_end`
- Include reasoning phase context (`brainstorming`, `outline`, `synopsis`, `script`)
- Emit reasoning events immediately when reasoning begins/ends

### 2. Streaming Service Updates

**UnifiedStreamingService (`src/server/services/streaming/UnifiedStreamingService.ts`):**
- Add reasoning event handling to existing SSE infrastructure
- Extend streaming protocols to include reasoning events
- Maintain backward compatibility with existing streaming

**Event Types Addition:**
```typescript
type ReasoningEvent = {
  type: 'reasoning_start' | 'reasoning_end';
  phase: 'brainstorming' | 'outline' | 'synopsis' | 'script';
  timestamp: number;
}
```

### 3. Template Service Integration

**Templates Service (`src/server/services/templates/`):**
- Detect reasoning models in template rendering pipeline
- Configure reasoning middleware for applicable models
- Pass reasoning events through to streaming layer

## Frontend Implementation

### 1. Reasoning State Management

**Enhanced Streaming Hooks:**
- Update `useStreamingData` to handle reasoning events
- Add reasoning state to existing streaming state management
- Maintain compatibility with current streaming behavior

**New Reasoning Hook:**
```typescript
interface ReasoningState {
  isReasoning: boolean;
  phase?: 'brainstorming' | 'outline' | 'synopsis' | 'script';
  startTime?: number;
}
```

### 2. Reasoning Indicator Component

**ReasoningIndicator (`src/client/components/shared/ReasoningIndicator.tsx`):**
- Animated thinking indicator with pulsing brain/lightbulb icon
- Phase-specific contextual messages
- Smooth fade in/out transitions
- Dark theme compatible styling

**Contextual Messages by Phase:**
- Brainstorming: "Exploring creative possibilities..."
- Outline: "Structuring your story..."
- Synopsis: "Weaving narrative threads..."
- Script: "Bringing characters to life..."

### 3. UI Integration Points

**Brainstorming View:**
- Overlay reasoning indicator on streaming section
- Position above the streaming content area
- Maintain existing streaming UI behavior

**Outline Generation:**
- Integrate with existing outline streaming components
- Show reasoning during initial outline generation
- Preserve accordion and editing functionality

**Synopsis Generation:**
- Add to synopsis streaming display
- Maintain synopsis staging visualization

**Script Generation:**
- Overlay on script streaming interface
- Preserve script formatting and display

### 4. Streaming Component Updates

**Enhanced Event Handling:**
- Update all streaming components to listen for reasoning events
- Add reasoning state to component state management
- Trigger reasoning indicator show/hide based on events

**Animation Coordination:**
- Smooth transitions between reasoning and content states
- Ensure reasoning indicator doesn't interfere with content streaming
- Maintain responsive design across all screen sizes

## Implementation Order

### Phase 1: Backend Foundation
1. Add reasoning model detection to LLM service
2. Integrate AI SDK reasoning middleware
3. Add reasoning events to SSE infrastructure
4. Update streaming services to emit reasoning events

### Phase 2: Frontend Core
1. Create ReasoningIndicator component
2. Enhance streaming hooks with reasoning state
3. Add reasoning event handling to streaming pipeline

### Phase 3: UI Integration
1. Integrate reasoning indicators into brainstorming view
2. Add to outline generation interface
3. Integrate with synopsis generation
4. Add to script generation interface

### Phase 4: Testing & Polish
1. Test with reasoning models (deepseek-r1)
2. Verify non-reasoning models remain unchanged
3. Test all generation types with reasoning indicators
4. Polish animations and transitions

## Technical Considerations

**Backward Compatibility:**
- Non-reasoning models continue to work exactly as before
- No changes to existing streaming behavior for standard models
- All current UI features preserved (SSE streaming, refresh-and-resume)

**Performance:**
- Reasoning detection happens once per model initialization
- Minimal overhead for non-reasoning models
- Efficient event handling in streaming pipeline

**Error Handling:**
- Graceful fallback if reasoning detection fails
- Handle reasoning events that arrive out of order
- Timeout handling for stuck reasoning states

**Dark Theme Compliance:**
- All new UI components follow existing dark theme
- Consistent styling with current application design
- Smooth animations that don't disrupt user experience

## Files to Modify

### Backend
- `src/server/services/LlmService.ts`
- `src/server/services/streaming/UnifiedStreamingService.ts`
- `src/server/services/templates/` (template files)
- `src/common/streaming/` (shared types)

### Frontend
- `src/client/components/shared/ReasoningIndicator.tsx` (new)
- `src/client/hooks/` (streaming hooks)
- `src/client/services/streaming/` (streaming services)
- Brainstorming, outline, synopsis, script generation components
- `src/client/types/` (streaming types)

## Success Criteria

1. **Immediate Reasoning Detection:** Reasoning indicators appear instantly when reasoning models start thinking
2. **Contextual Messaging:** Different messages for different generation phases
3. **Seamless Integration:** No disruption to existing streaming functionality
4. **Model Agnostic:** Automatic detection works for any reasoning model
5. **Performance:** No impact on non-reasoning model performance
6. **Visual Polish:** Smooth animations and dark theme compliance 