/**
 * Check the actual database schema for YJS tables
 */

import { db } from '../database/connection';
import { sql } from 'kysely';

async function checkYJSSchema() {
  try {
    console.log('🔍 Checking YJS table schema in database...\n');

    // Check jsonDoc_yjs_documents table structure
    console.log('📋 jsonDoc_yjs_documents table structure:');
    const docsColumns = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'jsonDoc_yjs_documents' 
      ORDER BY ordinal_position
    `.execute(db);

    docsColumns.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check jsonDoc_yjs_awareness table structure
    console.log('\n📋 jsonDoc_yjs_awareness table structure:');
    const awarenessColumns = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'jsonDoc_yjs_awareness' 
      ORDER BY ordinal_position
    `.execute(db);

    awarenessColumns.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check constraints
    console.log('\n🔗 YJS table constraints:');
    const constraints = await sql`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name IN ('jsonDoc_yjs_documents', 'jsonDoc_yjs_awareness')
      ORDER BY tc.table_name, tc.constraint_type
    `.execute(db);

    constraints.rows.forEach((row: any) => {
      console.log(`  - ${row.table_name}.${row.column_name}: ${row.constraint_type} (${row.constraint_name})`);
    });

    console.log('\n✅ Schema check completed');

  } catch (error) {
    console.error('❌ Error checking YJS schema:', error);
  } finally {
    await db.destroy();
  }
}

checkYJSSchema(); 