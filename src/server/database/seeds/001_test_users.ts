import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
    // Clear existing entries
    await knex('auth_providers').del();
    await knex('users').del();

    // Insert test users
    const testUsers = [
        { id: 'test-user-xiyang', username: 'xiyang', display_name: 'Xi Yang' },
        { id: 'test-user-xiaolin', username: 'xiaolin', display_name: 'Xiao Lin' },
        { id: 'test-user-giselle', username: 'giselle', display_name: 'Giselle' }
    ];

    await knex('users').insert(testUsers);

    // Insert auth providers for test users
    const authProviders = testUsers.map(user => ({
        user_id: user.id,
        provider_type: 'dropdown',
        provider_user_id: user.username,
        provider_data: JSON.stringify({ test_user: true })
    }));

    await knex('auth_providers').insert(authProviders);
} 