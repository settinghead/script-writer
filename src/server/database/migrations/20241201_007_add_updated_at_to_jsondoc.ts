import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // Add updated_at column to jsondocs table
    await db.schema
        .alterTable('jsondocs')
        .addColumn('updated_at', 'timestamp', (col) =>
            col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
        )
        .execute();

    console.log('✅ Added updated_at column to jsondocs table');
}

export async function down(db: Kysely<any>): Promise<void> {
    // Remove the updated_at column
    await db.schema
        .alterTable('jsondocs')
        .dropColumn('updated_at')
        .execute();

    console.log('✅ Removed updated_at column from jsondocs table');
} 