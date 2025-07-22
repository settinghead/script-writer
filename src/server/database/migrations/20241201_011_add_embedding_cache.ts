import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // Create embedding_cache table
    await db.schema
        .createTable('embedding_cache')
        .addColumn('content_hash', 'varchar(64)', (col) => col.primaryKey())
        .addColumn('content_text', 'text', (col) => col.notNull())
        .addColumn('model_name', 'varchar(255)', (col) => col.notNull())
        .addColumn('provider', 'varchar(100)', (col) => col.notNull())
        .addColumn('dimensions', 'integer', (col) => col.notNull().defaultTo(1024))
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
        .addColumn('accessed_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
        .addColumn('access_count', 'integer', (col) => col.defaultTo(1).notNull())
        .execute();

    // Add embedding column with pgvector type (flexible dimensions based on model)
    // In test environment, use a simple array column instead of vector type
    if (process.env.NODE_ENV === 'test') {
        // Use a simple array column for testing
        await sql`ALTER TABLE embedding_cache ADD COLUMN embedding float[] NOT NULL`.execute(db);
    } else {
        // Use pgvector in production
        const embeddingDimensions = process.env.EMBEDDING_DIMENSIONS;
        if (!embeddingDimensions) {
            throw new Error('EMBEDDING_DIMENSIONS is not set');
        }
        const embeddingDimensionsInt = parseInt(embeddingDimensions);
        await sql`ALTER TABLE embedding_cache ADD COLUMN embedding vector(${sql.raw(`${embeddingDimensionsInt}`)}) NOT NULL`.execute(db);
    }

    // Create index on model_name and provider for efficient lookups
    await db.schema
        .createIndex('idx_embedding_cache_model_provider')
        .on('embedding_cache')
        .columns(['model_name', 'provider'])
        .execute();

    // Create index on created_at for cache cleanup operations
    await db.schema
        .createIndex('idx_embedding_cache_created_at')
        .on('embedding_cache')
        .columns(['created_at'])
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable('embedding_cache').execute();
} 