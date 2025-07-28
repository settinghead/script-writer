import { Kysely} from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Add missing columns to transforms table
  await db.schema
    .alterTable('transforms')
    .addColumn('streaming_status', 'text')
    .addColumn('progress_percentage', 'numeric')
    .addColumn('error_message', 'text')
    .execute();

  console.log('✅ Added streaming_status, progress_percentage, and error_message columns to transforms table');
}

export async function down(db: Kysely<any>): Promise<void> {
  // Remove the added columns
  await db.schema
    .alterTable('transforms')
    .dropColumn('streaming_status')
    .dropColumn('progress_percentage')
    .dropColumn('error_message')
    .execute();

  console.log('✅ Removed streaming_status, progress_percentage, and error_message columns from transforms table');
} 