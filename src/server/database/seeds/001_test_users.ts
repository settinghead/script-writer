import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
    // Define test users
    const testUsers = [
        { id: 'test-user-xiyang', username: 'xiyang', display_name: 'Xi Yang' },
        { id: 'test-user-xiaolin', username: 'xiaolin', display_name: 'Xiao Lin' },
        { id: 'test-user-giselle', username: 'giselle', display_name: 'Giselle' }
    ];

    // Ensure each test user and their auth provider exist
    for (const user of testUsers) {
        // Check if user exists
        const existingUser = await knex('users').where('id', user.id).first();
        if (!existingUser) {
            // Insert user
            await knex('users').insert(user);
            console.log(`Created test user: ${user.username}`);
        } else {
            console.log(`Test user already exists: ${user.username}`);
        }

        // Check if auth provider exists (whether user was created now or before)
        const existingProvider = await knex('auth_providers')
            .where('user_id', user.id)
            .where('provider_type', 'dropdown')
            .first();

        if (!existingProvider) {
            // Insert auth provider
            await knex('auth_providers').insert({
                user_id: user.id,
                provider_type: 'dropdown',
                provider_user_id: user.username,
                provider_data: JSON.stringify({ test_user: true })
            });
            console.log(`Created auth provider for: ${user.username}`);
        } else {
            console.log(`Auth provider already exists for: ${user.username}`);
        }
    }
} 