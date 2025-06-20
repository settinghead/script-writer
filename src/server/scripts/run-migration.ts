#!/usr/bin/env node

import { db } from '../database/connection';

async function runMigration() {
    console.log('🔧 Running path-based derivation migration...');
    
    try {
        // Check if columns already exist
        const result = await db
            .selectFrom('information_schema.columns')
            .select('column_name')
            .where('table_name', '=', 'human_transforms')
            .where('column_name', 'in', ['source_artifact_id', 'derivation_path', 'derived_artifact_id'])
            .execute();
        
        if (result.length === 3) {
            console.log('✅ Migration already applied - columns exist');
            return;
        }
        
        // Add the new columns
        await db.schema
            .alterTable('human_transforms')
            .addColumn('source_artifact_id', 'text', (col) => col.references('artifacts.id'))
            .addColumn('derivation_path', 'text', (col) => col.defaultTo(''))
            .addColumn('derived_artifact_id', 'text', (col) => col.references('artifacts.id'))
            .execute();
        
        console.log('✅ Added path-based derivation columns');
        
        // Create index for fast lookups
        await db.schema
            .createIndex('idx_human_transforms_derivation')
            .on('human_transforms')
            .columns(['source_artifact_id', 'derivation_path'])
            .execute();
        
        console.log('✅ Created derivation lookup index');
        console.log('🎉 Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await db.destroy();
    }
}

runMigration().catch(console.error); 