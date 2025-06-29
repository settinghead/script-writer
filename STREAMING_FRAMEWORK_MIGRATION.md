# Streaming Framework Migration Plan

## Overview
Refactor the current streaming tools (BrainstormTool, BrainstormEditTool, OutlineTool) to use a unified, simplified streaming framework that eliminates boilerplate code and provides consistent behavior across all tools.

## Core Design Principles
1. **Universal JSON Handling** - No distinction between collections, objects, or nested structures
2. **Magic Artifact Upserting** - Framework handles all artifact updates automatically
3. **Minimal Tool Configuration** - Tools only provide business logic (template variables)
4. **Consistent Error Handling** - Single retry, graceful failures
5. **Template Service Integration** - Leverage existing template system

## Implementation Plan

### Phase 1: Create Core Streaming Framework ✅
- [x] Create `src/server/services/StreamingTransformExecutor.ts`
  - [x] Define `StreamingTransformConfig` interface
  - [x] Implement `executeStreamingTransform` function
  - [x] Universal JSON artifact update logic
  - [x] Template service integration
  - [x] Error handling with single retry
  - [x] LLM streaming integration
  - [x] Transform lifecycle management

### Phase 2: Migrate BrainstormTool ✅
- [x] Rewrite `createBrainstormToolDefinition` using new framework
- [x] Update brainstorming template integration
- [x] Remove old `executeStreamingIdeationTransform` function
- [x] Remove `src/server/transforms/ideation-stream.ts`
- [ ] Test brainstorm generation functionality
- [ ] Verify Electric SQL real-time updates work

### Phase 3: Migrate BrainstormEditTool ✅
- [x] Add streaming support to brainstorm editing
- [x] Rewrite `createBrainstormEditToolDefinition` using new framework
- [x] Implement streaming for single idea edits
- [x] Remove old non-streaming edit logic
- [ ] Test edit functionality with streaming updates
- [ ] Verify lineage tracking works with streaming

### Phase 4: Migrate OutlineTool ✅
- [x] Rewrite `createOutlineToolDefinition` using new framework
- [x] Add streaming support to outline generation
- [x] Replace manual LLM calls with streaming framework
- [ ] Test outline generation with progressive updates
- [ ] Remove legacy outline generation code
- [ ] Verify complex object streaming works

### Phase 5: Cleanup & Testing ⏳
- [x] Write comprehensive test script for all three tools
- [ ] Remove all legacy streaming code
- [ ] Update tests to use new framework
- [ ] Verify all three tools work correctly
- [ ] Performance testing of streaming updates
- [ ] Documentation updates

## Technical Specifications

### Core Framework Interface
```typescript
interface StreamingTransformConfig<TInput, TOutput> {
  templateName: string;  // 'brainstorming', 'brainstorm_edit', 'outline'
  inputSchema: ZodSchema<TInput>;
  outputSchema: ZodSchema<TOutput>;
  prepareTemplateVariables: (input: TInput, context?: any) => Record<string, string>;
}

async function executeStreamingTransform<TInput, TOutput>({
  config,
  input,
  projectId,
  userId,
  transformRepo,
  artifactRepo,
  outputArtifactType,
  transformMetadata
}): Promise<{ outputArtifactId: string; finishReason: string }>
```

### Tool Definition Pattern
```typescript
export function createToolDefinition(...deps) {
  const config: StreamingTransformConfig<InputType, OutputType> = {
    templateName: 'template_name',
    inputSchema: InputSchema,
    outputSchema: OutputSchema,
    prepareTemplateVariables: (input) => ({ /* template vars */ })
  };

  return {
    name: 'tool_name',
    description: 'tool description',
    execute: async (params) => {
      return await executeStreamingTransform({
        config,
        input: params,
        outputArtifactType: 'artifact_type',
        transformMetadata: { toolName: 'tool_name' },
        ...deps
      });
    }
  };
}
```

### Framework Responsibilities
1. **Input Validation** against Zod schemas
2. **Template Rendering** via TemplateService
3. **Transform Lifecycle** creation, tracking, completion
4. **Artifact Management** creation, streaming updates, finalization
5. **LLM Integration** streaming calls with schema validation
6. **Error Handling** single retry, graceful degradation
7. **Progress Tracking** automatic status updates

## Expected Benefits
- **90% reduction** in tool boilerplate code
- **Consistent behavior** across all streaming tools
- **Centralized error handling** and retry logic
- **Universal JSON handling** for all artifact types
- **Easier maintenance** and bug fixes
- **Simplified tool creation** for future tools

## Files to Create
- `src/server/services/StreamingTransformExecutor.ts` - Core framework

## Files to Modify
- `src/server/tools/BrainstormTool.ts` - Simplified using framework
- `src/server/tools/OutlineTool.ts` - Add streaming support

## Files to Remove
- `src/server/transforms/ideation-stream.ts` - Replaced by framework
- Legacy non-streaming code in tool files

## Testing Strategy
- Unit tests for core framework
- Integration tests for each migrated tool
- End-to-end tests for streaming functionality
- Performance tests for artifact update frequency
- Electric SQL synchronization verification

---

## Progress Tracking
- ⏳ = In Progress
- ✅ = Completed
- ❌ = Failed/Blocked 