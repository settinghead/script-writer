# YJS + Electric SQL Refactor Plan

## Executive Summary

This document outlines a comprehensive refactor plan to integrate YJS + Electric SQL for real-time collaborative editing in the script-writer project. The goal is to replace the current PUT-based artifact updates with YJS collaborative documents while maintaining the Transform Framework's immutability and audit trail capabilities.

## Current State Analysis

### Existing Artifact Editing Patterns

**1. Direct Artifact Updates (via PUT /api/artifacts/:id)**
- Used by `useArtifactEditor` hook with debounced saves
- Handles both `user_input` and other artifact types differently
- Optimistic updates via ProjectDataContext
- Examples: BrainstormInputEditor, ArtifactEditor

**2. Human Transform Creation (via POST /api/artifacts/:id/human-transform)**
- Creates new `user_input` artifacts from existing artifacts
- Used for making AI-generated content editable
- Examples: SingleBrainstormIdeaEditor, ChronicleStageCard

**3. Field-Level Editing Components**
- EditableText: Single text fields with debounced auto-save
- EditableArray: String arrays with textarea or list modes
- EditableField: Generic input/textarea with streaming support

**4. Schema Transform System (POST /api/artifacts/:id/schema-transform)**
- Validates field updates against Zod schemas
- Creates derived artifacts with proper lineage tracking
- Used by HumanTransformExecutor for structured edits

**5. Path-Based Editing (POST /api/artifacts/:id/edit-with-path)**
- Enables editing nested object properties via JSONPath
- Creates human transforms for specific field modifications
- Used for complex object editing scenarios

### Artifact Types Requiring YJS Integration

1. **user_input artifacts** (origin_type: 'user_input')
2. **brainstorm_tool_input_schema** - Project brainstorm parameters
3. **brainstorm_item_schema** - Individual brainstorm ideas
4. **chronicle_stage_schema** - Individual chronicle stages
5. **outline_settings_schema** - Outline configuration
6. **Any artifact with editable fields**

### Existing Real-Time Infrastructure

**1. Electric SQL Integration**
- Authenticated proxy at `/api/electric/v1/shape`
- Project-based access control via `electricProxy.ts`
- Real-time subscriptions for artifacts, transforms, chat messages
- Used by `useShape` hooks throughout the frontend

**2. Streaming Infrastructure**
- Comprehensive streaming system for AI-generated content
- StreamingTransformExecutor for real-time artifact updates
- StreamProxy for multi-subscriber support
- StreamCache for development/testing

**3. Chat System Real-Time Features**
- Real-time chat messages via Electric SQL
- Dual message system (computation + response)
- WebSocket-ready infrastructure (nginx config exists)

**4. WebSocket Preparation**
- Nginx config includes `/yjs` route with WebSocket support
- AuthDatabase has `canUserAccessRoom` method
- Room-based access control patterns already established

## Architecture Overview

### Hybrid Approach: Transform Framework + YJS

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   YJS Document  │◄──►│ Electric Provider│◄──►│  Electric SQL   │
│  (Real-time)    │    │  (Sync Layer)   │    │  (Persistence)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                              │
         ▼                                              ▼
┌─────────────────┐                            ┌─────────────────┐
│ Transform       │                            │   PostgreSQL    │
│ Framework       │◄──────────────────────────►│   Database      │
│ (Audit Trail)   │      Periodic Sync         │                 │
└─────────────────┘                            └─────────────────┘
```

**Key Principles:**
- **YJS handles real-time collaboration** - Live editing, conflict resolution, presence
- **Transform Framework handles persistence** - Immutable artifacts, audit trails, AI integration
- **Periodic sync** - YJS changes flow back to Transform Framework for permanent storage

## Critical Overlooked Aspects

### 1. Existing Streaming Infrastructure Conflicts

**Issue:** The current system has extensive streaming infrastructure that could conflict with YJS:
- `StreamingTransformExecutor` for AI-generated content
- `StreamProxy` for multi-subscriber streams
- Real-time artifact updates during AI generation

**Solution:** Design YJS integration to coexist with streaming:
```typescript
// Hybrid artifact state management
interface ArtifactState {
  // Current persistent state (from Transform Framework)
  persistentData: any;
  
  // Real-time collaborative state (from YJS)
  collaborativeData?: any;
  
  // Streaming state (from AI generation)
  streamingData?: any;
  
  // Conflict resolution priority
  priority: 'persistent' | 'collaborative' | 'streaming';
}
```

### 2. Complex Artifact Creation Patterns

**Overlooked:** Multiple artifact creation patterns that need YJS integration:
- Initial artifact creation via POST `/api/artifacts`
- Human transform derivation via schema transforms
- Path-based editing with JSONPath
- Streaming artifact updates during AI generation

**Solution:** Unified YJS initialization pattern:
```typescript
// Auto-create YJS documents for all editable artifacts
const initializeYJSForArtifact = async (artifact: Artifact) => {
  // Only create YJS documents for user-editable types
  if (artifact.origin_type === 'user_input' || isEditableType(artifact.schema_type)) {
    const roomId = `artifact-${artifact.id}`;
    const yjsDoc = new Y.Doc();
    
    // Initialize with current artifact data
    const yMap = yjsDoc.getMap('content');
    Object.entries(artifact.data).forEach(([key, value]) => {
      yMap.set(key, value);
    });
    
    return { roomId, yjsDoc };
  }
  return null;
};
```

### 3. Authentication Integration Complexity

**Overlooked:** Complex authentication patterns that YJS must respect:
- HTTP-only cookies for web requests
- Debug token for development (`debug-auth-token-script-writer-dev`)
- Project-based access control (not user-based)
- Electric SQL proxy authentication

**Solution:** Unified authentication for YJS:
```typescript
// YJS provider with Electric SQL authentication
const createAuthenticatedYJSProvider = (roomId: string, artifact: Artifact) => {
  return new ElectricProvider({
    url: '/api/electric/v1/shape',
    room: roomId,
    headers: {
      // Use existing cookie-based auth - no manual token needed
      'X-Requested-With': 'XMLHttpRequest'
    },
    params: {
      table: 'artifact_yjs_updates',
      where: `room_id = '${roomId}' AND project_id = '${artifact.project_id}'`
    }
  });
};
```

### 4. Electric SQL Shape Integration

**Overlooked:** YJS must integrate with existing Electric SQL shape patterns:
- Project-scoped data access
- Real-time subscriptions via `useShape`
- Optimistic updates in ProjectDataContext

**Solution:** Extend existing Electric SQL patterns:
```typescript
// Extend useShape for YJS integration
const useYJSArtifact = (artifactId: string) => {
  // Get artifact metadata via existing Electric SQL
  const { data: artifact } = useShape({
    url: '/api/electric/v1/shape',
    params: {
      table: 'artifacts',
      where: `id = '${artifactId}'`
    }
  });

  // Get YJS updates via Electric SQL
  const { data: yjsUpdates } = useShape({
    url: '/api/electric/v1/shape', 
    params: {
      table: 'artifact_yjs_updates',
      where: `room_id = 'artifact-${artifactId}'`
    }
  });

  // Initialize YJS document
  const yjsDoc = useMemo(() => {
    if (!artifact) return null;
    
    const doc = new Y.Doc();
    // Apply updates from Electric SQL
    yjsUpdates?.forEach(update => {
      Y.applyUpdate(doc, update.update);
    });
    
    return doc;
  }, [artifact, yjsUpdates]);

  return { artifact, yjsDoc };
};
```

### 5. Streaming + Collaboration Conflict Resolution

**Critical Issue:** AI streaming and human collaboration can conflict:
- AI generates content while user is editing
- Streaming updates overwrite collaborative changes
- Need priority system for concurrent modifications

**Solution:** Conflict resolution hierarchy:
```typescript
enum UpdatePriority {
  USER_EDIT = 1,        // Highest priority - user is actively editing
  COLLABORATIVE = 2,    // Other users' edits
  AI_STREAMING = 3,     // AI generation (can be interrupted)
  BACKGROUND_SYNC = 4   // Lowest priority
}

const conflictResolver = {
  resolveConflict: (updates: Update[]) => {
    // Sort by priority, timestamp
    return updates.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }
};
```

## Implementation Plan

### Phase 1: Infrastructure Setup

#### 1.1 Database Schema Extensions

```sql
-- YJS document storage per artifact
CREATE TABLE artifact_yjs_documents (
  id SERIAL PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id),
  room_id TEXT NOT NULL UNIQUE,
  document_state BYTEA, -- Encoded YJS document state
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- YJS updates (for Electric SQL streaming)
CREATE TABLE artifact_yjs_updates (
  id SERIAL PRIMARY KEY,
  room_id TEXT NOT NULL,
  project_id TEXT NOT NULL, -- For access control
  update BYTEA NOT NULL,
  client_id TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- YJS awareness (user presence)
CREATE TABLE artifact_yjs_awareness (
  client_id TEXT,
  room_id TEXT NOT NULL,
  project_id TEXT NOT NULL, -- For access control
  update BYTEA NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, room_id)
);

-- Auto-cleanup stale awareness (30 seconds)
CREATE OR REPLACE FUNCTION gc_artifact_awareness_timeouts()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM artifact_yjs_awareness
    WHERE updated_at < (CURRENT_TIMESTAMP - INTERVAL '30 seconds') 
    AND room_id = NEW.room_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gc_artifact_awareness_trigger
AFTER INSERT OR UPDATE ON artifact_yjs_awareness
FOR EACH ROW
EXECUTE FUNCTION gc_artifact_awareness_timeouts();

-- Indexes for performance
CREATE INDEX idx_artifact_yjs_updates_room_id ON artifact_yjs_updates(room_id);
CREATE INDEX idx_artifact_yjs_updates_project_id ON artifact_yjs_updates(project_id);
CREATE INDEX idx_artifact_yjs_awareness_room_id ON artifact_yjs_awareness(room_id);
CREATE INDEX idx_artifact_yjs_awareness_project_id ON artifact_yjs_awareness(project_id);
```

#### 1.2 Electric SQL Proxy Extensions

```typescript
// Extend electricProxy.ts to handle YJS tables
const handleYJSTableAuth = (table: string, userId: string, projectIds: string[]) => {
  switch (table) {
    case 'artifact_yjs_updates':
    case 'artifact_yjs_awareness':
      // YJS tables are scoped by project_id
      return `project_id IN (${projectIds.map(id => `'${id}'`).join(',')})`;
    default:
      return null;
  }
};
```

#### 1.3 Package Dependencies

```json
{
  "dependencies": {
    "yjs": "^13.6.7",
    "@electric-sql/y-electric": "^0.1.0",
    "y-protocols": "^1.0.5",
    "lib0": "^0.2.85"
  }
}
```

### Phase 2: Core YJS Integration

#### 2.1 YJS Provider Service

```typescript
// src/client/services/YJSService.ts
export class YJSService {
  private providers = new Map<string, ElectricProvider>();
  private documents = new Map<string, Y.Doc>();

  async getOrCreateYJSDocument(artifactId: string, projectId: string): Promise<{
    doc: Y.Doc;
    provider: ElectricProvider;
  }> {
    const roomId = `artifact-${artifactId}`;
    
    if (this.documents.has(roomId)) {
      return {
        doc: this.documents.get(roomId)!,
        provider: this.providers.get(roomId)!
      };
    }

    // Create new YJS document
    const doc = new Y.Doc();
    
    // Create Electric provider
    const provider = new ElectricProvider({
      doc,
      documentUpdates: {
        shape: {
          url: '/api/electric/v1/shape',
          params: {
            table: 'artifact_yjs_updates',
            where: `room_id = '${roomId}' AND project_id = '${projectId}'`
          }
        },
        sendUrl: new URL(`/api/yjs/update?room=${roomId}&project=${projectId}`, window.location.origin)
      },
      awarenessUpdates: {
        shape: {
          url: '/api/electric/v1/shape',
          params: {
            table: 'artifact_yjs_awareness', 
            where: `room_id = '${roomId}' AND project_id = '${projectId}'`
          }
        },
        sendUrl: new URL(`/api/yjs/awareness?room=${roomId}&project=${projectId}`, window.location.origin)
      }
    });

    this.documents.set(roomId, doc);
    this.providers.set(roomId, provider);

    return { doc, provider };
  }

  async syncYJSToArtifact(artifactId: string, yjsDoc: Y.Doc): Promise<void> {
    // Convert YJS document back to artifact format
    const yMap = yjsDoc.getMap('content');
    const artifactData = yMap.toJSON();

    // Send to existing artifact update API
    await apiService.updateArtifact({
      artifactId,
      data: artifactData
    });
  }
}
```

#### 2.2 Universal YJS Hook

```typescript
// src/client/hooks/useYJSArtifact.ts
export const useYJSArtifact = (artifactId: string, options: {
  enableCollaboration?: boolean;
  syncIntervalMs?: number;
} = {}) => {
  const { enableCollaboration = true, syncIntervalMs = 5000 } = options;
  
  // Get artifact metadata via existing Electric SQL
  const { data: artifacts } = useShape({
    url: '/api/electric/v1/shape',
    params: {
      table: 'artifacts',
      where: `id = '${artifactId}'`
    }
  });
  
  const artifact = artifacts?.[0];
  const yjsService = useRef(new YJSService()).current;
  
  // YJS document state
  const [yjsDoc, setYJSDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<ElectricProvider | null>(null);
  const [collaborativeData, setCollaborativeData] = useState<any>(null);

  // Initialize YJS when artifact is available and collaboration is enabled
  useEffect(() => {
    if (!artifact || !enableCollaboration) return;

    const initYJS = async () => {
      const { doc, provider } = await yjsService.getOrCreateYJSDocument(
        artifact.id, 
        artifact.project_id
      );
      
      // Initialize YJS document with artifact data
      const yMap = doc.getMap('content');
      if (yMap.size === 0) {
        Object.entries(artifact.data).forEach(([key, value]) => {
          yMap.set(key, value);
        });
      }

      // Listen for YJS changes
      const updateHandler = () => {
        setCollaborativeData(yMap.toJSON());
      };
      
      yMap.observe(updateHandler);
      setYJSDoc(doc);
      setProvider(provider);
      setCollaborativeData(yMap.toJSON());

      return () => {
        yMap.unobserve(updateHandler);
      };
    };

    initYJS();
  }, [artifact, enableCollaboration]);

  // Periodic sync to Transform Framework
  useEffect(() => {
    if (!yjsDoc || !artifact) return;

    const syncInterval = setInterval(async () => {
      await yjsService.syncYJSToArtifact(artifact.id, yjsDoc);
    }, syncIntervalMs);

    return () => clearInterval(syncInterval);
  }, [yjsDoc, artifact, syncIntervalMs]);

  // Update YJS document when external artifact changes
  useEffect(() => {
    if (!yjsDoc || !artifact) return;

    const yMap = yjsDoc.getMap('content');
    const currentYJSData = yMap.toJSON();
    const artifactData = artifact.data;

    // Only update if artifact data is significantly different
    if (JSON.stringify(currentYJSData) !== JSON.stringify(artifactData)) {
      // Check if this is an AI streaming update vs user edit conflict
      const isStreamingUpdate = artifact.streaming_status === 'streaming';
      
      if (isStreamingUpdate) {
        // AI is streaming - merge carefully to avoid overwriting user edits
        Object.entries(artifactData).forEach(([key, value]) => {
          if (!yMap.has(key) || yMap.get(key) === currentYJSData[key]) {
            // Only update fields that user hasn't modified
            yMap.set(key, value);
          }
        });
      } else {
        // Normal artifact update - replace all data
        yMap.clear();
        Object.entries(artifactData).forEach(([key, value]) => {
          yMap.set(key, value);
        });
      }
    }
  }, [artifact, yjsDoc]);

  const updateField = useCallback((field: string, value: any) => {
    if (!yjsDoc) return;
    
    const yMap = yjsDoc.getMap('content');
    yMap.set(field, value);
  }, [yjsDoc]);

  const updateFields = useCallback((updates: Record<string, any>) => {
    if (!yjsDoc) return;
    
    const yMap = yjsDoc.getMap('content');
    Object.entries(updates).forEach(([key, value]) => {
      yMap.set(key, value);
    });
  }, [yjsDoc]);

  return {
    // Artifact data (prioritize collaborative over persistent)
    data: collaborativeData || artifact?.data,
    artifact,
    
    // YJS collaboration state
    yjsDoc,
    provider,
    isCollaborative: enableCollaboration && !!yjsDoc,
    
    // Update methods
    updateField,
    updateFields,
    
    // Legacy compatibility
    handleFieldChange: updateField
  };
};
```

#### 2.3 Enhanced Editable Components

```typescript
// src/client/components/shared/YJSEditableText.tsx
export const YJSEditableText: React.FC<{
  artifactId: string;
  field: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  enableCollaboration?: boolean;
}> = ({ 
  artifactId, 
  field, 
  value: externalValue, 
  placeholder, 
  disabled = false,
  enableCollaboration = true 
}) => {
  const { data, updateField, isCollaborative } = useYJSArtifact(artifactId, {
    enableCollaboration
  });

  // Use collaborative value if available, fallback to external value
  const currentValue = data?.[field] ?? externalValue ?? '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCollaborative) {
      updateField(field, e.target.value);
    } else {
      // Fallback to legacy update mechanism
      // This will be handled by parent component
    }
  };

  return (
    <Input
      value={currentValue}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        // Visual indicator for collaborative mode
        borderColor: isCollaborative ? '#1890ff' : undefined
      }}
    />
  );
};
```

### Phase 3: Backend YJS Endpoints

#### 3.1 YJS Update Handlers

```typescript
// src/server/routes/yjsRoutes.ts
export function createYJSRoutes(authMiddleware: AuthMiddleware) {
  const router = Router();

  // Handle YJS document updates
  router.post('/update', authMiddleware.authenticate, async (req: any, res: any) => {
    try {
      const user = authMiddleware.getCurrentUser(req);
      const { room, project } = req.query;
      const { update } = req.body;

      if (!user || !room || !project) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      // Verify user has access to this project
      const hasAccess = await req.authDB!.getProjectIdsForUser(user.id);
      if (!hasAccess.includes(project)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Store YJS update
      await req.db.insertInto('artifact_yjs_updates')
        .values({
          room_id: room,
          project_id: project,
          update: Buffer.from(update, 'base64'),
          client_id: req.headers['x-client-id'] || 'unknown'
        })
        .execute();

      res.json({ success: true });
    } catch (error) {
      console.error('YJS update error:', error);
      res.status(500).json({ error: 'Failed to save update' });
    }
  });

  // Handle YJS awareness updates
  router.post('/awareness', authMiddleware.authenticate, async (req: any, res: any) => {
    try {
      const user = authMiddleware.getCurrentUser(req);
      const { room, project } = req.query;
      const { update, client_id } = req.body;

      if (!user || !room || !project || !client_id) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      // Verify user has access to this project
      const hasAccess = await req.authDB!.getProjectIdsForUser(user.id);
      if (!hasAccess.includes(project)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Upsert awareness update
      await req.db.insertInto('artifact_yjs_awareness')
        .values({
          client_id,
          room_id: room,
          project_id: project,
          update: Buffer.from(update, 'base64')
        })
        .onConflict((oc) => oc
          .columns(['client_id', 'room_id'])
          .doUpdateSet({
            update: Buffer.from(update, 'base64'),
            updated_at: new Date()
          })
        )
        .execute();

      res.json({ success: true });
    } catch (error) {
      console.error('YJS awareness error:', error);
      res.status(500).json({ error: 'Failed to save awareness' });
    }
  });

  return router;
}
```

### Phase 4: Component Migration Strategy

#### 4.1 Backwards-Compatible API

```typescript
// Extend existing components with YJS support
const EditableText = ({ 
  artifactId, 
  field, 
  value, 
  onSave,
  enableYJS = true, // New prop
  ...props 
}) => {
  if (enableYJS && artifactId) {
    // Use YJS-enabled component
    return <YJSEditableText artifactId={artifactId} field={field} {...props} />;
  } else {
    // Use legacy component
    return <LegacyEditableText value={value} onSave={onSave} {...props} />;
  }
};
```

#### 4.2 Migration Phases

**Phase 4a: Enable YJS for Simple Text Fields**
- BrainstormInputEditor text fields
- Outline title/description fields
- Chronicle stage descriptions

**Phase 4b: Enable YJS for Complex Objects**
- Brainstorm idea collections
- Character arrays
- Synopsis stages

**Phase 4c: Enable YJS for All Artifact Types**
- Complete migration of all editable components
- Remove legacy update mechanisms

### Phase 5: Testing and Optimization

#### 5.1 Conflict Resolution Testing

```typescript
// Test concurrent editing scenarios
describe('YJS Conflict Resolution', () => {
  it('should handle simultaneous user edits', async () => {
    const artifact = await createTestArtifact();
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();
    
    // Simulate two users editing simultaneously
    const map1 = doc1.getMap('content');
    const map2 = doc2.getMap('content');
    
    map1.set('title', 'User 1 Edit');
    map2.set('title', 'User 2 Edit');
    
    // Apply updates cross-document
    Y.applyUpdate(doc1, Y.encodeStateAsUpdate(doc2));
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1));
    
    // Verify conflict resolution
    expect(map1.get('title')).toBe(map2.get('title'));
  });

  it('should prioritize user edits over AI streaming', async () => {
    // Test streaming vs collaborative editing conflicts
  });
});
```

#### 5.2 Performance Monitoring

```typescript
// Monitor YJS performance impact
const YJSPerformanceMonitor = {
  trackUpdateSize: (update: Uint8Array) => {
    console.log(`YJS update size: ${update.length} bytes`);
  },
  
  trackSyncLatency: (startTime: number) => {
    const latency = Date.now() - startTime;
    console.log(`YJS sync latency: ${latency}ms`);
  }
};
```

## Migration Strategy

### 1. Gradual Rollout

**Week 1-2:** Infrastructure setup (database, routes, basic YJS service)
**Week 3-4:** Simple text field migration (titles, descriptions)
**Week 5-6:** Complex object migration (arrays, nested objects)
**Week 7-8:** Full migration and legacy cleanup
**Week 9:** Documentation updates (README.md, TRANSFORM_ARTIFACT_FRAMEWORK.md)

### 2. Feature Flags

```typescript
// Enable YJS per component type
const YJS_FEATURE_FLAGS = {
  brainstormInput: true,
  outlineSettings: true,
  chronicleStages: false, // Gradual rollout
  episodeScripts: false   // Future phase
};
```

### 3. Fallback Mechanisms

- Always maintain legacy API endpoints during migration
- Automatic fallback if YJS fails to initialize
- Manual toggle for users to disable collaboration

## Success Metrics

1. **Real-time Collaboration**
   - Sub-100ms update propagation between clients
   - Zero data loss during concurrent editing
   - Proper conflict resolution in 100% of cases

2. **Performance**
   - No degradation in existing artifact loading times
   - YJS overhead < 50KB per artifact
   - Electric SQL query performance maintained

3. **Backwards Compatibility**
   - All existing components continue to work
   - No breaking changes to existing APIs
   - Seamless migration for end users

4. **User Experience**
   - Live cursor presence for collaborative editing
   - Visual indicators for collaborative mode
   - Offline editing with sync on reconnect

## Risk Mitigation

### 1. Data Consistency Risks
- **Risk:** YJS and Transform Framework data divergence
- **Mitigation:** Periodic sync validation, conflict resolution hierarchy

### 2. Performance Risks
- **Risk:** YJS overhead impacts app performance
- **Mitigation:** Lazy loading, selective collaboration, performance monitoring

### 3. Complexity Risks
- **Risk:** Dual state management increases bugs
- **Mitigation:** Comprehensive testing, gradual rollout, feature flags

### 4. Streaming Conflicts
- **Risk:** AI streaming overwrites collaborative edits
- **Mitigation:** Priority-based conflict resolution, user edit protection

This comprehensive plan addresses all overlooked aspects while maintaining the DRY principle and ensuring seamless integration with the existing Transform Framework. 

## Additional Critical Components Discovered

### 1. **Streaming Field Components** (`src/client/components/shared/streaming/fieldComponents.tsx`)

**Components requiring YJS integration:**
- `EditableTextListField` - Auto-saving text arrays with debounced updates
- `EditableCharacterArrayField` - Complex character object arrays
- `EditableSynopsisStagesField` - Nested story stage objects with key points

**YJS Integration Strategy:**
```typescript
// Convert streaming field components to YJS
const YJSEditableTextListField = ({ artifactId, field, ...props }) => {
  const { doc, provider } = useYJSArtifact(artifactId);
  const yArray = doc.getArray(field);
  
  // Convert Y.Array to local state for rendering
  const [localItems, setLocalItems] = useState<string[]>([]);
  
  useEffect(() => {
    const updateLocalItems = () => {
      setLocalItems(yArray.toArray());
    };
    
    yArray.observe(updateLocalItems);
    updateLocalItems(); // Initial sync
    
    return () => yArray.unobserve(updateLocalItems);
  }, [yArray]);
  
  const handleItemChange = (index: number, value: string) => {
    yArray.delete(index, 1);
    yArray.insert(index, [value]);
  };
  
  return (
    <div>
      {localItems.map((item, index) => (
        <YJSEditableText
          key={index}
          value={item}
          onChange={(value) => handleItemChange(index, value)}
          {...props}
        />
      ))}
    </div>
  );
};
```

### 2. **Core Editable Components** (`src/client/components/shared/EditableText.tsx`)

**Critical components:**
- `EditableText` - Basic text editing with debounced saves
- `EditableArray` - Array editing with both `list` and `textarea` modes

**YJS Integration Challenges:**
- Complex state management for concurrent editing
- Debounced save conflicts with real-time updates
- Mode switching between list and textarea

**Solution:**
```typescript
const YJSEditableText = ({ artifactId, field, multiline = false, ...props }) => {
  const { doc, provider } = useYJSArtifact(artifactId);
  const yText = multiline ? doc.getText(field) : doc.getMap('content');
  
  // For multiline: use Y.Text for collaborative text editing
  // For single line: use Y.Map with field-based updates
  
  if (multiline) {
    return <YJSTextEditor yText={yText} {...props} />;
  } else {
    return <YJSFieldEditor yMap={yText} field={field} {...props} />;
  }
};

const YJSEditableArray = ({ artifactId, field, mode = 'list', ...props }) => {
  const { doc } = useYJSArtifact(artifactId);
  const yArray = doc.getArray(field);
  
  if (mode === 'textarea') {
    // Convert array to text for textarea editing
    const yText = doc.getText(`${field}_text`);
    
    // Sync between Y.Array and Y.Text
    useEffect(() => {
      const syncArrayToText = () => {
        const arrayContent = yArray.toArray().join('\n');
        yText.delete(0, yText.length);
        yText.insert(0, arrayContent);
      };
      
      const syncTextToArray = () => {
        const textContent = yText.toString();
        const newArray = textContent.split('\n').filter(line => line.trim());
        yArray.delete(0, yArray.length);
        yArray.insert(0, newArray);
      };
      
      // Set up bidirectional sync
      yArray.observe(syncArrayToText);
      yText.observe(syncTextToArray);
      
      return () => {
        yArray.unobserve(syncArrayToText);
        yText.unobserve(syncTextToArray);
      };
    }, [yArray, yText]);
    
    return <YJSTextEditor yText={yText} {...props} />;
  } else {
    return <YJSArrayEditor yArray={yArray} {...props} />;
  }
};
```

### 3. **Transform Framework Components**

**Components requiring special handling:**
- `EditableField.tsx` - Low-level field editing with focus management
- `EditableTextField.tsx` - Text field editor with validation
- `ArtifactEditor.tsx` - High-level artifact editing orchestration

**Integration Strategy:**
```typescript
// Extend ArtifactEditor to support YJS
const YJSArtifactEditor = ({ artifactId, fields, ...props }) => {
  const { doc, provider, isConnected } = useYJSArtifact(artifactId);
  
  // Fallback to legacy editor if YJS fails
  if (!isConnected) {
    return <LegacyArtifactEditor artifactId={artifactId} fields={fields} {...props} />;
  }
  
  return (
    <div>
      {fields.map(field => (
        <YJSEditableField
          key={field.field}
          artifactId={artifactId}
          field={field.field}
          component={field.component}
          {...field}
        />
      ))}
    </div>
  );
};
```

### 4. **Chat and Real-time Components**

**Components affected:**
- `BasicThread.tsx` - Chat interface with real-time messaging
- `ChatContext.tsx` - Electric SQL chat message subscriptions
- `ChatInput.tsx` - Chat input with typewriter effects

**YJS Integration Notes:**
- Chat messages should remain in Electric SQL (not YJS) for audit trail
- Only artifact edits within chat context need YJS
- Maintain existing Electric SQL subscriptions for chat

### 5. **Workflow and Visualization Components**

**Components requiring updates:**
- `WorkflowVisualization.tsx` - Real-time workflow state visualization
- `RawGraphVisualization.tsx` - Artifact lineage graph with delete actions

**Integration Strategy:**
```typescript
// Update visualization to show YJS collaboration status
const YJSWorkflowVisualization = ({ ...props }) => {
  const collaborationStatus = useYJSCollaborationStatus();
  
  return (
    <div>
      <LegacyWorkflowVisualization {...props} />
      <CollaborationIndicator status={collaborationStatus} />
    </div>
  );
};
```

### 6. **Component-Specific Migration Plan**

**Priority 1 (Simple Text Fields):**
- `BrainstormInputEditor` text fields
- `OutlineSettingsDisplay` basic fields
- `ChronicleStageCard` descriptions

**Priority 2 (Complex Objects):**
- `EditableTextListField` arrays
- `EditableCharacterArrayField` objects
- `EditableSynopsisStagesField` nested structures

**Priority 3 (Advanced Features):**
- `EditableArray` textarea mode
- Cross-component synchronization
- Conflict resolution UI

### 7. **Testing Strategy for All Components**

```typescript
// Component-specific YJS tests
describe('YJS Component Integration', () => {
  describe('EditableText', () => {
    it('should sync text changes across clients', async () => {
      // Test basic text synchronization
    });
    
    it('should handle concurrent editing', async () => {
      // Test conflict resolution
    });
  });
  
  describe('EditableArray', () => {
    it('should sync array changes in list mode', async () => {
      // Test array item synchronization
    });
    
    it('should sync array changes in textarea mode', async () => {
      // Test textarea to array conversion
    });
  });
  
  describe('StreamingFieldComponents', () => {
    it('should prioritize user edits over AI streaming', async () => {
      // Test streaming vs collaborative editing
    });
  });
});
```

### 8. **Performance Considerations**

**Component-specific optimizations:**
- **EditableText**: Debounce YJS updates to prevent excessive network traffic
- **EditableArray**: Use Y.Array operations instead of full array replacement
- **StreamingComponents**: Implement conflict resolution hierarchy (user > AI)
- **Visualization**: Throttle real-time updates to prevent UI lag

This comprehensive analysis covers all critical components that require YJS integration, ensuring no component is overlooked in the migration process.

### Phase 6: Documentation Updates

#### 6.1 README.md Updates

**Add YJS Integration Section**:
```markdown
## Real-time Collaboration with YJS

觅光助创 supports real-time collaborative editing powered by YJS (Yjs) + Electric SQL:

### Features
- **Live Collaborative Editing** - Multiple users can edit artifacts simultaneously
- **Conflict-Free Synchronization** - CRDT-based conflict resolution
- **Cursor Presence** - See other users' cursors and selections
- **Offline Support** - Continue editing offline, sync when reconnected

### Usage
```typescript
// Enable YJS for artifact editing
const { doc, provider, isConnected } = useYJSArtifact(artifactId);

// Edit text collaboratively
const yText = doc.getText('content');
yText.insert(0, 'Hello collaborative world!');
```

### Configuration
Set `ENABLE_YJS_COLLABORATION=true` in environment variables to enable real-time collaboration features.
```

**Update Architecture Section**:
```markdown
### Real-time Collaboration Architecture

**YJS + Electric SQL Integration**:
- **YJS Documents** - CRDT-based collaborative data structures
- **Electric SQL Sync** - Persistent storage with real-time updates
- **Hybrid State** - YJS for editing, Electric SQL for audit trails
- **Conflict Resolution** - Automatic merge with user edit priority
```

#### 6.2 TRANSFORM_ARTIFACT_FRAMEWORK.md Updates

**Add YJS Integration Section**:
```markdown
## YJS Integration for Real-time Collaboration

The Transform Artifact Framework integrates YJS (Yjs) for real-time collaborative editing while maintaining the immutable artifact → transform → artifact paradigm.

### Architecture Integration

**Hybrid Approach**:
- **Artifacts remain immutable** - YJS operates on temporary collaborative documents
- **Transform creation** - Collaborative changes trigger artifact updates via transforms
- **Audit trail preservation** - All changes tracked through transform system
- **Conflict resolution** - YJS handles real-time conflicts, transforms handle persistence

### YJS Document Structure

```typescript
// YJS document mirrors artifact structure
const doc = new Y.Doc();
const yMap = doc.getMap('content');
const yText = doc.getText('description');
const yArray = doc.getArray('items');

// Sync with artifact data
yMap.set('title', artifact.data.title);
yText.insert(0, artifact.data.description);
```

### Collaborative Transform Pattern

```typescript
// YJS changes trigger transform creation
yText.observe((event) => {
  if (event.transaction.local) {
    // Local change - create human transform
    createHumanTransform({
      sourceArtifactId: artifact.id,
      changes: extractChanges(event),
      collaborativeSession: doc.guid
    });
  }
});
```

### Benefits for Framework Applications

- **Real-time UX** - Immediate visual feedback during collaboration
- **Preserved Immutability** - Artifact history remains complete
- **Scalable Collaboration** - Support for multiple simultaneous editors
- **Framework Compatibility** - Works with existing transform patterns
```

**Update Frontend Integration Section**:
```markdown
### YJS-Enhanced Frontend Components

**Collaborative Artifact Editor**:
```typescript
const CollaborativeArtifactEditor = ({ artifactId, field }) => {
  const { doc, provider, isConnected } = useYJSArtifact(artifactId);
  const yText = doc.getText(field);
  
  return (
    <YJSTextEditor
      yText={yText}
      placeholder="Start typing..."
      onSave={(content) => {
        // Create transform when collaboration session ends
        createHumanTransform({
          sourceArtifactId: artifactId,
          fieldUpdates: { [field]: content }
        });
      }}
    />
  );
};
```
```

#### 6.3 Implementation Documentation

**Add YJS Setup Guide**:
```markdown
## Setting Up YJS Collaboration

### Prerequisites
- PostgreSQL with YJS tables
- Electric SQL running
- YJS packages installed

### Installation
```bash
npm install yjs @electric-sql/y-electric y-websocket
```

### Configuration
```typescript
// Enable YJS in environment
ENABLE_YJS_COLLABORATION=true
YJS_WEBSOCKET_URL=ws://localhost:1234
```

### Usage Examples
[Include comprehensive examples for different artifact types]
``` 