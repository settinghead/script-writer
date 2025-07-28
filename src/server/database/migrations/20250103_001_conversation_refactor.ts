import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    console.log('[Migration] Conversation refactor - creating indexes only (tables already exist)...');

    // Create indexes for performance (the main missing piece)
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