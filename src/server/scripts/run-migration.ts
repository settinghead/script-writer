#!/usr/bin/env node

import { db } from '../database/connection';
import { readFileSync } from 'fs';
import { join } from 'path';
import { sql } from 'kysely';

async function runMigration() {
    console.log('🔄 Running Kysely-based migration: add transform_name column');
    
    try {
        // Check if transform_name column already exists
        const result = await db
            .selectFrom('information_schema.columns')
            .select('column_name')
            .where('table_name', '=', 'human_transforms')
            .where('column_name', '=', 'transform_name')
            .executeTakeFirst();
        
        if (result) {
            console.log('⏭️  transform_name column already exists, skipping migration');
            return;
        }

        // Read and execute raw SQL migration
        const migrationSQL = readFileSync(
            join(__dirname, '../database/migrations/006_add_transform_name.sql'), 
            'utf8'
        );
        
        // Execute the SQL migration
        await sql`${sql.raw(migrationSQL)}`.execute(db);
        
        console.log('✅ Migration completed successfully');
        console.log('📝 Please run: npm run db:generate-types');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    runMigration()
        .then(() => {
            console.log('✅ Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        })
        .finally(() => {
            db.destroy();
        });
}

export { runMigration }; 