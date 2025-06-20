# ArtifactEditor Component Design Plan

## Overview
Create a universal artifact editing component that handles path-based artifact derivation with atomic human transforms, Electric SQL real-time sync, and optimistic updates using TanStack Query.

## 1. Current State Analysis

### Existing Architecture
The codebase currently has:
- **Individual `brainstorm_idea` artifacts** - Each idea is stored as a separate artifact
- **`brainstorm_idea_collection` artifacts** - Collections of ideas from LLM generation
- **`BrainstormResultsWithArtifactEditor`** - Component that loads individual `brainstorm_idea` artifacts
- **`ArtifactEditor`** - Component that supports limited artifact types
- **Kysely + PostgreSQL** - Database layer (migrated from Knex)
- **Electric SQL** - Real-time sync with authenticated proxy

### Current Problem
- `ArtifactEditor` doesn't support `brainstorm_idea_collection` type
- No path-based derivation for editing individual ideas within collections
- No human transform tracking for LLM→Human transitions
- Missing database fields for artifact derivation

## 2. Path-Based Artifact Derivation

### Core Concept
- **No separate services needed** - `ArtifactEditor` handles derivation internally
- **Atomic human transforms** - first edit creates transform + derived artifact in one operation
- **JSON path-based derivation** - use paths like `ideas[0].title` or `ideas[1].body` to specify artifact parts
- **Automatic lookup** - editor checks for existing human transforms before deciding what to load

### Path Examples
```typescript
// Collection artifacts (fan-out)
"ideas[0].title"     // First idea's title
"ideas[1].body"      // Second idea's body
"characters[2].name" // Third character's name

// Single artifacts (1-to-1, root path)
""                   // Root path (default)
"title"              // Direct field access
"synopsis"           // Direct field access
```

### Transform Lookup Strategy
```typescript
// Composite key for finding existing human transforms
interface TransformLookupKey {
  source_artifact_id: string;
  derivation_path: string; // JSON path, empty string for root
}

// Database query example
const existingTransform = await db.query(`
  SELECT ht.*, t.* FROM human_transforms ht
  JOIN transforms t ON ht.transform_id = t.id
  WHERE ht.source_artifact_id = ? AND ht.derivation_path = ?
`, [artifactId, path || ""]);
```

## 3. Refactor Plan

### Phase 1: Database Schema Updates

#### Modify Existing Migration (002_create_artifacts_and_transforms.js)
```javascript
// Add to human_transforms table creation
await knex.schema.createTable('human_transforms', (table) => {
    table.string('transform_id').primary();
    table.string('action_type').notNullable();
    table.text('interface_context');
    table.text('change_description');
    
    // NEW: Path-based derivation fields
    table.string('source_artifact_id'); // Source artifact for derivation
    table.text('derivation_path').defaultTo(''); // JSON path (empty for root)
    table.string('derived_artifact_id'); // Resulting artifact after derivation

    table.foreign('transform_id').references('id').inTable('transforms').onDelete('CASCADE');
    table.foreign('source_artifact_id').references('id').inTable('artifacts');
    table.foreign('derived_artifact_id').references('id').inTable('artifacts');
});

// Add index for fast lookups
await knex.schema.raw(`
    CREATE INDEX idx_human_transforms_derivation 
    ON human_transforms(source_artifact_id, derivation_path)
`);
```

#### Update schema.sql for Electric SQL
```sql
-- Extend human_transforms table
ALTER TABLE human_transforms ADD COLUMN source_artifact_id TEXT REFERENCES artifacts(id);
ALTER TABLE human_transforms ADD COLUMN derivation_path TEXT DEFAULT '';
ALTER TABLE human_transforms ADD COLUMN derived_artifact_id TEXT REFERENCES artifacts(id);

-- Add index for fast lookups
CREATE INDEX idx_human_transforms_derivation 
ON human_transforms(source_artifact_id, derivation_path);
```

### Phase 2: Backend API Updates

#### New API Endpoint: `/api/artifacts/:id/edit-with-path`
```typescript
// src/server/routes/artifactRoutes.ts
router.post('/:id/edit-with-path', requireAuth, async (req, res) => {
  const { id: artifactId } = req.params;
  const { path = "", field, value } = req.body;
  const userId = req.user.id;

  try {
    const result = await artifactService.editArtifactWithPath(
      artifactId, path, field, value, userId
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Human transform lookup endpoint
router.get('/:id/human-transform/:path?', requireAuth, async (req, res) => {
  const { id: artifactId, path = "" } = req.params;
  const userId = req.user.id;

  try {
    const transform = await transformRepo.findHumanTransform(artifactId, path, userId);
    res.json(transform);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### Update TransformExecutor for Human Transforms
```typescript
// src/server/services/TransformExecutor.ts
async executeHumanTransformWithPath(
  userId: string,
  sourceArtifactId: string,
  derivationPath: string,
  field: string,
  value: any
): Promise<{ transform: any; derivedArtifact: Artifact }> {
  // Check for existing human transform
  const existingTransform = await this.transformRepo.findHumanTransform(
    sourceArtifactId, derivationPath, userId
  );
  
  if (existingTransform) {
    // Edit existing derived artifact
    const derivedArtifact = await this.artifactRepo.updateArtifact(
      existingTransform.derived_artifact_id, { [field]: value }
    );
    return { transform: existingTransform, derivedArtifact };
  }

  // First edit - create atomic human transform
  const sourceArtifact = await this.artifactRepo.getArtifact(sourceArtifactId);
  const sourceData = derivationPath ? 
    extractDataAtPath(sourceArtifact.data, derivationPath) : 
    sourceArtifact.data;
  
  const newData = { ...sourceData, [field]: value };
  
  // Atomic operation
  return await this.db.transaction(async (trx) => {
    const transform = await this.transformRepo.createTransform(
      userId, 'human', 'v1', 'completed',
      { timestamp: new Date().toISOString(), action_type: 'edit' },
      trx
    );
    
    const derivedArtifact = await this.artifactRepo.createArtifact(
      userId, 'user_input',
      { text: JSON.stringify(newData) },
      'v1',
      { source: 'human', original_artifact_id: sourceArtifactId },
      trx
    );
    
    // Link transform
    await this.transformRepo.addTransformInputs(transform.id, [{ artifactId: sourceArtifactId }], trx);
    await this.transformRepo.addTransformOutputs(transform.id, [{ artifactId: derivedArtifact.id }], trx);
    
    // Store human transform metadata
    await this.transformRepo.addHumanTransform({
      transform_id: transform.id,
      action_type: 'edit',
      source_artifact_id: sourceArtifactId,
      derivation_path: derivationPath,
      derived_artifact_id: derivedArtifact.id
    }, trx);
    
    return { transform, derivedArtifact };
  });
}
```

### Phase 3: Frontend Component Updates

#### Update ArtifactEditor Interface
```typescript
// src/client/components/shared/ArtifactEditor.tsx
interface ArtifactEditorProps {
  artifactId: string;
  path?: string;           // JSON path for derivation (optional, defaults to root)
  className?: string;
  onTransition?: (newArtifactId: string) => void;
}

function ArtifactEditor({ artifactId, path = "" }: ArtifactEditorProps) {
  // 1. Look up existing human transform for (artifactId, path)
  const existingTransform = useQuery({
    queryKey: ['human-transform', artifactId, path],
    queryFn: () => api.getHumanTransform(artifactId, path)
  });

  // 2. Determine which artifact to load
  const targetArtifactId = existingTransform?.data?.derived_artifact_id || artifactId;
  const targetPath = existingTransform?.data ? "" : path; // If derived, use root path

  // 3. Load artifact data with Electric SQL
  const { data: artifacts } = useShape({
    url: `${ELECTRIC_URL}/v1/shape`,
    params: {
      table: 'artifacts',
      where: `id = '${targetArtifactId}'`
    }
  });

  // 4. Extract data using path if needed
  const artifact = artifacts?.[0];
  const editableData = targetPath ? 
    extractDataAtPath(artifact?.data, targetPath) : 
    artifact?.data;

  // 5. Handle edits with atomic transform creation
  const editMutation = useMutation({
    mutationFn: (editData) => api.editArtifactWithPath({
      artifactId,
      path,
      editData
    }),
    onSuccess: (response) => {
      if (response.wasTransformed) {
        onTransition?.(response.newArtifactId);
      }
    }
  });
}
```

#### Add brainstorm_idea_collection Support
```typescript
// src/client/components/shared/ArtifactEditor.tsx
const ARTIFACT_FIELD_MAPPING = {
  'brainstorm_idea': [
    { field: 'idea_title', component: 'input', maxLength: 20 },
    { field: 'idea_text', component: 'textarea', rows: 6 }
  ],
  'brainstorm_idea_collection': [
    // This will be handled via path-based derivation
    { field: 'ideas', component: 'collection', itemType: 'brainstorm_idea' }
  ],
  'user_input': [
    { field: 'text', component: 'textarea', rows: 4 }
  ],
  'outline_title': [
    { field: 'title', component: 'input', maxLength: 50 }
  ]
} as const;
```

#### Update BrainstormResultsWithArtifactEditor
```typescript
// src/client/components/BrainstormResultsWithArtifactEditor.tsx
export const BrainstormResultsWithArtifactEditor: React.FC<BrainstormResultsWithArtifactEditorProps> = ({
    projectId,
    isStreaming
}) => {
    const electricConfig = getElectricConfig();

    // Fetch brainstorm_idea_collection artifacts (not individual ideas)
    const { data: artifacts, isLoading, error } = useShape({
        url: electricConfig.url,
        params: {
            table: 'artifacts',
            where: `project_id = '${projectId}' AND type = 'brainstorm_idea_collection'`
        }
    });

    // Get the latest collection artifact
    const latestCollection = useMemo(() => {
        if (!artifacts || !Array.isArray(artifacts)) return null;
        return (artifacts as unknown as ElectricArtifact[])
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    }, [artifacts]);

    // Parse ideas from collection
    const ideas = useMemo(() => {
        if (!latestCollection?.data) return [];
        try {
            const data = JSON.parse(latestCollection.data as string);
            return Array.isArray(data) ? data : data.ideas || [];
        } catch (error) {
            console.warn('Failed to parse collection data:', error);
            return [];
        }
    }, [latestCollection]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse bg-gray-800 h-32 rounded-lg"></div>
                ))}
            </div>
        );
    }

    if (!latestCollection || ideas.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-4xl mb-4">💡</div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">
                    {isStreaming ? '正在生成创意...' : '暂无创意'}
                </h3>
                <p className="text-gray-400 text-sm">
                    {isStreaming ? '创意将会逐个出现在这里' : '开始头脑风暴以生成创意'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">
                    创意列表 ({ideas.length})
                </h2>
                {isStreaming && (
                    <div className="flex items-center gap-2 text-sm text-blue-400">
                        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                        生成中...
                    </div>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {ideas.map((idea, index) => (
                    <div key={index} className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-500 font-mono">
                                #{index + 1}
                            </span>
                            <span className="text-xs text-gray-500">
                                Collection: {latestCollection.id.slice(-8)}
                            </span>
                        </div>

                        {/* Edit title with path-based derivation */}
                        <div className="mb-2">
                            <label className="text-xs text-gray-400 mb-1 block">标题</label>
                            <ArtifactEditor
                                artifactId={latestCollection.id}
                                path={`[${index}].title`}
                                className="bg-gray-800 hover:bg-gray-750 transition-colors"
                                onTransition={(newArtifactId) => {
                                    console.log(`Idea ${index + 1} title transitioned to ${newArtifactId}`);
                                }}
                            />
                        </div>

                        {/* Edit body with path-based derivation */}
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">内容</label>
                            <ArtifactEditor
                                artifactId={latestCollection.id}
                                path={`[${index}].body`}
                                className="bg-gray-800 hover:bg-gray-750 transition-colors"
                                onTransition={(newArtifactId) => {
                                    console.log(`Idea ${index + 1} body transitioned to ${newArtifactId}`);
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {isStreaming && (
                <div className="text-center text-sm text-gray-400 mt-6">
                    💡 新创意正在生成中，将自动显示在上方
                </div>
            )}
        </div>
    );
};
```

### Phase 4: Path Extraction Utilities

#### JSON Path Helper Functions
```typescript
// src/common/utils/pathExtraction.ts
export function extractDataAtPath(data: any, path: string): any {
  if (!path) return data;
  
  // Handle array indices: [0].title -> 0.title
  const normalizedPath = path.replace(/\[(\d+)\]/g, '$1');
  
  return normalizedPath.split('.').reduce((obj, key) => {
    return obj?.[key];
  }, data);
}

export function setDataAtPath(data: any, path: string, value: any): any {
  if (!path) return value;
  
  const normalizedPath = path.replace(/\[(\d+)\]/g, '$1');
  const keys = normalizedPath.split('.');
  const result = JSON.parse(JSON.stringify(data)); // Deep clone
  
  let current = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
  return result;
}

export function validatePath(data: any, path: string): boolean {
  try {
    const value = extractDataAtPath(data, path);
    return value !== undefined;
  } catch {
    return false;
  }
}
```

### Phase 5: Repository Updates (Kysely)

#### Update TransformRepository
```typescript
// src/server/repositories/TransformRepository.ts
export class TransformRepository {
  // Find existing human transform by source artifact and path
  async findHumanTransform(
    sourceArtifactId: string, 
    derivationPath: string, 
    userId: string
  ): Promise<any | null> {
    const result = await this.db
      .selectFrom('human_transforms as ht')
      .innerJoin('transforms as t', 't.id', 'ht.transform_id')
      .selectAll()
      .where('ht.source_artifact_id', '=', sourceArtifactId)
      .where('ht.derivation_path', '=', derivationPath)
      .where('t.project_id', 'in', 
        this.db.selectFrom('projects_users')
          .select('project_id')
          .where('user_id', '=', userId)
      )
      .executeTakeFirst();
    
    return result || null;
  }

  // Add human transform with derivation metadata
  async addHumanTransform(data: {
    transform_id: string;
    action_type: string;
    source_artifact_id?: string;
    derivation_path?: string;
    derived_artifact_id?: string;
    interface_context?: string;
    change_description?: string;
  }): Promise<void> {
    await this.db
      .insertInto('human_transforms')
      .values({
        transform_id: data.transform_id,
        action_type: data.action_type,
        source_artifact_id: data.source_artifact_id || null,
        derivation_path: data.derivation_path || '',
        derived_artifact_id: data.derived_artifact_id || null,
        interface_context: data.interface_context || null,
        change_description: data.change_description || null
      })
      .execute();
  }
}
```

## 4. Implementation Steps

### Phase 1: Database & Backend (Week 1)
1. ✅ Modify existing migration 002_create_artifacts_and_transforms.js
2. ✅ Update schema.sql for Electric SQL compatibility
3. ✅ Add path extraction utilities
4. ✅ Update TransformRepository with Kysely queries
5. ✅ Create new API endpoints for path-based editing

### Phase 2: ArtifactEditor Refactor (Week 2)
1. ✅ Update ArtifactEditor to accept path prop
2. ✅ Implement transform lookup logic
3. ✅ Add support for brainstorm_idea_collection
4. ✅ Test path-based derivation with collections

### Phase 3: Component Integration (Week 3)
1. ✅ Update BrainstormResultsWithArtifactEditor to use collections
2. ✅ Implement path-based editing for individual ideas
3. ✅ Ensure Electric SQL sync works with derived artifacts
4. ✅ Handle artifact transitions and animations

### Phase 4: Testing & Polish (Week 4)
1. ✅ End-to-end testing with real brainstorm collections
2. ✅ Performance optimization and caching
3. ✅ Error handling for invalid paths
4. ✅ Visual feedback for transform states

## 5. Migration Compatibility

### Existing Data Handling
- **Existing `brainstorm_idea` artifacts** will continue to work with root path (`""`)
- **New `brainstorm_idea_collection` artifacts** will use path-based derivation
- **Backward compatibility** maintained for all existing components
- **Gradual migration** - old and new approaches can coexist

### Database Migration Strategy
- **Modify existing migration** instead of creating new one
- **Add nullable columns** to human_transforms table
- **Create index** for fast path-based lookups
- **Update Electric SQL schema** to match PostgreSQL structure

---

This refactor plan provides a comprehensive path from the current state to the desired path-based artifact derivation system, maintaining backward compatibility while enabling powerful new editing capabilities. 