import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // Add content_hash column
    await db.schema
        .alterTable('particles')
        .addColumn('content_hash', 'text')
        .execute();

    // Add unique constraint on (jsondoc_id, path)
    await db.schema
        .alterTable('particles')
        .addUniqueConstraint('unique_particle_per_jsondoc_path', ['jsondoc_id', 'path'])
        .execute();

    console.log('✅ Added content_hash column and unique constraint to particles table');
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop unique constraint
    await db.schema
        .alterTable('particles')
        .dropConstraint('unique_particle_per_jsondoc_path')
        .execute();

    // Drop content_hash column
    await db.schema
        .alterTable('particles')
        .dropColumn('content_hash')
        .execute();

    console.log('✅ Rolled back content_hash column and unique constraint from particles table');
} 