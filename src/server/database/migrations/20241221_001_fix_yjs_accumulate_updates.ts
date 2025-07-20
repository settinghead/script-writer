import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    console.log('Running migration: 20241221_001_fix_yjs_accumulate_updates');

    // Drop the incorrect unique constraint that prevents YJS from accumulating updates
    // YJS is designed to store multiple incremental updates per jsondoc, not just one
    await db.schema
        .alterTable('jsondoc_yjs_documents')
        .dropConstraint('jsondoc_yjs_documents_jsondoc_id_unique')
        .execute();

    console.log('✅ Removed unique constraint - YJS can now accumulate multiple updates per jsondoc');
    console.log('Migration completed: 20241221_001_fix_yjs_accumulate_updates');
}

export async function down(db: Kysely<any>): Promise<void> {
    console.log('Rolling back migration: 20241221_001_fix_yjs_accumulate_updates');

    // Clean up duplicates before re-adding the constraint
    await sql`
        DELETE FROM jsondoc_yjs_documents 
        WHERE id NOT IN (
            SELECT DISTINCT ON (jsondoc_id) id 
            FROM jsondoc_yjs_documents 
            ORDER BY jsondoc_id, updated_at DESC
        )
    `.execute(db);

    // Re-add the unique constraint (though this is wrong for YJS)
    await db.schema
        .alterTable('jsondoc_yjs_documents')
        .addUniqueConstraint('jsondoc_yjs_documents_jsondoc_id_unique', ['jsondoc_id'])
        .execute();

    console.log('Migration rollback completed: 20241221_001_fix_yjs_accumulate_updates');
} 