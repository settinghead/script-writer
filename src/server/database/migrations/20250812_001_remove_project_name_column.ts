import { Kysely, sql } from 'kysely'

// Remove redundant name column from projects table, keeping only title
export async function up(db: Kysely<any>): Promise<void> {
  console.log('🔄 Starting migration to remove project name column...');

  // First, ensure all projects have a title (copy from name where title is null)
  await sql`
    UPDATE projects 
    SET title = name 
    WHERE title IS NULL OR title = ''
  `.execute(db);

  console.log('✅ Copied name values to title where needed');

  // Make title column NOT NULL
  await db.schema
    .alterTable('projects')
    .alterColumn('title', (col) => col.setNotNull())
    .execute();

  console.log('✅ Made title column NOT NULL');

  // Drop the name column
  await db.schema
    .alterTable('projects')
    .dropColumn('name')
    .execute();

  console.log('✅ Dropped name column from projects table');
  console.log('🎉 Migration completed successfully');
}

export async function down(db: Kysely<any>): Promise<void> {
  console.log('🔄 Rolling back: adding name column back...');

  // Add name column back
  await db.schema
    .alterTable('projects')
    .addColumn('name', 'text', (col) => col.notNull())
    .execute();

  // Copy title values back to name
  await sql`
    UPDATE projects 
    SET name = title
  `.execute(db);

  // Make title nullable again
  await db.schema
    .alterTable('projects')
    .alterColumn('title', (col) => col.dropNotNull())
    .execute();

  console.log('✅ Rollback completed');
}
