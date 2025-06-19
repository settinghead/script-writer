import { Kysely } from 'kysely';
import type { DB } from './types';

export async function maybeSeedTestUsers(db: Kysely<DB>) {
    try {
        // Check if test users exist (check both users and auth_providers)
        const existingUser = await db
            .selectFrom('users as u')
            .innerJoin('auth_providers as ap', 'u.id', 'ap.user_id')
            .select(['u.id'])
            .where('u.id', '=', 'test-user-1')
            .where('ap.provider_type', '=', 'dropdown')
            .executeTakeFirst();

        if (!existingUser) {
            console.log('🌱 Seeding test users...');

            // Define test users based on the README
            const testUsers = [
                { id: 'test-user-1', username: 'testuser', display_name: 'Test User' },
                { id: 'test-user-xiyang', username: 'xiyang', display_name: 'Xi Yang' },
                { id: 'test-user-xiaolin', username: 'xiaolin', display_name: 'Xiao Lin' },
            ];

            // Insert test users
            for (const user of testUsers) {
                await db
                    .insertInto('users')
                    .values({
                        ...user,
                        status: 'active',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .onConflict((oc) => oc.column('id').doNothing())
                    .execute();

                // Insert auth provider for dropdown login
                await db
                    .insertInto('auth_providers')
                    .values({
                        user_id: user.id,
                        provider_type: 'dropdown',
                        provider_user_id: user.username,
                        provider_data: JSON.stringify({ test_user: true }),
                        created_at: new Date().toISOString(),
                    })
                    .onConflict((oc) => oc.columns(['provider_type', 'provider_user_id']).doUpdateSet({
                        user_id: user.id,
                        provider_data: JSON.stringify({ test_user: true }),
                    }))
                    .execute();

                console.log(`✅ Created test user: ${user.username} (${user.display_name})`);
            }

            console.log('🎉 Test users seeded successfully!');
        } else {
            console.log('✅ Test users already exist, skipping seed');
        }
    } catch (error) {
        console.error('❌ Error seeding test users:', error);
        // Don't crash the server if seeding fails
    }
} 