import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
    // Remove the updated_at column from projects table since we'll compute it dynamically
    await db.schema
        .alterTable('projects')
        .dropColumn('updated_at')
        .execute()

    // Remove the trigger that updates projects.updated_at
    await sql`DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;`.execute(db)

    console.log('✅ Removed updated_at column and trigger from projects table')
}

export async function down(db: Kysely<any>): Promise<void> {
    // Add back the updated_at column
    await db.schema
        .alterTable('projects')
        .addColumn('updated_at', 'timestamp', (col) =>
            col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
        )
        .execute()

    // Recreate the trigger
    await sql`
        CREATE TRIGGER update_projects_updated_at 
        BEFORE UPDATE ON projects
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `.execute(db)

    console.log('✅ Restored updated_at column and trigger to projects table')
}
