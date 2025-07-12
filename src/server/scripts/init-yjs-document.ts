import { db } from '../database/connection';
import * as Y from 'yjs';

async function initYJSDocument(artifactId: string) {
    console.log(`Initializing YJS document for artifact: ${artifactId}`);

    // Get the artifact data
    const artifact = await db
        .selectFrom('artifacts')
        .selectAll()
        .where('id', '=', artifactId)
        .executeTakeFirst();

    if (!artifact) {
        console.error(`Artifact not found: ${artifactId}`);
        return;
    }

    console.log(`Found artifact:`, {
        id: artifact.id,
        schema_type: artifact.schema_type,
        origin_type: artifact.origin_type
    });

    // Parse artifact data
    let artifactData: any = {};
    try {
        artifactData = typeof artifact.data === 'string' ? JSON.parse(artifact.data) : artifact.data;
        console.log(`Parsed artifact data:`, artifactData);
    } catch (e) {
        console.error(`Failed to parse artifact data:`, e);
        return;
    }

    // Create YJS document
    const doc = new Y.Doc();
    const yMap = doc.getMap('content');

    // Initialize with artifact data
    Object.entries(artifactData).forEach(([key, value]) => {
        if (typeof value === 'string') {
            const yText = new Y.Text();
            yText.insert(0, value);
            yMap.set(key, yText);
            console.log(`Set ${key} as YText:`, value);
        } else if (Array.isArray(value)) {
            const yArray = new Y.Array();
            value.forEach((item: any) => {
                if (typeof item === 'string') {
                    yArray.push([item]);
                } else if (typeof item === 'object' && item !== null) {
                    yArray.push([JSON.stringify(item)]);
                } else {
                    yArray.push([item]);
                }
            });
            yMap.set(key, yArray);
            console.log(`Set ${key} as YArray:`, value);
        } else if (typeof value === 'object' && value !== null) {
            const yText = new Y.Text();
            yText.insert(0, JSON.stringify(value));
            yMap.set(key, yText);
            console.log(`Set ${key} as YText (JSON):`, value);
        } else {
            yMap.set(key, value);
            console.log(`Set ${key} as primitive:`, value);
        }
    });

    // Encode document state
    const documentState = Y.encodeStateAsUpdate(doc);
    console.log(`Encoded document state, size: ${documentState.length} bytes`);

    // Check if YJS document already exists
    const existingDoc = await db
        .selectFrom('artifact_yjs_documents')
        .selectAll()
        .where('artifact_id', '=', artifactId)
        .executeTakeFirst();

    if (existingDoc) {
        console.log(`YJS document already exists, updating...`);
        await db
            .updateTable('artifact_yjs_documents')
            .set({
                document_state: Buffer.from(documentState),
                updated_at: new Date().toISOString()
            })
            .where('artifact_id', '=', artifactId)
            .execute();
    } else {
        console.log(`Creating new YJS document...`);
        await db
            .insertInto('artifact_yjs_documents')
            .values({
                artifact_id: artifactId,
                project_id: artifact.project_id,
                room_id: `artifact-${artifactId}`,
                document_state: Buffer.from(documentState)
            })
            .execute();
    }

    console.log(`YJS document initialized successfully for artifact: ${artifactId}`);

    // Verify the document was saved correctly
    const savedDoc = await db
        .selectFrom('artifact_yjs_documents')
        .selectAll()
        .where('artifact_id', '=', artifactId)
        .executeTakeFirst();

    if (savedDoc) {
        console.log(`Verification: YJS document saved, size: ${savedDoc.document_state.length} bytes`);

        // Try to reconstruct the document to verify data integrity
        const testDoc = new Y.Doc();
        try {
            Y.applyUpdate(testDoc, new Uint8Array(savedDoc.document_state));
            const testMap = testDoc.getMap('content');

            console.log(`Verification: Document keys:`, Array.from(testMap.keys()));
            testMap.forEach((value, key) => {
                if (value && typeof value.toString === 'function') {
                    console.log(`  ${key}:`, value.toString());
                } else {
                    console.log(`  ${key}:`, value);
                }
            });
        } catch (e) {
            console.error(`Verification failed:`, e);
        }
    } else {
        console.error(`Verification failed: YJS document not found after save`);
    }
}

// Run the script
const artifactId = process.argv[2];
if (!artifactId) {
    console.error('Usage: ./run-ts src/server/scripts/init-yjs-document.ts <artifact-id>');
    process.exit(1);
}

initYJSDocument(artifactId).catch(console.error); 