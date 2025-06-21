#!/usr/bin/env node

import { db } from '../database/connection';

async function checkArtifactsSchema() {
    console.log('🔧 Checking artifacts table schema...\n');

    try {
        // Get all columns in artifacts table
        const columns = await db
            .selectFrom('information_schema.columns' as any)
            .select(['column_name', 'data_type', 'is_nullable'])
            .where('table_name', '=', 'artifacts')
            .orderBy('column_name')
            .execute();

        console.log('📋 Current artifacts table columns:');
        columns.forEach(col => {
            console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });

        console.log('\n🔍 Expected columns for unified context:');
        const expectedColumns = [
            'id',
            'project_id', 
            'type',
            'type_version',
            'data',
            'metadata',
            'created_at',
            'updated_at',
            'streaming_status',
            'streaming_progress',
            'partial_data'
        ];

        const currentColumns = columns.map(c => c.column_name);
        
        expectedColumns.forEach(expected => {
            const exists = currentColumns.includes(expected);
            console.log(`   ${exists ? '✅' : '❌'} ${expected}`);
        });

        console.log('\n📊 Missing columns:');
        const missingColumns = expectedColumns.filter(col => !currentColumns.includes(col));
        if (missingColumns.length === 0) {
            console.log('   ✅ All expected columns are present!');
        } else {
            missingColumns.forEach(col => {
                console.log(`   ❌ ${col}`);
            });
        }

        console.log('\n📊 Extra columns (not expected):');
        const extraColumns = currentColumns.filter(col => !expectedColumns.includes(col));
        if (extraColumns.length === 0) {
            console.log('   ✅ No unexpected columns!');
        } else {
            extraColumns.forEach(col => {
                console.log(`   ℹ️  ${col}`);
            });
        }

        // Check a sample artifact if any exist
        console.log('\n🔍 Sample artifact data:');
        const sampleArtifact = await db
            .selectFrom('artifacts')
            .selectAll()
            .limit(1)
            .execute();

        if (sampleArtifact.length > 0) {
            console.log('   📝 Sample artifact structure:');
            Object.entries(sampleArtifact[0]).forEach(([key, value]) => {
                const valueStr = typeof value === 'string' && value.length > 100 
                    ? value.substring(0, 100) + '...' 
                    : String(value);
                console.log(`      ${key}: ${valueStr}`);
            });
        } else {
            console.log('   ℹ️  No artifacts found in database');
        }

    } catch (error) {
        console.error('❌ Error checking artifacts schema:', error);
        throw error;
    }
}

checkArtifactsSchema()
    .then(() => {
        console.log('\n✅ Artifacts schema check completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Schema check failed:', error);
        process.exit(1);
    }); 