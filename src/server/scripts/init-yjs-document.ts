import { db } from '../database/connection';
import * as Y from 'yjs';

async function initYJSDocument(jsondocId: string) {
    console.log(`Initializing YJS document for jsondoc: ${jsondocId}`);

    // Get the jsondoc data
    const jsondoc = await db
        .selectFrom('jsondocs')
        .selectAll()
        .where('id', '=', jsondocId)
        .executeTakeFirst();

    if (!jsondoc) {
        console.error(`Jsondoc not found: ${jsondocId}`);
        return;
    }

    console.log(`Found jsondoc:`, {
        id: jsondoc.id,
        schema_type: jsondoc.schema_type,
        origin_type: jsondoc.origin_type
    });

    // Parse jsondoc data
    let jsondocData: any = {};
    try {
        jsondocData = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
        console.log(`Parsed jsondoc data:`, jsondocData);
    } catch (e) {
        console.error(`Failed to parse jsondoc data:`, e);
        return;
    }

    // Create YJS document
    const doc = new Y.Doc();
    const yMap = doc.getMap('content');

    // Initialize with jsondoc data
    Object.entries(jsondocData).forEach(([key, value]) => {
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
        .selectFrom('jsondoc_yjs_documents')
        .selectAll()
        .where('jsondoc_id', '=', jsondocId)
        .executeTakeFirst();

    if (existingDoc) {
        console.log(`YJS document already exists, updating...`);
        await db
            .updateTable('jsondoc_yjs_documents')
            .set({
                document_state: Buffer.from(documentState),
                updated_at: new Date().toISOString()
            })
            .where('jsondoc_id', '=', jsondocId)
            .execute();
    } else {
        console.log(`Creating new YJS document...`);
        await db
            .insertInto('jsondoc_yjs_documents')
            .values({
                jsondoc_id: jsondocId,
                project_id: jsondoc.project_id,
                room_id: `jsondoc-${jsondocId}`,
                document_state: Buffer.from(documentState)
            })
            .execute();
    }

    console.log(`YJS document initialized successfully for jsondoc: ${jsondocId}`);

    // Verify the document was saved correctly
    const savedDoc = await db
        .selectFrom('jsondoc_yjs_documents')
        .selectAll()
        .where('jsondoc_id', '=', jsondocId)
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
const jsondocId = process.argv[2];
if (!jsondocId) {
    console.error('Usage: ./run-ts src/server/scripts/init-yjs-document.ts <jsondoc-id>');
    process.exit(1);
}

initYJSDocument(jsondocId).catch(console.error); 