import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // Create users table
  await db.schema
    .createTable('users')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('username', 'text', (col) => col.notNull().unique())
    .addColumn('email', 'text')
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  // Create projects table
  await db.schema
    .createTable('projects')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('project_type', 'text', (col) => col.defaultTo('script'))
    .addColumn('status', 'text', (col) => col.defaultTo('active'))
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  // Create projects_users table
  await db.schema
    .createTable('projects_users')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('project_id', 'text', (col) =>
      col.references('projects.id').onDelete('cascade').notNull()
    )
    .addColumn('user_id', 'text', (col) =>
      col.references('users.id').onDelete('cascade').notNull()
    )
    .addColumn('role', 'text', (col) => col.defaultTo('member'))
    .addColumn('joined_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  // Create unique constraint for project membership
  await db.schema
    .createIndex('projects_users_unique')
    .on('projects_users')
    .columns(['project_id', 'user_id'])
    .unique()
    .execute()

  // Create auth_providers table
  await db.schema
    .createTable('auth_providers')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) =>
      col.references('users.id').onDelete('cascade').notNull()
    )
    .addColumn('provider', 'text', (col) => col.notNull())
    .addColumn('provider_id', 'text', (col) => col.notNull())
    .addColumn('provider_data', 'text')
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  // Create unique constraint for auth providers
  await db.schema
    .createIndex('auth_providers_unique')
    .on('auth_providers')
    .columns(['provider', 'provider_id'])
    .unique()
    .execute()

  // Create user_sessions table
  await db.schema
    .createTable('user_sessions')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) =>
      col.references('users.id').onDelete('cascade').notNull()
    )
    .addColumn('expires_at', 'timestamp', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  // Create artifacts table
  await db.schema
    .createTable('artifacts')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('project_id', 'text', (col) =>
      col.references('projects.id').onDelete('cascade').notNull()
    )
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('type_version', 'text', (col) => col.defaultTo('v1').notNull())
    .addColumn('data', 'text', (col) => col.notNull())
    .addColumn('metadata', 'text')
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  // Create transforms table
  await db.schema
    .createTable('transforms')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('project_id', 'text', (col) =>
      col.references('projects.id').onDelete('cascade').notNull()
    )
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('type_version', 'text', (col) => col.defaultTo('v1').notNull())
    .addColumn('status', 'text', (col) => col.defaultTo('completed'))
    .addColumn('retry_count', 'integer', (col) => col.defaultTo(0))
    .addColumn('max_retries', 'integer', (col) => col.defaultTo(2))
    .addColumn('execution_context', 'text')
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn('updated_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  // Create transform_inputs table
  await db.schema
    .createTable('transform_inputs')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('transform_id', 'text', (col) =>
      col.references('transforms.id').onDelete('cascade').notNull()
    )
    .addColumn('artifact_id', 'text', (col) =>
      col.references('artifacts.id').notNull()
    )
    .addColumn('input_role', 'text')
    .execute()

  // Create unique constraint for transform inputs
  await db.schema
    .createIndex('transform_inputs_unique')
    .on('transform_inputs')
    .columns(['transform_id', 'artifact_id', 'input_role'])
    .unique()
    .execute()

  // Create transform_outputs table
  await db.schema
    .createTable('transform_outputs')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('transform_id', 'text', (col) =>
      col.references('transforms.id').onDelete('cascade').notNull()
    )
    .addColumn('artifact_id', 'text', (col) =>
      col.references('artifacts.id').notNull()
    )
    .addColumn('output_role', 'text')
    .execute()

  // Create unique constraint for transform outputs
  await db.schema
    .createIndex('transform_outputs_unique')
    .on('transform_outputs')
    .columns(['transform_id', 'artifact_id', 'output_role'])
    .unique()
    .execute()

  // Create llm_prompts table
  await db.schema
    .createTable('llm_prompts')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('transform_id', 'text', (col) =>
      col.references('transforms.id').onDelete('cascade').notNull()
    )
    .addColumn('prompt_text', 'text', (col) => col.notNull())
    .addColumn('prompt_role', 'text', (col) => col.defaultTo('primary'))
    .execute()

  // Create llm_transforms table
  await db.schema
    .createTable('llm_transforms')
    .addColumn('transform_id', 'text', (col) =>
      col.primaryKey().references('transforms.id').onDelete('cascade')
    )
    .addColumn('model_name', 'text', (col) => col.notNull())
    .addColumn('model_parameters', 'text')
    .addColumn('raw_response', 'text')
    .addColumn('token_usage', 'text')
    .execute()

  // Create human_transforms table with path-based derivation support
  await db.schema
    .createTable('human_transforms')
    .addColumn('transform_id', 'text', (col) =>
      col.primaryKey().references('transforms.id').onDelete('cascade')
    )
    .addColumn('action_type', 'text', (col) => col.notNull())
    .addColumn('interface_context', 'text')
    .addColumn('change_description', 'text')
    .addColumn('source_artifact_id', 'text', (col) =>
      col.references('artifacts.id')
    )
    .addColumn('derivation_path', 'text', (col) => col.defaultTo(''))
    .addColumn('derived_artifact_id', 'text', (col) =>
      col.references('artifacts.id')
    )
    .addColumn('transform_name', 'text')
    .execute()

  // Create unique constraint to prevent duplicate transforms
  await db.schema
    .createIndex('unique_human_transform_per_artifact_path')
    .on('human_transforms')
    .columns(['source_artifact_id', 'derivation_path'])
    .unique()
    .where('source_artifact_id', 'is not', null)
    .execute()

  // Create performance indexes
  await db.schema
    .createIndex('idx_artifacts_project_type')
    .on('artifacts')
    .columns(['project_id', 'type'])
    .execute()

  await db.schema
    .createIndex('idx_artifacts_project_created')
    .on('artifacts')
    .columns(['project_id', 'created_at'])
    .execute()

  await db.schema
    .createIndex('idx_transforms_project_created')
    .on('transforms')
    .columns(['project_id', 'created_at'])
    .execute()

  await db.schema
    .createIndex('idx_human_transforms_derivation')
    .on('human_transforms')
    .columns(['source_artifact_id', 'derivation_path'])
    .where('source_artifact_id', 'is not', null)
    .execute()

  // Create auto-update triggers for timestamps
  await sql`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';
  `.execute(db)

  await sql`
    CREATE TRIGGER update_artifacts_updated_at 
    BEFORE UPDATE ON artifacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `.execute(db)

  await sql`
    CREATE TRIGGER update_transforms_updated_at 
    BEFORE UPDATE ON transforms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `.execute(db)

  await sql`
    CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `.execute(db)

  await sql`
    CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop triggers
  await sql`DROP TRIGGER IF EXISTS update_projects_updated_at ON projects`.execute(db)
  await sql`DROP TRIGGER IF EXISTS update_users_updated_at ON users`.execute(db)
  await sql`DROP TRIGGER IF EXISTS update_transforms_updated_at ON transforms`.execute(db)
  await sql`DROP TRIGGER IF EXISTS update_artifacts_updated_at ON artifacts`.execute(db)
  await sql`DROP FUNCTION IF EXISTS update_updated_at_column()`.execute(db)

  // Drop tables in reverse dependency order
  await db.schema.dropTable('human_transforms').execute()
  await db.schema.dropTable('llm_transforms').execute()
  await db.schema.dropTable('llm_prompts').execute()
  await db.schema.dropTable('transform_outputs').execute()
  await db.schema.dropTable('transform_inputs').execute()
  await db.schema.dropTable('transforms').execute()
  await db.schema.dropTable('artifacts').execute()
  await db.schema.dropTable('user_sessions').execute()
  await db.schema.dropTable('auth_providers').execute()
  await db.schema.dropTable('projects_users').execute()
  await db.schema.dropTable('projects').execute()
  await db.schema.dropTable('users').execute()
} 