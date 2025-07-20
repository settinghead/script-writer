import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    console.log('Running migration: 20241201_015_fix_yjs_unique_constraint');

    // First, clean up any duplicate YJS documents for the same jsondoc_id
    // Keep only the most recent one for each jsondoc_id
    await sql`
        DELETE FROM jsondoc_yjs_documents 
        WHERE id NOT IN (
            SELECT DISTINCT ON (jsondoc_id) id 
            FROM jsondoc_yjs_documents 
            ORDER BY jsondoc_id, updated_at DESC
        )
    `.execute(db);

    // Add unique constraint on jsondoc_id to prevent multiple YJS documents per jsondoc
    await db.schema
        .alterTable('jsondoc_yjs_documents')
        .addUniqueConstraint('jsondoc_yjs_documents_jsondoc_id_unique', ['jsondoc_id'])
        .execute();

    console.log('Migration completed: 20241201_015_fix_yjs_unique_constraint');
}

export async function down(db: Kysely<any>): Promise<void> {
    console.log('Rolling back migration: 20241201_015_fix_yjs_unique_constraint');

    // Drop the unique constraint
    await db.schema
        .alterTable('jsondoc_yjs_documents')
        .dropConstraint('jsondoc_yjs_documents_jsondoc_id_unique')
        .execute();

    console.log('Migration rollback completed: 20241201_015_fix_yjs_unique_constraint');
} 