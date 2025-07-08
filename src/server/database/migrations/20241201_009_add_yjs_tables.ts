import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // YJS document storage table
    await db.schema
        .createTable('artifact_yjs_documents')
        .addColumn('room_id', 'text', (col) => col.primaryKey())
        .addColumn('project_id', 'text', (col) => col.notNull())
        .addColumn('artifact_id', 'text', (col) => col.notNull())
        .addColumn('document_state', 'bytea', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo('now()').notNull())
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo('now()').notNull())
        .execute();

    // YJS awareness (cursor positions, user presence) table
    await db.schema
        .createTable('artifact_yjs_awareness')
        .addColumn('client_id', 'text', (col) => col.notNull())
        .addColumn('room_id', 'text', (col) => col.notNull())
        .addColumn('project_id', 'text', (col) => col.notNull())
        .addColumn('update', 'bytea', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo('now()').notNull())
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo('now()').notNull())
        .execute();

    // Add indexes for performance
    await db.schema
        .createIndex('artifact_yjs_documents_project_id_idx')
        .on('artifact_yjs_documents')
        .column('project_id')
        .execute();

    await db.schema
        .createIndex('artifact_yjs_documents_artifact_id_idx')
        .on('artifact_yjs_documents')
        .column('artifact_id')
        .execute();

    await db.schema
        .createIndex('artifact_yjs_awareness_room_id_idx')
        .on('artifact_yjs_awareness')
        .column('room_id')
        .execute();

    await db.schema
        .createIndex('artifact_yjs_awareness_project_id_idx')
        .on('artifact_yjs_awareness')
        .column('project_id')
        .execute();

    // Add primary key constraint for awareness table
    await db.schema
        .alterTable('artifact_yjs_awareness')
        .addPrimaryKeyConstraint('artifact_yjs_awareness_pkey', ['client_id', 'room_id'])
        .execute();

    // Add foreign key constraints
    await db.schema
        .alterTable('artifact_yjs_documents')
        .addForeignKeyConstraint(
            'artifact_yjs_documents_project_id_fkey',
            ['project_id'],
            'projects',
            ['id']
        )
        .execute();

    await db.schema
        .alterTable('artifact_yjs_documents')
        .addForeignKeyConstraint(
            'artifact_yjs_documents_artifact_id_fkey',
            ['artifact_id'],
            'artifacts',
            ['id']
        )
        .execute();

    await db.schema
        .alterTable('artifact_yjs_awareness')
        .addForeignKeyConstraint(
            'artifact_yjs_awareness_project_id_fkey',
            ['project_id'],
            'projects',
            ['id']
        )
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable('artifact_yjs_awareness').execute();
    await db.schema.dropTable('artifact_yjs_documents').execute();
} 