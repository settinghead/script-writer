import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // Enable pgvector extension
    await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);

    // Create particles table
    await db.schema
        .createTable('particles')
        .addColumn('id', 'text', (col) => col.primaryKey())
        .addColumn('jsondoc_id', 'text', (col) =>
            col.notNull().references('jsondocs.id').onDelete('cascade')
        )
        .addColumn('project_id', 'text', (col) => col.notNull())
        .addColumn('path', 'text', (col) => col.notNull())
        .addColumn('type', 'text', (col) => col.notNull())
        .addColumn('title', 'text', (col) => col.notNull())
        .addColumn('content', 'jsonb', (col) => col.notNull())
        .addColumn('content_text', 'text', (col) => col.notNull())
        .addColumn('is_active', 'boolean', (col) => col.defaultTo(true))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
        .execute();

    // Add embedding column with pgvector type (flexible dimensions based on model)
    // Default to 1536 for OpenAI, but can be 1024 for Qwen or other dimensions
    const embeddingDimensions = process.env.EMBEDDING_DIMENSIONS || '1536';
    await sql`ALTER TABLE particles ADD COLUMN embedding vector(${sql.raw(embeddingDimensions)})`.execute(db);

    // Create performance indexes
    await db.schema
        .createIndex('idx_particles_project_active')
        .on('particles')
        .columns(['project_id', 'is_active'])
        .execute();

    await db.schema
        .createIndex('idx_particles_jsondoc')
        .on('particles')
        .column('jsondoc_id')
        .execute();

    await db.schema
        .createIndex('idx_particles_type')
        .on('particles')
        .column('type')
        .execute();

    // Create pgvector index for similarity search
    await sql`CREATE INDEX idx_particles_embedding ON particles USING ivfflat (embedding vector_cosine_ops)`.execute(db);

    // Create trigger for updated_at
    await sql`
        CREATE OR REPLACE FUNCTION update_particles_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `.execute(db);

    await sql`
        CREATE TRIGGER particles_updated_at_trigger
            BEFORE UPDATE ON particles
            FOR EACH ROW EXECUTE FUNCTION update_particles_updated_at();
    `.execute(db);

    // Create trigger for jsondoc change notifications
    await sql`
        CREATE OR REPLACE FUNCTION notify_jsondoc_change()
        RETURNS TRIGGER AS $$
        BEGIN
            PERFORM pg_notify('jsondoc_changed', 
                json_build_object(
                    'jsondoc_id', COALESCE(NEW.id, OLD.id),
                    'project_id', COALESCE(NEW.project_id, OLD.project_id),
                    'operation', TG_OP,
                    'timestamp', extract(epoch from now())
                )::text
            );
            
            RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql;
    `.execute(db);

    await sql`
        CREATE TRIGGER jsondoc_change_trigger
            AFTER INSERT OR UPDATE OR DELETE ON jsondocs
            FOR EACH ROW EXECUTE FUNCTION notify_jsondoc_change();
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop triggers
    await sql`DROP TRIGGER IF EXISTS jsondoc_change_trigger ON jsondocs`.execute(db);
    await sql`DROP FUNCTION IF EXISTS notify_jsondoc_change()`.execute(db);

    await sql`DROP TRIGGER IF EXISTS particles_updated_at_trigger ON particles`.execute(db);
    await sql`DROP FUNCTION IF EXISTS update_particles_updated_at()`.execute(db);

    // Drop table (indexes will be dropped automatically)
    await db.schema.dropTable('particles').execute();
} 