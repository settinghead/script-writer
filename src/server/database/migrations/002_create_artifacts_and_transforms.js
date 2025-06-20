exports.up = async function (knex) {
    // Create artifacts table
    await knex.schema.createTable('artifacts', (table) => {
        table.string('id').primary();
        table.string('project_id').notNullable();
        table.string('type').notNullable();
        table.string('type_version').notNullable().defaultTo('v1');
        table.text('data').notNullable();
        table.text('metadata');
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.foreign('project_id').references('id').inTable('projects');
        table.index(['project_id', 'type'], 'idx_artifacts_project_type');
        table.index(['project_id', 'created_at'], 'idx_artifacts_project_created');
    });

    // Create transforms table
    await knex.schema.createTable('transforms', (table) => {
        table.string('id').primary();
        table.string('project_id').notNullable();
        table.string('type').notNullable();
        table.string('type_version').notNullable().defaultTo('v1');
        table.string('status').defaultTo('completed');
        table.text('execution_context');
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.foreign('project_id').references('id').inTable('projects');
        table.index(['project_id', 'created_at'], 'idx_transforms_project_created');
    });

    // Create transform_inputs table
    await knex.schema.createTable('transform_inputs', (table) => {
        table.increments('id').primary();
        table.string('transform_id').notNullable();
        table.string('artifact_id').notNullable();
        table.string('input_role');

        table.foreign('transform_id').references('id').inTable('transforms').onDelete('CASCADE');
        table.foreign('artifact_id').references('id').inTable('artifacts');
        table.unique(['transform_id', 'artifact_id', 'input_role']);
    });

    // Create transform_outputs table
    await knex.schema.createTable('transform_outputs', (table) => {
        table.increments('id').primary();
        table.string('transform_id').notNullable();
        table.string('artifact_id').notNullable();
        table.string('output_role');

        table.foreign('transform_id').references('id').inTable('transforms').onDelete('CASCADE');
        table.foreign('artifact_id').references('id').inTable('artifacts');
        table.unique(['transform_id', 'artifact_id', 'output_role']);
    });

    // Create llm_prompts table
    await knex.schema.createTable('llm_prompts', (table) => {
        table.string('id').primary();
        table.string('transform_id').notNullable();
        table.text('prompt_text').notNullable();
        table.string('prompt_role').defaultTo('primary');

        table.foreign('transform_id').references('id').inTable('transforms').onDelete('CASCADE');
    });

    // Create llm_transforms table
    await knex.schema.createTable('llm_transforms', (table) => {
        table.string('transform_id').primary();
        table.string('model_name').notNullable();
        table.text('model_parameters');
        table.text('raw_response');
        table.text('token_usage');

        table.foreign('transform_id').references('id').inTable('transforms').onDelete('CASCADE');
    });

    // Create human_transforms table
    await knex.schema.createTable('human_transforms', (table) => {
        table.string('transform_id').primary();
        table.string('action_type').notNullable();
        table.text('interface_context');
        table.text('change_description');
        
        // Path-based artifact derivation fields
        table.string('source_artifact_id');
        table.text('derivation_path').defaultTo('');
        table.string('derived_artifact_id');

        table.foreign('transform_id').references('id').inTable('transforms').onDelete('CASCADE');
        table.foreign('source_artifact_id').references('id').inTable('artifacts');
        table.foreign('derived_artifact_id').references('id').inTable('artifacts');
        
        // Index for fast path-based lookups
        table.index(['source_artifact_id', 'derivation_path'], 'idx_human_transforms_derivation');
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('human_transforms');
    await knex.schema.dropTableIfExists('llm_transforms');
    await knex.schema.dropTableIfExists('llm_prompts');
    await knex.schema.dropTableIfExists('transform_outputs');
    await knex.schema.dropTableIfExists('transform_inputs');
    await knex.schema.dropTableIfExists('transforms');
    await knex.schema.dropTableIfExists('artifacts');
}; 