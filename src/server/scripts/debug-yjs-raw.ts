import { db } from '../database/connection';

async function debugYJSRaw() {
    const artifactId = 'da5238e0-8c10-489e-bf4e-65402b3884a2';

    console.log('=== Debug YJS Raw Data ===');

    // Get the latest update
    const updates = await db
        .selectFrom('artifact_yjs_documents')
        .selectAll()
        .where('artifact_id', '=', artifactId)
        .orderBy('created_at', 'desc')
        .limit(3)
        .execute();

    console.log(`Found ${updates.length} updates`);

    updates.forEach((update, i) => {
        console.log(`\nUpdate ${i + 1}:`);
        console.log(`  ID: ${update.id}`);
        console.log(`  Created: ${update.created_at}`);
        console.log(`  Data length: ${update.document_state?.length || 0}`);

        if (update.document_state) {
            // Show first 100 bytes as hex
            const buffer = Buffer.from(update.document_state);
            const hex = buffer.subarray(0, 100).toString('hex');
            console.log(`  First 100 bytes (hex): ${hex}`);

            // Show first 100 bytes as text (to see if it's corrupted)
            const text = buffer.subarray(0, 100).toString('utf8');
            console.log(`  First 100 bytes (text): ${JSON.stringify(text)}`);

            // Check if it starts with YJS magic bytes
            const firstBytes = Array.from(buffer.subarray(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log(`  First 10 bytes: ${firstBytes}`);
        }
    });
}

debugYJSRaw().then(() => process.exit(0)).catch(console.error); 