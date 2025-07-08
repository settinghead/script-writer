# YJS + Electric SQL Integration Analysis

## Overview

This document analyzes two example codebases that demonstrate YJS (Yjs) integration with Electric SQL for real-time collaborative editing:

1. **electric-notes** - A collaborative notes application using TipTap editor
2. **electric/examples/yjs** - A basic CodeMirror editor example

Both examples showcase different approaches to implementing real-time collaborative text editing with YJS and Electric SQL as the synchronization backend.

## Core Architecture

### YJS (Yjs) Fundamentals

**What is YJS?**
- A Conflict-free Replicated Data Type (CRDT) library for building collaborative applications
- Enables real-time synchronization of shared data structures (text, arrays, maps, etc.)
- Handles merge conflicts automatically without requiring a central authority
- Works offline and syncs when reconnected

**Key YJS Concepts:**
- **Y.Doc** - The main document container that holds all shared data
- **Y.Text** - Shared text type for collaborative text editing  
- **Y.Array** - Shared array type for lists
- **Y.Map** - Shared map type for key-value data
- **Awareness** - Real-time presence information (cursors, selections, user info)
- **Updates** - Binary diffs representing changes to the document

### Electric SQL Integration Pattern

Both examples follow a similar pattern for integrating YJS with Electric SQL:

```
YJS Document ←→ Electric Provider ←→ Electric SQL ←→ PostgreSQL
```

**Data Flow:**
1. **Local Changes** → YJS generates binary updates
2. **Updates** → Electric Provider sends to server via HTTP POST
3. **Server** → Stores updates in PostgreSQL tables
4. **Electric SQL** → Streams updates to all connected clients
5. **Clients** → Apply updates to their YJS documents

## Example 1: Electric-Notes (TipTap Integration)

### Architecture Overview

**Key Components:**
- **ElectricProvider** - Custom provider for YJS ↔ Electric integration
- **TipTap Editor** - Rich text editor with YJS collaboration extensions
- **Awareness** - Real-time cursor and user presence
- **IndexedDB Persistence** - Offline storage and resume capability

### Database Schema

```sql
-- Document updates (core YJS operations)
CREATE TABLE note_operations (
  id SERIAL PRIMARY KEY,
  note_id TEXT NOT NULL,
  op BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Awareness updates (user presence, cursors)
CREATE TABLE awareness (
  client_id TEXT,
  note_id TEXT, 
  op BYTEA NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, note_id)
);

-- Auto-cleanup for stale awareness
CREATE OR REPLACE FUNCTION gc_awareness_timeouts()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM awareness 
    WHERE updated_at < (CURRENT_TIMESTAMP - INTERVAL '30 seconds') 
    AND note_id = NEW.note_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### ElectricProvider Implementation

The `ElectricProvider` class handles the YJS ↔ Electric SQL integration:

```typescript
export class ElectricProvider extends ObservableV2<ObservableProvider> {
  private baseUrl: string;
  private roomName: string;
  private doc: Y.Doc;
  public awareness?: awarenessProtocol.Awareness;

  private operationsStream?: ShapeStream<OperationMessage>;
  private awarenessStream?: ShapeStream<AwarenessMessage>;

  constructor(baseUrl: string, roomName: string, doc: Y.Doc, options: {
    awareness?: awarenessProtocol.Awareness;
    connect?: boolean;
    persistence?: IndexeddbPersistence;
  }) {
    // Setup document update handler
    this.updateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin !== this) {
        this.sendOperation(update);
      }
    };
    this.doc.on('update', this.updateHandler);

    // Setup awareness update handler
    if (this.awareness) {
      this.awarenessUpdateHandler = ({ added, updated, removed }, origin) => {
        if (origin === 'local') {
          const changedClients = added.concat(updated).concat(removed);
          this.sendAwareness(changedClients);
        }
      };
      this.awareness.on('update', this.awarenessUpdateHandler);
    }
  }
}
```

### Key Features

**1. Offline Support with Resume:**
```typescript
// Load previous sync state from IndexedDB
async loadSyncState() {
  const operationsHandle = await this.persistence.get('operations_handle');
  const operationsOffset = await this.persistence.get('operations_offset');
  
  this.resume = {
    operations: { handle: operationsHandle, offset: operationsOffset }
  };
}
```

**2. Real-time Streaming:**
```typescript
private setupShapeStream() {
  this.operationsStream = new ShapeStream<OperationMessage>({
    url: this.baseUrl + '/notes-operations',
    params: { where: `note_id = '${this.roomName}'` },
    parser: parseToDecoder,
    subscribe: true,
    ...this.resume.operations,
  });
}
```

**3. Binary Update Encoding:**
```typescript
private sendOperation(update: Uint8Array) {
  const encoder = encoding.createEncoder();
  syncProtocol.writeUpdate(encoder, update);
  const op = toBase64(encoding.toUint8Array(encoder));
  
  return fetch(new URL("/v1/note-operation", this.baseUrl), {
    method: 'POST',
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ note_id: this.roomName, op }),
  });
}
```

### TipTap Integration

```typescript
export function createTiptapExtensions(provider: ElectricProvider): Extensions {
  return [
    StarterKit.configure({
      history: false, // Disable - YJS handles history
    }),
    Collaboration.configure({
      document: provider.doc, // YJS document
    }),
    CollaborationCursor.configure({
      provider,
      user: { name: userInfo.name, color: userInfo.color },
    }),
  ];
}
```

## Example 2: Electric YJS (CodeMirror Integration)

### Architecture Overview

**Key Components:**
- **@electric-sql/y-electric** - Official Electric YJS provider package
- **CodeMirror** - Code editor with YJS collaboration
- **LocalStorageResumeStateProvider** - Resume state management
- **IndexedDB Persistence** - Offline document storage

### Database Schema

```sql
-- Document updates
CREATE TABLE ydoc_update(
  id SERIAL PRIMARY KEY,
  room TEXT,
  update BYTEA NOT NULL 
);

-- Awareness updates  
CREATE TABLE ydoc_awareness(
  client_id TEXT, 
  room TEXT,
  update BYTEA NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, room)
);

-- Auto-cleanup for stale awareness (30 seconds)
CREATE OR REPLACE FUNCTION gc_awareness_timeouts()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM ydoc_awareness
    WHERE updated_at < (CURRENT_TIMESTAMP - INTERVAL '30 seconds') 
    AND room = NEW.room;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Official Provider Usage

```typescript
import { ElectricProvider, ElectricProviderOptions } from "@electric-sql/y-electric";

const options: ElectricProviderOptions<UpdateTableSchema, UpdateTableSchema> = {
  doc: ydoc,
  documentUpdates: {
    shape: {
      url: shapeUrl.href,
      params: { table: 'ydoc_update', where: `room = '${room}'` },
      parser: parseToDecoder,
    },
    sendUrl: new URL(`/api/update?room=${room}`, serverUrl),
    getUpdateFromRow: (row) => row.update,
  },
  awarenessUpdates: {
    shape: {
      url: shapeUrl.href, 
      params: { table: 'ydoc_awareness', where: `room = '${room}'` },
      parser: parseToDecoder,
    },
    sendUrl: new URL(`/api/update?room=${room}&client_id=${ydoc.clientID}`, serverUrl),
    protocol: awareness,
    getUpdateFromRow: (row) => row.update,
  },
  resumeState: resumeStateProvider.load(),
};

const provider = new ElectricProvider(options);
```

### CodeMirror Integration

```typescript
const ytext = ydoc.getText(room);

const state = EditorState.create({
  doc: ytext.toString(),
  extensions: [
    keymap.of([...yUndoManagerKeymap]),
    basicSetup,
    javascript(),
    EditorView.lineWrapping,
    yCollab(ytext, awareness), // YJS collaboration extension
  ],
});

const view = new EditorView({ state, parent: editorElement });
```

### Server Implementation

```typescript
// Handle YJS updates
app.put('/api/update', async (c: Context) => {
  const requestParams = await parseRequest(c);
  
  if ('client_id' in requestParams) {
    await upsertAwarenessUpdate(requestParams, pool);
  } else {
    await saveUpdate(requestParams, pool);
  }
  
  return c.json({});
});

// Save document updates
async function saveUpdate({ room, update }: Update, pool: Pool) {
  const q = 'INSERT INTO ydoc_update (room, update) VALUES ($1, $2)';
  await pool.query(q, [room, update]);
}

// Upsert awareness updates
async function upsertAwarenessUpdate({ room, client_id, update }: AwarenessUpdate, pool: Pool) {
  const q = `INSERT INTO ydoc_awareness (room, client_id, update) VALUES ($1, $2, $3)
             ON CONFLICT (client_id, room) DO UPDATE SET update = $3, updated_at = now()`;
  await pool.query(q, [room, client_id, update]);
}
```

## Key Technical Patterns

### 1. Binary Data Handling

**YJS generates binary updates that must be stored as BYTEA in PostgreSQL:**

```typescript
// Convert hex string from PostgreSQL to Uint8Array
const hexStringToUint8Array = (hexString: string) => {
  const cleanHexString = hexString.startsWith('\\x') 
    ? hexString.slice(2) 
    : hexString;
  return new Uint8Array(
    cleanHexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
};

// Create YJS decoder from PostgreSQL bytea
export const parseToDecoder = {
  bytea: (hexString: string) => {
    const uint8Array = hexStringToUint8Array(hexString);
    return decoding.createDecoder(uint8Array);
  },
};
```

### 2. Shape Stream Integration

**Electric SQL Shape Streams provide real-time updates:**

```typescript
const operationsStream = new ShapeStream<OperationMessage>({
  url: electricUrl + '/v1/shape',
  params: {
    table: 'ydoc_update',
    where: `room = '${roomName}'`,
  },
  parser: parseToDecoder,
  subscribe: true,
  ...resumeState,
});

operationsStream.subscribe((messages) => {
  messages.forEach((message) => {
    if (isChangeMessage(message) && message.value.op) {
      const decoder = message.value.op;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.readSyncMessage(decoder, encoder, ydoc, provider);
    }
  });
});
```

### 3. Awareness Management

**Real-time user presence with automatic cleanup:**

```typescript
// Send awareness updates
private sendAwareness(changedClients: number[]) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(this.awareness!, changedClients)
  );
  const op = toBase64(encoding.toUint8Array(encoder));
  
  return fetch(awarenessUrl, {
    method: 'POST',
    body: JSON.stringify({ clientId: `${this.doc.clientID}`, room, op }),
  });
}

// Apply incoming awareness updates
const handleAwarenessMessage = (messages: Message<AwarenessMessage>[]) => {
  const minTime = new Date(Date.now() - awarenessPingPeriod);
  messages.forEach((message) => {
    if (message.value.updated < minTime) return; // Skip stale updates
    
    const decoder = message.value.op();
    awarenessProtocol.applyAwarenessUpdate(
      this.awareness!,
      decoding.readVarUint8Array(decoder),
      this
    );
  });
};
```

### 4. Offline Support & Resume

**IndexedDB persistence with resume capabilities:**

```typescript
// Load previous sync state
const resumeState = {
  operations: {
    handle: await persistence.get('operations_handle'),
    offset: await persistence.get('operations_offset'),
  },
  awareness: {
    handle: await persistence.get('awareness_handle'), 
    offset: await persistence.get('awareness_offset'),
  }
};

// Save sync state on updates
const updateShapeState = (name: 'operations' | 'awareness', offset: Offset, handle: string) => {
  persistence.set(`${name}_offset`, offset);
  persistence.set(`${name}_handle`, handle);
};
```

## Recommendations for Script-Writer Integration

### 1. Artifact-Level YJS Integration

**Current Challenge:**
The script-writer uses immutable artifacts with transform chains. YJS expects mutable shared documents.

**Recommended Approach:**
Implement YJS at the **artifact content level** rather than the artifact metadata level:

```typescript
// Each artifact gets its own YJS document for content editing
interface ArtifactYJSDocument {
  artifactId: string;
  yjsDoc: Y.Doc;
  contentType: 'text' | 'json' | 'structured';
  lastSyncedVersion: string;
}

// YJS document per artifact type
const brainstormIdeaDoc = new Y.Doc();
const outlineDoc = new Y.Doc();
const chroniclesDoc = new Y.Doc();
```

### 2. Hybrid Architecture: Transform Framework + YJS

**Maintain Transform Framework for:**
- Artifact versioning and lineage
- AI-generated content creation
- Cross-artifact dependencies
- Audit trails and history

**Use YJS for:**
- Real-time collaborative editing of artifact content
- Live cursor presence and awareness
- Conflict resolution during simultaneous edits
- Offline editing with sync on reconnect

### 3. Database Schema Design

```sql
-- Extend existing artifacts table
ALTER TABLE artifacts ADD COLUMN yjs_room_id TEXT;
ALTER TABLE artifacts ADD COLUMN yjs_enabled BOOLEAN DEFAULT FALSE;

-- YJS document updates per artifact
CREATE TABLE artifact_yjs_updates (
  id SERIAL PRIMARY KEY,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id),
  room_id TEXT NOT NULL,
  update BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- YJS awareness per artifact editing session
CREATE TABLE artifact_yjs_awareness (
  client_id TEXT,
  artifact_id TEXT NOT NULL REFERENCES artifacts(id),
  room_id TEXT NOT NULL,
  update BYTEA NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, artifact_id)
);

-- Auto-cleanup stale awareness
CREATE OR REPLACE FUNCTION gc_artifact_awareness_timeouts()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM artifact_yjs_awareness
    WHERE updated_at < (CURRENT_TIMESTAMP - INTERVAL '30 seconds') 
    AND artifact_id = NEW.artifact_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gc_artifact_awareness_trigger
AFTER INSERT OR UPDATE ON artifact_yjs_awareness
FOR EACH ROW
EXECUTE FUNCTION gc_artifact_awareness_timeouts();
```

### 4. Component Integration Strategy

**Enhanced ArtifactEditor with YJS:**

```typescript
interface YJSArtifactEditorProps {
  artifactId: string;
  fields: FieldConfig[];
  enableCollaboration?: boolean;
  onSaveToTransformFramework?: (data: any) => void;
}

const YJSArtifactEditor: React.FC<YJSArtifactEditorProps> = ({
  artifactId,
  fields,
  enableCollaboration = true,
  onSaveToTransformFramework
}) => {
  const [yjsDoc] = useState(() => new Y.Doc());
  const [awareness] = useState(() => new Awareness(yjsDoc));
  const [provider, setProvider] = useState<ElectricProvider | null>(null);

  useEffect(() => {
    if (enableCollaboration) {
      const electricProvider = new ElectricProvider(
        electricUrl,
        `artifact-${artifactId}`,
        yjsDoc,
        { awareness, connect: true }
      );
      setProvider(electricProvider);

      return () => {
        electricProvider.destroy();
      };
    }
  }, [artifactId, enableCollaboration]);

  // Sync YJS changes back to Transform Framework periodically
  useEffect(() => {
    const syncToFramework = () => {
      const currentData = extractDataFromYJS(yjsDoc, fields);
      onSaveToTransformFramework?.(currentData);
    };

    const interval = setInterval(syncToFramework, 5000); // Sync every 5 seconds
    return () => clearInterval(interval);
  }, [yjsDoc, fields, onSaveToTransformFramework]);

  return (
    <div className="yjs-artifact-editor">
      {fields.map((field) => (
        <YJSField
          key={field.field}
          fieldConfig={field}
          yjsDoc={yjsDoc}
          awareness={awareness}
          path={field.field}
        />
      ))}
      
      {provider && (
        <CollaborationStatus 
          provider={provider}
          awareness={awareness}
        />
      )}
    </div>
  );
};
```

### 5. Field-Level YJS Implementation

**For different field types:**

```typescript
// Text fields using Y.Text
const YJSTextField: React.FC<{
  fieldConfig: FieldConfig;
  yjsDoc: Y.Doc;
  awareness: Awareness;
  path: string;
}> = ({ fieldConfig, yjsDoc, awareness, path }) => {
  const ytext = yjsDoc.getText(path);
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: yjsDoc, field: path }),
      CollaborationCursor.configure({ provider: awareness }),
    ],
  });

  return <EditorContent editor={editor} />;
};

// Array fields using Y.Array
const YJSArrayField: React.FC<{
  fieldConfig: FieldConfig;
  yjsDoc: Y.Doc;
  path: string;
}> = ({ fieldConfig, yjsDoc, path }) => {
  const yarray = yjsDoc.getArray(path);
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    const updateItems = () => setItems(yarray.toArray());
    yarray.observe(updateItems);
    updateItems();
    
    return () => yarray.unobserve(updateItems);
  }, [yarray]);

  const addItem = (item: string) => {
    yarray.push([item]);
  };

  const removeItem = (index: number) => {
    yarray.delete(index, 1);
  };

  return (
    <div>
      {items.map((item, index) => (
        <div key={index}>
          <input 
            value={item}
            onChange={(e) => yarray.delete(index, 1) && yarray.insert(index, [e.target.value])}
          />
          <button onClick={() => removeItem(index)}>Remove</button>
        </div>
      ))}
      <button onClick={() => addItem('')}>Add Item</button>
    </div>
  );
};
```

### 6. Integration Points

**1. Enhanced SingleBrainstormIdeaEditor:**
```typescript
const SingleBrainstormIdeaEditor: React.FC<Props> = ({ isEditable }) => {
  const handleYJSSync = useCallback((yjsData: any) => {
    // Sync YJS changes back to Transform Framework
    projectData.updateArtifact.mutate({
      artifactId: latestArtifactId,
      data: yjsData
    });
  }, [latestArtifactId]);

  if (isEditable) {
    return (
      <YJSArtifactEditor
        artifactId={latestArtifactId}
        fields={BRAINSTORM_IDEA_FIELDS}
        enableCollaboration={true}
        onSaveToTransformFramework={handleYJSSync}
      />
    );
  }
  
  // ... existing read-only logic
};
```

**2. Enhanced ChronicleStageCard:**
```typescript
const ChronicleStageCard: React.FC<Props> = ({ chroniclesArtifactId, stagePath }) => {
  if (isEditable) {
    return (
      <YJSArtifactEditor
        artifactId={effectiveArtifact.id}
        fields={CHRONICLE_STAGE_FIELDS}
        enableCollaboration={true}
        onSaveToTransformFramework={(data) => {
          // Sync back to Transform Framework
          handleSave('', data);
        }}
      />
    );
  }
  
  // ... existing logic
};
```

### 7. Migration Strategy

**Phase 1: Infrastructure Setup**
1. Add YJS database tables and triggers
2. Install YJS dependencies (`yjs`, `y-protocols`, `@electric-sql/y-electric`)
3. Create ElectricProvider for artifact editing
4. Implement basic YJS text field component

**Phase 2: Component Integration**
1. Enhance ArtifactEditor with YJS support
2. Add collaboration awareness UI
3. Implement field-specific YJS components (text, array, object)
4. Add sync mechanisms between YJS and Transform Framework

**Phase 3: Advanced Features**
1. Offline editing with IndexedDB persistence
2. Conflict resolution for simultaneous edits
3. Real-time cursor and user presence
4. Performance optimization for large documents

### 8. Benefits for Script-Writer

**Immediate Benefits:**
- **Real-time Collaboration** - Multiple users can edit artifacts simultaneously
- **Live Cursors** - See where other users are editing in real-time
- **Conflict Resolution** - Automatic merge of simultaneous edits
- **Offline Support** - Continue editing when disconnected, sync when reconnected

**Framework Preservation:**
- **Immutable Artifacts** - Transform Framework history preserved
- **AI Integration** - YJS doesn't interfere with AI-generated content
- **Audit Trails** - Complete lineage tracking maintained
- **Version Control** - Snapshots and rollback capabilities preserved

**Enhanced User Experience:**
- **Instant Feedback** - No waiting for debounced saves
- **Collaborative Awareness** - See who's editing what in real-time
- **Seamless Sync** - Changes appear instantly across all clients
- **Robust Offline** - Work continues during network interruptions

This hybrid approach combines the best of both worlds: the robust artifact management and AI integration of the Transform Framework with the real-time collaborative editing capabilities of YJS + Electric SQL. 