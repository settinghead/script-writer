import { PostgresMock } from 'pgmock';
import { Kysely, PostgresDialect } from 'kysely';
import { DB } from '../../server/database/types';
import { Client } from 'pg';

// Import all migration files
import { up as migration001 } from '../../server/database/migrations/20241201_001_initial_schema';
import { up as migration002 } from '../../server/database/migrations/20241201_002_add_transform_columns';
import { up as migration003 } from '../../server/database/migrations/20241201_003_add_project_id_to_transform_tables';
import { up as migration004 } from '../../server/database/migrations/20241201_004_add_jsondoc_streaming_fields';
import { up as migration005 } from '../../server/database/migrations/20241201_005_add_chat_messages';
import { up as migration006 } from '../../server/database/migrations/20241201_006_add_jsondoc_path_to_transform_inputs';
import { up as migration007 } from '../../server/database/migrations/20241201_007_add_updated_at_to_jsondoc';
import { up as migration009 } from '../../server/database/migrations/20241201_009_add_yjs_tables';
import { up as migration010 } from '../../server/database/migrations/20241201_010_add_particles_table';
import { up as migration011 } from '../../server/database/migrations/20241201_011_add_embedding_cache';
import { up as migration202001 } from '../../server/database/migrations/20241202_001_add_patch_transform_types';
import { up as migration202002 } from '../../server/database/migrations/20241202_002_fix_yjs_unique_constraint';
import { up as migration221001 } from '../../server/database/migrations/20241221_001_fix_yjs_accumulate_updates';
import { up as migration222001 } from '../../server/database/migrations/20241222_001_add_context_caching_support';
import { up as migration010101 } from '../../server/database/migrations/20250101_001_add_content_hash_to_particles';

export class TestDatabaseManager {
    private pgMock: PostgresMock | null = null;
    private db: Kysely<DB> | null = null;
    private client: Client | null = null;

    async setup(): Promise<Kysely<DB>> {
        if (this.db) {
            return this.db;
        }

        try {
            // Create PostgresMock instance
            this.pgMock = await PostgresMock.create();

            // Get the node-postgres configuration
            const pgConfig = this.pgMock.getNodePostgresConfig();

            // Create a single client connection to avoid pgmock pool limitations
            this.client = new Client(pgConfig);
            await this.client.connect();

            // Create a proper proxy wrapper that forwards all methods and adds release
            const clientWrapper = new Proxy(this.client, {
                get(target, prop) {
                    if (prop === 'release') {
                        return () => { }; // Add the release method that Kysely expects
                    }
                    const value = (target as any)[prop];
                    return typeof value === 'function' ? value.bind(target) : value;
                }
            });

            // Create Kysely instance with a simple pool wrapper
            this.db = new Kysely<DB>({
                dialect: new PostgresDialect({
                    pool: {
                        connect: async () => clientWrapper,
                        end: async () => { }, // Don't end client here, we'll handle it in teardown
                        on: () => { },
                        removeListener: () => { },
                        totalCount: 1,
                        idleCount: 0,
                        waitingCount: 0
                    } as any
                })
            });

            // Run all migrations to set up the schema
            await this.runMigrations();

            return this.db;
        } catch (error) {
            console.error('Failed to setup test database:', error);
            await this.teardown();
            throw error;
        }
    }

    async teardown(): Promise<void> {
        try {
            if (this.db) {
                await this.db.destroy();
                this.db = null;
            }

            if (this.client) {
                await this.client.end();
                this.client = null;
            }

            if (this.pgMock) {
                this.pgMock.destroy();
                this.pgMock = null;
            }
        } catch (error) {
            console.warn('Warning during teardown:', error);
            // Continue cleanup even if there are errors
            this.db = null;
            this.client = null;
            this.pgMock = null;
        }
    }

    async reset(): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized. Call setup() first.');
        }

        // Clear all data from all tables (in reverse dependency order)
        const tables = [
            'jsondoc_yjs_awareness',
            'jsondoc_yjs_documents',
            'chat_conversations',
            'chat_messages_display',
            'chat_messages_raw',
            'transform_outputs',
            'transform_inputs',
            'human_transforms',
            'transforms',
            'particles',
            'embedding_cache',
            'jsondocs',
            'projects_users',
            'user_sessions',
            'auth_providers',
            'projects',
            'users'
        ];

        for (const table of tables) {
            try {
                await this.db.deleteFrom(table as any).execute();
            } catch (error) {
                // Some tables might not exist in all test scenarios, continue
                console.warn(`Warning: Could not clear table ${table}:`, error);
            }
        }
    }

    getDatabase(): Kysely<DB> {
        if (!this.db) {
            throw new Error('Database not initialized. Call setup() first.');
        }
        return this.db;
    }

    private async runMigrations(): Promise<void> {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        console.log('Running migrations for test database...');

        // Run migrations in chronological order
        const migrations = [
            { name: '20241201_001_initial_schema', up: migration001 },
            { name: '20241201_002_add_transform_columns', up: migration002 },
            { name: '20241201_003_add_project_id_to_transform_tables', up: migration003 },
            { name: '20241201_004_add_jsondoc_streaming_fields', up: migration004 },
            { name: '20241201_005_add_chat_messages', up: migration005 },
            { name: '20241201_006_add_jsondoc_path_to_transform_inputs', up: migration006 },
            { name: '20241201_007_add_updated_at_to_jsondoc', up: migration007 },
            { name: '20241201_009_add_yjs_tables', up: migration009 },
            { name: '20241201_010_add_particles_table', up: migration010 },
            { name: '20241201_011_add_embedding_cache', up: migration011 },
            { name: '20241202_001_add_patch_transform_types', up: migration202001 },
            { name: '20241202_002_fix_yjs_unique_constraint', up: migration202002 },
            { name: '20241221_001_fix_yjs_accumulate_updates', up: migration221001 },
            { name: '20241222_001_add_context_caching_support', up: migration222001 },
            { name: '20250101_001_add_content_hash_to_particles', up: migration010101 }
        ];

        for (const migration of migrations) {
            try {
                console.log(`  Running migration: ${migration.name}`);
                await migration.up(this.db);
            } catch (error) {
                console.error(`Failed to run migration ${migration.name}:`, error);
                throw error;
            }
        }

        console.log('All migrations completed successfully');
    }
}

// Singleton instance for tests
let testDbManager: TestDatabaseManager | null = null;

export async function getTestDatabase(): Promise<Kysely<DB>> {
    if (!testDbManager) {
        testDbManager = new TestDatabaseManager();
    }
    return await testDbManager.setup();
}

export async function resetTestDatabase(): Promise<void> {
    if (testDbManager) {
        await testDbManager.reset();
    }
}

export async function teardownTestDatabase(): Promise<void> {
    if (testDbManager) {
        await testDbManager.teardown();
        testDbManager = null;
    }
} 