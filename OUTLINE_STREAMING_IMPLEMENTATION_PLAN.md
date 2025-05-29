# Outline Generation Streaming Architecture Migration Plan

## Overview
Migrate the outline generation feature from the current streaming implementation to the new architecture that uses Server-Sent Events (SSE), RxJS observables, and partial UI rendering. This will follow the same pattern established for brainstorming.

## Current State Analysis

### Server-side:
- `OutlineService.ts` has `generateOutlineFromArtifact` and `generateOutlineFromArtifactStream` methods
- Uses `TransformExecutor.executeLLMTransformStream` for streaming
- Creates outline artifacts of type `outline_components`
- Builds a complex prompt for generating outline JSON

### Client-side:
- `OutlineTab.tsx` uses the old `useStreamingLLM` hook
- Streams via `/api/outlines/from-artifact/{id}/stream` endpoint
- Displays streaming content in a monospace preview box
- Navigates to completed outline after generation

## Implementation Plan

### 1. Server-side Changes

#### 1.1 Create Outline Job System
- [x] Add `startOutlineJob` method to `StreamingTransformExecutor`
- [x] Create artifact type `outline_job_params` to store job parameters
- [x] Implement job creation endpoint `/api/outlines/create-job`
- [x] Store source artifact ID, total episodes, and episode duration in job params

#### 1.2 Adapt Streaming Infrastructure
- [x] Add outline template to `TemplateService` if not exists
- [x] Implement outline-specific transform execution in `StreamingTransformExecutor`
- [x] Ensure proper artifact creation for outline components
- [x] Handle the complex JSON structure (title, genre, selling_points, setting, characters, synopsis)

#### 1.3 SSE Endpoints
- [x] Create `/api/streaming/transform/:transformId` endpoint for outline (reuse existing)
- [x] Ensure `JobBroadcaster` and `StreamingCache` work with outline data

### 2. Client-side Changes

#### 2.1 Create Outline Streaming Service
- [x] Create `OutlineStreamingService` extending `LLMStreamingService`
- [x] Implement parsing logic for outline JSON structure
- [x] Handle partial JSON parsing for progressive rendering
- [x] Use `jsonrepair` for robust parsing

#### 2.2 Create React Hook
- [x] Create `useStreamingOutline` hook similar to `useStreamingBrainstorm`
- [x] Integrate with `useLLMStreaming` and RxJS observables
- [x] Support connecting to existing transforms

#### 2.3 Update OutlineTab Component
- [x] Replace `useStreamingLLM` with `useStreamingOutline`
- [x] Implement progressive rendering of outline components
- [x] Show each section (title, genre, etc.) as it becomes available
- [x] Maintain existing UI but with live updates

### 3. Data Flow

1. **Job Creation**: 
   - User clicks "Generate Outline"
   - Client creates job via `/api/outlines/create-job`
   - Receives `transformId` and redirects to `/outlines/new?transform_id=xxx`

2. **Streaming Connection**:
   - Client connects to SSE endpoint with `transformId`
   - Server starts streaming if first client
   - Chunks are batched and sent via SSE

3. **Progressive Rendering**:
   - Client parses partial JSON as it arrives
   - Updates UI sections progressively
   - Completes when all sections are parsed

### 4. Reusable Components

#### From Brainstorming Implementation:
- `StreamingCache` - Store outline results
- `JobBroadcaster` - Manage multiple clients
- `LLMStreamingService` base class - Handle SSE connection
- `useLLMStreaming` hook - Observable management
- Chunk batching logic - Reduce message frequency
- `jsonrepair` integration - Parse partial JSON

#### New Components Needed:
- Outline-specific JSON parser ✓
- Progressive outline component renderer ✓
- Outline artifact type handlers ✓

### 5. Migration Steps

1. **Phase 1**: Server Infrastructure ✓
   - Implement job creation ✓
   - Adapt streaming executor ✓
   - Set up SSE endpoints ✓

2. **Phase 2**: Client Service Layer ✓
   - Create OutlineStreamingService ✓
   - Implement parsing logic ✓
   - Create React hook ✓

3. **Phase 3**: UI Integration ✓
   - Update OutlineTab component ✓
   - Implement progressive rendering ✓
   - Test end-to-end flow

4. **Phase 4**: Cleanup
   - [ ] Remove old streaming code
   - [ ] Update API endpoints
   - [ ] Ensure backward compatibility

### 6. Key Considerations

- **JSON Structure**: Outline has nested structure (setting, characters array) ✓
- **Partial Parsing**: Need to handle incomplete nested objects ✓
- **UI Updates**: Should update each section independently ✓
- **Error Handling**: Gracefully handle parsing failures ✓
- **Performance**: Batch updates to avoid excessive re-renders ✓

### 7. Testing Strategy

1. Test partial JSON parsing with various incomplete states
2. Verify progressive UI updates
3. Test multiple concurrent clients
4. Ensure proper cleanup on disconnection
5. Validate artifact creation and storage

## Success Criteria

- [x] Outline generation uses new SSE-based streaming
- [x] UI updates progressively as content streams
- [x] Multiple clients can connect to same stream
- [x] Robust parsing handles partial JSON
- [x] Performance is improved with batching
- [ ] Old streaming code is removed
- [x] All existing functionality is preserved

## Implementation Summary

The outline generation has been successfully migrated to the new streaming architecture:

1. **Server-side**: Created `OutlineJobParamsV1` type, implemented `startOutlineJob` and `executeOutlineJobWithRetries` methods, added outline template, and integrated with the existing SSE infrastructure.

2. **Client-side**: Created `OutlineStreamingService` with robust partial JSON parsing, `useStreamingOutline` hook, and updated `OutlineTab` to use progressive rendering.

3. **Key improvements**:
   - Outline sections appear as they are generated
   - Robust handling of partial JSON
   - Support for multiple concurrent clients
   - Clean separation of concerns with reusable components
   - Consistent with brainstorming implementation

The old streaming code can be removed in a future cleanup phase. 