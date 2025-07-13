# Template System & Debugger Refactor Plan

## 1. Overview

This document outlines the comprehensive refactor of the Transform Jsondoc Framework's **Tool Execution Prompt** system. The goal is to eliminate manual coordination, reduce boilerplate, and improve developer experience through intelligent automation and an integrated debugging facility.

### 1.1. Scope and Distinction

This refactor **exclusively targets the Tool Execution Prompt system** (managed by `TemplateService` and used by individual tools). It does **not** alter the **Agent Rationale Prompt** system (managed by `prepareAgentPromptContext` and used by `AgentService` to select tools).

## 2. Current Pain Points

- **Manual Coordination**: Adding a single parameter requires changing 7+ files.
- **Boilerplate**: Each tool requires a custom `prepareTemplateVariables` function.
- **Poor DX**: Templates use unreadable `JSON.stringify` output and hardcoded variable names.
- **Disconnected Schemas**: Schema changes do not automatically propagate to templates, and valuable metadata like `.describe()` is unused.
- **No Debugging**: There is no way to inspect the final prompt a tool will use before execution.

## 3. Design Principles

- **Schema-Driven Automation**: Templates must adapt to schema changes automatically.
- **Human-Readable Templates**: Use YAML and schema descriptions for clarity.
- **Intelligent Defaults**: Automate template variable preparation.
- **Enhanced Debugging**: Provide comprehensive tooling to inspect and debug tool prompts.
- **Zero Manual Coordination**: Eliminate the need for multi-file changes for a single new field.

## 4. Technical Design

### 4.1. Enhanced Schema & Types

Tool input schemas will be standardized to accept a `jsondocs` array, replacing disparate `sourceJsondocId` fields.

```typescript
// src/common/schemas/common.ts (NEW FILE)
import { z } from 'zod';
import { TypedJsondoc }s from '../types';

export const JsondocReferenceSchema = z.object({
  jsondocId: z.string(),
  description: z.string().describe("The description for this jsondoc's role in the prompt."),
  schemaType: z.custom<TypedJsondoc['schema_type']>()
});

export type JsondocReference = z.infer<typeof JsondocReferenceSchema>;

// src/common/transform_schemas.ts (UPDATED)
export const IdeationInputSchema = z.object({
  jsondocs: z.array(JsondocReferenceSchema).min(1),
  otherRequirements: z.string().describe('其他要求: 如故事类型、内容、故事风格等')
});
```

### 4.2. Intelligent TemplateVariableService

A new service will replace all `prepareTemplateVariables` functions. It will automatically construct human-readable YAML for template injection.

```typescript
// src/server/services/TemplateVariableService.ts (NEW FILE)
import { dump } from 'js-yaml';

class TemplateVariableService {
  prepareTemplateVariables(input: any, inputSchema: ZodSchema, executionContext: any): Record<string, string> {
    const params = this.extractParams(input);
    const jsondocRefs = input.jsondocs || [];

    return {
      params: this.formatParamsAsYAML(params, inputSchema),
      jsondocs: this.formatJsondocsAsYAML(jsondocRefs, executionContext)
    };
  }

  private formatParamsAsYAML(params: any, schema: ZodSchema): string {
    // 1. Parse schema to get field descriptions/titles
    // 2. Create a human-readable object with titles as keys
    // 3. Convert to YAML string
  }

  private formatJsondocsAsYAML(jsondocRefs: JsondocReference[], executionContext: any): string {
    // 1. For each ref, fetch the full jsondoc
    // 2. Handle special logic (e.g., 'patch' mode extraction from executionContext)
    // 3. Create a map where keys are ref.description and values are jsondoc.data
    // 4. Convert to YAML string
  }
}
```

### 4.3. Simplified Template Structure

Templates will be simplified to use two generic variables: `%%params%%` and `%%jsondocs%%`.

```typescript
// Example: src/server/services/templates/brainstorming.ts
export const brainstormingTemplate: EnhancedLLMTemplate = {
  id: 'brainstorming',
  name: 'Story Brainstorming',
  promptTemplate: `
你是一位专门从事中国社交媒体平台短视频内容的创意总监。

### 参数信息
%%params%%

### 参考内容
%%jsondocs%%

请根据以上信息生成故事创意...
  `,
  outputFormat: 'json_array',
  // No more 'variables' array
};
```

### 4.4. Centralized ToolRegistry

A new registry will manage all tool definitions, making them available to both the agent and the new debug facility.

```typescript
// src/server/services/ToolRegistry.ts (NEW FILE)
class ToolRegistry {
  private tools = new Map<string, StreamingToolDefinition>();

  register(tool: StreamingToolDefinition) { /* ... */ }
  get(name: string): StreamingToolDefinition | undefined { /* ... */ }
  getAll(): StreamingToolDefinition[] { /* ... */ }
}

// src/server/transform-jsondoc-framework/AgentService.ts (UPDATED)
// The AgentService will be initialized with the ToolRegistry
// and retrieve tools from it instead of creating them on-the-fly.
```

### 4.5. Tool Debug Facility

A new debug tab and backend endpoint to inspect tool-specific prompts.

```typescript
// Backend Endpoint: POST /api/admin/tool-debug
// Request Body:
{
  "projectId": "...",
  "toolName": "generate_brainstorm_ideas",
  "jsondocReferences": [{ "jsondocId": "...", "description": "...", "schemaType": "..." }],
  "additionalParams": { "otherRequirements": "some user input" }
}
// Response Body:
{ "prompt": "The fully rendered prompt string" }

// Frontend: RawAgentContext.tsx (UPDATED)
// - Adds a new "工具调试" tab.
// - Fetches tools from `/api/admin/tools`.
// - Provides UI to select a tool, compatible jsondocs, and enter additional params.
// - Displays the final prompt returned from the debug endpoint.
```

## 5. Implementation Plan

### Phase 1: Core Infrastructure ✅ TODO
- [ ] Create `TemplateVariableService.ts` with placeholder methods.
- [ ] Create `SchemaDescriptionParser.ts` to extract titles from Zod descriptions.
- [ ] Create `common/schemas/common.ts` for `JsondocReferenceSchema`.
- [ ] Implement YAML formatting utility.
- [ ] Create `ToolRegistry.ts`.

### Phase 2: Schema Migration ✅ TODO
- [ ] Update input schemas in `transform_schemas.ts` and `outlineSchemas.ts` to use `JsondocReferenceSchema`.
- [ ] Remove all `sourceJsondocId` fields and replace with a `jsondocs` array.

### Phase 3: Template & Tool Refactoring ✅ TODO
- [ ] Update `TemplateService.ts` to use `TemplateVariableService`.
- [ ] Refactor all templates in `src/server/services/templates/` to use `%%params%%` and `%%jsondocs%%`.
- [ ] Refactor tool definitions in `src/server/tools/` to remove `prepareTemplateVariables` and rely on the new system. Encapsulate data extraction logic inside the new `TemplateVariableService`.

### Phase 4: AgentService Integration ✅ TODO
- [ ] Instantiate `ToolRegistry` and register all tools at application startup.
- [ ] Inject `ToolRegistry` into `AgentService`.
- [ ] Modify `AgentService` to retrieve tools from the registry.

### Phase 5: Debug Facility Backend ✅ TODO
- [ ] Create `/api/admin/tools` endpoint to return all registered tools.
- [ ] Create `/api/admin/tool-debug` endpoint to construct and return a tool's prompt.

### Phase 6: Debug Facility UI ✅ TODO
- [ ] Add "工具调试" tab to `RawAgentContext.tsx`.
- [ ] Implement UI for tool selection, jsondoc selection (with schema type filtering), and inputting additional parameters.
- [ ] Call the debug endpoint and display the resulting prompt, with debouncing.

### Phase 7: Testing & Validation ✅ TODO
- [ ] **Update all affected unit and integration tests** (e.g., `BrainstormTool.test.ts`) to use the new input schemas and reflect the refactor. **Ensure `npm test -- --run` passes.**
- [ ] Add new tests for `TemplateVariableService`, `SchemaDescriptionParser`, and `ToolRegistry`.
- [ ] Add tests for the new debug API endpoints.
- [ ] Perform end-to-end testing of all major user workflows.

### Phase 8: Documentation & Cleanup ✅ TODO
- [ ] Update `TRANSFORM_JSONDOC_FRAMEWORK.md` and `README.md`.
- [ ] Remove all deprecated code, including old `prepareTemplateVariables` functions.
- [ ] Add documentation for the new debug facility.

## 6. Quality Assurance & Success Metrics

### 6.1. QA Checklist
- [ ] **Functionality**: All tools produce correct outputs with the new template system.
- [ ] **Debugging**: The debug UI accurately displays tool prompts.
- [ ] **Schema Propagation**: Adding a new field to an input schema makes it available in `%%params%%` without further changes.
- [ ] **Tests**: All tests pass.
- [ ] **Performance**: YAML generation and API response times are acceptable.

### 6.2. Success Metrics
- **Before**: Adding a parameter takes changes in 7+ files.
- [ ] **After**: Adding a parameter takes changes in **1 file** (the Zod schema).
- [ ] **Before**: No tool-specific prompt debugging exists.
- [ ] **After**: A fully functional, interactive tool prompt debugger is available.
- [ ] **Before**: `prepareTemplateVariables` functions contain ~20-50 lines of custom logic per tool.
- [ ] **After**: This logic is centralized in one service, and tools have **0 lines** of custom preparation code. 