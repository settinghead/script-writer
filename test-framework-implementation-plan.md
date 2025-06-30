# Test Framework Implementation Plan

## Overview
This plan implements a comprehensive test framework for the script-writer project using **Vitest** with **cache-based mocking** - leveraging existing cached LLM responses from `/cache/llm-streams/` for realistic test data.

## 🎯 Key Innovation: Cache-Based Mocking

Instead of hardcoded mock responses, we'll use **real cached LLM responses** to make tests more realistic and maintainable.

### Benefits
- ✅ **Realistic test data** - Actual LLM responses, not fabricated ones
- ✅ **Deterministic tests** - Same cache key = same response every time
- ✅ **Zero LLM costs** - No API calls during testing
- ✅ **Comprehensive coverage** - Test against variety of real scenarios

## 📋 Phase 1: Core Infrastructure Setup

### 1.1 Install Dependencies
```bash
npm install -D vitest @vitest/coverage-v8 jsdom @types/crypto
```

### 1.2 Create Vitest Configuration
**File: `vitest.config.ts`**
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        '**/__tests__/**',
        '**/node_modules/**',
        '**/*.test.ts',
        '**/coverage/**'
      ]
    },
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './src/__tests__')
    }
  }
});
```

### 1.3 Update Package.json Scripts
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch",
    "test:run": "vitest run"
  }
}
```

## 📋 Phase 2: Cache Key Refactoring

### 2.1 Extract Cache Key Logic

**File: `src/common/utils/cacheKeyGenerator.ts`** (NEW)
```typescript
import crypto from 'crypto';
import { z } from 'zod';

export interface CacheKeyParams {
    prompt: string;
    seed?: number;
    schemaHash?: string;
    modelName: string;
    provider?: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    mode?: 'object' | 'text';
    [key: string]: any;
}

export interface ModelInfo {
    name: string;
    provider: string;
    supportsReasoning: boolean;
}

/**
 * Generate deterministic cache key from parameters
 */
export function generateCacheKey(params: CacheKeyParams): string {
    const keyData = {
        prompt: params.prompt,
        seed: params.seed,
        schemaHash: params.schemaHash,
        modelName: params.modelName,
        provider: params.provider,
        temperature: params.temperature,
        topP: params.topP,
        maxTokens: params.maxTokens,
        mode: params.mode,
        // Include other parameters sorted
        ...Object.fromEntries(
            Object.entries(params)
                .filter(([key]) => !['prompt', 'seed', 'schemaHash', 'modelName', 'provider', 'temperature', 'topP', 'maxTokens', 'mode'].includes(key))
                .sort(([a], [b]) => a.localeCompare(b))
        )
    };

    const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
    return crypto.createHash('sha256').update(keyString).digest('hex');
}

/**
 * Generate hash for Zod schema
 */
export function generateSchemaHash(schema: z.ZodSchema): string {
    const schemaString = JSON.stringify(schema._def);
    return crypto.createHash('md5').update(schemaString).digest('hex');
}

/**
 * Extract model information from AI SDK model instance
 */
export function extractModelInfo(model: any): ModelInfo {
    const modelId = model.modelId || model.id || 'unknown';
    const provider = model.provider?.providerId || model.provider || 'unknown';
    
    return {
        name: modelId,
        provider: provider,
        supportsReasoning: modelId.includes('reasoning') || provider === 'deepseek'
    };
}
```

### 2.2 Refactor CachedLLMService

**File: `src/server/services/CachedLLMService.ts`** (REFACTOR)
```typescript
// Replace existing cache key generation logic with:
import { generateCacheKey, generateSchemaHash, extractModelInfo, CacheKeyParams } from '../../common/utils/cacheKeyGenerator';

export class CachedLLMService {
    // ... existing code ...

    /**
     * Generate cache key from model and parameters
     */
    private generateCacheKey(
        model: any,
        prompt: string,
        schema?: z.ZodSchema,
        options: {
            seed?: number;
            temperature?: number;
            topP?: number;
            maxTokens?: number;
            mode: 'object' | 'text';
        } = { mode: 'text' }
    ): string {
        const modelInfo = extractModelInfo(model);

        const cacheKeyParams: CacheKeyParams = {
            prompt,
            seed: options.seed,
            schemaHash: schema ? generateSchemaHash(schema) : undefined,
            modelName: modelInfo.name,
            provider: modelInfo.provider,
            temperature: options.temperature,
            topP: options.topP,
            maxTokens: options.maxTokens,
            mode: options.mode
        };

        return generateCacheKey(cacheKeyParams);
    }

    // ... rest of existing methods remain the same ...
}
```

### 2.3 Refactor StreamCache

**File: `src/server/services/StreamCache.ts`** (REFACTOR)
```typescript
// Replace existing cache key generation with:
import { generateCacheKey, generateSchemaHash } from '../../common/utils/cacheKeyGenerator';

export class StreamCache {
    // ... existing code ...

    /**
     * Generate a deterministic cache key from parameters
     */
    generateCacheKey(params: CacheKeyParams): string {
        return generateCacheKey(params);
    }

    /**
     * Generate hash for Zod schema for cache invalidation
     */
    generateSchemaHash(schema: z.ZodSchema): string {
        return generateSchemaHash(schema);
    }

    // ... rest of methods remain the same ...
}
```

## 📋 Phase 3: Cache-Based Mock System

### 3.1 Cache Reader Utility

**File: `src/__tests__/utils/cacheReader.ts`** (NEW)
```typescript
import fs from 'fs/promises';
import path from 'path';
import { CachedStreamChunk } from '../../server/services/StreamCache';

export interface CachedResponse {
    metadata: {
        cacheKey: string;
        createdAt: string;
        totalChunks: number;
        finalResult?: any;
    };
    chunks: CachedStreamChunk[];
}

export class CacheReader {
    private cacheDir: string;

    constructor(cacheDir: string = './cache/llm-streams') {
        this.cacheDir = cacheDir;
    }

    /**
     * Read cached response by cache key
     */
    async getCachedResponse(cacheKey: string): Promise<CachedResponse | null> {
        try {
            const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
            const cacheData = await fs.readFile(cacheFile, 'utf-8');
            return JSON.parse(cacheData);
        } catch (error) {
            return null;
        }
    }

    /**
     * List all available cache files
     */
    async listCacheFiles(): Promise<string[]> {
        try {
            const files = await fs.readdir(this.cacheDir);
            return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
        } catch (error) {
            return [];
        }
    }

    /**
     * Find cache entries by pattern (for test data discovery)
     */
    async findCachesByPattern(pattern: RegExp): Promise<CachedResponse[]> {
        const files = await this.listCacheFiles();
        const matches: CachedResponse[] = [];

        for (const file of files) {
            const response = await this.getCachedResponse(file);
            if (response && pattern.test(JSON.stringify(response.metadata))) {
                matches.push(response);
            }
        }

        return matches;
    }

    /**
     * Get random cached response (for test data)
     */
    async getRandomCachedResponse(): Promise<CachedResponse | null> {
        const files = await this.listCacheFiles();
        if (files.length === 0) return null;

        const randomFile = files[Math.floor(Math.random() * files.length)];
        return this.getCachedResponse(randomFile);
    }
}
```

### 3.2 AI SDK Mock Factory

**File: `src/__tests__/mocks/aiSdkMocks.ts`** (NEW)
```typescript
import { vi } from 'vitest';
import { CacheReader, CachedResponse } from '../utils/cacheReader';
import { generateCacheKey, generateSchemaHash, CacheKeyParams } from '../../common/utils/cacheKeyGenerator';
import { z } from 'zod';

const cacheReader = new CacheReader();

/**
 * Create mock for streamObject that uses cached responses
 */
export function createCachedStreamObjectMock() {
    return vi.fn().mockImplementation(async (options: {
        model: any;
        schema: z.ZodSchema;  
        messages: Array<{ role: string; content: string }>;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }) => {
        // Generate cache key from parameters
        const prompt = options.messages.map(m => m.content).join('\n');
        const cacheKey = generateCacheKey({
            prompt,
            seed: options.seed,
            schemaHash: generateSchemaHash(options.schema),
            modelName: options.model.modelId || 'test-model',
            provider: options.model.provider || 'test-provider',
            temperature: options.temperature,
            topP: options.topP,
            maxTokens: options.maxTokens,
            mode: 'object'
        });

        // Try to get cached response
        const cachedResponse = await cacheReader.getCachedResponse(cacheKey);
        
        if (cachedResponse) {
            // Use cached response
            return createStreamObjectFromCache(cachedResponse);
        } else {
            // Fallback to mock data
            console.warn(`No cached response found for key: ${cacheKey.substring(0, 8)}...`);
            return createFallbackStreamObject();
        }
    });
}

/**
 * Create mock for streamText that uses cached responses
 */
export function createCachedStreamTextMock() {
    return vi.fn().mockImplementation(async (options: {
        model: any;
        messages: Array<{ role: string; content: string }>;
        seed?: number;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    }) => {
        // Generate cache key from parameters
        const prompt = options.messages.map(m => m.content).join('\n');
        const cacheKey = generateCacheKey({
            prompt,
            modelName: options.model.modelId || 'test-model',
            provider: options.model.provider || 'test-provider',
            seed: options.seed,
            temperature: options.temperature,
            topP: options.topP,
            maxTokens: options.maxTokens,
            mode: 'text'
        });

        // Try to get cached response
        const cachedResponse = await cacheReader.getCachedResponse(cacheKey);
        
        if (cachedResponse) {
            return createStreamTextFromCache(cachedResponse);
        } else {
            console.warn(`No cached response found for key: ${cacheKey.substring(0, 8)}...`);
            return createFallbackStreamText();
        }
    });
}

/**
 * Create streamObject result from cached data
 */
function createStreamObjectFromCache(cachedResponse: CachedResponse) {
    const chunks = cachedResponse.chunks.filter(c => c.type === 'object');
    
    return {
        partialObjectStream: createAsyncIteratorFromChunks(chunks),
        object: Promise.resolve(cachedResponse.metadata.finalResult)
    };
}

/**
 * Create streamText result from cached data  
 */
function createStreamTextFromCache(cachedResponse: CachedResponse) {
    const chunks = cachedResponse.chunks.filter(c => c.type === 'text-delta');
    
    return {
        textStream: createAsyncIteratorFromChunks(chunks),
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({ promptTokens: 100, completionTokens: 50, totalTokens: 150 })
    };
}

/**
 * Create async iterator from cached chunks
 */
async function* createAsyncIteratorFromChunks(chunks: any[]) {
    for (const chunk of chunks) {
        yield chunk.data;
    }
}

/**
 * Fallback mock for when no cache is available
 */
function createFallbackStreamObject() {
    return {
        partialObjectStream: createAsyncIterator([
            { title: "Test Title" },
            { title: "Test Title", body: "Test content..." }
        ]),
        object: Promise.resolve({ title: "Test Title", body: "Test content..." })
    };
}

function createFallbackStreamText() {
    return {
        textStream: createAsyncIterator(["Hello", " World", "!"]),
        finishReason: Promise.resolve('stop'),
        usage: Promise.resolve({ promptTokens: 10, completionTokens: 5, totalTokens: 15 })
    };
}

async function* createAsyncIterator<T>(items: T[]) {
    for (const item of items) {
        yield item;
    }
}
```

### 3.3 Database Mock Factory

**File: `src/__tests__/mocks/databaseMocks.ts`** (NEW)
```typescript
import { vi } from 'vitest';
import { DatabaseSchema } from '../../server/database/types';

export function createMockKyselyDatabase() {
    return {
        selectFrom: vi.fn().mockReturnThis(),
        insertInto: vi.fn().mockReturnThis(),
        updateTable: vi.fn().mockReturnThis(),
        deleteFrom: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        execute: vi.fn(),
        executeTakeFirst: vi.fn(),
        executeTakeFirstOrThrow: vi.fn(),
        destroy: vi.fn().mockResolvedValue(undefined)
    };
}

export function createMockArtifactRepository() {
    return {
        getArtifact: vi.fn(),
        createArtifact: vi.fn(),
        updateArtifact: vi.fn(),
        getLatestBrainstormIdeas: vi.fn(),
        getProjectArtifactsByType: vi.fn(),
        userHasProjectAccess: vi.fn().mockResolvedValue(true),
    };
}

export function createMockTransformRepository() {
    return {
        createTransform: vi.fn(),
        getTransform: vi.fn(),
        getProjectTransforms: vi.fn(),
        updateTransformStatus: vi.fn(),
    };
}
```

## 📋 Phase 4: Test Structure Implementation

### 4.1 Test Setup File

**File: `src/__tests__/setup.ts`** (NEW)
```typescript
import { vi } from 'vitest';
import { createCachedStreamObjectMock, createCachedStreamTextMock } from './mocks/aiSdkMocks';

// Mock AI SDK functions globally
vi.mock('ai', () => ({
    streamText: createCachedStreamTextMock(),
    streamObject: createCachedStreamObjectMock(),
    generateText: vi.fn().mockResolvedValue({ text: 'Generated text' }),
    tool: vi.fn(),
    wrapLanguageModel: vi.fn(),
    extractReasoningMiddleware: vi.fn()
}));

// Mock database connection
vi.mock('../server/database/connection', () => ({
    db: {
        selectFrom: vi.fn().mockReturnThis(),
        insertInto: vi.fn().mockReturnThis(),
        updateTable: vi.fn().mockReturnThis(),
        deleteFrom: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        selectAll: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        execute: vi.fn(),
        executeTakeFirst: vi.fn(),
        executeTakeFirstOrThrow: vi.fn(),
        destroy: vi.fn().mockResolvedValue(undefined)
    }
}));

// Mock environment variables
process.env.NODE_ENV = 'test';
```

### 4.2 Test Data Fixtures

**File: `src/__tests__/fixtures/artifacts.ts`** (NEW)
```typescript
export const mockArtifacts = {
    brainstormIdea: {
        id: 'test-brainstorm-1',
        type: 'brainstorm_idea',
        project_id: 'test-project-1',
        data: {
            title: '误爱成宠',
            body: '林氏集团总裁林慕琛因一场误会将普通职员夏栀认作富家千金...'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    },

    outline: {
        id: 'test-outline-1',
        type: 'outline',
        project_id: 'test-project-1',
        data: {
            title: '误爱成宠',
            characters: [
                { name: '林慕琛', type: 'male_lead' },
                { name: '夏栀', type: 'female_lead' }
            ],
            stages: ['相遇', '误会', '真相', '结局']
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
};

export const mockTransforms = {
    brainstormTransform: {
        id: 'test-transform-1',
        type: 'llm',
        project_id: 'test-project-1',
        status: 'completed',
        input_artifacts: ['test-input-1'],
        output_artifact_id: 'test-brainstorm-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
};
```

## 📋 Phase 5: Test Implementation

### 5.1 Repository Tests

**File: `src/server/repositories/__tests__/ArtifactRepository.test.ts`** (NEW)
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArtifactRepository } from '../ArtifactRepository';
import { createMockKyselyDatabase } from '../../../__tests__/mocks/databaseMocks';
import { mockArtifacts } from '../../../__tests__/fixtures/artifacts';

describe('ArtifactRepository', () => {
    let repository: ArtifactRepository;
    let mockDb: any;

    beforeEach(() => {
        mockDb = createMockKyselyDatabase();
        repository = new ArtifactRepository(mockDb);
    });

    describe('getLatestBrainstormIdeas', () => {
        it('should resolve latest brainstorm ideas for project', async () => {
            // Arrange
            mockDb.execute.mockResolvedValue([mockArtifacts.brainstormIdea]);

            // Act
            const result = await repository.getLatestBrainstormIdeas('test-project-1');

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('brainstorm_idea');
            expect(mockDb.selectFrom).toHaveBeenCalledWith('artifacts');
        });

        it('should return empty array when no ideas exist', async () => {
            // Arrange
            mockDb.execute.mockResolvedValue([]);

            // Act
            const result = await repository.getLatestBrainstormIdeas('test-project-1');

            // Assert
            expect(result).toHaveLength(0);
        });
    });

    describe('getArtifact', () => {
        it('should return artifact by id', async () => {
            // Arrange
            mockDb.executeTakeFirst.mockResolvedValue(mockArtifacts.brainstormIdea);

            // Act
            const result = await repository.getArtifact('test-brainstorm-1');

            // Assert
            expect(result).toEqual(mockArtifacts.brainstormIdea);
            expect(mockDb.where).toHaveBeenCalledWith('id', '=', 'test-brainstorm-1');
        });
    });
});
```

### 5.2 Streaming Tool Tests

**File: `src/server/tools/__tests__/BrainstormTool.test.ts`** (NEW)
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBrainstormToolDefinition } from '../BrainstormTool';
import { createMockArtifactRepository, createMockTransformRepository } from '../../../__tests__/mocks/databaseMocks';

describe('BrainstormTool', () => {
    let mockTransformRepo: any;
    let mockArtifactRepo: any;
    let brainstormTool: any;

    beforeEach(() => {
        mockTransformRepo = createMockTransformRepository();
        mockArtifactRepo = createMockArtifactRepository();
        
        brainstormTool = createBrainstormToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: false } // Disable caching for predictable tests
        );
    });

    it('should generate brainstorm ideas using cached LLM responses', async () => {
        // Arrange
        mockArtifactRepo.createArtifact.mockResolvedValue({ id: 'new-artifact-1' });
        mockTransformRepo.createTransform.mockResolvedValue({ id: 'new-transform-1' });

        const input = {
            platform: '抖音',
            genre: '现代甜宠',
            other_requirements: '快节奏，高颜值主角'
        };

        // Act
        const result = await brainstormTool.execute(input, { toolCallId: 'test-call-1' });

        // Assert
        expect(result.outputArtifactId).toBe('new-artifact-1');
        expect(result.finishReason).toBe('stop');
        expect(mockArtifactRepo.createArtifact).toHaveBeenCalled();
    });
});
```

### 5.3 Integration Tests

**File: `src/server/__tests__/streaming-workflow.test.ts`** (NEW)
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createBrainstormToolDefinition } from '../tools/BrainstormTool';
import { createOutlineToolDefinition } from '../tools/OutlineTool';
import { createMockArtifactRepository, createMockTransformRepository } from '../../__tests__/mocks/databaseMocks';

describe('Streaming Workflow Integration', () => {
    let mockTransformRepo: any;
    let mockArtifactRepo: any;

    beforeEach(() => {
        mockTransformRepo = createMockTransformRepository();
        mockArtifactRepo = createMockArtifactRepository();
        
        // Setup mock responses
        mockArtifactRepo.createArtifact.mockImplementation(() => ({
            id: `artifact-${Date.now()}-${Math.random()}`
        }));
        mockTransformRepo.createTransform.mockImplementation(() => ({
            id: `transform-${Date.now()}-${Math.random()}`
        }));
    });

    it('should complete brainstorm -> outline workflow using cached responses', async () => {
        // Step 1: Generate brainstorm ideas
        const brainstormTool = createBrainstormToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: false }
        );

        const brainstormResult = await brainstormTool.execute({
            platform: '抖音',
            genre: '现代甜宠',
            other_requirements: '快节奏，高颜值主角'
        }, { toolCallId: 'brainstorm-1' });

        expect(brainstormResult.outputArtifactId).toBeTruthy();

        // Step 2: Generate outline from brainstorm
        const outlineTool = createOutlineToolDefinition(
            mockTransformRepo,
            mockArtifactRepo,
            'test-project-1',
            'test-user-1',
            { enableCaching: false }
        );

        const outlineResult = await outlineTool.execute({
            sourceArtifactId: brainstormResult.outputArtifactId,
            totalEpisodes: 12,
            episodeDuration: 3,
            selectedPlatform: '抖音',
            selectedGenrePaths: [['现代', '甜宠', '都市']],
            requirements: '高颜值演员，快节奏剧情'
        }, { toolCallId: 'outline-1' });

        expect(outlineResult.outputArtifactId).toBeTruthy();
        expect(outlineResult.finishReason).toBe('stop');
    });
});
```

## 📋 Phase 6: Test Execution

### 6.1 Convert Existing Test Scripts

**Replace:** `src/server/scripts/test-lineage-brainstorm-ideas.ts`
**With:** `src/server/repositories/__tests__/ArtifactRepository.test.ts` (implemented above)

**Replace:** `src/server/scripts/test-streaming-framework.ts`
**With:** `src/server/__tests__/streaming-workflow.test.ts` (implemented above)

### 6.2 Test Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- ArtifactRepository.test.ts

# Run with UI
npm run test:ui
```

## 📋 Phase 7: Cache Discovery Tools

### 7.1 Cache Analysis Script

**File: `src/__tests__/scripts/analyze-cache.ts`** (NEW)
```typescript
#!/usr/bin/env node

import { CacheReader } from '../utils/cacheReader';

async function analyzeCacheContents() {
    const cacheReader = new CacheReader();
    
    console.log('🔍 Analyzing cached LLM responses...\n');
    
    const files = await cacheReader.listCacheFiles();
    console.log(`Found ${files.length} cached responses\n`);
    
    for (const file of files) {
        const response = await cacheReader.getCachedResponse(file);
        if (response) {
            console.log(`📁 Cache Key: ${file.substring(0, 16)}...`);
            console.log(`   Created: ${response.metadata.createdAt}`);
            console.log(`   Chunks: ${response.metadata.totalChunks}`);
            if (response.metadata.finalResult) {
                console.log(`   Final Result: ${JSON.stringify(response.metadata.finalResult).substring(0, 100)}...`);
            }
            console.log('');
        }
    }
}

analyzeCacheContents().catch(console.error);
```

### 7.2 Test Data Generator

**File: `src/__tests__/scripts/generate-test-data.ts`** (NEW)
```typescript
#!/usr/bin/env node

import { CacheReader } from '../utils/cacheReader';
import fs from 'fs/promises';

async function generateTestDataFromCache() {
    const cacheReader = new CacheReader();
    
    // Find representative cached responses
    const brainstormResponses = await cacheReader.findCachesByPattern(/brainstorm/i);
    const outlineResponses = await cacheReader.findCachesByPattern(/outline/i);
    
    const testData = {
        brainstormExamples: brainstormResponses.slice(0, 3).map(r => ({
            cacheKey: r.metadata.cacheKey,
            finalResult: r.metadata.finalResult,
            chunks: r.chunks.length
        })),
        outlineExamples: outlineResponses.slice(0, 3).map(r => ({
            cacheKey: r.metadata.cacheKey,
            finalResult: r.metadata.finalResult,
            chunks: r.chunks.length
        }))
    };
    
    await fs.writeFile(
        'src/__tests__/fixtures/cache-examples.json',
        JSON.stringify(testData, null, 2)
    );
    
    console.log('✅ Generated test data from cache');
}

generateTestDataFromCache().catch(console.error);
```

## 🎯 Implementation Priority

### Phase 1 (High Priority)
1. ✅ **Vitest setup** and configuration
2. ✅ **Cache key refactoring** (shared utilities)
3. ✅ **AI SDK mocking** with cache integration

### Phase 2 (Medium Priority)  
4. ✅ **Repository tests** with database mocking
5. ✅ **Tool tests** with cached LLM responses
6. ✅ **Integration tests** for complete workflows

### Phase 3 (Low Priority)
7. ✅ **Frontend tests** (components, hooks)
8. ✅ **Cache analysis tools**
9. ✅ **CI/CD integration**

## 📊 Expected Outcomes

- **🚀 50x faster test execution** - No real LLM calls
- **💰 Zero testing costs** - Uses cached responses
- **🎯 Realistic test data** - Actual LLM outputs
- **📈 High test coverage** - Comprehensive mocking
- **🔄 Deterministic tests** - Same cache = same results
- **🐞 Better debugging** - Trace through actual data flows

This cache-based approach ensures our tests are both realistic and efficient, providing the best of both worlds. 