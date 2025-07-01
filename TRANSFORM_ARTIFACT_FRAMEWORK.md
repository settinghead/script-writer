# Transform Artifact Framework

A comprehensive data transformation and artifact management framework with intelligent agent orchestration, real-time collaboration, and complete audit trail capabilities built on PostgreSQL + Electric SQL + TypeScript.

## Overview

The Transform Artifact Framework provides a sophisticated foundation for applications requiring intelligent content processing, immutable data management, and real-time collaboration capabilities.

**Key Features**:
- **Intelligent Agent Orchestration** - Context-aware agents with tool-based decision making
- **Immutable Artifact Management** - Complete audit trail with flexible editing capabilities  
- **Real-time Synchronization** - Electric SQL integration for instant cross-client updates
- **Schema-Driven Architecture** - Type-safe operations with Zod validation throughout
- **Advanced Caching System** - Development-optimized streaming response caching

## Core Paradigm: Artifact → Transform → Artifact

### The Fundamental Pattern

The Transform Artifact Framework is built on a single, powerful paradigm: **Artifact → Transform → Artifact**. Every data modification flows through this pattern, creating an immutable chain of transformations that preserves complete history while enabling flexible editing.

**Core Concept**:
```
Input Artifact(s) → Transform (Human or LLM) → Output Artifact(s)
```

This simple pattern underlies all data operations in the framework, from simple edits to complex AI-powered content generation.

### Why This Paradigm?

#### 1. **Immutability by Design**
Unlike traditional CRUD systems that overwrite data, every change creates new artifacts while preserving the original. This provides:

- **Complete Audit Trail** - Every version of every piece of content is preserved
- **Reproducible Operations** - Any sequence of transformations can be replayed exactly
- **Safe Experimentation** - Try different approaches without fear of losing previous work
- **Collaborative Safety** - Multiple users can work simultaneously without data corruption

#### 2. **Perfect for LLM Applications**
This paradigm is especially powerful for AI-powered applications:

**Data Collection Benefits**:
- **Human Preferences** - Capture exactly what users change and why
- **Correction Patterns** - Build datasets of AI outputs and human improvements
- **Context Preservation** - Maintain complete conversation and editing history
- **Training Data** - Automatic generation of high-quality human-feedback datasets

**AI Agent Benefits**:
- **Context Awareness** - Agents can see complete history when making decisions
- **Iterative Improvement** - Each generation builds on previous attempts
- **Rollback Capability** - Easily revert problematic AI changes
- **Branching Exploration** - Try multiple AI approaches simultaneously

#### 3. **Lineage-Driven Logic**
The framework derives application logic through lineage tree traversal:

**Latest Version Resolution**:
```typescript
// Always work with the most recent version
const effectiveArtifact = await resolveLatestVersion(originalArtifactId);
```

**Dependency Tracking**:
```typescript
// Understand what needs updating when something changes
const affectedArtifacts = await findDependentArtifacts(changedArtifactId);
```

**Conflict Resolution**:
```typescript
// Handle multiple edits intelligently
const mergedResult = await resolveBranchingEdits(conflictingArtifacts);
```

### The Streaming Exception

The framework maintains strict immutability with one carefully designed exception: **streaming updates**.

**Why the Exception?**
- **Real-time UX** - Users expect immediate feedback during AI generation
- **Performance** - Avoid creating thousands of intermediate artifacts during streaming
- **Resource Management** - Streaming generates massive amounts of transient data
- **Practical Necessity** - The intermediate steps aren't valuable to preserve

**How It Works**:
```typescript
// During streaming, output artifacts can be updated in-place
if (transform.streaming_status === 'active') {
  await updateArtifactInPlace(outputArtifact, newChunk);
} else {
  // Normal immutable operation
  await createNewArtifact(transformedData);
}
```

**Safe Streaming**:
- Only **pending** transforms can update their output artifacts
- Only **leaf-level** artifacts (no dependents) can be streamed
- Stream completion **finalizes** the artifact as immutable
- **Human transforms** to user_input artifacts can stream for live editing

### Transform Types & Triggers

#### LLM Transforms
Triggered by AI agents or direct API calls:
```typescript
const llmTransform = {
  type: 'llm',
  trigger: 'agent_request',
  input_artifacts: [userRequest, contextArtifacts],
  model: 'gpt-4',
  prompt_template: 'content_generation',
  streaming_status: 'active'
};
```

#### Human Transforms  
Triggered by direct user edits:
```typescript
const humanTransform = {
  type: 'human', 
  trigger: 'user_edit',
  input_artifacts: [originalContent],
  edit_path: '/items/0/title',
  user_id: 'user-123',
  streaming_status: 'completed'
};
```

### Practical Benefits

#### For Development Teams
- **Simplified Debugging** - Trace any issue through the transformation chain
- **Clear Architecture** - Every operation follows the same pattern
- **Testing Confidence** - Deterministic operations with preserved test data
- **Feature Development** - New features naturally fit the transform pattern

#### For LLM Applications
- **Continuous Learning** - Automatic collection of human preference data
- **Context Preservation** - Complete conversation and editing history available
- **Quality Improvement** - Easy comparison of AI outputs with human corrections
- **Personalization** - Track individual user preferences and patterns

#### For Users
- **Undo/Redo** - Natural support for reverting any change
- **Branching Workflows** - Try different approaches without losing work
- **Collaboration** - See complete history of who changed what
- **AI Transparency** - Understand exactly what the AI modified

### Real-World Example

Consider a brainstorming session that gets refined:

```
1. User Request Artifact
   ↓ (AI Transform)
2. Generated Ideas Artifact
   ↓ (Human Transform - user selects idea 2)  
3. Selected Idea Artifact
   ↓ (AI Transform - expand into outline)
4. Story Outline Artifact
   ↓ (Human Transform - edit character name)
5. Refined Outline Artifact
   ↓ (AI Transform - generate first episode)
6. Episode Script Artifact
```

Each step preserves the previous version while building toward the final result. The lineage tree allows:
- **Rollback** to any previous version
- **Branching** to try different AI generations from step 4
- **Context** for future AI operations using complete history
- **Data Collection** of human preferences and corrections

This paradigm transforms complex content creation workflows into simple, traceable, and improvable processes.

## Core Architecture Principles

### 1. Implementation Requirements
- **ALWAYS respect the artifact → transform → artifact structure** when implementing data flow logic
- Every data modification MUST be tracked through transforms with proper input/output artifact relationships
- Use `TransformExecutor` for all data modifications that need traceability
- Transforms must specify type ('llm' or 'human'), execution context, and status
- **Streaming Exception Rule**: Only pending transforms can update their output artifacts in-place during streaming

### 2. Agent-Driven Operations
All major operations flow through a context-aware agent framework:
- **Tool-Based Decision Making** - Agents automatically select appropriate tools based on request analysis
- **Natural Language Interface** - Conversational interaction with intelligent routing
- **Context Enrichment** - Maintains project context and provides comprehensive background
- **Dual-Mode Operation** - Automatically detects generation vs editing requests

**Agent Workflow**:
```
User Request → Agent Analysis → Context Enrichment → Tool Selection → Execution → Artifact Creation
```

### 3. Lineage Resolution & Type System
**Technical Implementation**: Advanced graph traversal and type management for flexible editing while maintaining immutability.

**Lineage Resolution Algorithm**:
- **Latest Version Detection** - Automatically resolve to most recent artifact in edit chains
- **Branch Merging** - Handle multiple simultaneous edits to the same content
- **Collection Decomposition** - Break collections into individual artifacts for granular editing
- **Dependency Tracking** - Understand cascading effects of changes

**Dual-Type Architecture**:
- **Schema Types** (`schema_type`) - Define data structure (e.g., `collection_schema`, `individual_item_schema`)
- **Origin Types** (`origin_type`) - Define creation source (`ai_generated`, `user_input`, `decomposed_from_collection`)
- **Editability Logic** - Use origin_type to determine edit permissions and UI behavior
- **Versioned Validation** - All transforms validated against Zod schemas with version suffixes

## Database Architecture

**PostgreSQL + Electric SQL + Kysely**:
- **PostgreSQL 16** - Primary database with logical replication
- **Electric SQL** - Real-time synchronization with authenticated proxy
- **Kysely** - Type-safe database operations with auto-generated types

**Core Tables**:
```sql
-- Enhanced artifacts with dual-type system
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  schema_type TEXT NOT NULL,        -- Data structure type
  origin_type TEXT NOT NULL,        -- Creation source
  data TEXT NOT NULL,
  streaming_status TEXT DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transform tracking with lineage
CREATE TABLE transforms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  streaming_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transform input/output relationships
CREATE TABLE transform_inputs (
  id TEXT PRIMARY KEY,
  transform_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  artifact_path TEXT DEFAULT '',
  FOREIGN KEY (transform_id) REFERENCES transforms(id),
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id)
);

CREATE TABLE transform_outputs (
  id TEXT PRIMARY KEY,
  transform_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  FOREIGN KEY (transform_id) REFERENCES transforms(id),
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id)
);

-- Human transforms with concurrent protection
CREATE TABLE human_transforms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  input_artifact_id TEXT NOT NULL,
  output_artifact_id TEXT NOT NULL,
  path TEXT NOT NULL,
  transform_name TEXT,
  CONSTRAINT unique_human_transform_per_artifact_path 
    UNIQUE (input_artifact_id, path)
);

-- Project-based access control
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects_users (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  PRIMARY KEY (project_id, user_id)
);

-- Chat messages for agent communication
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  event_type TEXT DEFAULT 'user_message',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Unified Streaming Framework & Caching

**Streaming Framework**: All agent tools use a unified streaming architecture with 90% reduction in boilerplate code and consistent behavior.

**Framework Benefits**:
- **Code Reduction** - Tools reduced from ~200 lines to ~30 lines of business logic
- **Consistent Behavior** - Identical streaming patterns, error handling, validation
- **Centralized Maintenance** - Bug fixes apply to all tools automatically
- **Type Safety** - Comprehensive Zod validation throughout pipeline

**Tool Implementation Pattern**:
```typescript
const config: StreamingTransformConfig<InputType, OutputType> = {
  templateName: 'template_name',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  prepareTemplateVariables: (input) => ({ /* business logic */ })
};

return executeStreamingTransform({ config, input, ...dependencies });
```

**Advanced Caching System**:
- **Transparent Caching** - Internal to service layer, parent code unaware
- **Full Streaming Progression Cache** - Caches complete streaming experience, not just final results
- **Deterministic Testing** - Fixed seeds ensure reproducible test results
- **Development-Only** - Disabled by default, explicitly enabled for tests
- **File-Based Storage** - SHA256 cache keys with model-aware invalidation

**Cache Performance**:
```
First Run:  Cache MISS → Saved 77 chunks to cache
Second Run: Cache HIT (77 chunks) → Near-instantaneous replay
```

## Electric SQL Integration

### Real-Time Synchronization
**Electric SQL** provides instant cross-client synchronization:
- **Authenticated Proxy** - All shape requests validated and user-scoped  
- **Project-Based Access** - Automatic filtering by user's project membership
- **Performance Optimized** - Efficient real-time data streaming
- **Type-Safe Hooks** - Generated TypeScript hooks for React integration

### Frontend Integration Pattern
```typescript
// Custom hook using Electric SQL + TanStack Query
export const useProjectData = (projectId: string) => {
  // Server state via TanStack Query
  const { data: project } = useQuery(['project', projectId], () => 
    apiService.getProject(projectId)
  );

  // Real-time sync via Electric SQL
  const { results: artifacts } = useShape({
    url: '/api/electric/v1/shape',
    table: 'artifacts', 
    where: `project_id = '${projectId}'`
  });

  // Client state via Zustand
  const { uiState, setUIState } = useProjectStore();

  return { project, artifacts, uiState };
};
```

## Schema System

### Zod Schema Definitions
**Versioned Artifact Schemas**:
```typescript
// Define shared types in src/common/ for consistency
export const DataCollectionSchemaV1 = z.object({
  items: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    metadata: z.record(z.unknown()).optional()
  })),
  metadata: z.object({
    created_at: z.string(),
    total_count: z.number()
  })
});

// Transform schemas with regex path patterns
export const EditTransformSchema = z.object({
  pathPattern: z.string().regex(/^\/items\/\d+$/),
  input: z.object({
    targetArtifacts: z.array(z.string()),
    instructions: z.string(),
    context: z.string().optional()
  }),
  output: z.object({
    editedItems: z.array(z.object({
      id: z.string(),
      title: z.string(),
      content: z.string()
    }))
  })
});
```

### Schema Transform Executor
**Complete validation and execution engine**:
```typescript
export class SchemaTransformExecutor {
  async executeTransform<T, U>(
    transformName: string,
    input: T,
    context: TransformContext
  ): Promise<TransformResult<U>> {
    // 1. Validate input against schema
    const transformDef = this.getTransformDefinition(transformName);
    const validatedInput = transformDef.inputSchema.parse(input);
    
    // 2. Execute transform with validation
    const result = await this.executeWithValidation(
      transformDef,
      validatedInput,
      context
    );
    
    // 3. Validate and return output
    return transformDef.outputSchema.parse(result);
  }
}
```

## Security & Access Control

### Project-Based Access Control
**Core Principle**: Access control managed through project membership, not direct user ownership.

```typescript
// All operations scoped to user's projects
async function validateProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const membership = await db
    .selectFrom('projects_users')
    .where('user_id', '=', userId)
    .where('project_id', '=', projectId)
    .executeTakeFirst();
    
  return !!membership;
}

// Always use artifactRepo.userHasProjectAccess(userId, projectId) to validate access
// Never filter artifacts directly by user_id
```

### Authentication Requirements
- **ALL AI/LLM endpoints MUST require authentication** using `requireAuth` middleware
- **ALL data operations MUST be scoped to authenticated user** (`project_id` filtering)
- Use HTTP-only cookies for JWT tokens to prevent XSS attacks
- Validate user ownership before allowing access to any resource
- Room IDs must include user ID for WebSocket security: `room-{user_id}-{timestamp}-{random}`

### Debug Authentication
- **For development/testing**: Use debug token `debug-auth-token-script-writer-dev` in Authorization header
- Debug token bypasses JWT validation and authenticates as test-user-1
- Example: `Authorization: Bearer debug-auth-token-script-writer-dev`
- **NEVER use debug token in production** - only for local development and testing

## Lineage Resolution System

### Graph Traversal Algorithm
**Always Edit Latest Version**:
```typescript
export async function resolveEffectiveArtifacts(
  inputArtifactIds: string[],
  projectId: string
): Promise<ArtifactWithLineage[]> {
  
  // 1. Build complete lineage graph
  const graph = await buildLineageGraph(projectId);
  
  // 2. For each input artifact, find the latest effective version
  const resolvedArtifacts = [];
  
  for (const artifactId of inputArtifactIds) {
    // Find leaf artifacts that derive from this input
    const leafArtifacts = findLeafArtifacts(graph, artifactId);
    
    if (leafArtifacts.length > 0) {
      // Use the most recent leaf artifact
      const latestLeaf = leafArtifacts.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      
      resolvedArtifacts.push(latestLeaf);
    } else {
      // No derivatives, use original
      resolvedArtifacts.push(await getArtifact(artifactId));
    }
  }
  
  return resolvedArtifacts;
}
```

**Lineage Resolution Examples**:
```
Simple Chain:
Artifact A → Human Transform → Artifact B (leaf)
User edits A → System resolves to B → User edits latest version

Complex Branching:
Collection → [Item 1] → Human Edit → User Input → AI Edit → Enhanced Item (leaf)
          → [Item 2] → AI Edit → Enhanced Item (leaf)
          → [Item 3] → (unchanged, references original)
```

## Development Patterns

### Repository Pattern
**Data Access Layer**:
```typescript
export class ArtifactRepository {
  constructor(private db: Database) {}
  
  async createArtifact(data: CreateArtifactData): Promise<Artifact> {
    return this.db
      .insertInto('artifacts')
      .values({
        id: generateId(),
        project_id: data.projectId,
        schema_type: data.schemaType,
        origin_type: data.originType,
        data: JSON.stringify(data.data),
        created_at: new Date().toISOString()
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
```

### Service Layer Pattern
**Business Logic Orchestration**:
```typescript
export class ProjectService {
  constructor(
    private artifactRepo: ArtifactRepository,
    private transformRepo: TransformRepository,
    private chatService: ChatService
  ) {}
  
  async createProject(userId: string, data: CreateProjectData): Promise<Project> {
    // 1. Create project
    const project = await this.createProjectRecord(userId, data);
    
    // 2. Set up initial artifacts
    await this.initializeProjectArtifacts(project.id);
    
    // 3. Create welcome chat message
    await this.chatService.addSystemMessage(project.id, 'Welcome to your new project!');
    
    return project;
  }
}
```

## Testing Framework

### Cache-Based Testing Architecture
The framework uses a sophisticated **cache-based testing system** with **Vitest** that leverages real cached LLM responses for realistic, fast, and cost-effective tests.

**Key Innovation**: Instead of hardcoded mock responses, tests use **actual cached LLM responses** from the `/cache/llm-streams/` directory, providing realistic test data while maintaining zero API costs.

**Test Framework Benefits**:
- **🚀 50x Faster Execution** - No real LLM calls during testing
- **💰 Zero Testing Costs** - Uses cached responses instead of API calls
- **🎯 Realistic Test Data** - Actual LLM outputs, not fabricated responses
- **🔄 Deterministic Results** - Same cache key = same response every time
- **📊 Comprehensive Coverage** - Tests against variety of real scenarios
- **🐞 Better Debugging** - Trace through actual data flows

**Test Structure Example**:
```typescript
describe('Transform System', () => {
  let mockArtifactRepo: ArtifactRepository;
  let mockTransformRepo: TransformRepository;

  beforeEach(() => {
    mockArtifactRepo = createMockArtifactRepository();
    mockTransformRepo = createMockTransformRepository();
  });

  it('should execute transforms using cached responses', async () => {
    // Test automatically uses cached LLM response
    const result = await transformTool.execute(testInput);
    expect(result).toBeDefined();
  });
});
```

## Development Tools

### TypeScript Script Execution
- **ALWAYS use `./run-ts` when running TypeScript Node.js scripts** - never use `npx tsx` or `node` directly
- The `./run-ts` script handles proper TypeScript configuration, dotenv loading, and module resolution
- Example: `./run-ts src/server/test-script.ts` instead of `npx tsx src/server/test-script.ts`
- run-ts can only run typescript files. DO NOT run inline scripts. Always write down the script in TS file(s).

### Database Operations
- Use `ArtifactRepository` and `TransformRepository` for data access
- Run migrations with `npm run migrate`
- Use `./run-ts src/server/scripts/migrate.ts` for migrations
- Unique constraint `unique_human_transform_per_artifact_path` prevents concurrent editing race conditions

### File Structure
```
src/
├── client/                 # React frontend
│   ├── components/        # UI components with streaming support
│   ├── hooks/            # Custom hooks including streaming hooks
│   ├── services/         # API services
│   └── types/            # Frontend-specific types
├── common/               # Shared types and interfaces
│   ├── streaming/        # Streaming interfaces
│   └── schemas/         # Zod validation schemas
└── server/               # Express backend
    ├── routes/           # API routes (domain-focused)
    ├── services/         # Business logic with transform execution
    ├── repositories/     # Data access layer (artifacts/transforms)
    └── middleware/       # Authentication and validation
```

## Example Implementation

Here's a complete example showing how to implement a generation and editing system using the framework:

**1. Define Schemas** (in `src/common/schemas/`):
```typescript
export const ContentInputSchema = z.object({
  title: z.string(),
  requirements: z.string(),
  format: z.enum(['article', 'summary', 'outline']),
  context: z.string().optional()
});

export const ContentOutputSchema = z.object({
  title: z.string(),
  content: z.string(),
  metadata: z.object({
    word_count: z.number(),
    generated_at: z.string()
  })
});

export type ContentInput = z.infer<typeof ContentInputSchema>;
export type ContentOutput = z.infer<typeof ContentOutputSchema>;
```

**2. Create Tool** (in `src/server/tools/`):
```typescript
export function createContentTool(
  transformRepo: TransformRepository,
  artifactRepo: ArtifactRepository,
  projectId: string,
  userId: string,
  options: { enableCaching?: boolean } = {}
): StreamingToolDefinition<ContentInput, ContentResult> {
  
  const config: StreamingTransformConfig<ContentInput, ContentOutput> = {
    templateName: 'content_generation',
    inputSchema: ContentInputSchema,
    outputSchema: ContentOutputSchema,
    prepareTemplateVariables: (input: ContentInput) => ({
      title: input.title,
      requirements: input.requirements,
      format: input.format,
      context: input.context || ''
    })
  };

  return {
    name: 'generate_content',
    description: 'Generate content based on requirements',
    inputSchema: ContentInputSchema,
    outputSchema: ContentResultSchema,
    execute: async (params: ContentInput): Promise<ContentResult> => {
      const result = await executeStreamingTransform({
        config,
        input: params,
        transformRepo,
        artifactRepo,
        projectId,
        userId,
        options
      });

      return {
        artifactId: result.outputArtifact.id,
        transformId: result.transform.id,
        status: 'completed'
      };
    }
  };
}
```

**3. Frontend Hook** (following the `useProjectData.ts` pattern):
```typescript
export const useContentGeneration = (projectId: string) => {
  // Real-time artifact synchronization via Electric SQL
  const { results: artifacts } = useShape({
    url: '/api/electric/v1/shape',
    table: 'artifacts',
    where: `project_id = '${projectId}' AND schema_type = 'content_schema'`,
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  // Project data via TanStack Query
  const { data: project } = useQuery(['project', projectId], () =>
    apiService.getProject(projectId)
  );

  // Chat integration for agent communication
  const { sendMessage } = useChatMessages(projectId);

  const generateContent = async (input: ContentInput) => {
    await sendMessage({
      role: 'user',
      content: `Generate content: ${JSON.stringify(input)}`,
      event_type: 'generation_request'
    });
  };

  return {
    project,
    artifacts: artifacts || [],
    generateContent
  };
};
```

**4. UI Component**:
```typescript
export const ContentGenerator: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { artifacts, generateContent } = useContentGeneration(projectId);
  const [form] = Form.useForm();

  const handleGenerate = async (values: ContentInput) => {
    await generateContent(values);
  };

  return (
    <div>
      <Form form={form} onFinish={handleGenerate} layout="vertical">
        <Form.Item name="title" label="Title" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="requirements" label="Requirements" rules={[{ required: true }]}>
          <TextArea rows={4} />
        </Form.Item>
        <Form.Item name="format" label="Format" rules={[{ required: true }]}>
          <Select>
            <Option value="article">Article</Option>
            <Option value="summary">Summary</Option>
            <Option value="outline">Outline</Option>
          </Select>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">Generate Content</Button>
        </Form.Item>
      </Form>

      <div style={{ marginTop: '24px' }}>
        <h3>Generated Content</h3>
        {artifacts.map(artifact => {
          const content = JSON.parse(artifact.data);
          return (
            <Card key={artifact.id} style={{ marginBottom: '16px' }}>
              <Typography.Title level={4}>{content.title}</Typography.Title>
              <Typography.Paragraph>{content.content}</Typography.Paragraph>
              <Typography.Text type="secondary">
                Words: {content.metadata.word_count}
              </Typography.Text>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
```

This example demonstrates the complete framework lifecycle: schema definition, tool creation, frontend integration with Electric SQL, and UI components. The framework handles all complex aspects (streaming, caching, lineage, validation) while application code focuses on domain-specific business logic.

## Summary

The Transform Artifact Framework provides a complete foundation for sophisticated data transformation applications with intelligent agent orchestration, immutable artifact management, real-time collaboration, and enterprise-grade development tooling. Applications built on this framework benefit from automatic lineage tracking, type-safe operations, and advanced caching while maintaining focus on domain-specific business logic. 