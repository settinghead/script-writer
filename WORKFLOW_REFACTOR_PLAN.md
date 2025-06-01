# Script Writer Workflow System Refactor Plan

## Overview

This plan outlines a complete refactoring of the script writer application to implement a flexible, code-based workflow system that unifies all LLM-based generation processes under a single framework. **No backward compatibility is required** - we can delete existing data and start fresh.

## Core Requirements

### UI Functionalities to Preserve
All existing UI capabilities must remain **exactly the same**:
- **Real-time JSON streaming** with RxJS-based architecture
- **SSE (EventSource) streaming** for transform updates
- **Refresh-and-resume** - UI reconnects and continues from current state
- **Progressive UI updates** with multi-column responsive display
- **Streaming progress indicators** with cancellation support
- **Partial JSON parsing** with `jsonrepair` and error recovery
- **Auto-save with debounced updates** for user inputs
- **Think tag removal** and console spinner during AI thinking
- **Transform replay** capabilities for testing

## Core Architecture

### 1. Workflow Definition System

Instead of a rigid DSL, we'll use a TypeScript-based approach that provides flexibility while maintaining type safety:

```typescript
// src/common/workflow/types.ts
export interface WorkflowNode<TInput = any, TOutput = any> {
  id: string;
  type: 'llm' | 'human' | 'compute' | 'branch' | 'merge';
  
  // Execution function
  execute(context: WorkflowContext, inputs: TInput): Promise<TOutput>;
  
  // UI configuration (optional)
  ui?: {
    component?: string;  // Component name to render
    hidden?: boolean;    // Backend-only nodes
    editable?: boolean;  // Allow human editing
  };
  
  // Validation schemas
  inputSchema?: z.ZodSchema<TInput>;
  outputSchema?: z.ZodSchema<TOutput>;
  
  // Execution hints
  execution?: {
    lazy?: boolean;      // Only execute when needed
    parallel?: boolean;  // Can run in parallel with siblings
    retryable?: boolean; // Allow retry on failure
  };
}

// Workflow definition using builder pattern
export class WorkflowBuilder {
  private nodes: Map<string, WorkflowNode> = new Map();
  private edges: Array<{ from: string; to: string; condition?: (ctx: WorkflowContext) => boolean }> = [];
  
  addNode(node: WorkflowNode): this { /* ... */ }
  connect(from: string, to: string, condition?: (ctx: WorkflowContext) => boolean): this { /* ... */ }
  build(): WorkflowDefinition { /* ... */ }
}
```

### 2. Artifact Schema System with Zod

Define all artifact types using Zod for runtime validation and TypeScript type inference:

```typescript
// src/common/schemas/artifacts.ts
import { z } from 'zod';

// Base artifact schema
export const BaseArtifactSchema = z.object({
  id: z.string(),
  type: z.string(),
  version: z.string(),
  userId: z.string(),
  createdAt: z.string().datetime(),
});

// Specific artifact schemas
export const IdeationSessionSchema = BaseArtifactSchema.extend({
  type: z.literal('ideation_session'),
  version: z.literal('v1'),
  data: z.object({
    status: z.enum(['active', 'completed']),
    requirements: z.string().optional(),
  }),
});

export const BrainstormIdeaSchema = BaseArtifactSchema.extend({
  type: z.literal('brainstorm_idea'),
  version: z.literal('v1'),
  data: z.object({
    title: z.string(),
    body: z.string(),
    genre: z.string(),
  }),
});

export const OutlineSchema = BaseArtifactSchema.extend({
  type: z.literal('outline'),
  version: z.literal('v1'),
  data: z.object({
    characters: z.array(CharacterSchema),
    selling_points: z.array(z.string()),
    satisfaction_points: z.array(z.string()),
    synopsis_stages: z.array(z.string()),
  }),
});

export const EpisodeSchema = BaseArtifactSchema.extend({
  type: z.literal('episode'),
  version: z.literal('v1'),
  data: z.object({
    episodeNumber: z.number(),
    title: z.string(),
    content: z.string(),
    wordCount: z.number(),
  }),
});

// User input artifact for human modifications
export const UserInputSchema = BaseArtifactSchema.extend({
  type: z.literal('user_input'),
  version: z.literal('v1'),
  data: z.object({
    originalArtifactId: z.string(),
    modifications: z.record(z.any()), // Field-level modifications
  }),
});

// Union type for all artifacts
export const ArtifactSchema = z.discriminatedUnion('type', [
  IdeationSessionSchema,
  BrainstormIdeaSchema,
  OutlineSchema,
  EpisodeSchema,
  UserInputSchema,
  // ... other artifact types
]);

export type Artifact = z.infer<typeof ArtifactSchema>;
```

### 3. Workflow Node Implementations

```typescript
// src/server/workflow/nodes/LLMNode.ts
export class LLMNode<TInput, TOutput> implements WorkflowNode<TInput, TOutput> {
  constructor(
    public id: string,
    private config: {
      templateId: string;
      inputSchema: z.ZodSchema<TInput>;
      outputSchema: z.ZodSchema<TOutput>;
      extractOutputArtifacts: (response: any) => Artifact[];
      streamingEnabled?: boolean;  // Enable RxJS streaming
    }
  ) {}
  
  async execute(context: WorkflowContext, inputs: TInput): Promise<TOutput> {
    // 1. Validate inputs
    const validatedInputs = this.config.inputSchema.parse(inputs);
    
    // 2. Get template and construct prompt
    const template = await templateService.getTemplate(this.config.templateId);
    const prompt = template.render(validatedInputs);
    
    // 3. Execute LLM transform with streaming support
    if (this.config.streamingEnabled) {
      // Use existing streaming infrastructure
      const { transform, outputArtifacts } = await context.transformExecutor.executeLLMTransformWithStreaming(
        context.userId,
        context.inputArtifacts,
        prompt,
        validatedInputs,
        context.modelName,
        {
          onChunk: (chunk) => {
            // Store chunk in transform_chunks table
            context.eventBroadcaster.broadcastToUser(context.userId, {
              type: 'transform_chunk',
              executionId: context.executionId,
              nodeId: this.id,
              chunk: chunk
            });
          }
        }
      );
      
      // Extract and validate outputs
      const outputs = this.config.extractOutputArtifacts(outputArtifacts);
      return this.config.outputSchema.parse(outputs);
    } else {
      // Non-streaming execution
      const { transform, outputArtifacts } = await context.transformExecutor.executeLLMTransform(
        context.userId,
        context.inputArtifacts,
        prompt,
        validatedInputs,
        context.modelName
      );
      
      const outputs = this.config.extractOutputArtifacts(outputArtifacts);
      return this.config.outputSchema.parse(outputs);
    }
  }
}

// src/server/workflow/nodes/HumanInputNode.ts
export class HumanInputNode<T> implements WorkflowNode<T, T> {
  constructor(
    public id: string,
    private config: {
      fields: string[];  // Which fields are editable
      schema: z.ZodSchema<T>;
      ui: { 
        component: string;
        autoSave?: boolean;  // Enable debounced auto-save
        debounceMs?: number; // Debounce delay
      };
    }
  ) {}
  
  async execute(context: WorkflowContext, inputs: T): Promise<T> {
    // 1. Check if user has already provided input
    const existingUserInput = await context.getExistingUserInput(this.id);
    if (existingUserInput) {
      return this.mergeUserInput(inputs, existingUserInput);
    }
    
    // 2. Signal UI to collect input with auto-save configuration
    await context.requestUserInput(this.id, inputs, {
      ...this.config,
      autoSave: this.config.ui.autoSave ?? true,
      debounceMs: this.config.ui.debounceMs ?? 1000
    });
    
    // 3. Wait for user input (this pauses workflow)
    const userInput = await context.waitForUserInput(this.id);
    
    // 4. Create user_input artifact if modifications were made (first time only)
    if (this.hasModifications(inputs, userInput) && !existingUserInput) {
      await this.createUserInputArtifact(context, inputs, userInput);
    }
    
    return userInput;
  }
  
  private async createUserInputArtifact(
    context: WorkflowContext, 
    original: T, 
    modified: T
  ): Promise<void> {
    // Create human transform
    const humanTransform = await context.transformExecutor.executeHumanTransform(
      context.userId,
      [context.getArtifactForData(original)],
      'user_edit',
      {
        nodeId: this.id,
        executionId: context.executionId,
        modifications: this.getModifications(original, modified)
      }
    );
    
    // Create user_input artifact
    await context.artifactRepo.createArtifact(
      context.userId,
      'user_input',
      {
        originalArtifactId: context.getArtifactForData(original).id,
        modifications: this.getModifications(original, modified)
      } as UserInputV1
    );
  }
}

// src/server/workflow/nodes/ComputeNode.ts
export class ComputeNode<TInput, TOutput> implements WorkflowNode<TInput, TOutput> {
  constructor(
    public id: string,
    private computeFn: (inputs: TInput) => Promise<TOutput>,
    private config?: { lazy?: boolean; hidden?: boolean }
  ) {}
  
  async execute(context: WorkflowContext, inputs: TInput): Promise<TOutput> {
    return await this.computeFn(inputs);
  }
}
```

### 4. Workflow Examples

#### Brainstorming Workflow
```typescript
// src/server/workflow/definitions/brainstorming.ts
export function createBrainstormingWorkflow() {
  return new WorkflowBuilder()
    .addNode(new HumanInputNode('collect_requirements', {
      fields: ['genre', 'platform', 'requirements'],
      schema: BrainstormRequirementsSchema,
      ui: { component: 'BrainstormRequirementsForm' }
    }))
    .addNode(new LLMNode('generate_ideas', {
      templateId: 'brainstorming',
      inputSchema: BrainstormRequirementsSchema,
      outputSchema: z.array(BrainstormIdeaSchema),
      extractOutputArtifacts: (response) => response.ideas
    }))
    .addNode(new HumanInputNode('select_idea', {
      fields: ['selectedIdea'],
      schema: z.object({ 
        ideas: z.array(BrainstormIdeaSchema),
        selectedIdea: z.string() 
      }),
      ui: { component: 'IdeaSelector' }
    }))
    .connect('collect_requirements', 'generate_ideas')
    .connect('generate_ideas', 'select_idea')
    .build();
}
```

#### Episode Generation Workflow
```typescript
// src/server/workflow/definitions/episode.ts
export function createEpisodeWorkflow(episodeNumber: number) {
  return new WorkflowBuilder()
    // Hidden node: summarize previous episodes
    .addNode(new ComputeNode('summarize_previous', 
      async (inputs: { previousEpisodes: Episode[] }) => {
        if (inputs.previousEpisodes.length === 0) return null;
        
        // Use LLM to summarize
        return await summarizeEpisodes(inputs.previousEpisodes);
      },
      { lazy: true, hidden: true }
    ))
    
    // Collect all inputs for episode generation
    .addNode(new ComputeNode('prepare_context',
      async (inputs: any) => ({
        outline: inputs.outline,
        characters: inputs.characters,
        requirements: inputs.requirements,
        previousSummary: inputs.previousSummary,
        episodeNumber
      })
    ))
    
    // Allow user to edit/confirm inputs
    .addNode(new HumanInputNode('edit_context', {
      fields: ['characters', 'episodeSpecificRequirements'],
      schema: EpisodeContextSchema,
      ui: { component: 'EpisodeContextEditor' }
    }))
    
    // Generate episode
    .addNode(new LLMNode('generate_episode', {
      templateId: 'episode_generation',
      inputSchema: EpisodeContextSchema,
      outputSchema: EpisodeSchema,
      extractOutputArtifacts: (response) => [response.episode]
    }))
    
    // Edit generated episode
    .addNode(new HumanInputNode('edit_episode', {
      fields: ['content', 'title'],
      schema: EpisodeSchema,
      ui: { component: 'EpisodeEditor' }
    }))
    
    .connect('summarize_previous', 'prepare_context')
    .connect('prepare_context', 'edit_context')
    .connect('edit_context', 'generate_episode')
    .connect('generate_episode', 'edit_episode')
    .build();
}
```

### 5. Workflow Execution Engine with Streaming Support

```typescript
// src/server/workflow/WorkflowExecutor.ts
export class WorkflowExecutor {
  constructor(
    private artifactRepo: ArtifactRepository,
    private transformExecutor: TransformExecutor,
    private eventBroadcaster: EventBroadcaster,
    private unifiedStreamingService: UnifiedStreamingService
  ) {}
  
  async executeWorkflow(
    userId: string,
    workflowDef: WorkflowDefinition,
    initialInputs: Record<string, any>,
    executionId?: string  // Support resume from existing execution
  ): Promise<WorkflowExecution> {
    // Support refresh-and-resume
    const execution = executionId 
      ? await this.resumeExecution(userId, executionId)
      : await this.createExecution(userId, workflowDef.id);
      
    const context = this.createContext(userId, execution);
    
    try {
      // Execute nodes in topological order
      const sortedNodes = this.topologicalSort(workflowDef);
      
      // Find starting point for resume
      const startIndex = execution.currentNode 
        ? sortedNodes.findIndex(n => n.id === execution.currentNode) + 1
        : 0;
      
      for (let i = startIndex; i < sortedNodes.length; i++) {
        const node = sortedNodes[i];
        
        // Update current node for resume support
        await this.updateExecutionCurrentNode(execution.id, node.id);
        
        // Check if node should be executed
        if (await this.shouldExecuteNode(node, context)) {
          // Get inputs from previous nodes
          const inputs = await this.gatherNodeInputs(node, context);
          
          // Broadcast node start
          this.eventBroadcaster.broadcastToUser(userId, {
            type: 'workflow_node_start',
            executionId: execution.id,
            nodeId: node.id
          });
          
          // Execute node
          const outputs = await node.execute(context, inputs);
          
          // Store outputs
          await this.storeNodeOutputs(node, outputs, context);
          
          // Broadcast progress
          this.eventBroadcaster.broadcastToUser(userId, {
            type: 'workflow_progress',
            executionId: execution.id,
            nodeId: node.id,
            status: 'completed',
            progress: ((i + 1) / sortedNodes.length) * 100
          });
        }
      }
      
      // Mark execution as completed
      await this.completeExecution(execution.id);
      
      return execution;
    } catch (error) {
      await this.handleExecutionError(execution, error);
      throw error;
    }
  }
  
  private async shouldExecuteNode(node: WorkflowNode, context: WorkflowContext): Promise<boolean> {
    // Skip lazy nodes unless their outputs are needed
    if (node.execution?.lazy) {
      return await this.isNodeOutputNeeded(node, context);
    }
    
    // Check conditional edges
    const incomingEdges = context.workflow.getIncomingEdges(node.id);
    for (const edge of incomingEdges) {
      if (edge.condition && !edge.condition(context)) {
        return false;
      }
    }
    
    return true;
  }
}
```

### 6. UI Integration with Preserved Functionality

```typescript
// src/client/hooks/useWorkflow.ts
export function useWorkflow(workflowId: string, executionId?: string) {
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [currentNode, setCurrentNode] = useState<string | null>(null);
  const [nodeStates, setNodeStates] = useState<Record<string, any>>({});
  const [streamingStates, setStreamingStates] = useState<Record<string, StreamingState>>({});
  
  // Auto-reconnect SSE on mount/refresh
  useEffect(() => {
    const eventSource = new EventSource(
      `/api/workflow/execution/${executionId || 'new'}/events?workflowId=${workflowId}`
    );
    
    // Handle various event types
    eventSource.addEventListener('workflow_progress', (event) => {
      const data = JSON.parse(event.data);
      setCurrentNode(data.nodeId);
      // Update UI based on progress
    });
    
    eventSource.addEventListener('user_input_required', (event) => {
      const data = JSON.parse(event.data);
      setCurrentNode(data.nodeId);
      setNodeStates(prev => ({
        ...prev,
        [data.nodeId]: data.initialData
      }));
    });
    
    // Handle streaming chunks for RxJS integration
    eventSource.addEventListener('transform_chunk', (event) => {
      const data = JSON.parse(event.data);
      setStreamingStates(prev => ({
        ...prev,
        [data.nodeId]: {
          ...prev[data.nodeId],
          chunks: [...(prev[data.nodeId]?.chunks || []), data.chunk],
          status: 'streaming'
        }
      }));
    });
    
    // Resume from execution state on reconnect
    eventSource.addEventListener('execution_state', (event) => {
      const data = JSON.parse(event.data);
      setExecution(data.execution);
      setCurrentNode(data.currentNode);
      setNodeStates(data.nodeStates);
      setStreamingStates(data.streamingStates);
    });
    
    return () => eventSource.close();
  }, [executionId, workflowId]);
  
  // Auto-save with debouncing for user inputs
  const updateUserInput = useMemo(() => 
    debounce(async (nodeId: string, input: any) => {
      await fetch(`/api/workflow/execution/${execution?.id}/input/${nodeId}`, {
        method: 'PUT',  // Use PUT for updates
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
    }, 1000),
    [execution?.id]
  );
  
  const submitUserInput = async (nodeId: string, input: any) => {
    // Immediate update for UI responsiveness
    setNodeStates(prev => ({ ...prev, [nodeId]: input }));
    
    // Final submission
    await fetch(`/api/workflow/execution/${execution?.id}/input/${nodeId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
  };
  
  const cancelStreaming = async (nodeId: string) => {
    // Use existing cancel endpoint
    const transformId = streamingStates[nodeId]?.transformId;
    if (transformId) {
      await fetch(`/api/streaming/cancel/${transformId}`, { method: 'POST' });
    }
  };
  
  return {
    execution,
    currentNode,
    nodeStates,
    streamingStates,
    updateUserInput,
    submitUserInput,
    cancelStreaming
  };
}

// src/client/components/WorkflowRenderer.tsx
export function WorkflowRenderer({ workflowId, executionId }: Props) {
  const { 
    execution, 
    currentNode, 
    nodeStates, 
    streamingStates,
    updateUserInput,
    submitUserInput,
    cancelStreaming
  } = useWorkflow(workflowId, executionId);
  
  if (!currentNode) return <div>Loading workflow...</div>;
  
  // Get current node configuration
  const nodeConfig = execution?.workflow.nodes[currentNode];
  
  // Hidden nodes show processing state
  if (nodeConfig?.ui?.hidden) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spin size="large" />
        <span className="ml-4">Processing...</span>
      </div>
    );
  }
  
  // Get component for node
  const Component = getComponentForNode(nodeConfig);
  const streamingState = streamingStates[currentNode];
  
  return (
    <Component
      data={nodeStates[currentNode]}
      streamingState={streamingState}
      onUpdate={(data) => updateUserInput(currentNode, data)}  // Auto-save
      onSubmit={(data) => submitUserInput(currentNode, data)}  // Final submit
      onCancelStreaming={() => cancelStreaming(currentNode)}
    />
  );
}

// Example component with streaming support
export function IdeaGeneratorComponent({ 
  data, 
  streamingState, 
  onUpdate, 
  onSubmit,
  onCancelStreaming 
}: ComponentProps) {
  // Use existing RxJS streaming hooks
  const { items, status, error } = useStreamingItems(streamingState);
  
  return (
    <div>
      {/* Progressive multi-column display */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, index) => (
          <IdeaCard key={index} idea={item} />
        ))}
      </div>
      
      {/* Streaming progress indicator */}
      {status === 'streaming' && (
        <div className="mt-4">
          <Progress percent={streamingState.progress} />
          <Button onClick={onCancelStreaming}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
```

### 7. Database Schema

```sql
-- Drop all existing tables (no backward compatibility needed)
DROP TABLE IF EXISTS workflow_user_inputs;
DROP TABLE IF EXISTS workflow_node_results;
DROP TABLE IF EXISTS workflow_executions;

-- Create new workflow tables
CREATE TABLE workflow_executions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  status TEXT DEFAULT 'running', -- running, completed, failed, paused
  current_node TEXT,
  state TEXT, -- JSON state of the execution
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE workflow_node_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, running, streaming, completed, failed, skipped
  inputs TEXT, -- JSON inputs
  outputs TEXT, -- JSON outputs
  streaming_transform_id TEXT, -- Link to transform for streaming nodes
  error TEXT,
  started_at DATETIME,
  completed_at DATETIME,
  FOREIGN KEY (execution_id) REFERENCES workflow_executions (id) ON DELETE CASCADE
);

CREATE TABLE workflow_user_inputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  input_data TEXT NOT NULL, -- JSON
  version INTEGER DEFAULT 1, -- Track multiple saves
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (execution_id) REFERENCES workflow_executions (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id),
  UNIQUE(execution_id, node_id, version)
);

-- Keep existing artifacts/transforms tables as-is for traceability
```

## Implementation Phases

### Phase 1: Core Infrastructure (3 days)
1. **Implement workflow types and schemas**
   - WorkflowNode interface with streaming support
   - Zod schemas for all artifacts
   - WorkflowBuilder with full functionality

2. **Create execution engine**
   - Resume support for refresh
   - SSE event broadcasting
   - Node state management

3. **Database migration**
   - Drop old tables
   - Create new workflow tables
   - Seed test data

### Phase 2: Node Implementations (3 days)
1. **Core nodes with existing features**
   - LLMNode with RxJS streaming
   - HumanInputNode with auto-save
   - ComputeNode with lazy evaluation

2. **Streaming integration**
   - Connect to UnifiedStreamingService
   - Use transform_chunks table
   - Preserve think tag removal

3. **UI state persistence**
   - Save/restore node states
   - Handle reconnection
   - Progress tracking

### Phase 3: Refactor Features (4 days)
1. **Brainstorming workflow**
   - Convert to workflow definition
   - Preserve RxJS streaming
   - Multi-column responsive UI

2. **Outline generation workflow**
   - Human editing with auto-save
   - Progressive field updates
   - Character type normalization

3. **Episode generation workflow**
   - Hidden summarization nodes
   - Context editing
   - Streaming episode generation

### Phase 4: UI Components (3 days)
1. **Generic workflow renderer**
   - Dynamic component loading
   - Streaming state management
   - Progress visualization

2. **Preserve existing UI features**
   - Partial JSON parsing
   - Error recovery
   - Smooth animations

3. **Debug tools**
   - Workflow visualization
   - Transform replay integration
   - Performance monitoring

### Phase 5: Testing & Polish (2 days)
1. **End-to-end testing**
   - Full workflow execution
   - Refresh and resume
   - Streaming cancellation

2. **Performance optimization**
   - Lazy node evaluation
   - Efficient state updates
   - Database query optimization

## Key Technical Decisions

### Streaming Architecture
- **Keep RxJS** for client-side streaming logic
- **Use SSE** for server-to-client workflow events
- **Leverage transform_chunks** table for persistence
- **Maintain UnifiedStreamingService** for consistency

### State Management
- **Database-first** approach for all state
- **Auto-reconnect** on page refresh
- **Debounced saves** for user inputs
- **Progressive updates** for streaming content

### UI Preservation
- **Component reuse** - Keep existing React components
- **Hook compatibility** - Wrap existing hooks with workflow context
- **Feature parity** - All current features must work identically

## Benefits of This Approach

1. **Clean Architecture**: No legacy code to maintain
2. **Unified System**: All features use the same workflow engine
3. **Better Traceability**: Every step is tracked in the workflow
4. **Improved UX**: Consistent behavior across all features
5. **Developer Experience**: Easier to add new workflows
6. **Performance**: Optimized for streaming and real-time updates

This refactoring creates a more maintainable and extensible system while preserving all existing UI functionality that users rely on. 