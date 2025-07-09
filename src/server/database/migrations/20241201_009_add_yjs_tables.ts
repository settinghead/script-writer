import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    console.log('Running migration: 20241201_009_add_yjs_tables');

    // Create artifact YJS documents table
    await db.schema
        .createTable('artifact_yjs_documents')
        .addColumn('id', 'serial', (col) => col.primaryKey())
        .addColumn('artifact_id', 'text', (col) => col.notNull())
        .addColumn('room_id', 'text', (col) => col.notNull())
        .addColumn('update', 'bytea', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute();

    // Create artifact YJS awareness table
    await db.schema
        .createTable('artifact_yjs_awareness')
        .addColumn('client_id', 'text', (col) => col.notNull())
        .addColumn('artifact_id', 'text', (col) => col.notNull())
        .addColumn('room_id', 'text', (col) => col.notNull())
        .addColumn('update', 'bytea', (col) => col.notNull())
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute();

    // Add primary key constraint for awareness table
    await db.schema
        .alterTable('artifact_yjs_awareness')
        .addPrimaryKeyConstraint('artifact_yjs_awareness_pkey', ['client_id', 'artifact_id'])
        .execute();

    // Add foreign key constraints
    await db.schema
        .alterTable('artifact_yjs_documents')
        .addForeignKeyConstraint('artifact_yjs_documents_artifact_id_fkey', ['artifact_id'], 'artifacts', ['id'])
        .onDelete('cascade')
        .execute();

    await db.schema
        .alterTable('artifact_yjs_awareness')
        .addForeignKeyConstraint('artifact_yjs_awareness_artifact_id_fkey', ['artifact_id'], 'artifacts', ['id'])
        .onDelete('cascade')
        .execute();

    // Add indexes for performance
    await db.schema
        .createIndex('artifact_yjs_documents_artifact_id_idx')
        .on('artifact_yjs_documents')
        .column('artifact_id')
        .execute();

    await db.schema
        .createIndex('artifact_yjs_awareness_artifact_id_idx')
        .on('artifact_yjs_awareness')
        .column('artifact_id')
        .execute();

    // Auto-cleanup function for stale awareness (30 seconds)
    await sql`
        CREATE OR REPLACE FUNCTION gc_artifact_yjs_awareness_timeouts()
        RETURNS TRIGGER AS $$
        BEGIN
            DELETE FROM artifact_yjs_awareness
            WHERE updated_at < (CURRENT_TIMESTAMP - INTERVAL '30 seconds') 
            AND artifact_id = NEW.artifact_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `.execute(db);

    // Create trigger for auto-cleanup
    await sql`
        CREATE TRIGGER gc_artifact_yjs_awareness_trigger
        AFTER INSERT OR UPDATE ON artifact_yjs_awareness
        FOR EACH ROW
        EXECUTE FUNCTION gc_artifact_yjs_awareness_timeouts();
    `.execute(db);

    console.log('Migration completed: 20241201_009_add_yjs_tables');
}

export async function down(db: Kysely<any>): Promise<void> {
    console.log('Rolling back migration: 20241201_009_add_yjs_tables');

    // Drop trigger and function
    await sql`DROP TRIGGER IF EXISTS gc_artifact_yjs_awareness_trigger ON artifact_yjs_awareness;`.execute(db);
    await sql`DROP FUNCTION IF EXISTS gc_artifact_yjs_awareness_timeouts();`.execute(db);

    // Drop tables
    await db.schema.dropTable('artifact_yjs_awareness').ifExists().execute();
    await db.schema.dropTable('artifact_yjs_documents').ifExists().execute();

    console.log('Migration rollback completed: 20241201_009_add_yjs_tables');
} 