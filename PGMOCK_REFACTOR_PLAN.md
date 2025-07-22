# PGMock Migration Refactor Plan

## Overview

This document outlines the plan to migrate from simplistic database mocking to using [pgmock](https://github.com/stack-auth/pgmock) for more realistic database testing across the entire codebase.

## Current State Analysis

### Current Testing Architecture
- **Test Framework**: Vitest with jsdom environment
- **Database Mocking**: Simplistic mocks using `vi.mock()` with basic return values
- **Mock Implementation**: `src/__tests__/mocks/databaseMocks.ts` provides basic Kysely method mocks
- **Test Setup**: Global mocks in `src/__tests__/setup.ts`
- **Coverage**: 95+ tests across multiple layers (tools, services, repositories, components)

### Current Mock Limitations
1. **No Data Persistence**: Mocks return hardcoded values, no actual data storage
2. **No Referential Integrity**: No foreign key constraints or cascade behavior
3. **No Transaction Support**: Cannot test rollback scenarios or concurrent operations
4. **No Query Validation**: Invalid SQL queries pass silently
5. **Unrealistic Behavior**: Database operations don't reflect real PostgreSQL behavior
6. **Limited Error Testing**: Cannot test database-specific error conditions

### Identified Test Categories

#### Backend Tests (47 tests)
1. **Repository Tests** (2 files)
   - `src/server/transform-jsondoc-framework/JsondocRepository.test.ts`
   - Tests basic CRUD operations with mocked database

2. **Service Tests** (3 files)
   - `src/server/services/__tests__/EmbeddingService.test.ts` (6 tests)
   - `src/server/services/__tests__/ParticleExtractor.test.ts` (3 tests) 
   - `src/server/services/__tests__/BatchEmbedding.integration.test.ts` (3 tests)

3. **Tool Tests** (4 files)
   - `src/server/tools/__tests__/BrainstormTool.test.ts` (4 tests)
   - `src/server/tools/__tests__/BrainstormEditTool.test.ts` (12 tests)
   - `src/server/tools/__tests__/EpisodePlanningTool.test.ts` (6 tests)
   - `src/server/tools/__tests__/EpisodeSynopsisTool.test.ts` (7 tests)

4. **Shared Component Tests** (1 file)
   - `src/server/tools/shared/__tests__/JsondocProcessor.test.ts` (6 tests)

5. **Integration Tests** (2 files)
   - `src/server/__tests__/agent-service-integration.test.ts` (8 tests)
   - `src/server/__tests__/brainstorm-edit-chain-integration.test.ts`

#### Frontend Tests (48+ tests)
1. **Component Tests** (2 files)
   - `src/client/components/__tests__/BrainstormInputEditor.test.tsx` (6 tests)
   - `src/client/components/__tests__/ChroniclesDisplay.test.tsx`

2. **Action Tests** (1 file)
   - `src/client/components/actions/__tests__/EpisodePlanningAction.test.tsx`

3. **Debug Component Tests** (1 file)
   - `src/client/components/debug/__tests__/AgentContextView.test.tsx`

4. **Shared Component Tests** (2 files)
   - `src/client/components/shared/__tests__/EpisodePlanningDisplay.test.tsx`
   - `src/client/components/shared/__tests__/EpisodeSynopsisDisplay.test.tsx`

5. **Context Tests** (1 file)
   - `src/client/contexts/__tests__/ScrollSyncContext.test.tsx`

6. **Hook Tests** (1 file)
   - `src/client/hooks/__tests__/useScrollSyncObserver.test.tsx`

7. **Transform Framework Tests** (1 file)
   - `src/client/transform-jsondoc-framework/__tests__/YJSField.test.tsx`

8. **Utility Tests** (3 files)
   - `src/client/utils/__tests__/actionComputation.test.ts`
   - `src/client/utils/__tests__/episodePlanningActionComputation.test.ts`
   - `src/client/utils/__tests__/unifiedWorkflowComputation.test.ts`

#### Schema Tests (1 file)
- `src/common/schemas/__tests__/episodePlanningSchemas.test.ts` (30+ tests)

## PGMock Integration Plan

### Phase 1: Setup and Infrastructure

#### 1.1 Install Dependencies
```bash
npm install --save-dev pgmock
```

#### 1.2 Create PGMock Configuration
**File**: `src/__tests__/database/pgmock-setup.ts`
```typescript
import { PGMock } from 'pgmock';
import { Kysely, PostgresDialect } from 'kysely';
import { DB } from '../../server/database/types';

export class TestDatabaseManager {
  private pgMock: PGMock;
  private db: Kysely<DB>;

  async setup(): Promise<Kysely<DB>> {
    this.pgMock = new PGMock();
    await this.pgMock.start();
    
    // Run all migrations on test database
    await this.runMigrations();
    
    this.db = new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: this.pgMock.getPool()
      })
    });

    return this.db;
  }

  async teardown(): Promise<void> {
    await this.db?.destroy();
    await this.pgMock?.stop();
  }

  async reset(): Promise<void> {
    await this.pgMock.reset();
    await this.runMigrations();
  }

  private async runMigrations(): Promise<void> {
    // Import and run all migration files
    // This ensures test database has same schema as production
  }
}
```

#### 1.3 Update Vitest Configuration
**File**: `vitest.config.ts`
```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
    // Add longer timeout for database operations
    testTimeout: 30000,
    // Run tests serially for database tests to avoid conflicts
    poolOptions: {
      threads: {
        singleThread: true
      }
    }
  }
});
```

#### 1.4 Create Test Data Factories
**File**: `src/__tests__/factories/index.ts`
```typescript
import { faker } from '@faker-js/faker';
import { Kysely } from 'kysely';
import { DB } from '../../server/database/types';

export class TestDataFactory {
  constructor(private db: Kysely<DB>) {}

  async createUser(overrides = {}) {
    const userData = {
      id: faker.string.uuid(),
      username: faker.internet.userName(),
      email: faker.internet.email(),
      ...overrides
    };

    return await this.db
      .insertInto('users')
      .values(userData)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async createProject(userId: string, overrides = {}) {
    const projectData = {
      id: faker.string.uuid(),
      name: faker.company.name(),
      description: faker.lorem.paragraph(),
      ...overrides
    };

    const project = await this.db
      .insertInto('projects')
      .values(projectData)
      .returningAll()
      .executeTakeFirstOrThrow();

    // Add user as project member
    await this.db
      .insertInto('projects_users')
      .values({
        project_id: project.id,
        user_id: userId,
        role: 'owner'
      })
      .execute();

    return project;
  }

  async createJsondoc(projectId: string, overrides = {}) {
    const jsondocData = {
      id: faker.string.uuid(),
      project_id: projectId,
      schema_type: 'brainstorm_idea' as const,
      schema_version: 'v1' as const,
      origin_type: 'ai_generated' as const,
      data: JSON.stringify({
        title: faker.lorem.words(3),
        body: faker.lorem.paragraph()
      }),
      ...overrides
    };

    return await this.db
      .insertInto('jsondocs')
      .values(jsondocData)
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
```

### Phase 2: Backend Test Migration

#### 2.1 Repository Tests Migration
**Priority**: High (Foundation for all other tests)

**Target Files**:
- `src/server/transform-jsondoc-framework/JsondocRepository.test.ts`

**Migration Strategy**:
1. Replace mock database with real PGMock instance
2. Test actual SQL queries and constraints
3. Add tests for error conditions (foreign key violations, etc.)
4. Test transaction rollback scenarios

**Example Migration**:
```typescript
// Before (Mock-based)
describe('JsondocRepository', () => {
  let mockDb: any;
  
  beforeEach(() => {
    mockDb = createMockKyselyDatabase();
  });
});

// After (PGMock-based)
describe('JsondocRepository', () => {
  let testDb: TestDatabaseManager;
  let db: Kysely<DB>;
  let factory: TestDataFactory;
  let repository: JsondocRepository;
  
  beforeAll(async () => {
    testDb = new TestDatabaseManager();
    db = await testDb.setup();
    factory = new TestDataFactory(db);
    repository = new JsondocRepository(db);
  });

  afterAll(async () => {
    await testDb.teardown();
  });

  beforeEach(async () => {
    await testDb.reset();
  });
});
```

#### 2.2 Service Tests Migration
**Priority**: High

**Target Files**:
- `src/server/services/__tests__/EmbeddingService.test.ts`
- `src/server/services/__tests__/ParticleExtractor.test.ts`
- `src/server/services/__tests__/BatchEmbedding.integration.test.ts`

**Migration Strategy**:
1. Test actual database caching behavior
2. Verify embedding storage and retrieval
3. Test concurrent access patterns
4. Add performance benchmarks with real data

#### 2.3 Tool Tests Migration
**Priority**: Medium-High

**Target Files**:
- `src/server/tools/__tests__/BrainstormTool.test.ts`
- `src/server/tools/__tests__/BrainstormEditTool.test.ts`
- `src/server/tools/__tests__/EpisodePlanningTool.test.ts`
- `src/server/tools/__tests__/EpisodeSynopsisTool.test.ts`

**Migration Strategy**:
1. Test complete data flow from input to database storage
2. Verify transform tracking and lineage creation
3. Test error recovery and rollback scenarios
4. Add tests for concurrent tool execution

#### 2.4 Integration Tests Migration
**Priority**: High

**Target Files**:
- `src/server/__tests__/agent-service-integration.test.ts`
- `src/server/__tests__/brainstorm-edit-chain-integration.test.ts`

**Migration Strategy**:
1. Test complete workflow chains with real data persistence
2. Verify complex multi-step operations
3. Test data consistency across operations
4. Add stress testing with realistic data volumes

### Phase 3: Frontend Test Strategy

#### 3.1 Component Tests with Database Integration
**Priority**: Medium

**Strategy**: 
- Frontend components that interact with database APIs should be tested with real data
- Use MSW (Mock Service Worker) with PGMock backend for API integration
- Test real data loading and state management

**Target Files**:
- `src/client/components/__tests__/BrainstormInputEditor.test.tsx`
- `src/client/components/shared/__tests__/EpisodePlanningDisplay.test.tsx`
- `src/client/components/shared/__tests__/EpisodeSynopsisDisplay.test.tsx`

#### 3.2 Context and Hook Tests
**Priority**: Low-Medium

**Strategy**:
- Test hooks that depend on database state with real data
- Verify context providers with realistic data flows

**Target Files**:
- `src/client/contexts/__tests__/ScrollSyncContext.test.tsx`
- `src/client/hooks/__tests__/useScrollSyncObserver.test.tsx`

### Phase 4: Advanced Testing Features

#### 4.1 Transaction Testing
```typescript
describe('Transaction Handling', () => {
  it('should rollback on error', async () => {
    await db.transaction().execute(async (trx) => {
      await factory.createJsondoc(projectId);
      throw new Error('Simulated error');
    });
    
    // Verify rollback occurred
    const count = await db
      .selectFrom('jsondocs')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirstOrThrow();
    
    expect(count.count).toBe('0');
  });
});
```

#### 4.2 Concurrent Access Testing
```typescript
describe('Concurrent Operations', () => {
  it('should handle concurrent jsondoc creation', async () => {
    const promises = Array.from({ length: 10 }, () =>
      factory.createJsondoc(projectId)
    );
    
    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);
    expect(new Set(results.map(r => r.id))).toHaveLength(10);
  });
});
```

#### 4.3 Performance Testing
```typescript
describe('Performance Tests', () => {
  it('should handle large datasets efficiently', async () => {
    // Create 1000 jsondocs
    const jsondocs = await Promise.all(
      Array.from({ length: 1000 }, () => factory.createJsondoc(projectId))
    );
    
    const start = performance.now();
    const results = await repository.getProjectJsondocs(projectId);
    const duration = performance.now() - start;
    
    expect(results).toHaveLength(1000);
    expect(duration).toBeLessThan(1000); // Less than 1 second
  });
});
```

### Phase 5: CI/CD Integration

#### 5.1 GitHub Actions Update
```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test -- --run
        env:
          # PGMock will handle database setup
          NODE_ENV: test
```

#### 5.2 Test Data Management
- Create seed data for consistent test scenarios
- Implement test data cleanup strategies
- Add database snapshot/restore for complex test scenarios

## Migration Timeline

### Week 1: Foundation
- [ ] Install pgmock and setup basic configuration
- [ ] Create TestDatabaseManager and factory classes
- [ ] Migrate JsondocRepository tests
- [ ] Update vitest configuration

### Week 2: Core Services
- [ ] Migrate EmbeddingService tests
- [ ] Migrate ParticleExtractor tests
- [ ] Migrate BatchEmbedding integration tests
- [ ] Add transaction and error testing

### Week 3: Tools and Integration
- [ ] Migrate BrainstormTool tests
- [ ] Migrate BrainstormEditTool tests
- [ ] Migrate EpisodePlanningTool tests
- [ ] Migrate agent service integration tests

### Week 4: Frontend and Polish
- [ ] Migrate key frontend component tests
- [ ] Add performance and concurrent access tests
- [ ] Update CI/CD configuration
- [ ] Documentation and cleanup

## Benefits Expected

### Improved Test Quality
1. **Real Database Behavior**: Tests will catch SQL-specific issues
2. **Referential Integrity**: Foreign key constraints will be enforced
3. **Transaction Testing**: Can test rollback and commit scenarios
4. **Performance Insights**: Real query performance characteristics

### Better Bug Detection
1. **SQL Syntax Errors**: Invalid queries will fail in tests
2. **Data Type Issues**: PostgreSQL type checking will catch mismatches
3. **Constraint Violations**: Real constraint enforcement
4. **Race Conditions**: Concurrent access testing will reveal issues

### Increased Confidence
1. **Production Parity**: Test database matches production schema
2. **Integration Testing**: End-to-end data flow validation
3. **Error Handling**: Database-specific error scenarios
4. **Performance Validation**: Query optimization verification

## Risks and Mitigation

### Performance Impact
- **Risk**: Tests may run slower with real database
- **Mitigation**: Use test database pooling, parallel test execution where safe

### Complexity Increase
- **Risk**: More complex test setup and maintenance
- **Mitigation**: Good abstractions (TestDatabaseManager, factories), clear documentation

### Flaky Tests
- **Risk**: Database state may cause test interdependencies
- **Mitigation**: Proper cleanup between tests, isolated test data

### CI/CD Overhead
- **Risk**: Additional setup time for database in CI
- **Mitigation**: PGMock is lightweight, consider test parallelization strategies

## Success Metrics

1. **Test Coverage**: Maintain or improve current 95%+ test coverage
2. **Test Reliability**: Reduce flaky test occurrences by 50%
3. **Bug Detection**: Catch 3+ additional bug categories (SQL, constraints, performance)
4. **Developer Experience**: Faster debugging with realistic test data
5. **CI Performance**: Keep total test suite under 10 minutes

## Conclusion

Migrating to pgmock will significantly improve our test quality by providing realistic database behavior while maintaining the speed and isolation benefits of unit testing. The phased approach ensures minimal disruption to current development while systematically improving our testing infrastructure.

The investment in better testing infrastructure will pay dividends in reduced production bugs, faster debugging, and increased confidence in database-related changes.

## Implementation Status Update

**Date**: December 2024
**Status**: Phase 1 Complete, pgmock has limitations
**Current Priority**: Medium - pgmock has stability issues, existing mocks work well

### Progress Summary

#### ✅ Completed
- **Phase 1: Setup and Infrastructure** - pgmock dependency installed and basic setup created
- **TestDatabaseManager** - Created with migration support and connection management  
- **TestDataFactory** - Comprehensive test data generation with faker.js
- **Basic pgmock functionality** - Simple queries and table creation work
- **Migration compatibility** - Fixed vector extension issues for test environment
- **Vitest configuration** - Updated for database testing support

#### ⚠️ Issues Encountered
- **Connection stability**: pgmock has connection termination issues during long migration processes
- **Extension limitations**: No support for PostgreSQL extensions like pgvector (worked around)
- **Performance**: Very slow migration execution (60+ seconds for full schema)
- **Maturity**: pgmock is relatively new and has stability/compatibility issues
- **Complex migrations**: Fails on complex migration chains with foreign keys and indexes

#### ✅ Current Test Status
- **All existing tests pass**: 218 tests passing, 2 skipped
- **Test coverage**: 95+ tests across backend and frontend  
- **Performance**: Existing mock-based tests run in ~49 seconds
- **Reliability**: No flaky or unstable tests
- **Mock quality**: Current mocks provide good test isolation and speed

### Recommendation

**Defer pgmock migration** until the library matures further. The current mock-based testing infrastructure is:
- ✅ Fast and reliable
- ✅ Provides good test coverage
- ✅ Easy to maintain and extend
- ✅ Supports complex scenarios with controlled data

**Alternative approaches to consider:**
1. **Improve existing mocks** - Add more realistic data validation and constraints
2. **Integration test layer** - Use real PostgreSQL for integration tests, keep unit tests with mocks
3. **Database test containers** - Consider testcontainers for more realistic database testing
4. **Wait for pgmock maturity** - Revisit when pgmock has better stability and performance

The current testing infrastructure serves the project well and doesn't require immediate replacement. 