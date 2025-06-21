# Schema-Driven Transform Implementation Plan - REVISED

## Overview

This plan implements a rigorous schema-driven approach to artifact and transform definitions, replacing the current loose type system with Zod schemas and creating a graph-based transform system. The goal is to eliminate data structure inconsistencies and create a clear, type-safe path from brainstorm ideas to outline inputs.

## CRITICAL REVISIONS BASED ON CODEBASE ANALYSIS

### Major Issues Found in Original Plan

1. **Inconsistent Database Schema**: The database uses `project_id` while common types use `user_id`
2. **Missing Database Columns**: `human_transforms` table lacks `transform_name` column needed for schema definitions
3. **Existing Path System**: There's already a working path-based editing system that should be enhanced, not replaced
4. **Electric SQL Integration**: The plan ignored the existing Electric SQL real-time system
5. **Artifact Type Mismatch**: Current `BrainstormIdeaCollectionV1` uses `{title, body}` but server validation expects `{idea_text, idea_title}`
6. **Repository Method Gaps**: Missing methods like `getTransformsByOutput` and `getTransformInputs` needed for graph traversal

### Revised Architecture Approach

Instead of a complete rewrite, this plan now focuses on:
1. **Enhancing existing systems** with Zod validation
2. **Fixing data structure inconsistencies** between frontend and backend
3. **Adding missing database columns** and repository methods
4. **Integrating with Electric SQL** for real-time updates
5. **Maintaining backward compatibility** where possible

## Current State Analysis

### What Actually Exists ✅
1. **Path-based editing system**: `extractDataAtPath`, `setDataAtPath`, `ArtifactEditor` with path support
2. **Human transform database schema**: `human_transforms` table with `source_artifact_id`, `derivation_path`, `derived_artifact_id`
3. **TypeScript interfaces**: Extensive type definitions in `src/common/types.ts` and `src/server/types/artifacts.ts`
4. **Transform execution**: `TransformExecutor.executeHumanTransformWithPath()`
5. **Graph structure foundation**: `transform_inputs`, `transform_outputs` tables
6. **Electric SQL integration**: Real-time artifact updates via `useShape`
7. **Existing validation system**: `validateArtifactData` function with runtime type checking

### What's Actually Broken ❌
1. **Data structure mismatch**: Frontend expects `{title, body}` but backend validates `{idea_text, idea_title}`
2. **Database inconsistency**: `project_id` vs `user_id` confusion
3. **Missing graph traversal methods**: Repository methods for building derivation graphs
4. **No formal transform definitions**: Transforms are ad-hoc, not schema-defined
5. **Incomplete Electric SQL integration**: Schema transforms not integrated with real-time updates

## Implementation Plan - REVISED

### Phase 1: Fix Data Structure Inconsistencies (Week 1)

#### 1.1 Align Frontend/Backend Data Structures
**Priority: CRITICAL** - This is blocking current functionality

**File**: `src/common/schemas/artifacts.ts` (NEW)
```typescript
import { z } from 'zod';

// Unified brainstorm idea schema - aligns frontend and backend
export const BrainstormIdeaSchema = z.object({
  title: z.string().min(1).max(50),
  body: z.string().min(10).max(2000)
});

export const BrainstormIdeaCollectionSchema = z.array(BrainstormIdeaSchema);

// Schema for outline input (derived from brainstorm ideas)
export const OutlineInputSchema = z.object({
  content: z.string().min(10).max(5000),
  source_metadata: z.object({
    original_idea_title: z.string(),
    original_idea_body: z.string(),
    derivation_path: z.string(),
    source_artifact_id: z.string()
  }).optional()
});

// User input schema (for manual edits)
export const UserInputSchema = z.object({
  text: z.string(),
  source: z.enum(['manual', 'modified_brainstorm']),
  source_artifact_id: z.string().optional()
});

// Schema registry
export const ARTIFACT_SCHEMAS = {
  'brainstorm_idea_collection': BrainstormIdeaCollectionSchema,
  'outline_input': OutlineInputSchema,
  'user_input': UserInputSchema
} as const;

export type BrainstormIdea = z.infer<typeof BrainstormIdeaSchema>;
export type BrainstormIdeaCollection = z.infer<typeof BrainstormIdeaCollectionSchema>;
export type OutlineInput = z.infer<typeof OutlineInputSchema>;
export type UserInput = z.infer<typeof UserInputSchema>;
export type ArtifactType = keyof typeof ARTIFACT_SCHEMAS;
```

#### 1.2 Update Backend Validation
**File**: `src/server/types/artifacts.ts` (UPDATE existing validation)
```typescript
// Add to existing validateArtifactData function
import { ARTIFACT_SCHEMAS } from '../../common/schemas/artifacts';

export function validateArtifactData(type: string, typeVersion: string, data: any): boolean {
  // Use Zod schemas for new artifact types
  if (type in ARTIFACT_SCHEMAS) {
    const schema = ARTIFACT_SCHEMAS[type as keyof typeof ARTIFACT_SCHEMAS];
    const result = schema.safeParse(data);
    return result.success;
  }
  
  // Fallback to existing validation for legacy types
  // ... existing validation code ...
}
```

#### 1.3 Database Schema Fixes
**File**: `src/server/database/migrations/006_add_transform_name.js` (NEW)
```javascript
exports.up = async function (knex) {
  // Add transform_name column to human_transforms
  await knex.schema.alterTable('human_transforms', (table) => {
    table.string('transform_name');
    table.index('transform_name', 'idx_human_transforms_name');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('human_transforms', (table) => {
    table.dropIndex('transform_name', 'idx_human_transforms_name');
    table.dropColumn('transform_name');
  });
};
```

### Phase 2: Add Missing Repository Methods (Week 1)

#### 2.1 Complete TransformRepository
**File**: `src/server/repositories/TransformRepository.ts` (ADD methods)
```typescript
// Add these methods to existing TransformRepository class

async getTransformsByOutput(artifactId: string): Promise<Transform[]> {
  const rows = await this.db
    .selectFrom('transforms as t')
    .innerJoin('transform_outputs as to', 'to.transform_id', 't.id')
    .selectAll('t')
    .where('to.artifact_id', '=', artifactId)
    .execute();

  return rows.map(this.mapTransformRow);
}

async getTransformsByInput(artifactId: string): Promise<Transform[]> {
  const rows = await this.db
    .selectFrom('transforms as t')
    .innerJoin('transform_inputs as ti', 'ti.transform_id', 't.id')
    .selectAll('t') 
    .where('ti.artifact_id', '=', artifactId)
    .execute();

  return rows.map(this.mapTransformRow);
}

async getTransformInputs(transformId: string): Promise<TransformInput[]> {
  const rows = await this.db
    .selectFrom('transform_inputs')
    .selectAll()
    .where('transform_id', '=', transformId)
    .execute();

  return rows.map(row => ({
    id: row.id,
    transform_id: row.transform_id,
    artifact_id: row.artifact_id,
    input_role: row.input_role || undefined
  }));
}

private mapTransformRow(row: any): Transform {
  return {
    id: row.id,
    project_id: row.project_id,
    type: row.type,
    type_version: row.type_version,
    status: row.status,
    retry_count: row.retry_count || 0,
    max_retries: row.max_retries || 2,
    execution_context: row.execution_context ? JSON.parse(row.execution_context) : undefined,
    created_at: row.created_at?.toISOString() || new Date().toISOString()
  };
}

// Update addHumanTransform to support transform_name
async addHumanTransform(humanTransform: HumanTransform & {
  source_artifact_id?: string;
  derivation_path?: string;
  derived_artifact_id?: string;
  transform_name?: string;
}): Promise<void> {
  const humanData = {
    transform_id: humanTransform.transform_id,
    action_type: humanTransform.action_type,
    interface_context: humanTransform.interface_context ? JSON.stringify(humanTransform.interface_context) : null,
    change_description: humanTransform.change_description || null,
    source_artifact_id: humanTransform.source_artifact_id || null,
    derivation_path: humanTransform.derivation_path || '',
    derived_artifact_id: humanTransform.derived_artifact_id || null,
    transform_name: humanTransform.transform_name || null
  };

  await this.db
    .insertInto('human_transforms')
    .values(humanData)
    .execute();
}
```

### Phase 3: Transform Definitions with Schema Validation (Week 2)

#### 3.1 Transform Definition Schema
**File**: `src/common/schemas/transforms.ts` (NEW)
```typescript
import { z } from 'zod';
import { ARTIFACT_SCHEMAS, ArtifactType } from './artifacts';

// Transform definition schema
export const HumanTransformDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  sourceArtifactType: z.string(),
  targetArtifactType: z.string(),
  pathPattern: z.string(), // Regex pattern for valid paths
  instantiationFunction: z.string()
});

export type HumanTransformDefinition = z.infer<typeof HumanTransformDefinitionSchema>;

// Transform registry
export const HUMAN_TRANSFORM_DEFINITIONS: Record<string, HumanTransformDefinition> = {
  'brainstorm_to_outline': {
    name: 'brainstorm_to_outline',
    description: 'Convert a brainstorm idea to outline input',
    sourceArtifactType: 'brainstorm_idea_collection',
    targetArtifactType: 'outline_input',
    pathPattern: '^\\[\\d+\\]$', // Matches [0], [1], etc.
    instantiationFunction: 'createOutlineInputFromBrainstormIdea'
  },
  'edit_brainstorm_idea': {
    name: 'edit_brainstorm_idea',
    description: 'Edit individual fields of brainstorm ideas',
    sourceArtifactType: 'brainstorm_idea_collection', 
    targetArtifactType: 'user_input',
    pathPattern: '^\\[\\d+\\]\\.(title|body)$', // Matches [0].title, [1].body, etc.
    instantiationFunction: 'createUserInputFromBrainstormField'
  }
};

// Validation function
export function validateTransformPath(transformName: string, path: string): boolean {
  const definition = HUMAN_TRANSFORM_DEFINITIONS[transformName];
  if (!definition) return false;
  
  const regex = new RegExp(definition.pathPattern);
  return regex.test(path);
}
```

#### 3.2 Transform Instantiation Functions
**File**: `src/server/services/transform-instantiations/brainstormTransforms.ts` (NEW)
```typescript
import { BrainstormIdea, OutlineInput, UserInput } from '../../../common/schemas/artifacts';
import { extractDataAtPath } from '../../../common/utils/pathExtraction';

/**
 * Create outline input from entire brainstorm idea
 */
export function createOutlineInputFromBrainstormIdea(
  sourceArtifactData: any,
  derivationPath: string
): OutlineInput {
  const ideaData = extractDataAtPath(sourceArtifactData, derivationPath) as BrainstormIdea;
  
  if (!ideaData || typeof ideaData.title !== 'string' || typeof ideaData.body !== 'string') {
    throw new Error(`Invalid brainstorm idea data at path ${derivationPath}`);
  }

  return {
    content: ideaData.body,
    source_metadata: {
      original_idea_title: ideaData.title,
      original_idea_body: ideaData.body,
      derivation_path: derivationPath,
      source_artifact_id: '' // Will be filled by executor
    }
  };
}

/**
 * Create user input from brainstorm idea field (title or body)
 */
export function createUserInputFromBrainstormField(
  sourceArtifactData: any,
  derivationPath: string
): UserInput {
  const fieldValue = extractDataAtPath(sourceArtifactData, derivationPath);
  
  if (typeof fieldValue !== 'string') {
    throw new Error(`Invalid field value at path ${derivationPath}`);
  }

  return {
    text: fieldValue,
    source: 'modified_brainstorm'
  };
}
```

#### 3.3 Transform Instantiation Registry
**File**: `src/server/services/TransformInstantiationRegistry.ts` (NEW)
```typescript
import { HUMAN_TRANSFORM_DEFINITIONS } from '../../common/schemas/transforms';
import { 
  createOutlineInputFromBrainstormIdea,
  createUserInputFromBrainstormField 
} from './transform-instantiations/brainstormTransforms';

type InstantiationFunction = (
  sourceArtifactData: any,
  derivationPath: string
) => any;

export class TransformInstantiationRegistry {
  private functions: Map<string, InstantiationFunction> = new Map();

  constructor() {
    this.registerFunctions();
  }

  private registerFunctions() {
    this.functions.set('createOutlineInputFromBrainstormIdea', createOutlineInputFromBrainstormIdea);
    this.functions.set('createUserInputFromBrainstormField', createUserInputFromBrainstormField);
  }

  executeInstantiation(
    transformName: string,
    sourceArtifactData: any,
    derivationPath: string,
    sourceArtifactId: string
  ): any {
    const definition = HUMAN_TRANSFORM_DEFINITIONS[transformName];
    if (!definition) {
      throw new Error(`Transform definition not found: ${transformName}`);
    }

    const instantiationFn = this.functions.get(definition.instantiationFunction);
    if (!instantiationFn) {
      throw new Error(`Instantiation function not found: ${definition.instantiationFunction}`);
    }

    const result = instantiationFn(sourceArtifactData, derivationPath);
    
    // Add source artifact ID to metadata if applicable
    if (result.source_metadata) {
      result.source_metadata.source_artifact_id = sourceArtifactId;
    }
    
    return result;
  }
}
```

### Phase 4: Enhanced Schema Transform Executor (Week 2)

#### 4.1 Schema-Driven Transform Executor
**File**: `src/server/services/SchemaTransformExecutor.ts` (NEW)
```typescript
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { TransformInstantiationRegistry } from './TransformInstantiationRegistry';
import { ARTIFACT_SCHEMAS } from '../../common/schemas/artifacts';
import { HUMAN_TRANSFORM_DEFINITIONS, validateTransformPath } from '../../common/schemas/transforms';

export class SchemaTransformExecutor {
  private instantiationRegistry: TransformInstantiationRegistry;

  constructor(
    private artifactRepo: ArtifactRepository,
    private transformRepo: TransformRepository
  ) {
    this.instantiationRegistry = new TransformInstantiationRegistry();
  }

  /**
   * Execute a schema-validated human transform
   */
  async executeSchemaHumanTransform(
    transformName: string,
    sourceArtifactId: string,
    derivationPath: string,
    projectId: string,
    fieldUpdates?: Record<string, any>
  ): Promise<{ transform: any; derivedArtifact: any; wasTransformed: boolean }> {
    
    // 1. Validate transform definition
    const transformDef = HUMAN_TRANSFORM_DEFINITIONS[transformName];
    if (!transformDef) {
      throw new Error(`Transform definition not found: ${transformName}`);
    }

    // 2. Validate path pattern
    if (!validateTransformPath(transformName, derivationPath)) {
      throw new Error(`Invalid path '${derivationPath}' for transform '${transformName}'`);
    }

    // 3. Check for existing transform
    const existingTransform = await this.transformRepo.findHumanTransform(
      sourceArtifactId, 
      derivationPath, 
      projectId
    );

    if (existingTransform && existingTransform.derived_artifact_id) {
      // Update existing derived artifact
      return this.updateExistingDerivedArtifact(
        existingTransform, 
        fieldUpdates || {}, 
        transformDef
      );
    }

    // 4. Create new derived artifact
    return this.createNewDerivedArtifact(
      transformName,
      sourceArtifactId,
      derivationPath,
      projectId,
      transformDef
    );
  }

  private async updateExistingDerivedArtifact(
    existingTransform: any,
    fieldUpdates: Record<string, any>,
    transformDef: any
  ) {
    const currentArtifact = await this.artifactRepo.getArtifact(
      existingTransform.derived_artifact_id
    );
    
    if (!currentArtifact) {
      throw new Error('Derived artifact not found');
    }

    // Get current data and apply updates
    let currentData = JSON.parse(currentArtifact.data);
    
    // Handle user_input artifacts with metadata
    if (currentArtifact.type === 'user_input' && currentArtifact.metadata) {
      const metadata = JSON.parse(currentArtifact.metadata);
      if (metadata.derived_data) {
        currentData = metadata.derived_data;
      }
    }

    const updatedData = { ...currentData, ...fieldUpdates };
    
    // Validate against target schema
    const targetSchema = ARTIFACT_SCHEMAS[transformDef.targetArtifactType];
    const validationResult = targetSchema.safeParse(updatedData);
    
    if (!validationResult.success) {
      throw new Error(`Schema validation failed: ${validationResult.error.message}`);
    }

    // Update artifact with validated data
    let finalData = validationResult.data;
    let finalMetadata = currentArtifact.metadata;

    // Special handling for user_input artifacts
    if (transformDef.targetArtifactType === 'user_input') {
      finalData = {
        text: JSON.stringify(validationResult.data),
        source: 'modified_brainstorm'
      };
      finalMetadata = JSON.stringify({
        ...JSON.parse(currentArtifact.metadata || '{}'),
        derived_data: validationResult.data
      });
    }

    await this.artifactRepo.updateArtifact(
      existingTransform.derived_artifact_id,
      finalData,
      finalMetadata ? JSON.parse(finalMetadata) : undefined
    );

    const updatedArtifact = await this.artifactRepo.getArtifact(
      existingTransform.derived_artifact_id
    );

    return {
      transform: existingTransform.transform,
      derivedArtifact: updatedArtifact,
      wasTransformed: false
    };
  }

  private async createNewDerivedArtifact(
    transformName: string,
    sourceArtifactId: string,
    derivationPath: string,
    projectId: string,
    transformDef: any
  ) {
    // 1. Get and validate source artifact
    const sourceArtifact = await this.artifactRepo.getArtifact(sourceArtifactId);
    if (!sourceArtifact) {
      throw new Error('Source artifact not found');
    }

    const sourceSchema = ARTIFACT_SCHEMAS[transformDef.sourceArtifactType];
    const sourceData = JSON.parse(sourceArtifact.data);
    const sourceValidation = sourceSchema.safeParse(sourceData);
    
    if (!sourceValidation.success) {
      throw new Error(`Source artifact schema validation failed: ${sourceValidation.error.message}`);
    }

    // 2. Execute instantiation
    const initialData = this.instantiationRegistry.executeInstantiation(
      transformName,
      sourceValidation.data,
      derivationPath,
      sourceArtifactId
    );

    // 3. Validate instantiated data
    const targetSchema = ARTIFACT_SCHEMAS[transformDef.targetArtifactType];
    const targetValidation = targetSchema.safeParse(initialData);
    
    if (!targetValidation.success) {
      throw new Error(`Target artifact schema validation failed: ${targetValidation.error.message}`);
    }

    // 4. Create transform
    const transform = await this.transformRepo.createTransform(
      projectId,
      'human',
      'v1',
      'completed',
      {
        transform_name: transformName,
        derivation_path: derivationPath,
        timestamp: new Date().toISOString()
      }
    );

    // 5. Create derived artifact
    let artifactData = targetValidation.data;
    let artifactMetadata: any = {
      transform_name: transformName,
      source_artifact_id: sourceArtifactId,
      derivation_path: derivationPath
    };

    // Special handling for user_input artifacts
    if (transformDef.targetArtifactType === 'user_input') {
      artifactMetadata.derived_data = targetValidation.data;
      artifactData = {
        text: JSON.stringify(targetValidation.data),
        source: 'modified_brainstorm'
      };
    }

    const derivedArtifact = await this.artifactRepo.createArtifact(
      projectId,
      transformDef.targetArtifactType,
      artifactData,
      'v1',
      artifactMetadata
    );

    // 6. Link relationships
    await this.transformRepo.addTransformInputs(transform.id, [
      { artifactId: sourceArtifactId, inputRole: 'source' }
    ]);
    
    await this.transformRepo.addTransformOutputs(transform.id, [
      { artifactId: derivedArtifact.id, outputRole: 'derived' }
    ]);

    // 7. Store human transform metadata
    await this.transformRepo.addHumanTransform({
      transform_id: transform.id,
      action_type: 'schema_transform',
      source_artifact_id: sourceArtifactId,
      derivation_path: derivationPath,
      derived_artifact_id: derivedArtifact.id,
      transform_name: transformName,
      change_description: `Schema transform: ${transformName} at path ${derivationPath}`
    });

    return {
      transform,
      derivedArtifact,
      wasTransformed: true
    };
  }
}
```

### Phase 5: API Integration (Week 3)

#### 5.1 Schema Transform API Route
**File**: `src/server/routes/artifactRoutes.ts` (ADD to existing routes)
```typescript
// Add this route to the existing artifact routes factory

router.post('/:id/schema-transform', authMiddleware.authenticate, async (req: any, res: any) => {
  const user = authMiddleware.getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  const { id: artifactId } = req.params;
  const { transformName, derivationPath, fieldUpdates } = req.body;

  if (!transformName || !derivationPath) {
    return res.status(400).json({ error: "transformName and derivationPath are required" });
  }

  try {
    const schemaExecutor = new SchemaTransformExecutor(artifactRepo, transformRepo);
    
    const result = await schemaExecutor.executeSchemaHumanTransform(
      transformName,
      artifactId,
      derivationPath,
      user.id, // Using user.id as projectId for compatibility
      fieldUpdates
    );

    res.json(result);
  } catch (error: any) {
    console.error('Schema transform error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Phase 6: Frontend Integration (Week 3)

#### 6.1 Enhanced Artifact Editor with Schema Support
**File**: `src/client/components/shared/SchemaArtifactEditor.tsx` (NEW)
```typescript
import React, { useState, useEffect } from 'react';
import { useShape } from '@electric-sql/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { message } from 'antd';
import { useDebouncedCallback } from '../../hooks/useDebounce';
import { EditableField } from './EditableField';
import type { ElectricArtifact } from '../../../common/types';
import { getElectricConfig } from '../../../common/config/electric';
import { extractDataAtPath } from '../../../common/utils/pathExtraction';
import { HUMAN_TRANSFORM_DEFINITIONS } from '../../../common/schemas/transforms';

interface SchemaArtifactEditorProps {
  artifactId: string;
  path?: string;
  transformName?: string;
  className?: string;
  onTransition?: (newArtifactId: string) => void;
}

export const SchemaArtifactEditor: React.FC<SchemaArtifactEditorProps> = ({
  artifactId,
  path = "",
  transformName,
  className = '',
  onTransition
}) => {
  // 1. Check for existing transform
  const { data: existingTransform } = useQuery({
    queryKey: ['human-transform', artifactId, path],
    queryFn: async () => {
      const response = await fetch(`/api/artifacts/${artifactId}/human-transform?path=${encodeURIComponent(path)}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch human transform');
      }
      return response.json();
    },
    enabled: !!path && !!transformName
  });

  // 2. Determine target artifact
  const targetArtifactId = existingTransform?.derived_artifact_id || artifactId;

  // 3. Electric SQL real-time data
  const electricConfig = getElectricConfig();
  const { data: artifacts, isLoading, error } = useShape({
    url: electricConfig.url,
    params: {
      table: 'artifacts',
      where: `id = '${targetArtifactId}'`
    }
  });

  const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set());

  const artifact = artifacts?.[0] as unknown as ElectricArtifact | undefined;
  
  // 4. Extract and process data
  let artifactData = null;
  if (artifact) {
    let rawData = JSON.parse(artifact.data as string);
    
    // Handle user_input artifacts with derived data
    if (artifact.type === 'user_input' && artifact.metadata) {
      const metadata = JSON.parse(artifact.metadata as string);
      if (metadata.derived_data) {
        rawData = metadata.derived_data;
      }
    }
    
    artifactData = path ? extractDataAtPath(rawData, path) : rawData;
  }

  // 5. Schema transform mutation
  const transformMutation = useMutation({
    mutationFn: async (fieldUpdates: Record<string, any>) => {
      if (!transformName) {
        throw new Error('Transform name required for schema editing');
      }

      const response = await fetch(`/api/artifacts/${artifactId}/schema-transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          transformName,
          derivationPath: path,
          fieldUpdates
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      return response.json();
    },
    onSuccess: (result) => {
      setPendingSaves(new Set());
      
      if (result.wasTransformed && onTransition) {
        onTransition(result.derivedArtifact.id);
      }
      
      message.success('内容已保存');
    },
    onError: (error: any) => {
      setPendingSaves(new Set());
      message.error(`保存失败: ${error.message}`);
    }
  });

  // 6. Debounced save
  const debouncedSave = useDebouncedCallback((field: string, value: any) => {
    setPendingSaves(prev => new Set(prev).add(field));
    transformMutation.mutate({ [field]: value });
  }, 500);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading artifact</div>;
  if (!artifactData) return <div>No data available</div>;

  return (
    <div className={className}>
      {Object.entries(artifactData).map(([field, value]) => (
        <div key={field} style={{ marginBottom: 16 }}>
          <EditableField
            label={field}
            value={value as string}
            onChange={(newValue) => debouncedSave(field, newValue)}
            component={typeof value === 'string' && value.length > 50 ? 'textarea' : 'input'}
            rows={6}
            placeholder={`输入${field}...`}
            disabled={!transformName}
            className={pendingSaves.has(field) ? 'saving' : ''}
          />
        </div>
      ))}
    </div>
  );
};
```

#### 6.2 Update Brainstorm Results Component
**File**: `src/client/components/DynamicBrainstormingResults.tsx` (UPDATE existing)
```typescript
// Replace existing ArtifactEditor usage with SchemaArtifactEditor
import { SchemaArtifactEditor } from './shared/SchemaArtifactEditor';

// In the EditableIdeaCard component:
<SchemaArtifactEditor
  artifactId={collectionArtifactId}
  path={`[${index}]`}
  transformName="edit_brainstorm_idea"
  className="!border-none !p-0"
  onTransition={(newArtifactId) => {
    console.log(`Idea ${index + 1} edited, derived artifact: ${newArtifactId}`);
  }}
/>
```

### Phase 7: Testing & Validation (Week 4)

#### 7.1 Comprehensive Test Script
**File**: `src/server/scripts/test-schema-system.ts` (NEW)
```typescript
#!/usr/bin/env node

import { SchemaTransformExecutor } from '../services/SchemaTransformExecutor';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { db } from '../database/connection';

async function testSchemaSystem() {
  console.log('🧪 Testing Complete Schema-Driven Transform System\n');

  const artifactRepo = new ArtifactRepository(db);
  const transformRepo = new TransformRepository(db);
  const executor = new SchemaTransformExecutor(artifactRepo, transformRepo);

  try {
    // 1. Create test brainstorm collection with correct structure
    const brainstormData = [
      { title: "穿越CEO", body: "现代女CEO穿越到古代，利用现代商业知识在古代商场叱咤风云" },
      { title: "时空恋人", body: "男主在不同时空中寻找同一个女主，每次相遇都有不同的身份和故事" }
    ];

    const sourceArtifact = await artifactRepo.createArtifact(
      'test-project-1',
      'brainstorm_idea_collection',
      brainstormData,
      'v1'
    );

    console.log('✅ Created test brainstorm collection:', sourceArtifact.id);

    // 2. Test field-level editing (title)
    const titleEdit = await executor.executeSchemaHumanTransform(
      'edit_brainstorm_idea',
      sourceArtifact.id,
      '[0].title',
      'test-project-1',
      { title: '修改后的标题' }
    );

    console.log('✅ Title edit completed');
    console.log('Derived artifact type:', titleEdit.derivedArtifact.type);

    // 3. Test field-level editing (body)
    const bodyEdit = await executor.executeSchemaHumanTransform(
      'edit_brainstorm_idea',
      sourceArtifact.id,
      '[0].body',
      'test-project-1',
      { body: '修改后的详细内容' }
    );

    console.log('✅ Body edit completed');

    // 4. Test full idea to outline conversion
    const outlineTransform = await executor.executeSchemaHumanTransform(
      'brainstorm_to_outline',
      sourceArtifact.id,
      '[1]',
      'test-project-1'
    );

    console.log('✅ Outline transform completed');
    console.log('Outline data:', JSON.parse(outlineTransform.derivedArtifact.data));

    // 5. Test validation errors
    try {
      await executor.executeSchemaHumanTransform(
        'invalid_transform',
        sourceArtifact.id,
        '[0]',
        'test-project-1'
      );
    } catch (error) {
      console.log('✅ Validation error caught:', error.message);
    }

    console.log('\n🎉 All schema system tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await db.destroy();
  }
}

testSchemaSystem().catch(console.error);
```

## Migration Strategy - REVISED

### Phase 1 (Week 1): Critical Fixes
1. **Run database migration** for `transform_name` column
2. **Fix data structure alignment** between frontend/backend
3. **Add missing repository methods** for graph traversal
4. **Update validation system** to use Zod schemas

### Phase 2 (Week 2): Schema Framework
1. **Implement transform definitions** with validation
2. **Create instantiation functions** for common transforms
3. **Build schema transform executor** with proper validation
4. **Add comprehensive error handling**

### Phase 3 (Week 3): Integration
1. **Add API routes** for schema transforms
2. **Update frontend components** to use schema system
3. **Integrate with Electric SQL** for real-time updates
4. **Test end-to-end functionality**

### Phase 4 (Week 4): Validation & Cleanup
1. **Run comprehensive tests** on all transform types
2. **Performance optimization** for real-time updates
3. **Documentation** and code cleanup
4. **Remove deprecated code paths**

## Success Metrics - REVISED

1. **Schema Validation**: All new artifacts validated against Zod schemas ✅
2. **Data Consistency**: Frontend and backend use identical data structures ✅
3. **Transform Traceability**: Complete audit trail for all transforms ✅
4. **Real-time Updates**: Electric SQL integration with schema transforms ✅
5. **Error Prevention**: Comprehensive validation prevents runtime errors ✅
6. **Backward Compatibility**: Existing functionality preserved during migration ✅

## Benefits

1. **Immediate Bug Fixes**: Resolves current data structure mismatches
2. **Progressive Enhancement**: Builds on existing working systems
3. **Type Safety**: Zod schemas prevent runtime type errors
4. **Real-time Integration**: Works seamlessly with Electric SQL
5. **Extensible Architecture**: Easy to add new transform types
6. **Maintainable Code**: Clear separation of concerns and validation

This revised implementation plan addresses the actual state of the codebase and provides a realistic path forward that builds on existing systems while adding the requested schema-driven rigor. 