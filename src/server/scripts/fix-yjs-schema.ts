/**
 * Fix YJS table schema by adding missing columns
 */

import { db } from '../database/connection';
import { sql } from 'kysely';

async function fixYJSSchema() {
  try {
    console.log('🔧 Fixing YJS table schema...\n');

    // Add missing columns to artifact_yjs_documents
    console.log('Adding project_id to artifact_yjs_documents...');
    await sql`
      ALTER TABLE artifact_yjs_documents 
      ADD COLUMN IF NOT EXISTS project_id TEXT NOT NULL DEFAULT '';
    `.execute(db);

    console.log('Renaming update to document_state in artifact_yjs_documents...');
    await sql`
      ALTER TABLE artifact_yjs_documents 
      RENAME COLUMN update TO document_state;
    `.execute(db);

    console.log('Adding updated_at to artifact_yjs_documents...');
    await sql`
      ALTER TABLE artifact_yjs_documents 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
    `.execute(db);

    // Add missing columns to artifact_yjs_awareness  
    console.log('Adding project_id to artifact_yjs_awareness...');
    await sql`
      ALTER TABLE artifact_yjs_awareness 
      ADD COLUMN IF NOT EXISTS project_id TEXT NOT NULL DEFAULT '';
    `.execute(db);

    console.log('Adding created_at to artifact_yjs_awareness...');
    await sql`
      ALTER TABLE artifact_yjs_awareness 
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
    `.execute(db);

    // Update project_id values based on artifact_id
    console.log('Updating project_id values...');
    await sql`
      UPDATE artifact_yjs_documents 
      SET project_id = (
        SELECT project_id FROM artifacts WHERE artifacts.id = artifact_yjs_documents.artifact_id
      )
      WHERE project_id = '';
    `.execute(db);

    await sql`
      UPDATE artifact_yjs_awareness 
      SET project_id = (
        SELECT project_id FROM artifacts WHERE artifacts.id = artifact_yjs_awareness.artifact_id
      )
      WHERE project_id = '';
    `.execute(db);

    // Add foreign key constraints for project_id
    console.log('Adding foreign key constraints...');
    await sql`
      ALTER TABLE artifact_yjs_documents 
      ADD CONSTRAINT artifact_yjs_documents_project_id_fkey 
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
    `.execute(db);

    await sql`
      ALTER TABLE artifact_yjs_awareness 
      ADD CONSTRAINT artifact_yjs_awareness_project_id_fkey 
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
    `.execute(db);

    console.log('✅ YJS schema fix completed');

  } catch (error) {
    console.error('❌ Error fixing YJS schema:', error);
  } finally {
    await db.destroy();
  }
}

fixYJSSchema(); 