import { db } from '../database/connection';
import * as Y from 'yjs';

async function testYJSData(jsondocId: string) {
    console.log(`Testing YJS data for jsondoc: ${jsondocId}`);

    // Test 1: Check if YJS document exists
    const yjsDoc = await db
        .selectFrom('jsondoc_yjs_documents')
        .selectAll()
        .where('jsondoc_id', '=', jsondocId)
        .executeTakeFirst();

    if (!yjsDoc) {
        console.error(`❌ YJS document not found for jsondoc: ${jsondocId}`);
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

    // Test 5: Compare with jsondoc data
    const jsondoc = await db
        .selectFrom('jsondocs')
        .select('data')
        .where('id', '=', jsondocId)
        .executeTakeFirst();

    if (jsondoc) {
        const jsondocData = JSON.parse(jsondoc.data);
        console.log(`✅ Original jsondoc data:`, jsondocData);

        // Compare fields
        const fieldsMatch = Object.keys(jsondocData).every(key => {
            const match = extractedData[key] === jsondocData[key];
            if (!match) {
                console.log(`❌ Field mismatch for ${key}:`);
                console.log(`  Jsondoc: ${jsondocData[key]}`);
                console.log(`  YJS:      ${extractedData[key]}`);
            }
            return match;
        });

        if (fieldsMatch) {
            console.log(`✅ All fields match between jsondoc and YJS data`);
        } else {
            console.log(`❌ Some fields don't match`);
        }
    }
}

// Run the test
const jsondocId = process.argv[2];
if (!jsondocId) {
    console.error('Usage: ./run-ts src/server/scripts/test-yjs-data.ts <jsondoc-id>');
    process.exit(1);
}

testYJSData(jsondocId).catch(console.error); 