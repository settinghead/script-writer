import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    console.log('[Migration] Conversation refactor - creating tables and indexes...');

    // Create conversations table
    console.log('[Migration] Creating conversations table...');
    await db.schema
        .createTable('conversations')
        .ifNotExists()
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('project_id', 'text', (col) => col.notNull().references('projects.id').onDelete('cascade'))
        .addColumn('type', 'text', (col) => col.notNull().check(sql`type IN ('agent', 'tool')`))
        .addColumn('status', 'text', (col) => col.notNull().defaultTo('active').check(sql`status IN ('active', 'completed', 'failed')`))
        .addColumn('metadata', 'jsonb', (col) => col.defaultTo('{}'))
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`NOW()`))
        .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`NOW()`))
        .execute();
    console.log('[Migration] ✅ Created conversations table');

    // Create conversation_messages table
    console.log('[Migration] Creating conversation_messages table...');
    await db.schema
        .createTable('conversation_messages')
        .ifNotExists()
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('conversation_id', 'uuid', (col) => col.notNull().references('conversations.id').onDelete('cascade'))
        .addColumn('role', 'text', (col) => col.notNull().check(sql`role IN ('system', 'user', 'assistant', 'tool')`))
        .addColumn('content', 'text', (col) => col.notNull())
        // Tool-specific fields
        .addColumn('tool_name', 'text')
        .addColumn('tool_call_id', 'text')
        .addColumn('tool_parameters', 'jsonb')
        .addColumn('tool_result', 'jsonb')
        // LLM parameters
        .addColumn('model_name', 'text')
        .addColumn('temperature', 'numeric')
        .addColumn('top_p', 'numeric')
        .addColumn('max_tokens', 'integer')
        .addColumn('seed', 'integer')
        // Caching support
        .addColumn('content_hash', 'text')
        .addColumn('cache_hit', 'boolean', (col) => col.defaultTo(false))
        .addColumn('cached_tokens', 'integer', (col) => col.defaultTo(0))
        // Status tracking
        .addColumn('status', 'text', (col) => col.defaultTo('completed').check(sql`status IN ('streaming', 'completed', 'failed')`))
        .addColumn('error_message', 'text')
        // Metadata
        .addColumn('metadata', 'jsonb', (col) => col.defaultTo('{}'))
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`NOW()`))
        .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`NOW()`))
        .execute();
    console.log('[Migration] ✅ Created conversation_messages table');

    // Add conversation tracking columns to transforms table
    console.log('[Migration] Adding conversation tracking columns to transforms table...');
    try {
        await db.schema
            .alterTable('transforms')
            .addColumn('conversation_id', 'uuid', (col) => col.references('conversations.id'))
            .execute();
        console.log('[Migration] ✅ Added conversation_id column to transforms');
    } catch (error: any) {
        if (error.code === '42701') { // column already exists
            console.log('[Migration] ✅ conversation_id column already exists in transforms');
        } else {
            console.error('[Migration] ❌ Failed to add conversation_id column:', error.message);
            throw error;
        }
    }

    try {
        await db.schema
            .alterTable('transforms')
            .addColumn('trigger_message_id', 'uuid', (col) => col.references('conversation_messages.id'))
            .execute();
        console.log('[Migration] ✅ Added trigger_message_id column to transforms');
    } catch (error: any) {
        if (error.code === '42701') { // column already exists
            console.log('[Migration] ✅ trigger_message_id column already exists in transforms');
        } else {
            console.error('[Migration] ❌ Failed to add trigger_message_id column:', error.message);
            throw error;
        }
    }

    // Create indexes for performance
    console.log('[Migration] Creating performance indexes...');
    const indexes = [
        // Conversations indexes
        { name: 'idx_conversations_project_id', table: 'conversations', column: 'project_id' },
        { name: 'idx_conversations_type', table: 'conversations', column: 'type' },
        { name: 'idx_conversations_created_at', table: 'conversations', column: 'created_at' },

        // Conversation messages indexes
        { name: 'idx_messages_conversation_id', table: 'conversation_messages', column: 'conversation_id' },
        { name: 'idx_messages_role', table: 'conversation_messages', column: 'role' },
        { name: 'idx_messages_tool_name', table: 'conversation_messages', column: 'tool_name' },
        { name: 'idx_messages_content_hash', table: 'conversation_messages', column: 'content_hash' },
        { name: 'idx_messages_created_at', table: 'conversation_messages', column: 'created_at' },

        // Transform conversation tracking indexes
        { name: 'idx_transforms_conversation_id', table: 'transforms', column: 'conversation_id' },
        { name: 'idx_transforms_trigger_message_id', table: 'transforms', column: 'trigger_message_id' },
    ];

    for (const index of indexes) {
        try {
            console.log(`[Migration] Creating index ${index.name}...`);
            await db.schema
                .createIndex(index.name)
                .ifNotExists()
                .on(index.table)
                .column(index.column)
                .execute();
            console.log(`[Migration] ✅ Created index ${index.name}`);
        } catch (error: any) {
            if (error.code === '42P07') { // relation already exists
                console.log(`[Migration] ✅ Index ${index.name} already exists, skipping...`);
            } else {
                console.error(`[Migration] ❌ Failed to create index ${index.name}: ${error.message}`);
                throw error;
            }
        }
    }

    console.log('[Migration] Conversation refactor migration completed successfully');
}

export async function down(db: Kysely<any>): Promise<void> {
    console.log('[Migration] Rolling back conversation refactor...');

    // Remove indexes first
    const indexes = [
        'idx_transforms_trigger_message_id',
        'idx_transforms_conversation_id',
        'idx_messages_created_at',
        'idx_messages_content_hash',
        'idx_messages_tool_name',
        'idx_messages_role',
        'idx_messages_conversation_id',
        'idx_conversations_created_at',
        'idx_conversations_type',
        'idx_conversations_project_id'
    ];

    for (const indexName of indexes) {
        await db.schema.dropIndex(indexName).ifExists().execute();
    }

    // Remove columns from transforms
    await db.schema
        .alterTable('transforms')
        .dropColumn('trigger_message_id')
        .execute();

    await db.schema
        .alterTable('transforms')
        .dropColumn('conversation_id')
        .execute();

    // Drop new tables
    await db.schema.dropTable('conversation_messages').execute();
    await db.schema.dropTable('conversations').execute();

    // Note: We don't recreate the old tables since this is a destructive migration
    console.log('[Migration] Conversation refactor rollback completed');
} 