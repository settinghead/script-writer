import { db } from '../database/connection';

async function checkYJSData() {
    console.log('=== YJS Documents ===');
    const docs = await db.selectFrom('artifact_yjs_documents').selectAll().execute();
    console.log('Count:', docs.length);
    docs.forEach(doc => {
        console.log('Artifact:', doc.artifact_id, 'Room:', doc.room_id, 'Update size:', doc.document_state?.length || 0);
    });

    console.log('\n=== YJS Awareness ===');
    const awareness = await db.selectFrom('artifact_yjs_awareness').selectAll().execute();
    console.log('Count:', awareness.length);
    awareness.forEach(aw => {
        console.log('Artifact:', aw.artifact_id, 'Client:', aw.client_id, 'Update size:', aw.update?.length || 0);
    });
}

checkYJSData().then(() => process.exit(0)).catch(console.error); 