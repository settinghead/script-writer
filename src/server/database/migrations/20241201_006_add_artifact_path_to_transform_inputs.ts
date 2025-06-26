import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // Add artifact_path column to transform_inputs table
    await db.schema
        .alterTable('transform_inputs')
        .addColumn('artifact_path', 'text', (col) => col.notNull().defaultTo('$'))
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    // Remove artifact_path column
    await db.schema
        .alterTable('transform_inputs')
        .dropColumn('artifact_path')
        .execute();
} 