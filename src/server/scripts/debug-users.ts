import { db } from '../database/connection';

async function debugUsers() {
    console.log('🔍 Debugging user database state...\n');

    try {
        // Check users table
        const users = await db
            .selectFrom('users')
            .selectAll()
            .execute();

        console.log('👥 Users in database:');
        users.forEach(user => {
            console.log(`  - ID: ${user.id}, Username: ${user.username}, Display: ${user.display_name}`);
        });
        console.log(`Total users: ${users.length}\n`);

        // Check auth_providers table
        const authProviders = await db
            .selectFrom('auth_providers')
            .selectAll()
            .execute();

        console.log('🔑 Auth providers in database:');
        authProviders.forEach(provider => {
            console.log(`  - User ID: ${provider.user_id}, Type: ${provider.provider_type}, Provider User ID: ${provider.provider_user_id}`);
        });
        console.log(`Total auth providers: ${authProviders.length}\n`);

        // Check the INNER JOIN query that getTestUsers() uses
        const testUsers = await db
            .selectFrom('users as u')
            .innerJoin('auth_providers as ap', 'u.id', 'ap.user_id')
            .select(['u.id', 'u.username', 'u.display_name', 'ap.provider_type', 'ap.provider_user_id'])
            .where('ap.provider_type', '=', 'dropdown')
            .execute();

        console.log('🎯 Test users (INNER JOIN result):');
        testUsers.forEach(user => {
            console.log(`  - ID: ${user.id}, Username: ${user.username}, Display: ${user.display_name}, Provider User ID: ${user.provider_user_id}`);
        });
        console.log(`Total test users: ${testUsers.length}\n`);

    } catch (error) {
        console.error('❌ Error debugging users:', error);
    } finally {
        process.exit(0);
    }
}

debugUsers(); 