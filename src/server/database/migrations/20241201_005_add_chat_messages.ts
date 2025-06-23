import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // Raw messages table (backend only, not exposed via Electric)
    await db.schema
        .createTable('chat_messages_raw')
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('project_id', 'text', (col) =>
            col.notNull().references('projects.id').onDelete('cascade')
        )
        .addColumn('role', 'text', (col) =>
            col.notNull().check(sql`role IN ('user', 'assistant', 'tool', 'system')`)
        )
        .addColumn('content', 'text', (col) => col.notNull())
        .addColumn('tool_name', 'text')
        .addColumn('tool_parameters', 'jsonb')
        .addColumn('tool_result', 'jsonb')
        .addColumn('metadata', 'jsonb')
        .addColumn('created_at', 'timestamp', (col) =>
            col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
        )
        .addColumn('updated_at', 'timestamp', (col) =>
            col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
        )
        .execute();

    // Display messages table (Electric SQL synced, user-facing)
    await db.schema
        .createTable('chat_messages_display')
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('project_id', 'text', (col) =>
            col.notNull().references('projects.id').onDelete('cascade')
        )
        .addColumn('role', 'text', (col) =>
            col.notNull().check(sql`role IN ('user', 'assistant', 'tool')`)
        )
        .addColumn('content', 'text', (col) => col.notNull())
        .addColumn('display_type', 'text', (col) =>
            col.defaultTo('message').check(sql`display_type IN ('message', 'tool_summary', 'thinking')`)
        )
        .addColumn('status', 'text', (col) =>
            col.defaultTo('completed').check(sql`status IN ('pending', 'streaming', 'completed', 'failed')`)
        )
        .addColumn('raw_message_id', 'text', (col) =>
            col.references('chat_messages_raw.id').onDelete('cascade')
        )
        .addColumn('created_at', 'timestamp', (col) =>
            col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
        )
        .addColumn('updated_at', 'timestamp', (col) =>
            col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
        )
        .execute();

    // Create indexes for better performance
    await db.schema
        .createIndex('chat_messages_raw_project_id_idx')
        .on('chat_messages_raw')
        .column('project_id')
        .execute();

    await db.schema
        .createIndex('chat_messages_raw_created_at_idx')
        .on('chat_messages_raw')
        .column('created_at')
        .execute();

    await db.schema
        .createIndex('chat_messages_display_project_id_idx')
        .on('chat_messages_display')
        .column('project_id')
        .execute();

    await db.schema
        .createIndex('chat_messages_display_created_at_idx')
        .on('chat_messages_display')
        .column('created_at')
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable('chat_messages_display').execute();
    await db.schema.dropTable('chat_messages_raw').execute();
} 