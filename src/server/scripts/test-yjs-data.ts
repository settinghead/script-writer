import { db } from '../database/connection';
import * as Y from 'yjs';

async function testYJSData(jsonDocId: string) {
    console.log(`Testing YJS data for jsonDoc: ${jsonDocId}`);

    // Test 1: Check if YJS document exists
    const yjsDoc = await db
        .selectFrom('jsonDoc_yjs_documents')
        .selectAll()
        .where('jsonDoc_id', '=', jsonDocId)
        .executeTakeFirst();

    if (!yjsDoc) {
        console.error(`❌ YJS document not found for jsonDoc: ${jsonDocId}`);
        return;
    }

    console.log(`✅ YJS document found, size: ${yjsDoc.document_state.length} bytes`);

    // Test 2: Try to reconstruct the document
    const doc = new Y.Doc();
    try {
        Y.applyUpdate(doc, new Uint8Array(yjsDoc.document_state));
        console.log(`✅ YJS document reconstructed successfully`);
    } catch (e) {
        console.error(`❌ Failed to reconstruct YJS document:`, e);
        return;
    }

    // Test 3: Check the content map
    const contentMap = doc.getMap('content');
    console.log(`✅ Content map keys: [${Array.from(contentMap.keys()).join(', ')}]`);

    // Test 4: Extract field values
    const extractedData: any = {};
    contentMap.forEach((value, key) => {
        if (value && typeof value.toString === 'function') {
            extractedData[key] = value.toString();
        } else {
            extractedData[key] = value;
        }
    });

    console.log(`✅ Extracted data:`, extractedData);

    // Test 5: Compare with jsonDoc data
    const jsonDoc = await db
        .selectFrom('jsonDocs')
        .select('data')
        .where('id', '=', jsonDocId)
        .executeTakeFirst();

    if (jsonDoc) {
        const jsonDocData = JSON.parse(jsonDoc.data);
        console.log(`✅ Original jsonDoc data:`, jsonDocData);

        // Compare fields
        const fieldsMatch = Object.keys(jsonDocData).every(key => {
            const match = extractedData[key] === jsonDocData[key];
            if (!match) {
                console.log(`❌ Field mismatch for ${key}:`);
                console.log(`  JsonDoc: ${jsonDocData[key]}`);
                console.log(`  YJS:      ${extractedData[key]}`);
            }
            return match;
        });

        if (fieldsMatch) {
            console.log(`✅ All fields match between jsonDoc and YJS data`);
        } else {
            console.log(`❌ Some fields don't match`);
        }
    }
}

// Run the test
const jsonDocId = process.argv[2];
if (!jsonDocId) {
    console.error('Usage: ./run-ts src/server/scripts/test-yjs-data.ts <jsonDoc-id>');
    process.exit(1);
}

testYJSData(jsonDocId).catch(console.error); 