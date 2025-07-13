import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    console.log('Running migration: 20241201_009_add_yjs_tables');

    // Create jsondoc YJS documents table
    await db.schema
        .createTable('jsondoc_yjs_documents')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('jsondoc_id', 'text', (col) => col.notNull())
        .addColumn('project_id', 'text', (col) => col.notNull())
        .addColumn('room_id', 'text', (col) => col.notNull())
        .addColumn('document_state', 'bytea', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute();

    // Create jsondoc YJS awareness table
    await db.schema
        .createTable('jsondoc_yjs_awareness')
        .addColumn('client_id', 'text', (col) => col.notNull())
        .addColumn('jsondoc_id', 'text', (col) => col.notNull())
        .addColumn('project_id', 'text', (col) => col.notNull())
        .addColumn('room_id', 'text', (col) => col.notNull())
        .addColumn('update', 'bytea', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute();

    // Add primary key constraint for awareness table
    await db.schema
        .alterTable('jsondoc_yjs_awareness')
        .addPrimaryKeyConstraint('jsondoc_yjs_awareness_pkey', ['client_id', 'jsondoc_id'])
        .execute();

    // Add foreign key constraints for jsondoc_id
    await db.schema
        .alterTable('jsondoc_yjs_documents')
        .addForeignKeyConstraint('jsondoc_yjs_documents_jsondoc_id_fkey', ['jsondoc_id'], 'jsondocs', ['id'])
        .onDelete('cascade')
        .execute();

    await db.schema
        .alterTable('jsondoc_yjs_awareness')
        .addForeignKeyConstraint('jsondoc_yjs_awareness_jsondoc_id_fkey', ['jsondoc_id'], 'jsondocs', ['id'])
        .onDelete('cascade')
        .execute();

    // Add foreign key constraints for project_id
    await db.schema
        .alterTable('jsondoc_yjs_documents')
        .addForeignKeyConstraint('jsondoc_yjs_documents_project_id_fkey', ['project_id'], 'projects', ['id'])
        .onDelete('cascade')
        .execute();

    await db.schema
        .alterTable('jsondoc_yjs_awareness')
        .addForeignKeyConstraint('jsondoc_yjs_awareness_project_id_fkey', ['project_id'], 'projects', ['id'])
        .onDelete('cascade')
        .execute();

    // Add indexes for performance
    await db.schema
        .createIndex('jsondoc_yjs_documents_jsondoc_id_idx')
        .on('jsondoc_yjs_documents')
        .column('jsondoc_id')
        .execute();

    await db.schema
        .createIndex('jsondoc_yjs_awareness_jsondoc_id_idx')
        .on('jsondoc_yjs_awareness')
        .column('jsondoc_id')
        .execute();

    // Auto-cleanup function for stale awareness (30 seconds)
    await sql`
        CREATE OR REPLACE FUNCTION gc_jsondoc_yjs_awareness_timeouts()
        RETURNS TRIGGER AS $$
        BEGIN
            DELETE FROM jsondoc_yjs_awareness
            WHERE updated_at < (CURRENT_TIMESTAMP - INTERVAL '30 seconds') 
            AND jsondoc_id = NEW.jsondoc_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `.execute(db);

    // Create trigger for auto-cleanup
    await sql`
        CREATE TRIGGER gc_jsondoc_yjs_awareness_trigger
        AFTER INSERT OR UPDATE ON jsondoc_yjs_awareness
        FOR EACH ROW
        EXECUTE FUNCTION gc_jsondoc_yjs_awareness_timeouts();
    `.execute(db);

    console.log('Migration completed: 20241201_009_add_yjs_tables');
}

export async function down(db: Kysely<any>): Promise<void> {
    console.log('Rolling back migration: 20241201_009_add_yjs_tables');

    // Drop trigger and function
    await sql`DROP TRIGGER IF EXISTS gc_jsondoc_yjs_awareness_trigger ON jsondoc_yjs_awareness;`.execute(db);
    await sql`DROP FUNCTION IF EXISTS gc_jsondoc_yjs_awareness_timeouts();`.execute(db);

    // Drop tables
    await db.schema.dropTable('jsondoc_yjs_awareness').ifExists().execute();
    await db.schema.dropTable('jsondoc_yjs_documents').ifExists().execute();

    console.log('Migration rollback completed: 20241201_009_add_yjs_tables');
} 