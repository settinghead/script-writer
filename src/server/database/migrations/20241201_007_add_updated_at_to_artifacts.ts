import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // Add updated_at column to artifacts table
    await db.schema
        .alterTable('artifacts')
        .addColumn('updated_at', 'timestamp', (col) =>
            col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
        )
        .execute();

    console.log('✅ Added updated_at column to artifacts table');
}

export async function down(db: Kysely<any>): Promise<void> {
    // Remove the updated_at column
    await db.schema
        .alterTable('artifacts')
        .dropColumn('updated_at')
        .execute();

    console.log('✅ Removed updated_at column from artifacts table');
} 