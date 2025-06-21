import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // Add streaming status to artifacts table
    await db.schema
        .alterTable('artifacts')
        .addColumn('streaming_status', 'text', (col) =>
            col.defaultTo('completed').check(sql`streaming_status IN ('streaming', 'completed', 'failed', 'cancelled')`)
        )
        .execute();

    console.log('✅ Added streaming_status column to artifacts table');
}

export async function down(db: Kysely<any>): Promise<void> {
    // Remove the streaming status column
    await db.schema
        .alterTable('artifacts')
        .dropColumn('streaming_status')
        .execute();

    console.log('✅ Removed streaming_status column from artifacts table');
} 