exports.up = async function (knex) {
    // Create users table
    await knex.schema.createTable('users', (table) => {
        table.string('id').primary();
        table.string('username').notNullable().unique();
        table.string('display_name');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.string('status').defaultTo('active');
    });

    // Create projects table
    await knex.schema.createTable('projects', (table) => {
        table.string('id').primary();
        table.string('name').notNullable();
        table.text('description');
        table.string('project_type').defaultTo('script');
        table.string('status').defaultTo('active');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        table.index(['status'], 'idx_projects_status');
        table.index(['created_at'], 'idx_projects_created');
    });

    // Create projects_users table (many-to-many relationship)
    await knex.schema.createTable('projects_users', (table) => {
        table.increments('id').primary();
        table.string('project_id').notNullable();
        table.string('user_id').notNullable();
        table.string('role').defaultTo('owner'); // owner, collaborator, viewer, etc.
        table.timestamp('joined_at').defaultTo(knex.fn.now());

        table.foreign('project_id').references('id').inTable('projects').onDelete('CASCADE');
        table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
        table.unique(['project_id', 'user_id']);
        table.index(['user_id'], 'idx_projects_users_user_id');
        table.index(['project_id'], 'idx_projects_users_project_id');
    });

    // Create auth_providers table
    await knex.schema.createTable('auth_providers', (table) => {
        table.increments('id').primary();
        table.string('user_id').notNullable();
        table.string('provider_type').notNullable();
        table.string('provider_user_id');
        table.text('provider_data');
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.foreign('user_id').references('id').inTable('users');
        table.unique(['provider_type', 'provider_user_id']);
    });

    // Create user_sessions table
    await knex.schema.createTable('user_sessions', (table) => {
        table.string('id').primary();
        table.string('user_id').notNullable();
        table.timestamp('expires_at').notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.foreign('user_id').references('id').inTable('users');
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('user_sessions');
    await knex.schema.dropTableIfExists('auth_providers');
    await knex.schema.dropTableIfExists('projects_users');
    await knex.schema.dropTableIfExists('projects');
    await knex.schema.dropTableIfExists('users');
}; 