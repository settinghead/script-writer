import { db } from '../database/connection';
import * as Y from 'yjs';

async function initYJSDocument(jsonDocId: string) {
    console.log(`Initializing YJS document for jsonDoc: ${jsonDocId}`);

    // Get the jsonDoc data
    const jsonDoc = await db
        .selectFrom('jsonDocs')
        .selectAll()
        .where('id', '=', jsonDocId)
        .executeTakeFirst();

    if (!jsonDoc) {
        console.error(`JsonDoc not found: ${jsonDocId}`);
        return;
    }

    console.log(`Found jsonDoc:`, {
        id: jsonDoc.id,
        schema_type: jsonDoc.schema_type,
        origin_type: jsonDoc.origin_type
    });

    // Parse jsonDoc data
    let jsonDocData: any = {};
    try {
        jsonDocData = typeof jsonDoc.data === 'string' ? JSON.parse(jsonDoc.data) : jsonDoc.data;
        console.log(`Parsed jsonDoc data:`, jsonDocData);
    } catch (e) {
        console.error(`Failed to parse jsonDoc data:`, e);
        return;
    }

    // Create YJS document
    const doc = new Y.Doc();
    const yMap = doc.getMap('content');

    // Initialize with jsonDoc data
    Object.entries(jsonDocData).forEach(([key, value]) => {
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
        .selectFrom('jsonDoc_yjs_documents')
        .selectAll()
        .where('jsonDoc_id', '=', jsonDocId)
        .executeTakeFirst();

    if (existingDoc) {
        console.log(`YJS document already exists, updating...`);
        await db
            .updateTable('jsonDoc_yjs_documents')
            .set({
                document_state: Buffer.from(documentState),
                updated_at: new Date().toISOString()
            })
            .where('jsonDoc_id', '=', jsonDocId)
            .execute();
    } else {
        console.log(`Creating new YJS document...`);
        await db
            .insertInto('jsonDoc_yjs_documents')
            .values({
                jsonDoc_id: jsonDocId,
                project_id: jsonDoc.project_id,
                room_id: `jsonDoc-${jsonDocId}`,
                document_state: Buffer.from(documentState)
            })
            .execute();
    }

    console.log(`YJS document initialized successfully for jsonDoc: ${jsonDocId}`);

    // Verify the document was saved correctly
    const savedDoc = await db
        .selectFrom('jsonDoc_yjs_documents')
        .selectAll()
        .where('jsonDoc_id', '=', jsonDocId)
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
const jsonDocId = process.argv[2];
if (!jsonDocId) {
    console.error('Usage: ./run-ts src/server/scripts/init-yjs-document.ts <jsonDoc-id>');
    process.exit(1);
}

initYJSDocument(jsonDocId).catch(console.error); 