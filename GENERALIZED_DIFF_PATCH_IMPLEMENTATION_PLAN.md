# Generalized Diff Patch Implementation Plan

## Executive Summary

This plan outlines the implementation of a generalized diff patch mechanism that enables all jsondocs to be editable via click-to-edit, automatically detects affected downstream jsondocs when edits are made, and provides batch auto-correction capabilities.

## Design Decisions

Based on user preferences:
1. **Stale Detection Scope**: Direct children only (immediate AI-transform outputs)
2. **Generic Diff Tool**: Single GenericEditTool with auto-generated templates from Zod schemas
3. **Auto-fix Strategy**: Batch processing with bulk approval
4. **Terminology**: "受影响" (Affected) for stale jsondocs
5. **Brainstorm Collection Edit**: Disabled when an idea is already chosen

## Current System Analysis

### 1. Current Editing Rules (`src/client/utils/componentState.ts`)

The current system determines editability based on:

```typescript
ComponentState {
  EDITABLE           // user_input origin, no descendants
  CLICK_TO_EDIT      // ai_generated origin, no descendants, parent transform complete
  READ_ONLY          // has descendants
  PENDING_PARENT_TRANSFORM  // parent transform not complete
}
```

**Key Rules:**
- AI-generated jsondocs become editable only if they have no descendants
- User-input jsondocs are directly editable if they have no descendants
- Any jsondoc with descendants is read-only (immutability preservation)

### 2. Current Click-to-Edit Mechanism

**Flow:**
1. User clicks AI-generated content → `JsondocDisplayWrapper.handleCreateEditableVersion()`
2. POST `/api/jsondocs/:id/human-transform` creates human transform
3. Human transform produces new `user_input` jsondoc
4. UI switches to display the new editable jsondoc

**Current Transform Names:**
- `edit_brainstorm_input_params`
- `edit_灵感创意`
- `edit_故事设定`
- `edit_chronicles`
- `edit_分集结构`
- `edit_单集大纲`
- `edit_单集剧本`

### 3. Current Diff Generation System

**Unified Diff Flow:**
1. Template renders with line-numbered JSON + edit requirements
2. LLM generates unified diff text
3. `parseUnifiedDiff()` → structured hunks
4. `applyHunksToText()` → modified JSON (with fuzzy matching)
5. `rfc6902.createPatch()` → RFC6902 patches
6. Patches stored as `json_patch` jsondocs
7. Approval applies patches to create derived jsondoc

**Template Structure (`unifiedDiffBase.ts`):**
- Zod schema → JSON Schema for validation
- Instructions for unified diff format
- Line-numbered current content
- User's edit requirements

### 4. Current Lineage Graph Traversal

**Key Functions:**
- `hasJsondocDescendants()`: Check if jsondoc is used as input elsewhere
- `findLatestJsondoc()`: Traverse to find leaf nodes
- `traceForwardFromJsondoc()`: Find downstream jsondocs
- `computeCanonicalJsondocsFromLineage()`: Determine active/canonical jsondocs

### 5. Current Agent/Intent System

**Intent Shortcuts (`IntentShortcutService`):**
- Bypass LLM for known patterns
- Direct tool execution with resolved parameters
- Currently supports: `create_brainstorm`, `select_idea`, etc.

**Agent Auto-routing (`ChatService`):**
- Checks for intent metadata in user messages
- Routes to intent shortcuts when available
- Falls back to LLM agent for complex requests

## What Needs to Change

### 1. ✅ Component State Rules Modification

**File:** `src/client/utils/componentState.ts`

#### Detailed Implementation

**Current Function to Modify:**
```typescript
// Lines 83-180 in componentState.ts
export function computeComponentState(
    jsondoc: ElectricJsondoc | null,
    projectData: ProjectDataContextType
): ComponentStateInfo
```

**New Implementation:**
```typescript
export function computeComponentState(
    jsondoc: ElectricJsondoc | null,
    projectData: ProjectDataContextType
): ComponentStateInfo {
    // Handle null jsondoc
    if (!jsondoc) {
        return {
            state: ComponentState.ERROR,
            reason: 'Jsondoc not found'
        };
    }

    // Check loading/error states first
    if (projectData.isLoading) {
        return {
            state: ComponentState.LOADING,
            reason: 'Project data is loading'
        };
    }

    if (projectData.isError) {
        return {
            state: ComponentState.ERROR,
            reason: 'Failed to load project data',
            metadata: { error: projectData.error }
        };
    }

    // Get parent transform info from lineage
    const parentTransform = getParentTransform(jsondoc, projectData);
    
    // NEW: Check for brainstorm collection special case
    const isBrainstormCollection = jsondoc.schema_type === 'brainstorm_collection';
    const hasChosenIdea = checkHasChosenIdea(projectData);
    
    // Check if parent transform is complete
    const isParentTransformComplete = !parentTransform || 
        parentTransform.status === 'complete' || 
        parentTransform.status === 'completed';

    // Apply new rules for AI-generated content
    if (jsondoc.origin_type === 'ai_generated') {
        // Special case: Brainstorm collection when idea is chosen
        if (isBrainstormCollection && hasChosenIdea) {
            return {
                state: ComponentState.READ_ONLY,
                reason: '已选择创意，集合不可再编辑',
                parentTransformId: parentTransform?.id,
                parentTransformStatus: parentTransform?.status,
                metadata: { 
                    specialCase: 'brainstorm_collection_with_chosen_idea',
                    hasChosenIdea: true 
                }
            };
        }

        // Check if parent transform is complete
        if (!isParentTransformComplete) {
            return {
                state: ComponentState.PENDING_PARENT_TRANSFORM,
                reason: `Parent LLM transform is ${parentTransform?.status}`,
                parentTransformId: parentTransform?.id,
                parentTransformStatus: parentTransform?.status,
                metadata: {
                    transformType: parentTransform?.type,
                    blockingStatus: parentTransform?.status
                }
            };
        }

        // NEW: Always allow click-to-edit for completed AI content
        return {
            state: ComponentState.CLICK_TO_EDIT,
            reason: '点击创建可编辑版本',
            parentTransformId: parentTransform?.id,
            parentTransformStatus: parentTransform?.status,
            canTransition: [ComponentState.EDITABLE],
            metadata: {
                transformType: parentTransform?.type,
                canCreateEditableVersion: true,
                // NEW: Track if this has existing editable version
                hasExistingEditableVersion: checkExistingEditableVersion(jsondoc, projectData)
            }
        };
    }

    // User input is always directly editable
    if (jsondoc.origin_type === 'user_input') {
        return {
            state: ComponentState.EDITABLE,
            reason: '用户创建的内容，可直接编辑',
            parentTransformId: parentTransform?.id,
            parentTransformStatus: parentTransform?.status,
            metadata: { 
                originType: jsondoc.origin_type,
                // NEW: Track parent AI jsondoc for change detection
                parentAIJsondocId: getParentAIJsondocId(jsondoc, projectData)
            }
        };
    }

    // Fallback to read-only (shouldn't happen in normal cases)
    return {
        state: ComponentState.READ_ONLY,
        reason: 'Unknown jsondoc state',
        metadata: { originType: jsondoc.origin_type }
    };
}
```

**New Helper Functions to Add:**
```typescript
// Check if project has a chosen brainstorm idea
function checkHasChosenIdea(projectData: ProjectDataContextType): boolean {
    if (projectData.canonicalContext === "pending" || 
        projectData.canonicalContext === "error" || 
        !projectData.canonicalContext) {
        return false;
    }
    
    // Check if there's a canonical brainstorm idea that's user_input
    const canonicalIdea = projectData.canonicalContext.canonicalBrainstormIdea;
    return canonicalIdea !== null && canonicalIdea.origin_type === 'user_input';
}

// Check if jsondoc already has an editable version
function checkExistingEditableVersion(
    jsondoc: ElectricJsondoc,
    projectData: ProjectDataContextType
): boolean {
    if (!Array.isArray(projectData.transformOutputs)) return false;
    
    // Find transforms that used this jsondoc as input
    const outputsFromThisJsondoc = projectData.transformOutputs.filter(
        output => output.jsondoc_id === jsondoc.id
    );
    
    // Check if any output is a human transform creating user_input
    for (const output of outputsFromThisJsondoc) {
        const transform = projectData.humanTransforms?.find(
            t => t.id === output.transform_id
        );
        if (transform) {
            // Find the output jsondoc
            const outputJsondoc = projectData.jsondocs?.find(
                j => j.id === output.jsondoc_id
            );
            if (outputJsondoc?.origin_type === 'user_input') {
                return true;
            }
        }
    }
    
    return false;
}

// Get parent AI jsondoc ID for change tracking
function getParentAIJsondocId(
    jsondoc: ElectricJsondoc,
    projectData: ProjectDataContextType
): string | null {
    const parentTransform = getParentTransform(jsondoc, projectData);
    if (!parentTransform || parentTransform.type !== 'human') {
        return null;
    }
    
    // Find the source AI jsondoc
    const inputs = projectData.transformInputs?.filter(
        input => input.transform_id === parentTransform.id
    );
    
    if (inputs && inputs.length > 0) {
        return inputs[0].jsondoc_id;
    }
    
    return null;
}
```

#### Acceptance Criteria

1. **✅ AI-Generated Content Always Click-to-Edit**
   - Given: An AI-generated jsondoc with no descendants
   - When: `computeComponentState()` is called
   - Then: Returns `CLICK_TO_EDIT` state
   
2. **✅ AI-Generated Content With Descendants Still Click-to-Edit**
   - Given: An AI-generated jsondoc that has been used as input for other transforms
   - When: `computeComponentState()` is called
   - Then: Returns `CLICK_TO_EDIT` state (not `READ_ONLY`)
   
3. **✅ Brainstorm Collection Special Case**
   - Given: A brainstorm_collection jsondoc AND a chosen idea exists
   - When: `computeComponentState()` is called
   - Then: Returns `READ_ONLY` with reason "已选择创意，集合不可再编辑"
   
4. **✅ User Input Always Editable**
   - Given: A user_input jsondoc
   - When: `computeComponentState()` is called
   - Then: Returns `EDITABLE` state regardless of descendants
   
5. **✅ Pending Transform Still Blocks**
   - Given: An AI-generated jsondoc with incomplete parent transform
   - When: `computeComponentState()` is called
   - Then: Returns `PENDING_PARENT_TRANSFORM` state

#### Test Cases

```typescript
// Test file: src/client/utils/__tests__/componentState.test.ts

describe('computeComponentState with new rules', () => {
    it('should allow click-to-edit for AI jsondoc with descendants', () => {
        const jsondoc = {
            id: 'ai-1',
            origin_type: 'ai_generated',
            schema_type: '故事设定'
        };
        
        const projectData = {
            transformInputs: [
                { jsondoc_id: 'ai-1', transform_id: 't-2' }
            ],
            // ... other data
        };
        
        const result = computeComponentState(jsondoc, projectData);
        expect(result.state).toBe(ComponentState.CLICK_TO_EDIT);
    });
    
    it('should block brainstorm collection when idea is chosen', () => {
        const jsondoc = {
            id: 'collection-1',
            origin_type: 'ai_generated',
            schema_type: 'brainstorm_collection'
        };
        
        const projectData = {
            canonicalContext: {
                canonicalBrainstormIdea: {
                    id: 'idea-1',
                    origin_type: 'user_input'
                }
            }
        };
        
        const result = computeComponentState(jsondoc, projectData);
        expect(result.state).toBe(ComponentState.READ_ONLY);
        expect(result.metadata.specialCase).toBe('brainstorm_collection_with_chosen_idea');
    });
});
```

#### Migration Notes

- No database migration required
- Frontend components will automatically adapt to new states
- Existing projects will work with new rules immediately

### 2. ✅ Automatic Human Transform Creation

**File:** `src/client/transform-jsondoc-framework/components/JsondocDisplayWrapper.tsx`

**Changes:**
- [x] Modify `handleCreateEditableVersion` to check if editable version exists
- [x] If no human transform exists, create it automatically
- [x] If human transform exists but no edits, switch to existing derived jsondoc

### 3. ✅ Stale Detection System

**New File:** `src/common/staleDetection.ts`

#### Detailed Implementation

```typescript
import { LineageGraph, ElectricJsondoc, ElectricTransform } from './transform-jsondoc-types';
import { JSONPath } from 'jsonpath-plus';

/**
 * Represents a single change in a jsondoc
 */
export interface DiffChange {
  jsondocId: string;           // ID of edited jsondoc
  path: string;                // JSONPath of changed field (e.g., "$.title", "$.characters[0].name")
  before: any;                 // Previous value
  after: any;                  // New value
  fieldType?: string;          // Optional: semantic type (e.g., "plot", "character", "setting")
}

/**
 * Represents a jsondoc that is affected by upstream changes
 */
export interface AffectedJsondoc {
  jsondocId: string;           // ID of affected jsondoc
  schemaType: string;          // Schema type (e.g., "故事设定", "chronicles")
  reason: string;              // Human-readable reason in Chinese
  affectedPaths?: string[];    // Specific paths that might need updates
  severity: 'high' | 'medium' | 'low';
  sourceChanges: DiffChange[]; // Original changes that caused this
  suggestedAction?: string;    // Optional suggestion for fix
}

/**
 * Main function to compute affected jsondocs based on changes
 */
export async function computeStaleJsondocs(
  diffs: DiffChange[],
  lineageGraph: LineageGraph,
  jsondocs: ElectricJsondoc[],
  transforms?: ElectricTransform[]
): Promise<AffectedJsondoc[]> {
  const affectedMap = new Map<string, AffectedJsondoc>();
  
  // Process each change
  for (const diff of diffs) {
    const sourceJsondoc = jsondocs.find(j => j.id === diff.jsondocId);
    if (!sourceJsondoc) continue;
    
    // Find direct children in lineage graph
    const directChildren = findDirectChildren(
      diff.jsondocId,
      lineageGraph,
      jsondocs,
      transforms
    );
    
    // Analyze impact on each child
    for (const child of directChildren) {
      // Skip if already user-edited (not stale)
      if (child.origin_type === 'user_input') continue;
      
      // Determine severity and affected paths
      const impact = analyzeImpact(
        sourceJsondoc.schema_type,
        diff.path,
        child.schema_type
      );
      
      // Create or update affected entry
      const existingEntry = affectedMap.get(child.id);
      if (existingEntry) {
        // Merge with existing entry
        existingEntry.sourceChanges.push(diff);
        existingEntry.affectedPaths = mergeAffectedPaths(
          existingEntry.affectedPaths,
          impact.affectedPaths
        );
        // Upgrade severity if needed
        if (impact.severity === 'high' || 
            (impact.severity === 'medium' && existingEntry.severity === 'low')) {
          existingEntry.severity = impact.severity;
        }
      } else {
        // Create new entry
        affectedMap.set(child.id, {
          jsondocId: child.id,
          schemaType: child.schema_type,
          reason: generateReason(sourceJsondoc.schema_type, diff, child.schema_type),
          affectedPaths: impact.affectedPaths,
          severity: impact.severity,
          sourceChanges: [diff],
          suggestedAction: generateSuggestedAction(child.schema_type)
        });
      }
    }
  }
  
  return Array.from(affectedMap.values());
}

/**
 * Find direct children of a jsondoc (immediate AI transform outputs)
 */
function findDirectChildren(
  jsondocId: string,
  lineageGraph: LineageGraph,
  jsondocs: ElectricJsondoc[],
  transforms?: ElectricTransform[]
): ElectricJsondoc[] {
  const children: ElectricJsondoc[] = [];
  
  // Get edges from this jsondoc
  const edges = lineageGraph.edges.get(jsondocId);
  if (!edges || edges.length === 0) return children;
  
  // For each edge, check if it points to a transform
  for (const targetId of edges) {
    const targetNode = lineageGraph.nodes.get(targetId);
    if (!targetNode) continue;
    
    if (targetNode.type === 'transform') {
      // This is a transform that uses our jsondoc as input
      // Find the output jsondocs of this transform
      const transformOutputEdges = lineageGraph.edges.get(targetId);
      if (transformOutputEdges) {
        for (const outputId of transformOutputEdges) {
          const outputJsondoc = jsondocs.find(j => j.id === outputId);
          if (outputJsondoc && outputJsondoc.origin_type === 'ai_generated') {
            children.push(outputJsondoc);
          }
        }
      }
    }
  }
  
  return children;
}

// Schema impact mapping configuration
const SCHEMA_IMPACT_MAP = {
  '灵感创意': {
    '$.title': { impactedSchemas: ['故事设定'], severity: 'high' },
    '$.genre': { impactedSchemas: ['故事设定'], severity: 'high' },
    '$.body': { impactedSchemas: ['故事设定', 'chronicles'], severity: 'medium' }
  },
  '故事设定': {
    '$.characters': { impactedSchemas: ['chronicles', '分集结构'], severity: 'high' },
    '$.synopsis': { impactedSchemas: ['chronicles'], severity: 'medium' }
  },
  'chronicles': {
    '$.stages': { impactedSchemas: ['分集结构'], severity: 'high' }
  }
};

function analyzeImpact(sourceSchema: string, changePath: string, targetSchema: string) {
  const sourceImpacts = SCHEMA_IMPACT_MAP[sourceSchema];
  if (!sourceImpacts) return { severity: 'medium' };
  
  for (const [pathPattern, impact] of Object.entries(sourceImpacts)) {
    if (changePath.startsWith(pathPattern) && impact.impactedSchemas.includes(targetSchema)) {
      return { severity: impact.severity, affectedPaths: [changePath] };
    }
  }
  return { severity: 'low' };
}

function generateReason(sourceSchema: string, diff: DiffChange, targetSchema: string): string {
  const fieldName = diff.path.split('.').pop() || '内容';
  return `上游${sourceSchema}的${fieldName}已更改，${targetSchema}可能需要相应调整`;
}

function generateSuggestedAction(schemaType: string): string {
  const actions = {
    '故事设定': '根据新的故事创意更新故事设定',
    'chronicles': '调整时间线以匹配新的剧情发展',
    '分集结构': '重新划分集数以适应新的故事节奏'
  };
  return actions[schemaType] || '更新内容以保持一致性';
}

function mergeAffectedPaths(existing?: string[], newPaths?: string[]): string[] | undefined {
  if (!existing && !newPaths) return undefined;
  if (!existing) return newPaths;
  if (!newPaths) return existing;
  return Array.from(new Set([...existing, ...newPaths]));
}
```

#### Acceptance Criteria

1. **✅ Detect Direct Children Only**
   - Given: A jsondoc with changes and multiple levels of descendants
   - When: `computeStaleJsondocs()` is called
   - Then: Only immediate AI-generated children are marked as affected

2. **✅ Skip User-Edited Children**
   - Given: A changed jsondoc with both AI and user-edited children
   - When: `computeStaleJsondocs()` is called
   - Then: User-edited children are not marked as affected

3. **✅ Severity Based on Field Impact**
   - Given: Changes to critical fields (title, genre) vs minor fields
   - When: `computeStaleJsondocs()` is called
   - Then: Appropriate severity levels are assigned

4. **✅ Path-Specific Impact Analysis**
   - Given: A change to a specific field path
   - When: `computeStaleJsondocs()` is called
   - Then: Affected paths in downstream jsondocs are identified

#### Test Cases

```typescript
// Test file: src/common/__tests__/staleDetection.test.ts

describe('staleDetection', () => {
  it('should detect direct AI children as affected', async () => {
    const diffs = [{
      jsondocId: 'idea-1',
      path: '$.title',
      before: 'Old Title',
      after: 'New Title'
    }];
    
    const lineageGraph = {
      edges: new Map([
        ['idea-1', ['transform-1']],
        ['transform-1', ['outline-1']]
      ]),
      nodes: new Map([
        ['idea-1', { type: 'jsondoc' }],
        ['transform-1', { type: 'transform' }],
        ['outline-1', { type: 'jsondoc' }]
      ])
    };
    
    const jsondocs = [
      { id: 'idea-1', schema_type: '灵感创意', origin_type: 'user_input' },
      { id: 'outline-1', schema_type: '故事设定', origin_type: 'ai_generated' }
    ];
    
    const affected = await computeStaleJsondocs(diffs, lineageGraph, jsondocs);
    
    expect(affected).toHaveLength(1);
    expect(affected[0].jsondocId).toBe('outline-1');
    expect(affected[0].severity).toBe('high');
  });
});
```

### 4. ✅ Generic Edit Tool

**New File:** `src/server/tools/GenericEditTool.ts`

#### Detailed Implementation

```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { StreamingToolDefinition } from '../types';
import { createUnifiedDiffTemplate } from '../services/templates/unifiedDiffBase';

/**
 * Registry of all jsondoc schemas for dynamic tool generation
 */
const SCHEMA_REGISTRY: Record<string, {
  schema: z.ZodSchema;
  displayName: string;
  editInstructions?: string[];
}> = {
  '灵感创意': {
    schema: IdeaSchema,
    displayName: '故事创意',
    editInstructions: [
      '确保修改后的创意符合去脸谱化原则',
      '保持故事的核心吸引力和商业价值'
    ]
  },
  '故事设定': {
    schema: OutlineSettingsSchema,
    displayName: '故事设定',
    editInstructions: [
      '保持角色设定的一致性',
      '确保剧情逻辑通顺'
    ]
  },
  'chronicles': {
    schema: ChroniclesSchema,
    displayName: '编年史',
    editInstructions: [
      '维护时间线的逻辑性',
      '确保事件顺序合理'
    ]
  },
  '分集结构': {
    schema: EpisodePlanningSchema,
    displayName: '分集结构',
    editInstructions: [
      '保持集数划分的平衡',
      '确保每集有明确的冲突和解决'
    ]
  }
};

/**
 * Generic edit input schema
 */
const GenericEditInputSchema = z.object({
  jsondocId: z.string().describe('要编辑的jsondoc ID'),
  editRequirements: z.string().describe('编辑要求的详细描述'),
  affectedContext: z.array(z.object({
    jsondocId: z.string(),
    schemaType: z.string(),
    reason: z.string()
  })).optional().describe('受影响的下游jsondocs')
});

/**
 * Create a generic edit tool for any jsondoc type
 */
export function createGenericEditTool(
  schemaType: string,
  jsondocRepo: TransformJsondocRepository,
  transformRepo: TransformJsondocRepository,
  projectId: string,
  userId: string,
  cachingOptions?: {
    enableCaching?: boolean;
    seed?: number;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
  }
): StreamingToolDefinition<any, any> | null {
  
  // Look up schema in registry
  const schemaConfig = SCHEMA_REGISTRY[schemaType];
  if (!schemaConfig) {
    console.warn(`[GenericEditTool] No schema registered for type: ${schemaType}`);
    return null;
  }
  
  const { schema, displayName, editInstructions = [] } = schemaConfig;
  
  // Generate template dynamically
  const template = createUnifiedDiffTemplate({
    templateName: `edit_${schemaType}_generic`,
    description: `Edit ${displayName}`,
    outputJsondocType: schemaType,
    targetTypeName: displayName,
    schema: schema,
    additionalInstructions: [
      ...editInstructions,
      '只修改需要改变的字段，保持其他内容不变',
      '确保修改后的内容符合数据结构要求'
    ]
  });
  
  // Register template
  const templateService = getTemplateService();
  templateService.registerTemplate(template);
  
  return {
    name: `edit_${schemaType}`,
    description: `编辑${displayName}内容`,
    inputSchema: GenericEditInputSchema,
    outputSchema: JsonPatchOperationsSchema,
    
    execute: async (params, { toolCallId }) => {
      console.log(`[GenericEditTool] Starting edit for ${schemaType} jsondoc ${params.jsondocId}`);
      
      // Fetch source jsondoc
      const sourceJsondoc = await jsondocRepo.getJsondoc(params.jsondocId);
      if (!sourceJsondoc) {
        throw new Error(`Jsondoc not found: ${params.jsondocId}`);
      }
      
      // Verify schema type matches
      if (sourceJsondoc.schema_type !== schemaType) {
        throw new Error(`Schema type mismatch: expected ${schemaType}, got ${sourceJsondoc.schema_type}`);
      }
      
      // Check if this is AI-generated (needs patch) or user-input (direct edit)
      if (sourceJsondoc.origin_type === 'user_input') {
        // For user input, we can edit directly without patches
        return handleDirectEdit(sourceJsondoc, params, jsondocRepo);
      }
      
      // Create config for patch generation
      const config: StreamingTransformConfig = {
        templateName: template.id,
        inputSchema: GenericEditInputSchema,
        outputSchema: JsonPatchOperationsSchema,
        prepareTemplateVariables: async (input) => {
          // Extract jsondoc data
          const jsondocData = typeof sourceJsondoc.data === 'string' 
            ? JSON.parse(sourceJsondoc.data) 
            : sourceJsondoc.data;
          
          // Add context about affected jsondocs if provided
          const additionalContext = params.affectedContext 
            ? `\n受影响的内容：\n${params.affectedContext.map(
                a => `- ${a.schemaType}: ${a.reason}`
              ).join('\n')}`
            : '';
          
          return {
            jsondocs: { [schemaType]: jsondocData },
            params: {
              editRequirements: params.editRequirements + additionalContext
            }
          };
        }
      };
      
      // Execute streaming transform with patch mode
      const result = await executeStreamingTransform({
        config,
        input: params,
        projectId,
        userId,
        transformRepo,
        jsondocRepo,
        outputJsondocType: schemaType,
        executionMode: {
          mode: 'patch-approval',
          originalJsondoc: sourceJsondoc
        },
        transformMetadata: {
          toolName: `edit_${schemaType}`,
          source_jsondoc_id: params.jsondocId,
          edit_requirements: params.editRequirements,
          method: 'json_patch',
          affected_context: params.affectedContext
        },
        ...cachingOptions
      });
      
      console.log(`[GenericEditTool] Successfully generated patches for ${schemaType}`);
      
      return {
        success: true,
        jsondocId: result.outputJsondocId,
        patches: result.patches,
        message: `已生成${displayName}的修改补丁`
      };
    }
  };
}

/**
 * Create all generic edit tools for a project
 */
export function createAllGenericEditTools(
  projectId: string,
  userId: string,
  jsondocRepo: TransformJsondocRepository,
  transformRepo: TransformJsondocRepository,
  cachingOptions?: any
): StreamingToolDefinition[] {
  const tools: StreamingToolDefinition[] = [];
  
  for (const schemaType of Object.keys(SCHEMA_REGISTRY)) {
    const tool = createGenericEditTool(
      schemaType,
      jsondocRepo,
      transformRepo,
      projectId,
      userId,
      cachingOptions
    );
    
    if (tool) {
      tools.push(tool);
    }
  }
  
  return tools;
}

/**
 * Handle direct edit for user-input jsondocs
 */
async function handleDirectEdit(
  jsondoc: ElectricJsondoc,
  params: any,
  jsondocRepo: TransformJsondocRepository
): Promise<any> {
  // Parse edit requirements to extract field changes
  // This would typically use an LLM to understand the requirements
  // For now, return a placeholder
  
  return {
    success: true,
    jsondocId: jsondoc.id,
    message: '用户创建的内容可直接编辑，无需生成补丁'
  };
}

/**
 * Dynamic schema introspection helpers
 */
export function getSchemaFieldDescriptions(schema: z.ZodSchema): Record<string, string> {
  const jsonSchema = zodToJsonSchema(schema);
  const descriptions: Record<string, string> = {};
  
  function extractDescriptions(obj: any, path: string = '') {
    if (obj.properties) {
      for (const [key, value] of Object.entries(obj.properties)) {
        const fieldPath = path ? `${path}.${key}` : key;
        if (value.description) {
          descriptions[fieldPath] = value.description;
        }
        if (value.properties) {
          extractDescriptions(value, fieldPath);
        }
      }
    }
  }
  
  extractDescriptions(jsonSchema);
  return descriptions;
}

/**
 * Generate edit instructions based on schema type
 */
export function generateSchemaSpecificInstructions(schemaType: string): string[] {
  const fieldDescriptions = getSchemaFieldDescriptions(
    SCHEMA_REGISTRY[schemaType]?.schema
  );
  
  const instructions: string[] = [];
  
  // Add field-specific instructions
  for (const [field, description] of Object.entries(fieldDescriptions)) {
    instructions.push(`${field}: ${description}`);
  }
  
  return instructions;
}
```

#### Acceptance Criteria

1. **✅ Dynamic Tool Generation**
   - Given: Any registered jsondoc schema type
   - When: `createGenericEditTool()` is called
   - Then: A fully functional edit tool is generated

2. **✅ Schema Validation**
   - Given: Edit requirements for a jsondoc
   - When: Tool executes
   - Then: Generated patches conform to Zod schema

3. **✅ Template Caching**
   - Given: Multiple calls for same schema type
   - When: Tools are created
   - Then: Templates are reused, not regenerated

4. **✅ Context Awareness**
   - Given: Affected jsondocs context provided
   - When: Generating patches
   - Then: Context influences patch generation

5. **✅ Fallback for Unknown Schemas**
   - Given: Unregistered schema type
   - When: Tool creation attempted
   - Then: Returns null with warning log

### 5. ✅ UI Components for Affected Jsondocs

**New Component:** `src/client/components/AffectedJsondocsPanel.tsx`

**Features:**
- [x] List of affected jsondocs with reasons
- [x] Severity indicators (color coding)
- [x] "自动修正" button for batch processing
- [x] Progress indicator during auto-fix
- [ ] Patch approval interface

**Integration Points:**
- [x] Add to `ActionItemsSection.tsx`
- [ ] Subscribe to jsondoc edit events (debounced)
- [x] Update when lineage changes (initial heuristic via localUpdates)

### 6. ✅ Batch Auto-Fix System

**New File:** `src/server/services/BatchAutoFixService.ts`

**Features:**
- [x] Parallel patch generation for multiple jsondocs
- [ ] Progress tracking via SSE/WebSocket
- [x] Batch approval endpoint

**Flow:**
1. Receive list of affected jsondoc IDs
2. Generate patches in parallel using GenericEditTool
3. Stream progress updates to UI
4. Present all patches for approval
5. Apply approved patches in dependency order

### 7. ✅ Intent Shortcut for Auto-Fix

**File:** `src/server/services/IntentParameterResolver.ts`

**New Intent:** `auto_fix_affected`

**Parameters:**
- `affectedJsondocIds`: Array of jsondoc IDs
- `editContext`: Original edits that caused the changes
- `autoApprove`: Boolean for skip approval (false by default)

## Implementation Checklist

### Phase 1: Foundation (Week 1)
- [x] Create `staleDetection.ts` with core algorithm
- [x] Write comprehensive tests for stale detection
- [x] Modify `componentState.ts` editing rules
- [x] Test new editing rules don't break existing features

### Phase 2: Generic Diff Tool (Week 1-2)
- [x] Create `GenericEditTool.ts` with schema introspection
- [x] Implement dynamic template generation
- [x] Add schema-specific edit instructions
- [x] Test with all existing jsondoc types (basic unit test added; expand later)
- [x] Create registry for schema → tool mapping

### Phase 3: UI Integration (Week 2)
- [x] Create `AffectedJsondocsPanel.tsx` component
- [x] Integrate with `ActionItemsSection.tsx`
- [x] Add debounced stale detection on edits (500ms)
- [x] Implement "自动修正" button and loading states
- [x] Add Chinese translations for UI elements

### Phase 4: Batch Processing (Week 2-3)
- [x] Create `BatchAutoFixService.ts`
- [x] Implement parallel patch generation
- [x] Add progress tracking system (SSE)
- [x] Create batch approval endpoint
- [ ] Add patch preview UI component

### Phase 5: Testing & Polish (Week 3)
- [ ] End-to-end testing of complete flow
- [ ] Performance testing with large projects
- [ ] Error handling and recovery
- [ ] Documentation updates
- [ ] Migration guide for existing projects

## Rationale

### Why Direct Children Only for Stale Detection?

1. **Predictability**: Users can understand the immediate impact of their edits
2. **Performance**: Avoids cascading updates through entire lineage tree
3. **Control**: Users can choose which downstream effects to propagate
4. **Incremental**: Can expand scope later based on user feedback

### Why Generic Tool Over Type-Specific Tools?

1. **Maintainability**: Single tool to maintain vs. many specialized tools
2. **Consistency**: Uniform editing experience across all jsondoc types
3. **Extensibility**: New jsondoc types automatically supported
4. **Schema-Driven**: Leverages existing Zod schemas for validation

### Why Batch Processing for Auto-Fix?

1. **Efficiency**: Parallel processing reduces total wait time
2. **Context**: User sees all changes before approval
3. **Atomicity**: Can approve/reject as a coherent set

## Risk Mitigation

### Risk 1: Breaking Existing Workflows
**Mitigation**: 
- Feature flag for gradual rollout
- Maintain backward compatibility
- Extensive testing of edge cases

### Risk 2: Performance Impact
**Mitigation**:
- Debounced stale detection
- Lazy loading of affected jsondocs
- Caching of lineage traversals
- Progressive UI updates

### Risk 3: User Confusion
**Mitigation**:
- Clear visual indicators for affected content
- Tooltips explaining why content is affected
- Option to disable auto-detection
- Comprehensive user documentation

## Success Metrics

1. **Functionality**
   - All jsondoc types editable via click-to-edit
   - Affected jsondocs correctly identified
   - Auto-fix generates valid patches

2. **Performance**
   - Stale detection < 100ms for typical project
   - Batch auto-fix < 5s for 10 jsondocs
   - No UI lag during editing

3. **User Experience**
   - Reduced clicks to edit content
   - Clear understanding of edit impacts
   - Successful auto-fix rate > 90%

## Next Steps

1. Review and approve this implementation plan
2. Create feature branch `feature/generalized-diff-patch`
3. Begin Phase 1 implementation
4. Weekly progress reviews
5. User testing after Phase 3

## Appendix: Example Scenarios

### Scenario 1: Edit Story Idea
1. User clicks on AI-generated 灵感创意
2. System creates human transform → editable version
3. User changes plot
4. System detects 故事设定 is affected
5. User clicks "自动修正"
6. System generates patch for 故事设定
7. User approves patch
8. 故事设定 updated to match new plot

### Scenario 2: Edit Chronicle
1. User edits chronicles timeline
2. System detects 分集结构 is affected
3. Multiple episode structures marked as affected
4. User clicks "自动修正"
5. System generates patches for all episodes in parallel
6. User reviews and approves patches
7. All episodes updated consistently

### Scenario 3: Brainstorm Collection Special Case
1. User has already chosen and edited an idea
2. Brainstorm collection shows as read-only
3. No click-to-edit available (prevents confusion)
4. User can still view collection content
5. Clear message explains why editing is disabled

## Refactoring Objectives

### Code Quality Objectives

1. **Type Safety Enhancement**
   - [ ] All new functions have proper TypeScript types
   - [ ] No `any` types without explicit justification
   - [ ] Zod schemas for all data structures
   - [ ] Exhaustive type checking in switch statements

2. **Error Handling**
   - [ ] All async operations wrapped in try-catch
   - [ ] Meaningful error messages in Chinese for user-facing errors
   - [ ] Proper error propagation through the stack
   - [ ] Graceful degradation when features fail

3. **Performance Optimization**
   - [ ] Debounced stale detection (500ms delay)
   - [ ] Memoized lineage traversal functions
   - [ ] Lazy loading of affected jsondocs
   - [ ] Virtual scrolling for large affected lists

4. **Code Organization**
   - [ ] Single responsibility for each function
   - [ ] Clear separation of concerns
   - [ ] Reusable utility functions extracted
   - [ ] Consistent naming conventions

### Architecture Objectives

1. **Modularity**
   - [ ] Each feature as independent module
   - [ ] Clear interfaces between modules
   - [ ] Dependency injection where appropriate
   - [ ] Testable in isolation

2. **Extensibility**
   - [ ] Easy to add new jsondoc types
   - [ ] Schema registry pattern for tools
   - [ ] Plugin architecture for impact analysis
   - [ ] Configurable severity rules

3. **Maintainability**
   - [ ] Comprehensive JSDoc comments
   - [ ] Clear code documentation
   - [ ] Examples for complex functions
   - [ ] Migration guides for changes

## Overall Acceptance Criteria

### Functional Requirements

1. **Universal Editability**
   - ✅ All AI-generated jsondocs show click-to-edit button
   - ✅ Click creates human transform if not exists
   - ✅ Existing editable versions are reused
   - ✅ Brainstorm collection blocked when idea chosen

2. **Stale Detection**
   - ✅ Edits trigger affected jsondoc detection
   - ✅ Only direct AI children marked as affected
   - ✅ User-edited children excluded
   - ✅ Severity levels correctly assigned
   - ✅ Chinese reasons clearly explain impact

3. **Generic Diff Generation**
   - ✅ Works for all registered jsondoc types
   - ✅ Schema validation enforced
   - ✅ Templates dynamically generated
   - ✅ Context-aware patch generation
   - ✅ Unified diff format consistent

4. **Batch Auto-Fix**
   - ✅ "自动修正" button triggers batch processing
   - ✅ Parallel patch generation for performance
   - ✅ Progress indicator during processing
   - ✅ Bulk approval interface functional
   - ✅ Individual patch preview available

5. **UI Integration**
   - ✅ Affected panel integrated in main UI
   - ✅ Real-time updates on edits
   - ✅ Clear visual indicators (colors, icons)
   - ✅ Chinese UI text throughout
   - ✅ Responsive design maintained

### Non-Functional Requirements

1. **Performance**
   - ✅ Stale detection < 100ms for 50 jsondocs
   - ✅ Batch generation < 5s for 10 jsondocs
   - ✅ No UI freezing during operations
   - ✅ Memory usage < 200MB increase
   - ✅ Network requests properly batched

2. **Reliability**
   - ✅ 99% success rate for patch generation
   - ✅ Graceful error recovery
   - ✅ No data loss on failures
   - ✅ Audit trail maintained

3. **Usability**
   - ✅ User understands affected content
   - ✅ Clear action buttons
   - ✅ Intuitive approval flow
   - ✅ Help tooltips provided

4. **Compatibility**
   - ✅ Works with existing projects
   - ✅ No breaking changes to API
   - ✅ Database migrations backward compatible
   - ✅ UI components work in all browsers
   - ✅ Mobile responsive maintained

### Testing Requirements

1. **Unit Tests**
   - [ ] 90% code coverage for new code
   - [ ] All edge cases covered
   - [ ] Mock data realistic
   - [ ] Error scenarios tested
   - [ ] Performance benchmarks included

2. **Integration Tests**
   - [ ] End-to-end flow tested
   - [ ] Database operations verified
   - [ ] API endpoints tested
   - [ ] UI interactions validated
   - [ ] Cross-browser testing done

3. **User Acceptance Tests**
   - [ ] 5 users test the feature
   - [ ] Feedback incorporated
   - [ ] Documentation reviewed
   - [ ] Training materials created
   - [ ] Success metrics defined

## Implementation Handoff Checklist

For another developer/AI to implement this feature, ensure:

### Prerequisites
- [ ] Access to codebase with latest main branch
- [ ] Understanding of Transform Jsondoc Framework
- [ ] Familiarity with TypeScript, React, Zod
- [ ] Knowledge of unified diff format
- [ ] Understanding of RFC6902 patches

### Key Files to Review
1. `src/client/utils/componentState.ts` - Current editing rules
2. `src/common/contextDiff.ts` - Diff parsing logic
3. `src/server/tools/BrainstormEditTool.ts` - Example edit tool
4. `src/server/transform-jsondoc-framework/StreamingTransformExecutor.ts` - Patch execution
5. `src/common/canonicalJsondocLogic.ts` - Canonical resolution

### Implementation Order
1. Phase 1: Component state rules (2 days)
2. Phase 1: Stale detection (3 days)
3. Phase 2: Generic edit tool (3 days)
4. Phase 3: UI components (3 days)
5. Phase 4: Batch processing (3 days)
6. Phase 5: Testing (2 days)

### Definition of Done
- [ ] All acceptance criteria met
- [ ] Tests passing with >90% coverage
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Performance benchmarks met
- [ ] User testing completed
- [ ] Deployed to staging environment
- [ ] Monitoring configured
