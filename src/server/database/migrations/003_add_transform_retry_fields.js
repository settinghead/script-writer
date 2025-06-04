exports.up = async function (knex) {
    // Add retry tracking fields to existing transforms table
    await knex.schema.alterTable('transforms', (table) => {
        table.integer('retry_count').defaultTo(0);
        table.integer('max_retries').defaultTo(2);
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    // Update the default status from 'completed' to 'running' for the new job system
    await knex.schema.alterTable('transforms', (table) => {
        table.string('status').defaultTo('running').alter();
    });
};

exports.down = async function (knex) {
    // Remove the added columns
    await knex.schema.alterTable('transforms', (table) => {
        table.dropColumn('retry_count');
        table.dropColumn('max_retries');
        table.dropColumn('updated_at');
    });

    // Revert status default back to 'completed'
    await knex.schema.alterTable('transforms', (table) => {
        table.string('status').defaultTo('completed').alter();
    });
}; 