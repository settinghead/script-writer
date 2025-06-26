# Brainstorm Collection Architecture Refactor Plan

## Overview

This refactor changes the brainstorm generation system from creating multiple individual `brainstorm_idea` artifacts to creating a single `brainstorm_idea_collection` artifact, with path-based transform inputs for subsequent human/AI edits.

## Current Architecture Issues

1. **Multiple Artifacts**: BrainstormTool creates N individual `brainstorm_idea` artifacts
2. **Complex Lineage**: Each idea gets its own lineage chain, complicating resolution
3. **Database Overhead**: N transform outputs, N artifacts for each brainstorm session
4. **Transform Input Limitations**: No path support in `transform_inputs` table

## Proposed Architecture

### Single Collection Artifact
- **One artifact** per brainstorm session: `brainstorm_idea_collection`
- **JSONPath-based editing**: Use `$.ideas[0]`, `$.ideas[1]`, etc. to reference individual ideas
- **JSONPath-aware transforms**: Transform inputs include `artifact_path` field for sub-item operations
- **Root path notation**: Use `$` to specify operations on the entire artifact

## Phase 1: Database Schema Changes ✅ COMPLETED

### 1.1 Add Path Field to Transform Inputs ✅ COMPLETED
```sql
-- Migration: Add artifact_path field to transform_inputs table
ALTER TABLE transform_inputs ADD COLUMN artifact_path TEXT NOT NULL DEFAULT '$';
```

### 1.2 Update Kysely Types ✅ COMPLETED
```typescript
// src/server/database/types.ts
export interface TransformInputs {
  artifact_id: string;
  artifact_path: string; // NEW: JSONPath for sub-item operations, '$' = root, '[0]' = first item, etc.
  id: Generated<number>;
  input_role: string | null;
  project_id: string;
  transform_id: string;
}
```

### 1.3 Add New Artifact Type ✅ COMPLETED
```typescript
// src/common/types.ts
export interface BrainstormIdeaCollectionV1 {
  ideas: Array<{
    title: string;
    body: string;
    metadata?: {
      ideaIndex: number;
      confidence_score?: number;
    };
  }>;
  platform: string;
  genre: string;
  total_ideas: number;
}
```

## Phase 2: Backend Transform System Changes ✅ COMPLETED

### 2.0.1 Fix Transform Name Validation ✅ COMPLETED (Dec 2024)
**Problem**: Backend was rejecting human transform requests with error:
```
Schema transform error: Error: Invalid path '$.ideas[0]' for transform 'edit_brainstorm_idea'
```

**Root Cause**: Frontend was using wrong transform name. The `edit_brainstorm_idea` transform expects:
- **Source**: `brainstorm_idea` (individual idea)
- **Path Pattern**: `^$` (root path only)
- **Target**: `brainstorm_idea`

But we were trying to use it with:
- **Source**: `brainstorm_idea_collection` (collection)
- **Path**: `$.ideas[0]` (JSONPath to specific idea)

**Solution**: Updated frontend to use correct transform name `edit_brainstorm_collection_idea` which expects:
- **Source**: `brainstorm_idea_collection` ✅
- **Path Pattern**: `^\\$.ideas\\[\\d+\\]$` ✅ (matches `$.ideas[0]`, `$.ideas[1]`, etc.)
- **Target**: `brainstorm_idea` ✅
- **Instantiation**: `createBrainstormIdeaFromPath` ✅

**Code Change**:
```typescript
// src/client/components/DynamicBrainstormingResults.tsx
// Before: Wrong transform name
<ArtifactEditor
  transformName="edit_brainstorm_idea"  // ❌ Wrong for collections
  artifactId={collectionId}
  path="$.ideas[0]"
/>

// After: Correct transform name
<ArtifactEditor
  transformName="edit_brainstorm_collection_idea"  // ✅ Correct for collections
  artifactId={collectionId}  
  path="$.ideas[0]"
/>
```

**Result**: Human transforms now work correctly, creating derived `brainstorm_idea` artifacts from collection paths.

### 2.0 Add BrainstormIdeaCollection Types ✅ COMPLETED
```typescript
// src/common/types.ts - Add to TypedArtifact union
export type TypedArtifact =
  | ArtifactWithData<'brainstorm_idea_collection', 'v1', BrainstormIdeaCollectionV1>
  | ArtifactWithData<'brainstorm_idea', 'v1', BrainstormIdeaV1>
  // ... existing types

// src/common/schemas/artifacts.ts - Add collection schema
export const BrainstormIdeaCollectionSchema = z.object({
  ideas: z.array(BrainstormIdeaSchema),
  platform: z.string(),
  genre: z.string(),
  total_ideas: z.number()
});

export const ARTIFACT_SCHEMAS = {
  'brainstorm_idea_collection': BrainstormIdeaCollectionSchema,
  'brainstorm_idea': BrainstormIdeaSchema,
  // ... existing schemas
} as const;
```

### 2.1 Update TransformRepository ✅ COMPLETED
```typescript
// src/server/repositories/TransformRepository.ts
async addTransformInputs(
  transformId: string,
  artifacts: Array<{ 
    artifactId: string; 
    inputRole?: string;
    artifactPath?: string; // NEW: Support JSONPath parameter
  }>,
  projectId: string
): Promise<void> {
  const inputData = artifacts.map(({ artifactId, inputRole, artifactPath }) => ({
    transform_id: transformId,
    artifact_id: artifactId,
    input_role: inputRole || null,
    artifact_path: artifactPath || '$', // NEW: Store JSONPath, '$' = root object
    project_id: projectId
  }));
  // ... rest of implementation
}
```

### 2.2 Refactor BrainstormTool ✅ COMPLETED
```typescript
// src/server/tools/BrainstormTool.ts
export function createBrainstormToolDefinition(/*...*/) {
  return {
    execute: async (params: IdeationInput): Promise<BrainstormToolResult> => {
      // 1. Create single collection artifact instead of multiple
      const collectionData: BrainstormIdeaCollectionV1 = {
        ideas: [],
        platform: params.platform,
        genre: params.genre,
        total_ideas: 0
      };

      // 2. Create collection artifact
      const collectionArtifact = await artifactRepo.createArtifact(
        projectId,
        'brainstorm_idea_collection', // NEW: Single collection type
        collectionData,
        'v1',
        { /* metadata */ }
      );

      // 3. Generate ideas and update collection
      const generatedIdeas = await this.generateIdeas(params);
      const finalCollection = {
        ...collectionData,
        ideas: generatedIdeas,
        total_ideas: generatedIdeas.length
      };

      await artifactRepo.updateArtifact(
        collectionArtifact.id,
        finalCollection,
        { /* metadata */ }
      );

      // 4. Single transform output
      await transformRepo.addTransformOutputs(toolTransformId, [
        { artifactId: collectionArtifact.id, outputRole: 'brainstorm_collection' }
      ], projectId);

      return {
        outputArtifactId: collectionArtifact.id, // Single ID
        finishReason: 'stop'
      };
    }
  };
}
```

### 2.3 Update BrainstormEditTool ✅ COMPLETED
```typescript
// src/server/tools/BrainstormEditTool.ts
export function createBrainstormEditToolDefinition(/*...*/) {
  return {
    execute: async (params: BrainstormEditInput): Promise<BrainstormEditToolResult> => {
      // 1. Get collection artifact
      const sourceArtifact = await artifactRepo.getArtifact(params.sourceArtifactId);
      
      // 2. Extract specific idea using JSONPath
      const ideaPath = `$.ideas[${params.ideaIndex}]`;
      const originalIdea = extractDataAtPath(sourceArtifact.data, ideaPath);

      // 3. Create transform with JSONPath-aware input
      await transformRepo.addTransformInputs(toolTransformId, [
        { 
          artifactId: params.sourceArtifactId, 
          inputRole: 'source_collection',
          artifactPath: ideaPath // NEW: Specify which idea in collection using JSONPath
        }
      ], projectId);

      // 4. Create new individual brainstorm_idea artifact (edited version)
      const editedArtifact = await artifactRepo.createArtifact(
        projectId,
        'brainstorm_idea', // Individual edited idea
        editedIdea,
        'v1',
        {
          source_collection_id: params.sourceArtifactId,
          source_idea_path: ideaPath,
          // ... other metadata
        }
      );

      return {
        outputArtifactId: editedArtifact.id,
        finishReason: 'stop'
      };
    }
  };
}
```

## Phase 3: Lineage Resolution Updates ✅ COMPLETED

### 3.1 Update Lineage Graph Building ✅ COMPLETED
```typescript
// src/common/utils/lineageResolution.ts
export function buildLineageGraph(/*...*/) {
  // ... existing code ...

  // Handle JSONPath-aware transform inputs
  for (const input of transformInputs) {
    const path = input.artifact_path; // Always has value: '$' for root or specific JSONPath
    
    if (path !== '$') {
      // Create path-specific lineage tracking for any sub-artifact operations
      const pathKey = `${input.artifact_id}:${path}`;
      if (!paths.has(pathKey)) {
        paths.set(pathKey, []);
      }
      // ... rest of path handling
    }
    // If path === '$', it's operating on the whole artifact (existing behavior)
  }
}
```

### 3.2 Path-Based Artifact Resolution ✅ COMPLETED
```typescript
// src/common/utils/lineageResolution.ts
export function findLatestArtifactForPath(
  sourceArtifactId: string,
  artifactPath: string,
  graph: LineageGraph
): LineageResolutionResult {
  // 1. Find all transforms that used this artifact + path as input
  const pathKey = `${sourceArtifactId}:${artifactPath}`;
  const pathLineage = graph.paths.get(pathKey);

  if (pathLineage && pathLineage.length > 0) {
    // 2. Follow lineage to find latest derived artifact
    const latestTransform = pathLineage[pathLineage.length - 1];
    // ... resolve to final derived artifact
  }

  // 3. If no edits found, return original artifact + path
  return {
    artifactId: sourceArtifactId,
    path: artifactPath,
    depth: 0,
    lineagePath: []
  };
}
```

### 2.4 Update Additional Backend Services

**ArtifactRepository Changes:**
```typescript
// src/server/repositories/ArtifactRepository.ts
async getLatestBrainstormIdeas(projectId: string): Promise<Artifact[]> {
  // NEW: Get brainstorm collections instead of individual ideas
  const collections = await this.getProjectArtifactsByType(projectId, 'brainstorm_idea_collection');
  
  // Extract individual ideas with lineage resolution
  const allIdeas: Artifact[] = [];
  for (const collection of collections) {
    for (let i = 0; i < collection.data.ideas.length; i++) {
      const artifactPath = `$.ideas[${i}]`;
      const latestVersion = findLatestArtifactForPath(collection.id, artifactPath, graph);
      if (latestVersion.artifactId) {
        allIdeas.push(await this.getArtifact(latestVersion.artifactId));
      }
    }
  }
  return allIdeas;
}

async getBrainstormCollections(projectId: string): Promise<Artifact[]> {
  return this.getProjectArtifactsByType(projectId, 'brainstorm_idea_collection');
}
```

**Services to Update:**
- `src/server/services/AgentService.ts` - Update brainstorm context preparation
- `src/server/services/OutlineService.ts` - Handle both collections and individual ideas  
- `src/server/services/ProjectService.ts` - Update project preview generation
- `src/server/services/TransformExecutor.ts` - Handle collection artifact creation
- `src/server/services/HumanTransformExecutor.ts` - Support JSONPath extraction

**Routes to Update:**
- `src/server/routes/artifactRoutes.ts` - Validate collection artifacts
- `src/server/routes/outlineRoutes.ts` - Support both individual and collection sources

**Transform System Updates:**
```typescript
// src/common/schemas/transforms.ts - Update transform definitions
export const HUMAN_TRANSFORM_DEFINITIONS = {
  'edit_brainstorm_collection_idea': {
    name: 'edit_brainstorm_collection_idea',
    description: 'Edit individual idea within brainstorm collection',
    sourceArtifactType: 'brainstorm_idea_collection',
    targetArtifactType: 'brainstorm_idea',
    pathPattern: '^\\$.ideas\\[\\d+\\]$', // JSONPath for ideas[n]
    instantiationFunction: 'createBrainstormIdeaFromPath'
  },
  'edit_artifact_field': {
    name: 'edit_artifact_field',
    description: 'Generic field editing using JSONPath',
    sourceArtifactType: '*', // Any artifact type
    targetArtifactType: '*', // Flexible output type
    pathPattern: '^\\$\\.[a-zA-Z_][a-zA-Z0-9_]*.*$', // Any valid JSONPath
    instantiationFunction: 'createFieldEditFromPath'
  },
  // ... existing definitions (keep for backward compatibility)
};

export const LLM_TRANSFORM_DEFINITIONS = {
  'llm_edit_brainstorm_collection_idea': {
    name: 'llm_edit_brainstorm_collection_idea',
    description: 'AI editing of ideas within brainstorm collections',
    inputTypes: ['brainstorm_idea_collection'],
    outputType: 'brainstorm_idea',
    templateName: 'brainstormEdit',
    inputSchema: BrainstormEditInputSchema,
    outputSchema: BrainstormEditOutputSchema
  },
  'llm_edit_artifact_path': {
    name: 'llm_edit_artifact_path',
    description: 'Generic AI editing using JSONPath',
    inputTypes: ['*'], // Any artifact type
    outputType: '*', // Flexible output type
    templateName: 'genericEdit',
    inputSchema: GenericEditInputSchema,
    outputSchema: GenericEditOutputSchema
  },
  // ... existing definitions
};
```

## Phase 4: Frontend Changes ✅ COMPLETED

### 4.1 Update Project Data Context ✅ COMPLETED
```typescript
// src/client/contexts/ProjectDataContext.tsx
export interface ProjectDataContextType {
  // ... existing ...

  // NEW: Collection-aware selectors
  getBrainstormCollections: () => ElectricArtifact[];
  getIdeaFromCollection: (collectionId: string, ideaIndex: number) => IdeaWithTitle | null;
  getLatestIdeaVersion: (collectionId: string, ideaIndex: number) => string | null;
}
```

### 4.2 Update DynamicBrainstormingResults ✅ COMPLETED

### 4.2.1 Fix Duplicate Ideas Issue ✅ COMPLETED (Dec 2024)
**Problem**: After implementing human transforms for brainstorm collections, the frontend was displaying duplicate ideas:
- Original collection ideas (e.g., 3 ideas from `brainstorm_idea_collection`) 
- Plus derived individual artifacts (e.g., 1 additional `brainstorm_idea` from human transform)
- Total: 4 ideas displayed instead of 3

**Root Cause**: The `useLatestBrainstormIdeas` hook had two sections:
1. **Collection processing**: Correctly used lineage resolution to show either original collection items or their derived versions
2. **Legacy individual ideas**: Added ALL standalone `brainstorm_idea` artifacts, including those derived from collections

**Solution Applied**:
1. **Removed Legacy Duplicate Logic**: Updated the legacy section to properly filter out artifacts derived from collections using lineage graph analysis
2. **Simplified Component Architecture**: Refactored `BrainstormIdeaCard` to accept direct artifact properties instead of collection references
3. **Fixed Transform Name Logic**: Properly select transform names based on artifact type and path:
   - `edit_brainstorm_idea`: For leaf artifacts (path = `$`)  
   - `edit_brainstorm_collection_idea`: For collection paths (path = `$.ideas[n]`)
4. **Corrected Artifact Display**: 
   - **Derived artifacts**: Use leaf artifact ID with `$` path (root)
   - **Collection items**: Use collection ID with JSONPath (e.g., `$.ideas[0]`)

**Key Code Changes**:
```typescript
// Before: Broken duplicate detection
const isDerivedFromCollection = lineageGraph.nodes.get(artifact.id)?.inputs?.some(input => 
  collectionIds.has(input.artifactId)
);

// After: Proper lineage analysis
const artifactNode = lineageGraph.nodes.get(artifact.id);
let hasCollectionSource = false;

if (artifactNode && artifactNode.type === 'artifact' && artifactNode.sourceTransform !== 'none') {
  const sourceTransform = artifactNode.sourceTransform;
  if (sourceTransform.sourceArtifacts) {
    hasCollectionSource = sourceTransform.sourceArtifacts.some(sourceArtifact => 
      collectionIds.has(sourceArtifact.artifactId)
    );
  }
}
```

**Result**: Now correctly displays 3 ideas total, with edited ideas properly replacing their original versions instead of appearing as duplicates.
```typescript
// src/client/components/DynamicBrainstormingResults.tsx
function useLatestBrainstormIdeas(): IdeaWithTitle[] {
  const projectData = useProjectData();

  return useMemo(() => {
    // 1. Get all brainstorm collections
    const collections = projectData.getBrainstormCollections();
    
    // 2. Extract ideas from collections with lineage resolution
    const allIdeas: IdeaWithTitle[] = [];
    
    for (const collection of collections) {
      const collectionData = JSON.parse(collection.data);
      
      for (let i = 0; i < collectionData.ideas.length; i++) {
        // 3. Resolve latest version for each idea
        const artifactPath = `$.ideas[${i}]`;
        const latestArtifactId = projectData.getLatestVersionForPath(collection.id, artifactPath);
        
        if (latestArtifactId) {
          // Use individual edited version
          const latestArtifact = projectData.getArtifactById(latestArtifactId);
          const ideaData = JSON.parse(latestArtifact.data);
          
          allIdeas.push({
            title: ideaData.title,
            body: ideaData.body,
            artifactId: latestArtifactId,
            originalArtifactId: collection.id,
            artifactPath: `$.ideas[${i}]`,
            index: i
          });
        } else {
          // Use original from collection
          const originalIdea = collectionData.ideas[i];
          
          allIdeas.push({
            title: originalIdea.title,
            body: originalIdea.body,
            artifactId: collection.id, // Base artifact ID
            originalArtifactId: collection.id,
            artifactPath: `$.ideas[${i}]`, // JSONPath to specific item
            index: i
          });
        }
      }
    }

    return allIdeas;
  }, [projectData]);
}
```

### 4.3 Update Frontend Services & Components



**ProjectDataContext Updates:**
```typescript
// src/client/contexts/ProjectDataContext.tsx
export interface ProjectDataContextType {
  // ... existing ...
  getBrainstormCollections: () => ElectricArtifact[];
  getArtifactAtPath: (artifactId: string, artifactPath: string) => any | null;
  getLatestVersionForPath: (artifactId: string, artifactPath: string) => string | null;
}

// Implementation
const getBrainstormCollections = useCallback(() => {
  return artifacts?.filter(a => a.type === 'brainstorm_idea_collection') || [];
}, [artifacts]);

const getLatestVersionForPath = useCallback((artifactId: string, artifactPath: string) => {
  const graph = getLineageGraph();
  const result = findLatestArtifactForPath(artifactId, artifactPath, graph);
  return result.artifactId === artifactId ? null : result.artifactId;
}, [getLineageGraph]);
```

**Component Updates:**
- `src/client/components/DynamicBrainstormingResults.tsx` - Handle collections with path-based editing
- `src/client/components/ProjectBrainstormPage.tsx` - Support mixed collection/individual display
- `src/client/components/StoryInspirationEditor.tsx` - Support path-based artifact editing
- `src/client/components/RawGraphVisualization.tsx` - Add collection node styling
- `src/client/components/OutlineParameterSummary.tsx` - Handle path-based artifact sources

**Store Updates:**
```typescript
// src/client/stores/projectStore.ts
interface ProjectState {
  brainstormCollections?: any[]; // NEW: Collections
  brainstormIdeas?: any[]; // LEGACY: Keep for backward compatibility
}

interface ProjectActions {
  setBrainstormCollections: (projectId: string, collections: any[]) => void;
  setBrainstormIdeas: (projectId: string, ideas: any[]) => void; // LEGACY
}
```

### 4.4 Update ArtifactEditor ✅ COMPLETED (Dec 2024)

### 4.4.1 Clean Hierarchical Refactor ✅ COMPLETED (Dec 2024)
**Problem**: The original `ArtifactEditor` component became a monolithic mess with complex logic crammed into one component, making it difficult to debug and maintain.

**Solution**: Implemented a clean, hierarchical architecture with separate sub-components:

**New Architecture**:
```typescript
// src/client/components/shared/ArtifactEditor.tsx

// 1. ArtifactFragment interface - represents resolved data
interface ArtifactFragment {
  artifactId: string;
  data: any;
  isEditable: boolean;
  hasHumanTransforms: boolean;
}

// 2. ReadOnlyView component - handles non-editable artifacts with click-to-edit
const ReadOnlyView: React.FC<ReadOnlyViewProps> = ({ fragment, fields, onEdit }) => {
  // Clean read-only display with click-to-edit functionality
};

// 3. EditableView component - handles editable artifacts with auto-save
const EditableView: React.FC<EditableViewProps> = ({ fragment, fields, onSave }) => {
  // Clean editable interface with debounced auto-save
};

// 4. Main ArtifactEditor - resolves fragment and routes to appropriate sub-component
export const ArtifactEditor: React.FC<ArtifactEditorProps> = ({
  artifactId,
  path = "",
  transformName,
  fields = [],
  // ... other props
}) => {
  // Resolve artifact fragment with lineage
  const fragment = useArtifactFragment(artifactId, path);
  
  // Route to appropriate sub-component
  if (fragment.isEditable) {
    return <EditableView fragment={fragment} fields={fields} onSave={handleSave} />;
  } else {
    return <ReadOnlyView fragment={fragment} fields={fields} onEdit={handleEdit} />;
  }
};
```

**Key Improvements**:
1. **Separation of Concerns**: Each sub-component has a single responsibility
2. **Fragment Resolution**: Clean artifact + path resolution at the top level
3. **Proper Lineage Handling**: Checks for existing human transforms and uses derived artifacts
4. **Type Safety**: Proper TypeScript interfaces and error handling
5. **Debugging**: Clear component boundaries and logging

**Fragment Resolution Logic**:
```typescript
const useArtifactFragment = (artifactId: string, path: string): ArtifactFragment => {
  // 1. Check for existing human transforms for this path
  const humanTransforms = projectData.getHumanTransformsForArtifactPath(artifactId, path);
  
  // 2. Use the derived artifact if human transform exists
  let targetArtifact;
  if (humanTransforms.length > 0) {
    const latestTransform = humanTransforms[humanTransforms.length - 1];
    targetArtifact = projectData.getArtifactById(latestTransform.derived_artifact_id);
  } else {
    targetArtifact = projectData.getArtifactById(artifactId);
  }
  
  // 3. Extract data at path and return fragment
  const extractedData = path ? extractDataAtPath(parsedData, path) : parsedData;
  
  return {
    artifactId: targetArtifact.id,
    data: extractedData,
    isEditable: targetArtifact.type === 'user_input',
    hasHumanTransforms: humanTransforms.length > 0
  };
};
```

**Result**: Clean, maintainable component architecture that properly handles both collection paths and individual artifacts without the previous complexity.

### 4.5 Update Field Configurations & Constants

**Field Configs:**
```typescript
// src/client/components/shared/fieldConfigs.ts
export const BRAINSTORM_IDEA_COLLECTION_FIELDS = FIELD_CONFIGS.TITLE_BODY;
export const BRAINSTORM_IDEA_FIELDS = FIELD_CONFIGS.TITLE_BODY; // Keep for compatibility
```

**Graph Visualization:**
```typescript
// src/client/components/RawGraphVisualization.tsx
const getNodeColor = (type: string): string => {
  switch (type) {
    case 'brainstorm_idea_collection': return '#1890ff'; // Blue for collections
    case 'brainstorm_idea': return '#52c41a'; // Green for individual ideas
    // ... existing colors
  }
};
```

**Transform Names:**
```typescript
// Update all components using these transform names:
// - 'edit_brainstorm_idea' → 'edit_brainstorm_collection_idea' (brainstorm-specific)
// - 'llm_edit_brainstorm_idea' → 'llm_edit_brainstorm_collection_idea' (brainstorm-specific)
// - Add generic transforms: 'edit_artifact_field', 'llm_edit_artifact_path'
// Keep old names for backward compatibility
```

### 4.6 Additional Files Needing Updates

**Scripts & Testing:**
- `src/server/scripts/test-lineage-brainstorm-ideas.ts` - Test collection lineage
- `src/client/hooks/README.md` - Update documentation
- `README.md` - Update architecture documentation

**Transform Instantiations:**
```typescript
// src/server/services/transform-instantiations/pathTransforms.ts
export function createBrainstormIdeaFromPath(
  sourceArtifactData: any,
  artifactPath: string
): BrainstormIdea {
  const extractedData = extractDataAtPath(sourceArtifactData, artifactPath);
  
  // Validate that extracted data matches BrainstormIdea schema
  const result = BrainstormIdeaSchema.safeParse(extractedData);
  if (!result.success) {
    throw new Error(`Data at path ${artifactPath} does not match BrainstormIdea schema: ${result.error.message}`);
  }
  
  return result.data;
}

export function createFieldEditFromPath(
  sourceArtifactData: any,
  artifactPath: string
): any {
  // Generic field extraction using JSONPath
  return extractDataAtPath(sourceArtifactData, artifactPath);
}

// Update existing functions to handle both collections and individual ideas
export function createOutlineInputFromPath(/*...*/) {
  // Handle any artifact type with JSONPath extraction
}
```

**Transform Instantiation Registry:**
```typescript
// src/server/services/TransformInstantiationRegistry.ts
constructor() {
  // ... existing registrations
  this.functions.set('createBrainstormIdeaFromPath', createBrainstormIdeaFromPath);
  this.functions.set('createFieldEditFromPath', createFieldEditFromPath);
  this.functions.set('createOutlineInputFromPath', createOutlineInputFromPath);
}
```

## Phase 5: Migration Strategy

### 5.1 Data Migration Script
```typescript
// src/server/scripts/migrate-to-collections.ts
export async function migrateExistingBrainstormData() {
  // 1. Find all existing individual brainstorm_idea artifacts
  // 2. Group by creation time/session to reconstruct collections
  // 3. Create new brainstorm_idea_collection artifacts
  // 4. Update transform relationships
  // 5. Mark old artifacts as deprecated (don't delete for safety)
}
```

### 5.2 Backward Compatibility
- Keep support for reading old individual `brainstorm_idea` artifacts
- Provide fallback logic in lineage resolution
- Add migration status tracking

## Critical Architecture Insights

### 🚨 **Electric SQL Real-Time Sync**
The application uses **Electric SQL** for real-time data synchronization. This adds significant complexity:
- All artifacts are synced via Electric SQL in real-time
- Frontend uses `useShape` hooks for real-time subscriptions
- `ElectricArtifact` type uses string data (not parsed JSON)
- Electric proxy routes have security filtering by `project_id`

### 🚨 **Project-Based Access Control** 
The system uses **project-based access control**, NOT user-based:
- All artifacts have `project_id` fields (not `user_id`)
- Access control via `projects_users` junction table
- All database queries must filter by project membership
- Electric proxy enforces project-level security



### 🚨 **Validation & Type Guards**
Extensive validation system:
- Zod schemas for new artifacts, legacy validation for existing
- `validateArtifactData` function with type guards
- Schema registry pattern in `ARTIFACT_SCHEMAS`
- Frontend/backend type alignment critical

## Complete File Inventory

### Files Requiring Major Changes:
1. **`src/common/schemas/artifacts.ts`** - Add collection schema
2. **`src/common/schemas/transforms.ts`** - Add collection transform definitions
3. **`src/common/types.ts`** - Add collection types, update union types
4. **`src/common/utils/lineageResolution.ts`** - Add JSONPath-aware lineage resolution
5. **`src/server/tools/BrainstormTool.ts`** - Generate single collection instead of multiple artifacts
6. **`src/server/tools/BrainstormEditTool.ts`** - Support JSONPath-based editing
7. **`src/server/repositories/ArtifactRepository.ts`** - Add collection methods
8. **`src/server/repositories/TransformRepository.ts`** - Add artifact_path support
9. **`src/server/services/TransformExecutor.ts`** - Handle collection creation
10. **`src/server/services/AgentService.ts`** - Update brainstorm context handling
11. **`src/client/components/DynamicBrainstormingResults.tsx`** - Collection-aware rendering
12. **`src/client/contexts/ProjectDataContext.tsx`** - Add collection selectors

### Files Requiring Minor Changes:
13. **`src/server/services/OutlineService.ts`** - Support path-based artifact sources
14. **`src/server/services/ProjectService.ts`** - Update preview generation

16. **`src/server/services/HumanTransformExecutor.ts`** - JSONPath extraction
17. **`src/server/routes/artifactRoutes.ts`** - Validate collections
18. **`src/server/routes/outlineRoutes.ts`** - Support path-based artifact sources
19. **`src/client/components/ProjectBrainstormPage.tsx`** - Mixed display support
20. **`src/client/components/StoryInspirationEditor.tsx`** - Path-based artifact editing
21. **`src/client/components/RawGraphVisualization.tsx`** - Collection node styling
22. **`src/client/components/OutlineParameterSummary.tsx`** - Path-based source display
23. **`src/client/components/shared/fieldConfigs.ts`** - Add collection fields

25. **`src/client/stores/projectStore.ts`** - Add collection state
26. **`src/server/services/transform-instantiations/pathTransforms.ts`** - Path-based transforms
27. **`src/server/services/TransformInstantiationRegistry.ts`** - Register path-based functions

### Files Requiring Documentation Updates:
28. **`README.md`** - Update architecture documentation
29. **`src/client/hooks/README.md`** - Update hook documentation
30. **`src/server/scripts/test-lineage-brainstorm-ideas.ts`** - Update test script

### Critical Infrastructure Files:
28. **`src/common/config/electric.ts`** - Electric SQL configuration
29. **`src/server/routes/electricProxy.ts`** - Electric sync security & routing
30. **`src/server/database/auth.ts`** - Authentication & project access control

### Database Migration:
31. **New migration file** - Add `artifact_path` column to `transform_inputs`

## Implementation Order & Risk Assessment

### ⚠️ **High-Risk Dependencies**
1. **Electric SQL Sync** - Collection artifacts must sync properly via Electric
2. **Project-Based Security** - All collection operations must respect project access control

### 📋 **Implementation Phases**

1. **Phase 1**: Database schema & validation
   - Add `artifact_path` column to `transform_inputs` 
   - Add `brainstorm_idea_collection` to validation system
   - Update Electric proxy to allow collection sync
   
2. **Phase 2**: Backend core systems
   - Update repositories with collection support
   - Refactor BrainstormTool for single collection output
   - Update transform system with JSONPath support
   
3. **Phase 3**: Frontend & lineage resolution
   - Update ProjectDataContext for collection selectors
   - Implement JSONPath-aware lineage resolution
   - Update UI components for collection rendering
   - Ensure Electric SQL syncs collections properly
   
4. **Phase 4**: Integration & validation
   - Verify project-based access control
   - Update export/import functionality
   - Test Electric SQL real-time updates
   
5. **Phase 5**: Migration & cleanup
   - Data migration script for existing individual ideas
   - Backward compatibility testing
   - Documentation updates

## Benefits

1. **Simplified Lineage**: One collection → individual edits (instead of N parallel chains)
2. **Better Performance**: Single artifact creation instead of N artifacts per session
3. **Cleaner Database**: Fewer transform outputs and relationships
4. **JSONPath-Based Operations**: Enable fine-grained editing within collections using standard JSONPath
5. **Scalability**: Easier to handle large brainstorm sessions
6. **Clear Path Semantics**: `$` for root, `$.ideas[0]` for specific items - no ambiguity

## Risks & Considerations

### 🔴 **Critical Risks**
1. **Electric SQL Compatibility**: Collection artifacts must sync properly with Electric SQL real-time system
2. **Project Security**: All collection operations must respect project-based access control (not user-based)

### 🟡 **Medium Risks** 
3. **Breaking Changes**: Existing data must be migrated from individual to collection format
4. **JSONPath Complexity**: JSONPath operations add complexity but use standard notation
5. **UI Complexity**: Frontend must handle mixed individual/collection artifacts during transition
6. **Performance Impact**: Single large collection artifacts vs multiple small individual artifacts

### 🟢 **Low Risks**
7. **Rollback Difficulty**: Hard to revert once migrated, but migration can be staged
8. **Type Safety**: Extensive validation system should catch most issues early

## Testing Strategy

### 🧪 **Critical Test Areas**
1. **Electric SQL Sync**: Verify collections sync properly in real-time
2. **Project Security**: Verify all collection operations respect project access control
3. **JSONPath Operations**: Test path extraction, validation, and lineage resolution

### 🔬 **Standard Test Coverage**
4. **Unit Tests**: Transform logic, validation, path extraction
5. **Integration Tests**: End-to-end brainstorm → edit → display workflows  
6. **Migration Tests**: Verify existing data converts correctly
7. **Performance Tests**: Compare single collection vs. multiple artifacts
8. **Backward Compatibility**: Mixed collection/individual artifact handling

## Recent Implementation Status (December 2024)

### ✅ **Successfully Completed**
1. **Collection Architecture**: Single `brainstorm_idea_collection` artifacts are generated and synced via Electric SQL
2. **JSONPath Transforms**: Human transforms work correctly with `edit_brainstorm_collection_idea` and JSONPath patterns
3. **Lineage Resolution**: Proper lineage tracking from collection paths to derived individual artifacts
4. **UI Display**: Clean display of 3 ideas without duplicates, with proper edit state tracking
5. **Component Architecture**: Clean hierarchical `ArtifactEditor` with separate read-only and editable sub-components

### 🎯 **Current Working State**
- **Brainstorm Generation**: Creates single collection with multiple ideas ✅
- **Idea Editing**: Click-to-edit creates human transforms and derived artifacts ✅
- **Lineage Tracking**: Properly tracks collection → individual idea derivations ✅
- **UI Display**: Shows correct number of ideas with proper edit indicators ✅
- **Transform Validation**: Backend properly validates collection-based transforms ✅

### 🔄 **Key Architectural Decisions Validated**
1. **Single Collection Approach**: Reduces database overhead and simplifies lineage
2. **JSONPath-Based Editing**: Enables fine-grained editing within collections
3. **Derived Artifact Pattern**: Human-edited ideas become standalone `brainstorm_idea` artifacts
4. **Project-Based Security**: All operations properly respect project access control
5. **Electric SQL Compatibility**: Collections sync properly in real-time

### 📊 **Performance Impact**
- **Before**: N individual artifacts + N transform outputs per brainstorm session
- **After**: 1 collection artifact + individual artifacts only for edited ideas
- **Result**: Significant reduction in database operations and improved UI performance

The brainstorm collection architecture refactor is now **fully functional** and provides a solid foundation for future enhancements. 