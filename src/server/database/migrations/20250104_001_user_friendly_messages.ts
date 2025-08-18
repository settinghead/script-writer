import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    console.log('[Migration] User-friendly messages system - creating tables and indexes...');

    // Create conversation_messages_display table
    console.log('[Migration] Creating conversation_messages_display table...');
    await db.schema
        .createTable('conversation_messages_display')
        .ifNotExists()
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('conversation_id', 'uuid', (col) => col.notNull().references('conversations.id').onDelete('cascade'))
        .addColumn('raw_message_id', 'uuid', (col) => col.notNull().references('conversation_messages.id').onDelete('cascade'))
        .addColumn('role', 'text', (col) => col.notNull().check(sql`role IN ('user', 'assistant')`))
        .addColumn('content', 'text', (col) => col.notNull())
        .addColumn('display_type', 'text', (col) => col.defaultTo('message').check(sql`display_type IN ('message', 'thinking', 'progress')`))
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`NOW()`))
        .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`NOW()`))
        .execute();

    // Add unique constraint on raw_message_id
    await db.schema
        .alterTable('conversation_messages_display')
        .addUniqueConstraint('unique_raw_message_id', ['raw_message_id'])
        .execute();

    console.log('[Migration] ✅ Created conversation_messages_display table');

    // Create project_current_conversations table
    console.log('[Migration] Creating project_current_conversations table...');
    await db.schema
        .createTable('project_current_conversations')
        .ifNotExists()
        .addColumn('project_id', 'text', (col) => col.primaryKey().references('projects.id').onDelete('cascade'))
        .addColumn('conversation_id', 'uuid', (col) => col.notNull().references('conversations.id'))
        .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`NOW()`))
        .execute();

    console.log('[Migration] ✅ Created project_current_conversations table');

    // Remove status column from conversations table if it exists
    console.log('[Migration] Removing status column from conversations table...');
    try {
        await db.schema
            .alterTable('conversations')
            .dropColumn('status')
            .execute();
        console.log('[Migration] ✅ Removed status column from conversations');
    } catch (error: any) {
        if (error.code === '42703') { // column does not exist
            console.log('[Migration] ✅ Status column does not exist in conversations, skipping...');
        } else {
            console.error('[Migration] ❌ Failed to remove status column:', error.message);
            throw error;
        }
    }

    // Create indexes for performance
    console.log('[Migration] Creating performance indexes...');
    const indexes = [
        { name: 'idx_display_messages_conversation_id', table: 'conversation_messages_display', column: 'conversation_id' },
        { name: 'idx_display_messages_created_at', table: 'conversation_messages_display', column: 'created_at' },
        { name: 'idx_project_current_conversations_updated_at', table: 'project_current_conversations', column: 'updated_at' },
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

    console.log('[Migration] User-friendly messages system migration completed successfully');
}

export async function down(db: Kysely<any>): Promise<void> {
    console.log('[Migration] Rolling back user-friendly messages system...');

    // Remove indexes first
    const indexes = [
        'idx_project_current_conversations_updated_at',
        'idx_display_messages_created_at',
        'idx_display_messages_conversation_id'
    ];

    for (const indexName of indexes) {
        await db.schema.dropIndex(indexName).ifExists().execute();
    }

    // Drop tables
    await db.schema.dropTable('project_current_conversations').ifExists().execute();
    await db.schema.dropTable('conversation_messages_display').ifExists().execute();

    // Re-add status column to conversations (if needed for rollback)
    try {
        await db.schema
            .alterTable('conversations')
            .addColumn('status', 'text', (col) => col.defaultTo('active').check(sql`status IN ('active', 'completed', 'failed')`))
            .execute();
    } catch (error) {
        console.log('[Migration] Status column may already exist, continuing...');
    }

    console.log('[Migration] User-friendly messages system rollback completed');
}