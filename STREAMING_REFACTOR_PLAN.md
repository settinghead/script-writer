# Streaming Architecture Refactor Plan

## Overview
This document outlines a comprehensive refactor to eliminate the caching layer and create a unified, real-time streaming architecture for both brainstorming and outline generation.

## Current Problems
1. **Race Conditions**: Cache populated with incomplete data during streaming
2. **Multiple Sources of Truth**: Cache, DB, StreamingCache, and broadcast events
3. **Complex State Management**: Different code paths for streaming vs completed states
4. **Stale Data**: 2-minute cache causes users to see empty results after streaming completes

## Proposed Architecture

### Core Principles
1. **Single Source of Truth**: Database (artifacts/transforms) is the only source
2. **Real-time Updates**: DB changes trigger events to connected clients
3. **Unified Endpoint**: Single endpoint serves both streaming and completed data
4. **No Caching**: Remove CacheService and StreamingCache entirely

### System Design

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────►│  Single API  │────►│   Database  │
│             │◄────│   Endpoint   │◄────│ (Artifacts/ │
└─────────────┘     └──────────────┘     │ Transforms) │
      ▲                    │              └─────────────┘
      │                    │                     │
      │              ┌─────▼──────┐              │
      └──────────────│   Event    │◄─────────────┘
                     │ Broadcaster │   DB Changes
                     └────────────┘
```

## Implementation Plan

### Phase 1: Backend Infrastructure

#### 1.1 Create Unified Data Service
```typescript
// src/server/services/UnifiedStreamingService.ts
interface StreamingState {
  transformId: string;
  status: 'running' | 'completed' | 'failed';
  chunks: string[];  // Retrieved from transform_chunks table
  results: any[];    // Retrieved from artifacts
  progress: number;  // Calculated from chunks/expected
}
```

#### 1.2 Database Schema Changes
```sql
-- Add table to store streaming chunks persistently
CREATE TABLE transform_chunks (
  id UUID PRIMARY KEY,
  transform_id UUID REFERENCES transforms(id),
  chunk_index INTEGER,
  chunk_data TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add index for fast retrieval
CREATE INDEX idx_transform_chunks_transform_id ON transform_chunks(transform_id);
```

#### 1.3 Event Broadcasting System
- Enhance JobBroadcaster to emit DB change events
- Use PostgreSQL LISTEN/NOTIFY for real-time updates
- Broadcast events when:
  - New chunks are inserted
  - Transform status changes
  - Artifacts are created

### Phase 2: Unified Endpoints

#### 2.1 Brainstorming Endpoint
```typescript
// GET /api/ideations/:id
// Returns complete state regardless of streaming status
{
  id: string;
  status: 'streaming' | 'completed' | 'failed';
  userInput: string;
  selectedPlatform: string;
  genrePaths: string[][];
  genreProportions: number[];
  ideas: IdeaWithTitle[];  // Always current from DB
  streamingData?: {
    transformId: string;
    chunks: string[];      // All chunks so far
    progress: number;      // 0-100
  }
}
```

#### 2.2 Outline Endpoint
```typescript
// GET /api/outlines/:id
// Returns complete state regardless of streaming status
{
  id: string;
  status: 'streaming' | 'completed' | 'failed';
  sourceArtifact: SourceArtifact;
  components: OutlineComponents;  // Always current from DB
  streamingData?: {
    transformId: string;
    chunks: string[];      // All chunks so far
    progress: number;      // 0-100
  }
}
```

### Phase 3: Remove Caching Layer

#### 3.1 Remove CacheService Usage
- Remove all `cacheService.get()` and `cacheService.set()` calls
- Delete CacheService class and related imports
- Update IdeationService and OutlineService constructors

#### 3.2 Remove StreamingCache
- Migrate chunk storage to `transform_chunks` table
- Remove StreamingCache class
- Update StreamingTransformExecutor to write directly to DB

### Phase 4: Frontend Updates

#### 4.1 Unified Data Fetching
```typescript
// useStreamingData.ts
export function useStreamingData(type: 'ideation' | 'outline', id: string) {
  const [data, setData] = useState(null);
  
  // 1. Fetch initial state
  useEffect(() => {
    fetchData(`/api/${type}s/${id}`).then(setData);
  }, []);
  
  // 2. Subscribe to SSE for updates
  useEffect(() => {
    const eventSource = new EventSource(`/api/stream/${type}/${id}`);
    eventSource.onmessage = (event) => {
      // Update specific fields based on event type
      const update = JSON.parse(event.data);
      setData(prev => ({ ...prev, ...update }));
    };
    return () => eventSource.close();
  }, []);
  
  return data;
}
```

#### 4.2 Remove Duplicate State Management
- Remove separate streaming/completed states
- Use single data structure for all states
- Let UI render based on `status` field

### Phase 5: Database Query Optimization

#### 5.1 Efficient Data Retrieval
```typescript
// Single query to get all ideation data
async getIdeationComplete(userId: string, ideationId: string) {
  // Use JOIN to get all related data in one query
  const query = `
    SELECT 
      s.*, 
      t.status as transform_status,
      array_agg(DISTINCT a.*) as artifacts,
      array_agg(DISTINCT tc.*) as chunks
    FROM ideation_sessions s
    LEFT JOIN transforms t ON t.execution_context->>'ideation_run_id' = s.id
    LEFT JOIN transform_outputs to ON to.transform_id = t.id
    LEFT JOIN artifacts a ON a.id = to.artifact_id
    LEFT JOIN transform_chunks tc ON tc.transform_id = t.id
    WHERE s.id = $1 AND s.user_id = $2
    GROUP BY s.id, t.id
  `;
}
```

### Phase 6: Migration Strategy

#### 6.1 Backward Compatibility
1. Deploy new endpoints alongside old ones
2. Update frontend to use new endpoints
3. Monitor for issues
4. Remove old endpoints and caching layer

#### 6.2 Data Migration
1. Migrate any cached streaming chunks to DB
2. Ensure all transforms have proper status
3. Verify artifact relationships

## Benefits

1. **Simplicity**: Single source of truth, no cache invalidation issues
2. **Real-time**: Instant updates via event broadcasting
3. **Consistency**: Same data structure for all states
4. **Performance**: Optimized DB queries, no redundant cache lookups
5. **Reliability**: No race conditions or stale data

## Implementation Timeline

- **Week 1**: Backend infrastructure (Phase 1-2)
- **Week 2**: Remove caching layer (Phase 3)
- **Week 3**: Frontend updates (Phase 4)
- **Week 4**: Query optimization and migration (Phase 5-6)

## Technical Considerations

### Database Performance
- Add appropriate indexes for frequent queries
- Use materialized views for complex aggregations
- Consider connection pooling for SSE connections

### Scaling Considerations
- Event broadcasting can use Redis Pub/Sub for multi-server deployments
- Database can be read-replicated for query performance
- Consider CDN for static streaming data

### Error Handling
- Graceful fallback if SSE connection fails
- Retry logic for database operations
- Clear error states in UI

## Success Metrics
1. Zero cache-related bugs
2. < 100ms latency for data updates
3. Simplified codebase (remove ~30% of streaming code)
4. Improved user experience (no empty results)

## Key Implementation Details

### Transform Chunks Table
The `transform_chunks` table is crucial for persistent streaming storage:
- Each chunk gets a sequential index for ordering
- Chunks are immutable once written
- Can be queried efficiently by transform_id
- Automatically cleaned up after transform completes + grace period

### Unified Service Methods
```typescript
class UnifiedStreamingService {
  async getIdeationRun(userId: string, runId: string) {
    // 1. Get session artifact
    const session = await this.getSession(userId, runId);
    
    // 2. Get latest transform
    const transform = await this.getLatestTransform(runId);
    
    // 3. Get all artifacts (completed ideas)
    const artifacts = await this.getArtifacts(transform.id);
    
    // 4. If streaming, get chunks
    let streamingData = null;
    if (transform.status === 'running') {
      const chunks = await this.getChunks(transform.id);
      streamingData = {
        transformId: transform.id,
        chunks,
        progress: this.calculateProgress(chunks)
      };
    }
    
    // 5. Return unified response
    return {
      ...session,
      ideas: artifacts,
      status: transform.status,
      streamingData
    };
  }
}
```

### Frontend State Management
```typescript
// Single state object for all phases
interface IdeationState {
  id: string;
  status: 'idle' | 'streaming' | 'completed' | 'failed';
  data: IdeationData;
  streamingProgress?: number;
}

// No more separate streaming vs completed logic
const IdeationView = ({ id }) => {
  const state = useStreamingData('ideation', id);
  
  return (
    <div>
      {state.status === 'streaming' && <ProgressBar value={state.streamingProgress} />}
      <IdeasList ideas={state.data.ideas} />
    </div>
  );
};
```

### Migration Safety
To ensure zero downtime during migration:
1. New tables/columns are additive only
2. Old endpoints remain functional during transition
3. Feature flag to switch between old/new behavior
4. Monitoring for both code paths 