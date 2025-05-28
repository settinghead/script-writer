import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    // Create users table
    await knex.schema.createTable('users', (table) => {
        table.string('id').primary();
        table.string('username').notNullable().unique();
        table.string('display_name');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.string('status').defaultTo('active');
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
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('user_sessions');
    await knex.schema.dropTableIfExists('auth_providers');
    await knex.schema.dropTableIfExists('users');
} 