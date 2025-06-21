import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  console.log('🔄 Adding project_id columns to transform-related tables...');

  // Add project_id columns (nullable initially)
  await db.schema
    .alterTable('transform_inputs')
    .addColumn('project_id', 'text')
    .execute();

  await db.schema
    .alterTable('transform_outputs')
    .addColumn('project_id', 'text')
    .execute();

  await db.schema
    .alterTable('llm_prompts')
    .addColumn('project_id', 'text')
    .execute();

  await db.schema
    .alterTable('llm_transforms')
    .addColumn('project_id', 'text')
    .execute();

  await db.schema
    .alterTable('human_transforms')
    .addColumn('project_id', 'text')
    .execute();

  console.log('✅ Added project_id columns to all tables');

  // Populate project_id from related transforms
  console.log('🔄 Populating project_id values...');

  await sql`
    UPDATE transform_inputs 
    SET project_id = (
      SELECT t.project_id 
      FROM transforms t 
      WHERE t.id = transform_inputs.transform_id
    )
  `.execute(db);

  await sql`
    UPDATE transform_outputs 
    SET project_id = (
      SELECT t.project_id 
      FROM transforms t 
      WHERE t.id = transform_outputs.transform_id
    )
  `.execute(db);

  await sql`
    UPDATE llm_prompts 
    SET project_id = (
      SELECT t.project_id 
      FROM transforms t 
      WHERE t.id = llm_prompts.transform_id
    )
  `.execute(db);

  await sql`
    UPDATE llm_transforms 
    SET project_id = (
      SELECT t.project_id 
      FROM transforms t 
      WHERE t.id = llm_transforms.transform_id
    )
  `.execute(db);

  await sql`
    UPDATE human_transforms 
    SET project_id = (
      SELECT t.project_id 
      FROM transforms t 
      WHERE t.id = human_transforms.transform_id
    )
  `.execute(db);

  console.log('✅ Populated project_id values');

  // Make project_id NOT NULL and add foreign key constraints
  console.log('🔄 Adding NOT NULL constraints and foreign keys...');

  await db.schema
    .alterTable('transform_inputs')
    .alterColumn('project_id', (col) => col.setNotNull())
    .execute();

  await db.schema
    .alterTable('transform_inputs')
    .addForeignKeyConstraint(
      'fk_transform_inputs_project',
      ['project_id'],
      'projects',
      ['id']
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('transform_outputs')
    .alterColumn('project_id', (col) => col.setNotNull())
    .execute();

  await db.schema
    .alterTable('transform_outputs')
    .addForeignKeyConstraint(
      'fk_transform_outputs_project',
      ['project_id'],
      'projects',
      ['id']
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('llm_prompts')
    .alterColumn('project_id', (col) => col.setNotNull())
    .execute();

  await db.schema
    .alterTable('llm_prompts')
    .addForeignKeyConstraint(
      'fk_llm_prompts_project',
      ['project_id'],
      'projects',
      ['id']
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('llm_transforms')
    .alterColumn('project_id', (col) => col.setNotNull())
    .execute();

  await db.schema
    .alterTable('llm_transforms')
    .addForeignKeyConstraint(
      'fk_llm_transforms_project',
      ['project_id'],
      'projects',
      ['id']
    )
    .onDelete('cascade')
    .execute();

  await db.schema
    .alterTable('human_transforms')
    .alterColumn('project_id', (col) => col.setNotNull())
    .execute();

  await db.schema
    .alterTable('human_transforms')
    .addForeignKeyConstraint(
      'fk_human_transforms_project',
      ['project_id'],
      'projects',
      ['id']
    )
    .onDelete('cascade')
    .execute();

  console.log('✅ Added NOT NULL constraints and foreign keys');

  // Add indexes for performance
  console.log('🔄 Creating performance indexes...');

  await db.schema
    .createIndex('idx_transform_inputs_project')
    .on('transform_inputs')
    .column('project_id')
    .execute();

  await db.schema
    .createIndex('idx_transform_outputs_project')
    .on('transform_outputs')
    .column('project_id')
    .execute();

  await db.schema
    .createIndex('idx_llm_prompts_project')
    .on('llm_prompts')
    .column('project_id')
    .execute();

  await db.schema
    .createIndex('idx_llm_transforms_project')
    .on('llm_transforms')
    .column('project_id')
    .execute();

  await db.schema
    .createIndex('idx_human_transforms_project')
    .on('human_transforms')
    .column('project_id')
    .execute();

  console.log('✅ Created performance indexes');
  console.log('🎉 Migration completed successfully!');
}

export async function down(db: Kysely<any>): Promise<void> {
  console.log('🔄 Rolling back project_id columns...');

  // Drop indexes
  await db.schema.dropIndex('idx_human_transforms_project').execute();
  await db.schema.dropIndex('idx_llm_transforms_project').execute();
  await db.schema.dropIndex('idx_llm_prompts_project').execute();
  await db.schema.dropIndex('idx_transform_outputs_project').execute();
  await db.schema.dropIndex('idx_transform_inputs_project').execute();

  // Drop foreign key constraints
  await db.schema
    .alterTable('human_transforms')
    .dropConstraint('fk_human_transforms_project')
    .execute();

  await db.schema
    .alterTable('llm_transforms')
    .dropConstraint('fk_llm_transforms_project')
    .execute();

  await db.schema
    .alterTable('llm_prompts')
    .dropConstraint('fk_llm_prompts_project')
    .execute();

  await db.schema
    .alterTable('transform_outputs')
    .dropConstraint('fk_transform_outputs_project')
    .execute();

  await db.schema
    .alterTable('transform_inputs')
    .dropConstraint('fk_transform_inputs_project')
    .execute();

  // Drop project_id columns
  await db.schema.alterTable('human_transforms').dropColumn('project_id').execute();
  await db.schema.alterTable('llm_transforms').dropColumn('project_id').execute();
  await db.schema.alterTable('llm_prompts').dropColumn('project_id').execute();
  await db.schema.alterTable('transform_outputs').dropColumn('project_id').execute();
  await db.schema.alterTable('transform_inputs').dropColumn('project_id').execute();

  console.log('✅ Rollback completed');
} 