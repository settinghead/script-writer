#!/usr/bin/env node

import * as path from 'path'
import { promises as fs } from 'fs'
import {
  Migrator,
  FileMigrationProvider,
} from 'kysely'
import { db } from '../database/connection'

async function migrateToLatest() {
  console.log('🚀 Running database migrations...')

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      // This needs to be an absolute path
      migrationFolder: path.join(__dirname, '../database/migrations'),
    }),
  })

  const { error, results } = await migrator.migrateToLatest()

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`✅ migration "${it.migrationName}" was executed successfully`)
    } else if (it.status === 'Error') {
      console.error(`❌ failed to execute migration "${it.migrationName}"`)
    }
  })

  if (error) {
    console.error('❌ failed to migrate')
    console.error(error)
    process.exit(1)
  }

  console.log('✅ All migrations completed successfully!')
  await db.destroy()
}

async function migrateDown() {
  console.log('⬇️ Rolling back database migrations...')

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, '../database/migrations'),
    }),
  })

  const { error, results } = await migrator.migrateDown()

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`✅ migration "${it.migrationName}" was rolled back successfully`)
    } else if (it.status === 'Error') {
      console.error(`❌ failed to roll back migration "${it.migrationName}"`)
    }
  })

  if (error) {
    console.error('❌ failed to roll back migrations')
    console.error(error)
    process.exit(1)
  }

  console.log('✅ Migration rollback completed successfully!')
  await db.destroy()
}

async function migrationStatus() {
  console.log('📊 Checking migration status...')

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, '../database/migrations'),
    }),
  })

  const migrations = await migrator.getMigrations()

  console.log('\n📋 Migration Status:')
  console.log('====================')

  migrations.forEach((migration) => {
    const status = migration.executedAt ? '✅ Executed' : '⏳ Pending'
    const date = migration.executedAt ?
      ` (${migration.executedAt.toISOString()})` : ''
    console.log(`${status} ${migration.name}${date}`)
  })

  await db.destroy()
}

// Command line interface
const command = process.argv[2]

switch (command) {
  case 'up':
  case 'latest':
  case undefined:
    migrateToLatest()
    break
  case 'down':
    migrateDown()
    break
  case 'status':
    migrationStatus()
    break
  default:
    console.log('Usage: ./run-ts src/server/scripts/migrate.ts [up|down|status]')
    console.log('  up/latest: Run all pending migrations (default)')
    console.log('  down:      Roll back the last migration')
    console.log('  status:    Show migration status')
    process.exit(1)
} 