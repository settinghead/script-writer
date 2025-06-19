# Electric Sync Migration Implementation Plan

## Overview

This plan migrates from our current SSE-based streaming architecture to Electric Sync, focusing **exclusively on the brainstorming functionality**. We'll maintain the graph-like artifact → transform → artifact structure while dramatically simplifying real-time updates.

## Key Findings from Codebase Analysis

### Current Architecture Complexity
1. **Multiple SSE Routes**: `/api/streaming/project/:projectId`, `/api/streaming/transform/:transformId`, `/api/brainstorm/generate/stream`
2. **Complex State Management**: Custom RxJS streams, manual chunk replay, JobBroadcaster
3. **Mixed Patterns**: Agent-based vs direct streaming, transform chunks vs artifacts
4. **SQLite Database**: Need to switch to Postgres for Electric compatibility

### Current Brainstorming Flow
1. User fills `BrainstormingInputForm` → creates project via `/api/projects/create-project-and-brainstorm`
2. Backend creates transform and starts streaming job
3. Frontend connects to SSE endpoint and updates `ProjectBrainstormPage`
4. Results displayed in `DynamicBrainstormingResults`

## Phase 1: Database Migration (SQLite → Postgres)

### 1.1 Complete Schema Replacement

**Replace all migrations with a single Postgres schema:**

```sql
-- src/server/database/schema.sql - NEW FILE

-- Users and Authentication
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active'
);

CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    project_type TEXT DEFAULT 'script',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects_users (
    id SERIAL PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'owner', -- owner, collaborator, viewer
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);

-- Authentication
CREATE TABLE auth_providers (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    provider_type TEXT NOT NULL,
    provider_user_id TEXT,
    provider_data TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_type, provider_user_id)
);

CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced Artifacts with Electric Streaming Support
CREATE TABLE artifacts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    type_version TEXT NOT NULL DEFAULT 'v1',
    data TEXT NOT NULL,
    metadata TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Electric streaming fields
    streaming_status TEXT DEFAULT 'completed' CHECK (streaming_status IN ('streaming', 'completed', 'failed', 'cancelled')),
    streaming_progress DECIMAL(5,2) DEFAULT 100.00, -- 0.00 to 100.00
    partial_data JSONB -- Store partial results during streaming
);

-- Enhanced Transforms with Electric Streaming Support
CREATE TABLE transforms (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    type_version TEXT NOT NULL DEFAULT 'v1',
    status TEXT DEFAULT 'running',
    execution_context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Electric streaming fields
    streaming_status TEXT DEFAULT 'pending' CHECK (streaming_status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 2
);

-- Transform relationships (maintain graph structure)
CREATE TABLE transform_inputs (
    id SERIAL PRIMARY KEY,
    transform_id TEXT NOT NULL REFERENCES transforms(id) ON DELETE CASCADE,
    artifact_id TEXT NOT NULL REFERENCES artifacts(id),
    input_role TEXT,
    UNIQUE(transform_id, artifact_id, input_role)
);

CREATE TABLE transform_outputs (
    id SERIAL PRIMARY KEY,
    transform_id TEXT NOT NULL REFERENCES transforms(id) ON DELETE CASCADE,
    artifact_id TEXT NOT NULL REFERENCES artifacts(id),
    output_role TEXT,
    UNIQUE(transform_id, artifact_id, output_role)
);

-- LLM-specific tables (for graph completeness)
CREATE TABLE llm_prompts (
    id TEXT PRIMARY KEY,
    transform_id TEXT NOT NULL REFERENCES transforms(id) ON DELETE CASCADE,
    prompt_text TEXT NOT NULL,
    prompt_role TEXT DEFAULT 'primary'
);

CREATE TABLE llm_transforms (
    transform_id TEXT PRIMARY KEY REFERENCES transforms(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    model_parameters TEXT,
    raw_response TEXT,
    token_usage TEXT
);

CREATE TABLE human_transforms (
    transform_id TEXT PRIMARY KEY REFERENCES transforms(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    interface_context TEXT,
    change_description TEXT
);

-- Remove chunks table - Electric will handle real-time updates directly
-- CREATE TABLE transform_chunks - DELETED

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_artifacts_updated_at BEFORE UPDATE ON artifacts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transforms_updated_at BEFORE UPDATE ON transforms
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_artifacts_project_type ON artifacts(project_id, type);
CREATE INDEX idx_artifacts_project_created ON artifacts(project_id, created_at);
CREATE INDEX idx_artifacts_streaming ON artifacts(streaming_status) WHERE streaming_status != 'completed';
CREATE INDEX idx_transforms_project_created ON transforms(project_id, created_at);
CREATE INDEX idx_transforms_streaming ON transforms(streaming_status) WHERE streaming_status IN ('running', 'pending');
CREATE INDEX idx_projects_users_user_id ON projects_users(user_id);
CREATE INDEX idx_projects_users_project_id ON projects_users(project_id);

-- Electric-optimized view for brainstorming flows
CREATE VIEW brainstorm_flows AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    t.id as transform_id,
    t.streaming_status as transform_status,
    t.progress_percentage,
    t.error_message,
    t.created_at as transform_created_at,
    t.updated_at as transform_updated_at,
    a.id as artifact_id,
    a.type as artifact_type,
    a.streaming_status as artifact_status,
    a.streaming_progress,
    a.data as artifact_data,
    a.partial_data as artifact_partial_data,
    a.created_at as artifact_created_at,
    a.updated_at as artifact_updated_at
FROM projects p
JOIN transforms t ON t.project_id = p.id
LEFT JOIN transform_outputs tro ON tro.transform_id = t.id
LEFT JOIN artifacts a ON a.id = tro.artifact_id
WHERE t.type = 'llm' 
  AND (a.type IS NULL OR a.type IN ('brainstorm_ideas', 'brainstorm_params'))
ORDER BY t.created_at DESC;
```

### 1.2 Switch from Knex to Kysely

**Kysely Benefits for our use case:**
- Better TypeScript support with auto-generated types from schema
- More performant and lightweight than Knex
- Better suited for Electric's real-time patterns
- Cleaner syntax for complex queries

```typescript
// src/server/database/connection.ts - REPLACE EXISTING

import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { DB } from './types'; // Generated types

const dialect = new PostgresDialect({
    pool: new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'script_writer',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        max: process.env.NODE_ENV === 'production' ? 20 : 10,
        min: 2,
    }),
});

export const db = new Kysely<DB>({ dialect });

// Initialize database with raw SQL (simpler than migrations for fresh start)
export const initializeDatabase = async (): Promise<void> => {
    try {
        // Read and execute schema.sql
        const fs = await import('fs/promises');
        const path = await import('path');
        
        const schemaPath = path.join(process.cwd(), 'src/server/database/schema.sql');
        const schema = await fs.readFile(schemaPath, 'utf-8');
        
        // Execute schema (Kysely doesn't have built-in schema management)
        await db.executeQuery({
            sql: schema,
            parameters: []
        });
        
        console.log('Database schema initialized successfully');
        
        // Run seeds in development
        if (process.env.NODE_ENV === 'development') {
            await seedDatabase();
        }
        
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
};

const seedDatabase = async () => {
    // Simple seed data for development
    const testUser = {
        id: 'test-user-1',
        username: 'testuser',
        display_name: 'Test User',
        status: 'active'
    };
    
    // Insert if not exists
    const existingUser = await db
        .selectFrom('users')
        .select('id')
        .where('id', '=', testUser.id)
        .executeTakeFirst();
        
    if (!existingUser) {
        await db.insertInto('users').values(testUser).execute();
        console.log('Test user seeded');
    }
};

export const closeDatabase = async (): Promise<void> => {
    try {
        await db.destroy();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error closing database:', error);
    }
};
```

### 1.3 Generate Kysely Types

```typescript
// src/server/database/types.ts - GENERATED FILE

import type { ColumnType } from 'kysely';

export type Generated<T> = T extends ColumnType<any, infer S, any>
  ? ColumnType<T, S, T>
  : ColumnType<T, T, T>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Users {
  id: string;
  username: string;
  display_name: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  status: Generated<string>;
}

export interface Projects {
  id: string;
  name: string;
  description: string | null;
  project_type: Generated<string>;
  status: Generated<string>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface ProjectsUsers {
  id: Generated<number>;
  project_id: string;
  user_id: string;
  role: Generated<string>;
  joined_at: Generated<Timestamp>;
}

export interface Artifacts {
  id: string;
  project_id: string;
  type: string;
  type_version: Generated<string>;
  data: string;
  metadata: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  streaming_status: Generated<string>;
  streaming_progress: Generated<number>;
  partial_data: unknown | null; // JSONB
}

export interface Transforms {
  id: string;
  project_id: string;
  type: string;
  type_version: Generated<string>;
  status: Generated<string>;
  execution_context: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
  streaming_status: Generated<string>;
  progress_percentage: Generated<number>;
  error_message: string | null;
  retry_count: Generated<number>;
  max_retries: Generated<number>;
}

export interface TransformInputs {
  id: Generated<number>;
  transform_id: string;
  artifact_id: string;
  input_role: string | null;
}

export interface TransformOutputs {
  id: Generated<number>;
  transform_id: string;
  artifact_id: string;
  output_role: string | null;
}

export interface AuthProviders {
  id: Generated<number>;
  user_id: string;
  provider_type: string;
  provider_user_id: string | null;
  provider_data: string | null;
  created_at: Generated<Timestamp>;
}

export interface UserSessions {
  id: string;
  user_id: string;
  expires_at: Timestamp;
  created_at: Generated<Timestamp>;
}

export interface LlmPrompts {
  id: string;
  transform_id: string;
  prompt_text: string;
  prompt_role: Generated<string>;
}

export interface LlmTransforms {
  transform_id: string;
  model_name: string;
  model_parameters: string | null;
  raw_response: string | null;
  token_usage: string | null;
}

export interface HumanTransforms {
  transform_id: string;
  action_type: string;
  interface_context: string | null;
  change_description: string | null;
}

export interface BrainstormFlows {
  project_id: string;
  project_name: string;
  transform_id: string;
  transform_status: string;
  progress_percentage: number;
  error_message: string | null;
  artifact_id: string | null;
  artifact_type: string | null;
  artifact_status: string | null;
  streaming_progress: number | null;
  artifact_data: string | null;
  artifact_partial_data: unknown | null;
  transform_created_at: Timestamp;
  transform_updated_at: Timestamp;
  artifact_created_at: Timestamp | null;
  artifact_updated_at: Timestamp | null;
}

export interface DB {
  users: Users;
  projects: Projects;
  projects_users: ProjectsUsers;
  artifacts: Artifacts;
  transforms: Transforms;
  transform_inputs: TransformInputs;
  transform_outputs: TransformOutputs;
  auth_providers: AuthProviders;
  user_sessions: UserSessions;
  llm_prompts: LlmPrompts;
  llm_transforms: LlmTransforms;
  human_transforms: HumanTransforms;
  brainstorm_flows: BrainstormFlows; // View
}
```

### 1.4 Dependencies Update

```json
// package.json - UPDATE dependencies
{
  "dependencies": {
    "@electric-sql/client": "^0.5.0",
    "@electric-sql/react": "^0.5.0",
    "kysely": "^0.27.0",
    "pg": "^8.11.0"
    // Remove: "knex", "sqlite3", "better-sqlite3"
  },
  "devDependencies": {
    "@types/pg": "^8.10.0",
    "kysely-codegen": "^0.10.0"
  },
  "scripts": {
    "db:generate-types": "kysely-codegen --out-file src/server/database/types.ts"
  }
}
```

## Phase 2: Electric Sync Setup

### 2.1 Docker Compose for Development

```yaml
# docker-compose.yml - NEW FILE
version: "3.8"
name: "script_writer_electric"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: script_writer
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    command:
      - -c
      - wal_level=logical
      - -c
      - listen_addresses=*
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./src/server/database/schema.sql:/docker-entrypoint-initdb.d/schema.sql

  electric:
    image: electricsql/electric:1.0.19
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/script_writer?sslmode=disable
      ELECTRIC_INSECURE: true
    ports:
      - "3000:3000"
    depends_on:
      - postgres

volumes:
  postgres_data:
```

### 2.2 Environment Configuration

```bash
# .env - ADD these variables
DB_HOST=localhost
DB_PORT=5432
DB_NAME=script_writer
DB_USER=postgres
DB_PASSWORD=password
ELECTRIC_URL=http://localhost:3000
```

## Phase 3: Backend Refactor - Brainstorming Only

### 3.1 Kysely-based Repositories

```typescript
// src/server/repositories/ArtifactRepository.ts - REWRITE WITH KYSELY

import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection';
import { Artifacts, Insertable, Updateable } from '../database/types';

export class ArtifactRepository {
    async createArtifact(
        projectId: string,
        type: string,
        data: string,
        typeVersion: string = 'v1',
        metadata: any = {},
        streamingFields?: {
            streaming_status?: string;
            streaming_progress?: number;
            partial_data?: any;
        }
    ): Promise<Artifacts> {
        const artifact: Insertable<Artifacts> = {
            id: uuidv4(),
            project_id: projectId,
            type,
            type_version: typeVersion,
            data,
            metadata: JSON.stringify(metadata),
            ...streamingFields
        };

        const result = await db
            .insertInto('artifacts')
            .values(artifact)
            .returningAll()
            .executeTakeFirstOrThrow();

        return result;
    }

    async updateArtifact(
        artifactId: string,
        updates: Updateable<Artifacts>
    ): Promise<Artifacts> {
        const result = await db
            .updateTable('artifacts')
            .set({
                ...updates,
                updated_at: new Date()
            })
            .where('id', '=', artifactId)
            .returningAll()
            .executeTakeFirstOrThrow();

        return result;
    }

    async getArtifact(artifactId: string): Promise<Artifacts | null> {
        return await db
            .selectFrom('artifacts')
            .selectAll()
            .where('id', '=', artifactId)
            .executeTakeFirst() ?? null;
    }

    async getArtifactsByProject(projectId: string, type?: string): Promise<Artifacts[]> {
        let query = db
            .selectFrom('artifacts')
            .selectAll()
            .where('project_id', '=', projectId);

        if (type) {
            query = query.where('type', '=', type);
        }

        return await query
            .orderBy('created_at', 'desc')
            .execute();
    }
}

// src/server/repositories/TransformRepository.ts - REWRITE WITH KYSELY

import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection';
import { Transforms, TransformInputs, TransformOutputs, Insertable, Updateable } from '../database/types';

export class TransformRepository {
    async createTransform(
        projectId: string,
        type: string,
        typeVersion: string = 'v1',
        status: string = 'running',
        executionContext?: string
    ): Promise<Transforms> {
        const transform: Insertable<Transforms> = {
            id: uuidv4(),
            project_id: projectId,
            type,
            type_version: typeVersion,
            status,
            execution_context: executionContext,
            streaming_status: 'pending'
        };

        const result = await db
            .insertInto('transforms')
            .values(transform)
            .returningAll()
            .executeTakeFirstOrThrow();

        return result;
    }

    async updateTransform(
        transformId: string,
        updates: Updateable<Transforms>
    ): Promise<Transforms> {
        const result = await db
            .updateTable('transforms')
            .set({
                ...updates,
                updated_at: new Date()
            })
            .where('id', '=', transformId)
            .returningAll()
            .executeTakeFirstOrThrow();

        return result;
    }

    async addTransformInputs(
        transformId: string,
        artifacts: Array<{ artifactId: string; inputRole?: string }>
    ): Promise<void> {
        const inputs: Insertable<TransformInputs>[] = artifacts.map(({ artifactId, inputRole }) => ({
            transform_id: transformId,
            artifact_id: artifactId,
            input_role: inputRole ?? null
        }));

        await db
            .insertInto('transform_inputs')
            .values(inputs)
            .execute();
    }

    async addTransformOutputs(
        transformId: string,
        artifacts: Array<{ artifactId: string; outputRole?: string }>
    ): Promise<void> {
        const outputs: Insertable<TransformOutputs>[] = artifacts.map(({ artifactId, outputRole }) => ({
            transform_id: transformId,
            artifact_id: artifactId,
            output_role: outputRole ?? null
        }));

        await db
            .insertInto('transform_outputs')
            .values(outputs)
            .execute();
    }

    async getTransform(transformId: string): Promise<Transforms | null> {
        return await db
            .selectFrom('transforms')
            .selectAll()
            .where('id', '=', transformId)
            .executeTakeFirst() ?? null;
    }
}
```

### 3.2 Simplified Brainstorm Service

```typescript
// src/server/services/BrainstormService.ts - NEW FILE

import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { TemplateService } from './templates/TemplateService';
import { LLMService } from './LLMService';

export interface BrainstormParams {
    platform: string;
    genre: string;
    other_requirements?: string;
}

export class BrainstormService {
    constructor(
        private artifactRepo: ArtifactRepository,
        private transformRepo: TransformRepository,
        private templateService: TemplateService,
        private llmService: LLMService
    ) {}

    async startBrainstormGeneration(projectId: string, params: BrainstormParams, userId: string): Promise<string> {
        // 1. Create transform record
        const transform = await this.transformRepo.createTransform(
            projectId,
            'llm',
            'v1',
            'running',
            JSON.stringify({ 
                params, 
                userId,
                timestamp: new Date().toISOString()
            })
        );

        // 2. Create input artifact for params
        const inputArtifact = await this.artifactRepo.createArtifact(
            projectId, 
            'brainstorm_params', 
            JSON.stringify(params)
        );

        // 3. Create output artifact (initially empty, will be streamed)
        const outputArtifact = await this.artifactRepo.createArtifact(
            projectId,
            'brainstorm_ideas',
            JSON.stringify({ ideas: [] }),
            'v1',
            {},
            {
                streaming_status: 'streaming',
                streaming_progress: 0,
                partial_data: { ideas: [] }
            }
        );

        // 4. Link artifacts to transform
        await this.transformRepo.addTransformInputs(transform.id, [
            { artifactId: inputArtifact.id, inputRole: 'params' }
        ]);
        await this.transformRepo.addTransformOutputs(transform.id, [
            { artifactId: outputArtifact.id, outputRole: 'ideas' }
        ]);

        // 5. Start background generation (don't await)
        this.executeBrainstormGeneration(transform.id, outputArtifact.id, params).catch(console.error);

        return transform.id;
    }

    private async executeBrainstormGeneration(transformId: string, artifactId: string, params: BrainstormParams) {
        try {
            // Update transform status
            await this.transformRepo.updateTransform(transformId, {
                streaming_status: 'running',
                progress_percentage: 10
            });

            const template = this.templateService.getBrainstormTemplate();
            const prompt = this.templateService.renderTemplate(template, params);
            
            const stream = await this.llmService.streamStructuredResponse(prompt, {
                schema: 'BrainstormIdeasSchema'
            });

            const ideas: any[] = [];
            let ideaCount = 0;
            const targetIdeas = 5; // Default target

            for await (const partialIdea of stream) {
                if (partialIdea.title && partialIdea.body) {
                    ideas.push(partialIdea);
                    ideaCount++;

                    const progress = Math.min((ideaCount / targetIdeas) * 90 + 10, 90);

                    // Update artifact with partial data - Electric will sync this automatically!
                    await this.artifactRepo.updateArtifact(artifactId, {
                        streaming_status: 'streaming',
                        streaming_progress: progress,
                        partial_data: { ideas: [...ideas] }
                    });

                    // Update transform progress
                    await this.transformRepo.updateTransform(transformId, {
                        progress_percentage: progress
                    });
                }
            }

            // Final completion
            await this.artifactRepo.updateArtifact(artifactId, {
                data: JSON.stringify({ ideas }),
                streaming_status: 'completed',
                streaming_progress: 100,
                partial_data: null
            });

            await this.transformRepo.updateTransform(transformId, {
                streaming_status: 'completed',
                progress_percentage: 100
            });

        } catch (error: any) {
            console.error('Brainstorm generation failed:', error);
            
            await this.transformRepo.updateTransform(transformId, {
                streaming_status: 'failed',
                error_message: error.message
            });

            await this.artifactRepo.updateArtifact(artifactId, {
                streaming_status: 'failed'
            });
        }
    }
}
```

### 3.2 Simplified Routes

```typescript
// src/server/routes/brainstormRoutes.ts - NEW FILE

import { Router } from 'express';
import { BrainstormService } from '../services/BrainstormService';
import { createAuthMiddleware } from '../middleware/auth';
import { AuthDatabase } from '../database/auth';

export function createBrainstormRoutes(authDB: AuthDatabase, brainstormService: BrainstormService) {
    const router = Router();
    const authMiddleware = createAuthMiddleware(authDB);

    // Simple trigger endpoint - replaces complex SSE
    router.post('/start', authMiddleware.authenticate, async (req: any, res: any) => {
        const user = authMiddleware.getCurrentUser(req);
        if (!user) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const { projectId, params } = req.body;
        
        if (!projectId || !params) {
            return res.status(400).json({ error: "Missing projectId or params" });
        }

        try {
            const transformId = await brainstormService.startBrainstormGeneration(
                projectId, 
                params, 
                user.id
            );
            
            res.json({ 
                transformId, 
                status: 'started',
                message: 'Brainstorming generation started. Connect to Electric to see real-time updates.'
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}
```

### 3.3 Remove Complex SSE Infrastructure

**Files to DELETE:**
- `src/server/routes/streamingRoutes.ts`
- `src/server/routes/streamingIdeation.ts`
- `src/server/services/streaming/JobBroadcaster.ts`
- `src/server/services/streaming/StreamingTransformExecutor.ts`
- All SSE endpoints in `src/server/index.ts`

## Phase 4: Frontend Electric Integration

### 4.1 Electric Configuration

```typescript
// src/common/config/electric.ts - NEW FILE

export const ELECTRIC_URL = process.env.ELECTRIC_URL || 'http://localhost:3000';

export const electricConfig = {
    url: ELECTRIC_URL,
    // Auth will be handled via proxy pattern
};
```

### 4.2 Electric Hook for Brainstorming

```typescript
// src/client/hooks/useElectricBrainstorm.ts - NEW FILE

import { useEffect, useMemo } from 'react';
import { useShape } from '@electric-sql/react';
import { ELECTRIC_URL } from '../../common/config/electric';

interface BrainstormFlow {
    project_id: string;
    project_name: string;
    transform_id: string;
    transform_status: 'pending' | 'running' | 'completed' | 'failed';
    progress_percentage: number;
    error_message: string | null;
    artifact_id: string | null;
    artifact_status: 'streaming' | 'completed' | 'failed' | null;
    streaming_progress: number | null;
    artifact_data: string | null;
    artifact_partial_data: any;
    transform_updated_at: string;
    artifact_updated_at: string | null;
}

export function useElectricBrainstorm(projectId: string) {
    // Subscribe to brainstorm flows for this project
    const { data: flows, isLoading } = useShape<BrainstormFlow>({
        url: `${ELECTRIC_URL}/v1/shape`,
        params: {
            table: 'brainstorm_flows',
            where: `project_id = $1`,
            params: [projectId],
            columns: [
                'project_id', 'project_name', 'transform_id', 'transform_status',
                'progress_percentage', 'error_message', 'artifact_id', 'artifact_status',
                'streaming_progress', 'artifact_data', 'artifact_partial_data',
                'transform_updated_at', 'artifact_updated_at'
            ].join(',')
        }
    });

    // Get the latest brainstorm flow
    const currentFlow = useMemo(() => {
        if (!flows || flows.length === 0) return null;
        return flows[0]; // Already ordered by created_at DESC in view
    }, [flows]);

    // Extract ideas from current flow
    const ideas = useMemo(() => {
        if (!currentFlow?.artifact_id) return [];
        
        // Use partial_data if streaming, otherwise use main data
        const dataSource = currentFlow.artifact_status === 'streaming' 
            ? currentFlow.artifact_partial_data 
            : (currentFlow.artifact_data ? JSON.parse(currentFlow.artifact_data) : null);
        
        return dataSource?.ideas || [];
    }, [currentFlow]);

    // Determine overall status
    const status = useMemo(() => {
        if (!currentFlow) return 'idle';
        if (currentFlow.transform_status === 'running' || currentFlow.artifact_status === 'streaming') return 'streaming';
        if (currentFlow.transform_status === 'completed') return 'completed';
        if (currentFlow.transform_status === 'failed') return 'failed';
        return 'idle';
    }, [currentFlow]);

    const progress = currentFlow?.progress_percentage || 0;
    const error = currentFlow?.error_message || null;

    return {
        ideas,
        status,
        progress,
        error,
        isLoading,
        transformId: currentFlow?.transform_id,
        artifactId: currentFlow?.artifact_id
    };
}
```

### 4.3 Updated Brainstorming Components

```typescript
// src/client/components/ProjectBrainstormPage.tsx - MAJOR REFACTOR

import React from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Button, Spin, Progress, Alert, Card } from 'antd';
import { BulbOutlined, ReloadOutlined } from '@ant-design/icons';
import { useElectricBrainstorm } from '../hooks/useElectricBrainstorm';
import { DynamicBrainstormingResults } from './DynamicBrainstormingResults';

const { Title, Text } = Typography;

export const ProjectBrainstormPage: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const { ideas, status, progress, error, isLoading, transformId } = useElectricBrainstorm(projectId!);

    const startBrainstorming = async () => {
        // This could come from a form or be predefined
        const params = {
            platform: "抖音",
            genre: "穿越, 爽文", 
            other_requirements: "现代CEO穿越古代，商战宫斗，打脸爽文"
        };

        try {
            const response = await fetch('/api/brainstorm/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, params })
            });
            
            if (!response.ok) {
                throw new Error('Failed to start brainstorming');
            }
            
            // Electric will automatically sync the results!
        } catch (error) {
            console.error('Error starting brainstorm:', error);
        }
    };

    if (!projectId) {
        return <Alert message="Project ID is required" type="error" />;
    }

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
            <Card>
                <Title level={2}>💡 创意头脑风暴</Title>
                
                {status === 'idle' && (
                    <div>
                        <Text>点击开始生成创意想法</Text>
                        <br />
                        <Button 
                            type="primary" 
                            icon={<BulbOutlined />}
                            onClick={startBrainstorming}
                            style={{ marginTop: 16 }}
                        >
                            开始头脑风暴
                        </Button>
                    </div>
                )}
                
                {status === 'streaming' && (
                    <div>
                        <Progress percent={progress} status="active" />
                        <Text>AI 正在生成创意想法... ({ideas.length} 个想法已生成)</Text>
                    </div>
                )}
                
                {error && (
                    <Alert
                        message="生成失败"
                        description={error}
                        type="error"
                        action={
                            <Button size="small" onClick={() => window.location.reload()}>
                                重试
                            </Button>
                        }
                    />
                )}
                
                {ideas.length > 0 && (
                    <DynamicBrainstormingResults 
                        ideas={ideas}
                        isStreaming={status === 'streaming'}
                        onIdeaSelect={(ideaText) => {
                            console.log('Selected idea:', ideaText);
                            // Navigate to next step
                        }}
                    />
                )}
                
                {isLoading && <Spin size="large" />}
            </Card>
        </div>
    );
};
```

### 4.4 Updated NewProjectFromBrainstormPage

```typescript
// src/client/components/NewProjectFromBrainstormPage.tsx - MAJOR REFACTOR

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Typography, Form, Input, Space, message } from 'antd';
import { BulbOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

export const NewProjectFromBrainstormPage: React.FC = () => {
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const [isCreating, setIsCreating] = useState(false);

    const handleSubmit = async (values: any) => {
        setIsCreating(true);
        
        try {
            // 1. Create project
            const projectResponse = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: `Brainstorm Project - ${new Date().toLocaleString()}`,
                    description: `Generated from brainstorm: ${values.genre}`
                })
            });
            
            if (!projectResponse.ok) {
                throw new Error('Failed to create project');
            }
            
            const { projectId } = await projectResponse.json();
            
            // 2. Start brainstorming
            const brainstormResponse = await fetch('/api/brainstorm/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    params: {
                        platform: values.platform,
                        genre: values.genre,
                        other_requirements: values.other_requirements
                    }
                })
            });
            
            if (!brainstormResponse.ok) {
                throw new Error('Failed to start brainstorming');
            }
            
            message.success('Project created! Redirecting to brainstorm page...');
            
            // 3. Navigate to project brainstorm page
            navigate(`/projects/${projectId}/brainstorm`);
            
        } catch (error) {
            console.error('Error:', error);
            message.error('Failed to create project and start brainstorming');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px' }}>
            <Card>
                <Title level={2}>新建脑暴项目</Title>
                <Paragraph>
                    创建一个新项目并开始AI头脑风暴，生成创意故事想法。
                </Paragraph>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{
                        platform: "抖音",
                        genre: "穿越, 爽文",
                    }}
                >
                    <Form.Item
                        name="platform"
                        label="目标平台"
                        rules={[{ required: true, message: '请输入目标平台' }]}
                    >
                        <Input placeholder="例如: 抖音, 快手, YouTube Shorts" />
                    </Form.Item>

                    <Form.Item
                        name="genre"
                        label="故事类型"
                        rules={[{ required: true, message: '请输入故事类型' }]}
                    >
                        <Input placeholder="例如: 穿越, 爽文, 甜宠, 悬疑" />
                    </Form.Item>

                    <Form.Item
                        name="other_requirements"
                        label="其他要求"
                    >
                        <TextArea
                            rows={4}
                            placeholder="描述故事核心、人物设定、情节走向等..."
                        />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button
                                type="primary"
                                htmlType="submit"
                                icon={<BulbOutlined />}
                                loading={isCreating}
                            >
                                {isCreating ? '创建中...' : '开始创建项目'}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};
```

## Phase 5: Implementation Timeline

### Week 1: Database & Kysely Migration
- [ ] Set up Postgres + Electric with Docker Compose
- [ ] Replace Knex with Kysely (connection.ts, dependencies)
- [ ] Create new schema.sql file
- [ ] Generate Kysely types with `kysely-codegen`
- [ ] Test database connection and Electric sync

### Week 2: Backend Refactor with Kysely
- [ ] Rewrite ArtifactRepository and TransformRepository with Kysely
- [ ] Create BrainstormService with Electric updates
- [ ] Create simplified brainstormRoutes.ts
- [ ] Remove SSE infrastructure (JobBroadcaster, StreamingTransformExecutor)
- [ ] Test background job updates sync through Electric

### Week 3: Frontend Migration
- [ ] Install Electric React libraries
- [ ] Create useElectricBrainstorm hook
- [ ] Refactor ProjectBrainstormPage to use Electric
- [ ] Refactor NewProjectFromBrainstormPage
- [ ] Test real-time updates

### Week 4: Integration & Testing
- [ ] End-to-end testing of brainstorm flow
- [ ] Performance testing and Kysely query optimization
- [ ] Error handling and edge cases
- [ ] Authentication integration
- [ ] Clean up unused Knex code and files

## Success Metrics

- [ ] **70%+ Code Reduction**: Remove all SSE complexity for brainstorming
- [ ] **Sub-100ms Updates**: Real-time sync from database to UI via Electric
- [ ] **Simplified Architecture**: Single trigger endpoint + Electric sync
- [ ] **Maintained Graph Structure**: All artifact/transform relationships preserved
- [ ] **No Feature Loss**: All current brainstorming functionality works

## Key Benefits

1. **Dramatically Simplified**: Replace complex SSE with simple HTTP trigger + Electric sync
2. **Real-time by Default**: Electric handles all real-time updates automatically
3. **Postgres Native**: Better performance, JSONB support, logical replication
4. **Graph Structure Preserved**: Maintains artifact → transform → artifact flow for future features
5. **Brainstorm-Focused**: Only migrate what's needed, no outline/episode complexity
6. **Kysely Advantages**: 
   - **Type Safety**: Auto-generated types from schema prevent runtime errors
   - **Performance**: More efficient queries than Knex, better for Electric's real-time patterns
   - **Developer Experience**: Better IntelliSense, compile-time query validation
   - **Future-Proof**: Easier to optimize for Electric's streaming patterns

## Electric + Kysely Synergy

Electric Sync works perfectly with Kysely because:
- **Database-Level Sync**: Electric streams changes from Postgres logical replication, independent of query builder
- **Type Safety**: Kysely's generated types ensure frontend and backend stay in sync with database schema
- **Performance**: Kysely's efficient queries reduce database load, improving Electric sync performance
- **Simple Updates**: Kysely's clean syntax makes the streaming update logic more readable

This focused approach will validate Electric Sync's effectiveness for our use case before expanding to other features. 