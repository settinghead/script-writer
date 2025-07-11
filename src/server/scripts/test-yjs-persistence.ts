import { db } from '../database/connection';

async function testYJSPersistence() {
    const artifactId = 'da5238e0-8c10-489e-bf4e-65402b3884a2';

    console.log('=== Testing YJS Persistence ===');

    // 1. Check what's in the database
    console.log('\n1. Database content:');
    const updates = await db
        .selectFrom('artifact_yjs_documents')
        .selectAll()
        .where('artifact_id', '=', artifactId)
        .orderBy('created_at', 'desc')
        .limit(5)
        .execute();

    console.log(`Found ${updates.length} updates for artifact ${artifactId}`);
    updates.forEach((update, i) => {
        console.log(`  Update ${i + 1}: ${update.document_state?.length || 0} bytes, created: ${update.created_at}`);
    });

    if (updates.length > 0) {
        // 2. Test loading the latest update
        console.log('\n2. Testing YJS document reconstruction:');

        const latestUpdate = updates[0];
        console.log(`Loading update with ${latestUpdate.document_state?.length || 0} bytes`);

        try {
            // Import Y.js dynamically
            const Y = await import('yjs');

            // Create a new YJS document
            const testDoc = new Y.Doc();

            // Apply all updates in order (like the new endpoint does)
            console.log(`Applying ${updates.length} updates in order...`);
            for (const update of updates.reverse()) { // Reverse to get chronological order
                if (update.document_state) {
                    try {
                        const updateArray = new Uint8Array(update.document_state);
                        Y.applyUpdate(testDoc, updateArray);
                        console.log(`  Applied update of ${updateArray.length} bytes`);
                    } catch (error) {
                        console.warn(`  Failed to apply update:`, error instanceof Error ? error.message : String(error));
                    }
                }
            }

            // Check what's in the document
            const yMap = testDoc.getMap('content');
            console.log(`YJS document has ${yMap.size} fields after loading all updates`);

            yMap.forEach((value: any, key: string) => {
                if (value && typeof value.toString === 'function') {
                    const stringValue = value.toString();
                    console.log(`  ${key}: "${stringValue}" (type: ${typeof value})`);
                } else {
                    console.log(`  ${key}: ${JSON.stringify(value)} (type: ${typeof value})`);
                }
            });

        } catch (error) {
            console.error('Error testing YJS reconstruction:', error);
        }
    }

    // 3. Check original artifact data
    console.log('\n3. Original artifact data:');
    const artifact = await db
        .selectFrom('artifacts')
        .select(['id', 'data'])
        .where('id', '=', artifactId)
        .executeTakeFirst();

    if (artifact) {
        console.log('Original artifact data:', JSON.stringify(artifact.data, null, 2));
    } else {
        console.log('Artifact not found');
    }
}

testYJSPersistence().then(() => process.exit(0)).catch(console.error); 