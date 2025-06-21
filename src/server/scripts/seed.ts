#!/usr/bin/env node

import { db } from '../database/connection'

const testUsers = [
  {
    id: 'test-user-1',
    username: 'xiyang',
    email: 'xiyang@example.com'
  },
  {
    id: 'test-user-2', 
    username: 'xiaolin',
    email: 'xiaolin@example.com'
  }
]

const testAuthProviders = [
  {
    user_id: 'test-user-1',
    provider: 'test',
    provider_id: 'xiyang',
    provider_data: JSON.stringify({ username: 'xiyang' })
  },
  {
    user_id: 'test-user-2',
    provider: 'test', 
    provider_id: 'xiaolin',
    provider_data: JSON.stringify({ username: 'xiaolin' })
  }
]

async function seedTestUsers() {
  console.log('🌱 Seeding test users...')
  
  try {
    // Insert test users
    for (const user of testUsers) {
      const existingUser = await db
        .selectFrom('users')
        .select('id')
        .where('id', '=', user.id)
        .executeTakeFirst()
      
      if (!existingUser) {
        await db
          .insertInto('users')
          .values(user)
          .execute()
        console.log(`✅ Created user: ${user.username}`)
      } else {
        console.log(`⏭️  User already exists: ${user.username}`)
      }
    }

    // Insert auth providers
    for (const provider of testAuthProviders) {
      const existingProvider = await db
        .selectFrom('auth_providers')
        .select('id')
        .where('provider', '=', provider.provider)
        .where('provider_id', '=', provider.provider_id)
        .executeTakeFirst()
      
      if (!existingProvider) {
        await db
          .insertInto('auth_providers')
          .values(provider)
          .execute()
        console.log(`✅ Created auth provider: ${provider.provider_id}`)
      } else {
        console.log(`⏭️  Auth provider already exists: ${provider.provider_id}`)
      }
    }

    console.log('✅ Test user seeding completed successfully!')
    
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  } finally {
    await db.destroy()
  }
}

// Run if called directly
if (require.main === module) {
  seedTestUsers()
    .then(() => {
      console.log('✅ Seeding completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error)
      process.exit(1)
    })
}

export { seedTestUsers } 