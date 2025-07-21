import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // Add tool_call_id column to transforms table
    await db.schema
        .alterTable('transforms')
        .addColumn('tool_call_id', 'varchar(255)')
        .execute();

    // Create index on tool_call_id for efficient lookups
    await db.schema
        .createIndex('idx_transforms_tool_call_id')
        .on('transforms')
        .column('tool_call_id')
        .execute();

    // Create chat_conversations table for conversation history storage
    await db.schema
        .createTable('chat_conversations')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('gen_random_uuid')))
        .addColumn('project_id', 'text', (col) => col.notNull().references('projects.id').onDelete('cascade'))
        .addColumn('tool_name', 'text', (col) => col.notNull())
        .addColumn('tool_call_id', 'varchar(255)')
        .addColumn('messages', 'jsonb', (col) => col.notNull())
        .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
        .execute();

    // Create indexes for efficient queries
    await db.schema
        .createIndex('idx_chat_conversations_project_id')
        .on('chat_conversations')
        .column('project_id')
        .execute();

    await db.schema
        .createIndex('idx_chat_conversations_tool_name')
        .on('chat_conversations')
        .column('tool_name')
        .execute();

    await db.schema
        .createIndex('idx_chat_conversations_tool_call_id')
        .on('chat_conversations')
        .column('tool_call_id')
        .execute();

    // Create compound index for efficient conversation lookups
    await db.schema
        .createIndex('idx_chat_conversations_project_tool')
        .on('chat_conversations')
        .columns(['project_id', 'tool_name', 'created_at'])
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop chat_conversations table
    await db.schema.dropTable('chat_conversations').execute();

    // Drop index on transforms.tool_call_id
    await db.schema.dropIndex('idx_transforms_tool_call_id').execute();

    // Remove tool_call_id column from transforms table
    await db.schema
        .alterTable('transforms')
        .dropColumn('tool_call_id')
        .execute();
} 