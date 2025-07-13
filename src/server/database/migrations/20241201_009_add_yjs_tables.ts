import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    console.log('Running migration: 20241201_009_add_yjs_tables');

    // Create jsonDoc YJS documents table
    await db.schema
        .createTable('jsonDoc_yjs_documents')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('jsonDoc_id', 'text', (col) => col.notNull())
        .addColumn('project_id', 'text', (col) => col.notNull())
        .addColumn('room_id', 'text', (col) => col.notNull())
        .addColumn('document_state', 'bytea', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute();

    // Create jsonDoc YJS awareness table
    await db.schema
        .createTable('jsonDoc_yjs_awareness')
        .addColumn('client_id', 'text', (col) => col.notNull())
        .addColumn('jsonDoc_id', 'text', (col) => col.notNull())
        .addColumn('project_id', 'text', (col) => col.notNull())
        .addColumn('room_id', 'text', (col) => col.notNull())
        .addColumn('update', 'bytea', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute();

    // Add primary key constraint for awareness table
    await db.schema
        .alterTable('jsonDoc_yjs_awareness')
        .addPrimaryKeyConstraint('jsonDoc_yjs_awareness_pkey', ['client_id', 'jsonDoc_id'])
        .execute();

    // Add foreign key constraints for jsonDoc_id
    await db.schema
        .alterTable('jsonDoc_yjs_documents')
        .addForeignKeyConstraint('jsonDoc_yjs_documents_jsonDoc_id_fkey', ['jsonDoc_id'], 'jsonDocs', ['id'])
        .onDelete('cascade')
        .execute();

    await db.schema
        .alterTable('jsonDoc_yjs_awareness')
        .addForeignKeyConstraint('jsonDoc_yjs_awareness_jsonDoc_id_fkey', ['jsonDoc_id'], 'jsonDocs', ['id'])
        .onDelete('cascade')
        .execute();

    // Add foreign key constraints for project_id
    await db.schema
        .alterTable('jsonDoc_yjs_documents')
        .addForeignKeyConstraint('jsonDoc_yjs_documents_project_id_fkey', ['project_id'], 'projects', ['id'])
        .onDelete('cascade')
        .execute();

    await db.schema
        .alterTable('jsonDoc_yjs_awareness')
        .addForeignKeyConstraint('jsonDoc_yjs_awareness_project_id_fkey', ['project_id'], 'projects', ['id'])
        .onDelete('cascade')
        .execute();

    // Add indexes for performance
    await db.schema
        .createIndex('jsonDoc_yjs_documents_jsonDoc_id_idx')
        .on('jsonDoc_yjs_documents')
        .column('jsonDoc_id')
        .execute();

    await db.schema
        .createIndex('jsonDoc_yjs_awareness_jsonDoc_id_idx')
        .on('jsonDoc_yjs_awareness')
        .column('jsonDoc_id')
        .execute();

    // Auto-cleanup function for stale awareness (30 seconds)
    await sql`
        CREATE OR REPLACE FUNCTION gc_jsonDoc_yjs_awareness_timeouts()
        RETURNS TRIGGER AS $$
        BEGIN
            DELETE FROM jsonDoc_yjs_awareness
            WHERE updated_at < (CURRENT_TIMESTAMP - INTERVAL '30 seconds') 
            AND jsonDoc_id = NEW.jsonDoc_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `.execute(db);

    // Create trigger for auto-cleanup
    await sql`
        CREATE TRIGGER gc_jsonDoc_yjs_awareness_trigger
        AFTER INSERT OR UPDATE ON jsonDoc_yjs_awareness
        FOR EACH ROW
        EXECUTE FUNCTION gc_jsonDoc_yjs_awareness_timeouts();
    `.execute(db);

    console.log('Migration completed: 20241201_009_add_yjs_tables');
}

export async function down(db: Kysely<any>): Promise<void> {
    console.log('Rolling back migration: 20241201_009_add_yjs_tables');

    // Drop trigger and function
    await sql`DROP TRIGGER IF EXISTS gc_jsonDoc_yjs_awareness_trigger ON jsonDoc_yjs_awareness;`.execute(db);
    await sql`DROP FUNCTION IF EXISTS gc_jsonDoc_yjs_awareness_timeouts();`.execute(db);

    // Drop tables
    await db.schema.dropTable('jsonDoc_yjs_awareness').ifExists().execute();
    await db.schema.dropTable('jsonDoc_yjs_documents').ifExists().execute();

    console.log('Migration rollback completed: 20241201_009_add_yjs_tables');
} 