import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // Add streaming status to jsondocs table
    await db.schema
        .alterTable('jsondocs')
        .addColumn('streaming_status', 'text', (col) =>
            col.defaultTo('completed').check(sql`streaming_status IN ('streaming', 'completed', 'failed', 'cancelled')`)
        )
        .execute();

    console.log('✅ Added streaming_status column to jsondocs table');
}

export async function down(db: Kysely<any>): Promise<void> {
    // Remove the streaming status column
    await db.schema
        .alterTable('jsondocs')
        .dropColumn('streaming_status')
        .execute();

    console.log('✅ Removed streaming_status column from jsondocs table');
} 