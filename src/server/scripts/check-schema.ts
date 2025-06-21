import { db } from '../database/connection.ts';

async function checkSchema() {
  console.log('=== Checking human_transforms table structure ===');
  try {
    const result = await db.executeQuery({
      sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'human_transforms'",
      parameters: []
    });
    console.log('human_transforms columns:', result.rows);
  } catch (error) {
    console.error('Error checking human_transforms schema:', error);
  }

  console.log('\n=== Checking artifacts table structure ===');
  try {
    const result = await db.executeQuery({
      sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'artifacts'",
      parameters: []
    });
    console.log('artifacts columns:', result.rows);
  } catch (error) {
    console.error('Error checking artifacts schema:', error);
  }

  console.log('\n=== Checking all tables ===');
  try {
    const result = await db.executeQuery({
      sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
      parameters: []
    });
    console.log('All tables:', result.rows);
  } catch (error) {
    console.error('Error checking tables:', error);
  }
}

checkSchema().catch(console.error).finally(() => process.exit(0)); 