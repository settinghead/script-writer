#!/usr/bin/env node

import { db } from '../database/connection';

export async function seedTestUsers() {
  console.log('🌱 Seeding test users with Kysely...');
  
  const testUsers = [
    {
      id: 'test-user-1',
      username: 'test-user-1',
      display_name: 'Test User One',
      status: 'active'
    }
  ];
  
  try {
    for (const user of testUsers) {
      // Check if user exists using Kysely
      const existingUser = await db
        .selectFrom('users')
        .select('id')
        .where('id', '=', user.id)
        .executeTakeFirst();
        
      if (!existingUser) {
        await db
          .insertInto('users')
          .values(user)
          .execute();
        console.log(`✅ Created user: ${user.username}`);
        
        // Add auth provider for the test user
        const existingProvider = await db
          .selectFrom('auth_providers')
          .select('id')
          .where('user_id', '=', user.id)
          .where('provider_type', '=', 'debug')
          .executeTakeFirst();
          
        if (!existingProvider) {
          await db
            .insertInto('auth_providers')
            .values({
              user_id: user.id,
              provider_type: 'debug',
              provider_user_id: user.username,
              provider_data: JSON.stringify({ debug: true })
            })
            .execute();
          console.log(`✅ Created debug auth provider for: ${user.username}`);
        }
      } else {
        console.log(`⏭️  User already exists: ${user.username}`);
      }
    }
    
    console.log('🎉 Test user seeding completed');
  } catch (error) {
    console.error('❌ Failed to seed test users:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedTestUsers()
    .then(() => {
      console.log('✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    })
    .finally(() => {
      db.destroy();
    });
} 