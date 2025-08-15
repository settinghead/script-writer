import { Kysely, sql } from 'kysely'

// Add nullable title and manual override flag to projects
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('projects')
    .addColumn('title', 'text') // nullable by default
    .addColumn('project_title_manual_override', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();

  // Optional index to quickly find projects without titles
  await db.schema
    .createIndex('idx_projects_title_override')
    .on('projects')
    .columns(['project_title_manual_override'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_projects_title_override').ifExists().execute();
  await db.schema
    .alterTable('projects')
    .dropColumn('title')
    .dropColumn('project_title_manual_override')
    .execute();
}





