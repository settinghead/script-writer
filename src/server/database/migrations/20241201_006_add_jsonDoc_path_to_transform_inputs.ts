import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // Add jsonDoc_path column to transform_inputs table
    await db.schema
        .alterTable('transform_inputs')
        .addColumn('jsonDoc_path', 'text', (col) => col.notNull().defaultTo('$'))
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    // Remove jsonDoc_path column
    await db.schema
        .alterTable('transform_inputs')
        .dropColumn('jsonDoc_path')
        .execute();
} 