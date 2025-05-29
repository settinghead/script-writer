# Brainstorming Job Implementation Plan

## 🎯 **Objective**
Refactor brainstorming to use ideation runs as persistent jobs with resumable streaming, immediate URL redirection, and refresh-resilient state management.

## 🏗️ **Architecture Changes**

### **1. Database Schema Updates**

#### Add Status Field to Transforms Table
```sql
-- Migration: Add status field to transforms table
ALTER TABLE transforms ADD COLUMN status TEXT DEFAULT 'running';
-- Possible values: 'running', 'completed', 'failed', 'cancelled'

-- Add retry tracking
ALTER TABLE transforms ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE transforms ADD COLUMN max_retries INTEGER DEFAULT 2;

-- Update existing completed transforms
UPDATE transforms SET status = 'completed' WHERE status IS NULL;
```

#### New Artifact Types for Job Parameters
```typescript
// src/common/types/artifacts.ts
export interface BrainstormingJobParamsV1 {
  platform: string;
  genrePaths: string[][];
  genreProportions: number[];
  requirements: string;
  requestedAt: string; // ISO timestamp
}

// Add to artifact type union
export type ArtifactData = 
  | IdeationSessionV1
  | BrainstormingJobParamsV1  // New
  | /* existing types */;
```

### **2. Transform Lifecycle Changes**

#### Current Flow (Create transform after completion)
```
Generate Button → LLM Stream → Parse Results → Create Transform + Artifacts
```

#### New Flow (Create transform immediately)
```
Generate Button → Create Transform (status: 'running') → Create Param Artifacts → Redirect → Start LLM Stream → Update Transform Status
```

### **3. URL Structure**
- **From**: Brainstorming panel in `/ideation` (no persistent URL)
- **To**: `/ideation/[run-id]` with streaming job state

## 🔧 **Implementation Steps**

### **Phase 1: Database & Transform System (Day 1)**

#### 1.1 Database Migration
```typescript
// src/server/database/migrations/add_transform_status.ts
export async function up(db: Database): Promise<void> {
  await db.exec(`
    ALTER TABLE transforms ADD COLUMN status TEXT DEFAULT 'running';
    ALTER TABLE transforms ADD COLUMN retry_count INTEGER DEFAULT 0;
    ALTER TABLE transforms ADD COLUMN max_retries INTEGER DEFAULT 2;
    
    -- Update existing transforms to completed status
    UPDATE transforms SET status = 'completed' WHERE status IS NULL OR status = '';
  `);
}
```

#### 1.2 Enhanced Transform Executor
```typescript
// src/server/services/streaming/StreamingTransformExecutor.ts
export class StreamingTransformExecutor {
  async startBrainstormingJob(
    userId: string,
    jobParams: BrainstormingJobParamsV1
  ): Promise<{ ideationRunId: string; transformId: string }> {
    // 1. Create ideation run
    const ideationRun = await this.createIdeationRun(userId);
    
    // 2. Create job parameters artifact
    const paramsArtifact = await this.artifactRepo.createArtifact(
      userId,
      'brainstorming_job_params',
      jobParams
    );
    
    // 3. Create transform with 'running' status
    const transform = await this.transformRepo.createTransform(
      userId,
      'llm',
      'running', // New status field
      {
        modelName: 'deepseek-chat',
        templateId: 'brainstorming',
        maxRetries: 2
      }
    );
    
    // 4. Link transform inputs
    await this.transformRepo.addTransformInput(
      transform.id,
      paramsArtifact.id,
      'job_params'
    );
    
    return {
      ideationRunId: ideationRun.id,
      transformId: transform.id
    };
  }
  
  async executeStreamingJobWithRetries(
    transformId: string,
    res: Response
  ): Promise<void> {
    const transform = await this.transformRepo.getTransform(transformId);
    
    try {
      await this.executeStreamingLLM(transform, res);
      await this.updateTransformStatus(transformId, 'completed');
    } catch (error) {
      await this.handleJobFailure(transformId, error);
    }
  }
  
  private async handleJobFailure(
    transformId: string, 
    error: Error
  ): Promise<void> {
    const transform = await this.transformRepo.getTransform(transformId);
    
    if (transform.retry_count < transform.max_retries) {
      // Increment retry count and retry
      await this.transformRepo.updateTransform(transformId, {
        retry_count: transform.retry_count + 1,
        status: 'running'
      });
      
      // Schedule retry (could use queue system, for now just immediate)
      setTimeout(() => {
        this.retryStreamingJob(transformId);
      }, 1000 * Math.pow(2, transform.retry_count)); // Exponential backoff
    } else {
      // Mark as failed
      await this.updateTransformStatus(transformId, 'failed');
    }
  }
}
```

### **Phase 2: Frontend Flow Refactor (Day 1-2)**

#### 2.1 Update Brainstorming Panel
```typescript
// src/client/components/BrainstormingPanel.tsx
const BrainstormingPanel: React.FC<Props> = ({ onJobCreated }) => {
  const generateIdeas = async () => {
    try {
      // Create job immediately
      const response = await fetch('/api/ideations/create-brainstorming-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: selectedPlatform,
          genrePaths: selectedGenrePaths,
          genreProportions: genreProportions,
          requirements: requirements
        })
      });
      
      const { ideationRunId, transformId } = await response.json();
      
      // Immediately redirect
      onJobCreated(ideationRunId, transformId);
    } catch (error) {
      setError(error);
    }
  };
  
  // Rest of component unchanged
};
```

#### 2.2 Update Ideation Tab
```typescript
// src/client/components/IdeationTab.tsx
const IdeationTab: React.FC = () => {
  const { id: ideationRunId } = useParams();
  const [streamingJobState, setStreamingJobState] = useState<StreamingJobState>();
  
  useEffect(() => {
    if (ideationRunId) {
      loadIdeationRun(ideationRunId);
      // Check if there's an active streaming job
      checkActiveStreamingJob(ideationRunId);
    }
  }, [ideationRunId]);
  
  const checkActiveStreamingJob = async (runId: string) => {
    const response = await fetch(`/api/ideations/${runId}/active-job`);
    if (response.ok) {
      const jobData = await response.json();
      if (jobData.status === 'running') {
        // Reconnect to streaming
        connectToStreamingJob(jobData.transformId);
      }
    }
  };
  
  const connectToStreamingJob = (transformId: string) => {
    // Use existing streaming service but with transform ID
    // This will reconnect to ongoing job on refresh
  };
  
  const handleJobCreated = (runId: string, transformId: string) => {
    navigate(`/ideation/${runId}`);
    // Start streaming immediately after redirect
    connectToStreamingJob(transformId);
  };
};
```

### **Phase 3: Backend API Updates (Day 2)**

#### 3.1 New Job Creation Endpoint
```typescript
// src/server/routes/ideations.ts
router.post('/create-brainstorming-job', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const jobParams: BrainstormingJobParamsV1 = {
      ...req.body,
      requestedAt: new Date().toISOString()
    };
    
    const { ideationRunId, transformId } = await streamingExecutor
      .startBrainstormingJob(userId, jobParams);
    
    // Start streaming job in background
    setImmediate(() => {
      streamingExecutor.executeStreamingJobWithRetries(transformId, null);
    });
    
    res.json({ ideationRunId, transformId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### 3.2 Job Status Check Endpoint
```typescript
router.get('/:id/active-job', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const ideationRunId = req.params.id;
    
    // Find the most recent running transform for this ideation run
    const activeTransform = await transformRepo.getActiveTransformForRun(
      userId, 
      ideationRunId
    );
    
    if (activeTransform && activeTransform.status === 'running') {
      res.json({
        transformId: activeTransform.id,
        status: activeTransform.status,
        retryCount: activeTransform.retry_count
      });
    } else {
      res.status(404).json({ message: 'No active job' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

#### 3.3 Enhanced Streaming Endpoint
```typescript
// src/server/routes/streaming.ts
router.get('/transform/:transformId', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const transformId = req.params.transformId;
    
    // Verify ownership
    const transform = await transformRepo.getTransform(transformId);
    if (transform.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // If job is already completed, send cached results
    if (transform.status === 'completed') {
      const outputs = await transformRepo.getTransformOutputs(transformId);
      return res.json({ status: 'completed', results: outputs });
    }
    
    // If job is running, connect to stream
    if (transform.status === 'running') {
      // Setup SSE connection
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      // Either connect to existing stream or start new one
      await streamingExecutor.connectToOrStartJob(transformId, res);
    } else {
      // Job failed or cancelled
      res.json({ status: transform.status, error: 'Job not active' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### **Phase 4: Multi-Tab State Sync (Day 2-3)**

#### 4.1 Simple Broadcast System
```typescript
// src/server/services/JobBroadcaster.ts
export class JobBroadcaster {
  private activeConnections = new Map<string, Response[]>();
  
  addConnection(transformId: string, res: Response): void {
    if (!this.activeConnections.has(transformId)) {
      this.activeConnections.set(transformId, []);
    }
    this.activeConnections.get(transformId)!.push(res);
    
    // Clean up on connection close
    res.on('close', () => this.removeConnection(transformId, res));
  }
  
  broadcast(transformId: string, data: any): void {
    const connections = this.activeConnections.get(transformId) || [];
    const message = `data: ${JSON.stringify(data)}\n\n`;
    
    connections.forEach(res => {
      try {
        res.write(message);
      } catch (error) {
        this.removeConnection(transformId, res);
      }
    });
  }
  
  private removeConnection(transformId: string, res: Response): void {
    const connections = this.activeConnections.get(transformId);
    if (connections) {
      const index = connections.indexOf(res);
      if (index > -1) {
        connections.splice(index, 1);
      }
    }
  }
}
```

#### 4.2 Frontend Connection Management
```typescript
// src/client/hooks/useStreamingJob.ts
export function useStreamingJob(transformId: string | null) {
  const [status, setStatus] = useState<StreamingJobState>();
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!transformId) return;
    
    const eventSource = new EventSource(`/api/streaming/transform/${transformId}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setStatus(data);
    };
    
    eventSource.onerror = (error) => {
      setError(new Error('Connection failed'));
    };
    
    return () => eventSource.close();
  }, [transformId]);
  
  return { status, error };
}
```

## 🧪 **Testing Strategy**

### **Unit Tests**
- Transform status transitions
- Retry logic with exponential backoff
- Artifact creation for job parameters
- URL routing and redirection

### **Integration Tests**
- End-to-end job creation flow
- Browser refresh resume functionality
- Multi-tab synchronization
- Failure and retry scenarios

### **Manual Testing Scenarios**
1. **Happy Path**: Create job → Redirect → Stream completes → View results
2. **Browser Refresh**: Start job → Refresh during streaming → Resume from current state
3. **Multi-Tab**: Open same job in multiple tabs → See synchronized updates
4. **Failure Recovery**: Simulate LLM failure → Verify retry logic → Final success/failure

## 🚀 **Migration Strategy**

### **Step 1: Database Migration**
- Run migration to add status fields
- Update existing transforms to 'completed'

### **Step 2: Backend Implementation**
- Implement new job creation endpoint
- Update streaming executor for immediate transform creation
- Add retry logic and broadcasting

### **Step 3: Frontend Refactor**
- Update brainstorming panel to create jobs
- Modify ideation tab to handle streaming jobs
- Add connection resumption logic

### **Step 4: Testing & Rollout**
- Feature flag for new vs old flow
- Gradual rollout with monitoring
- Remove old implementation once stable

## 📊 **Success Metrics**

- [ ] Zero data loss on browser refresh
- [ ] <2 second job creation and redirect time
- [ ] Successful retry handling for network failures
- [ ] Multi-tab synchronization works correctly
- [ ] Transform status accurately reflects job state
- [ ] Complete backward compatibility with existing ideation runs

---

*This refactor transforms brainstorming from ephemeral in-memory state to persistent, resumable jobs using the existing transform and artifact infrastructure.* 