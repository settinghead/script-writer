exports.up = async function (knex) {
    // Create artifacts table
    await knex.schema.createTable('artifacts', (table) => {
        table.string('id').primary();
        table.string('user_id').notNullable();
        table.string('type').notNullable();
        table.string('type_version').notNullable().defaultTo('v1');
        table.text('data').notNullable();
        table.text('metadata');
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.foreign('user_id').references('id').inTable('users');
        table.index(['user_id', 'type'], 'idx_artifacts_user_type');
        table.index(['user_id', 'created_at'], 'idx_artifacts_user_created');
    });

    // Create transforms table
    await knex.schema.createTable('transforms', (table) => {
        table.string('id').primary();
        table.string('user_id').notNullable();
        table.string('type').notNullable();
        table.string('type_version').notNullable().defaultTo('v1');
        table.string('status').defaultTo('completed');
        table.text('execution_context');
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.foreign('user_id').references('id').inTable('users');
        table.index(['user_id', 'created_at'], 'idx_transforms_user_created');
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

        table.foreign('transform_id').references('id').inTable('transforms').onDelete('CASCADE');
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