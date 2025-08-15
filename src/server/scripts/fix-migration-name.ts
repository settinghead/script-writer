#!/usr/bin/env tsx

import { db } from '../database/connection';

async function fixMigrationName() {
    try {
        console.log('🔧 Fixing migration name in database...');

        // Update the migration record to use the correct filename
        const result = await db
            .updateTable('kysely_migration')
            .set({
                name: '20250813_001_remove_project_updated_at'
            })
            .where('name', '=', '20250114_001_remove_project_updated_at')
            .execute();

        if (result.length > 0) {
            console.log('✅ Successfully updated migration name from 20250114_001_remove_project_updated_at to 20250813_001_remove_project_updated_at');
        } else {
            console.log('ℹ️  No migration record found with name 20250114_001_remove_project_updated_at');

            // Check what migrations exist
            const migrations = await db
                .selectFrom('kysely_migration')
                .selectAll()
                .orderBy('name', 'asc')
                .execute();

            console.log('📋 Current migrations in database:');
            migrations.forEach((migration, index) => {
                console.log(`  ${index + 1}: ${migration.name} (executed: ${migration.executed_at})`);
            });
        }

    } catch (error) {
        console.error('❌ Error fixing migration name:', error);
        throw error;
    } finally {
        await db.destroy();
        process.exit(0);
    }
}

// Run the fix
fixMigrationName().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
