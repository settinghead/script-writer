import { db } from '../database/connection';
import * as Y from 'yjs';

async function testYJSData(artifactId: string) {
    console.log(`Testing YJS data for artifact: ${artifactId}`);

    // Test 1: Check if YJS document exists
    const yjsDoc = await db
        .selectFrom('artifact_yjs_documents')
        .selectAll()
        .where('artifact_id', '=', artifactId)
        .executeTakeFirst();

    if (!yjsDoc) {
        console.error(`❌ YJS document not found for artifact: ${artifactId}`);
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

    // Test 5: Compare with artifact data
    const artifact = await db
        .selectFrom('artifacts')
        .select('data')
        .where('id', '=', artifactId)
        .executeTakeFirst();

    if (artifact) {
        const artifactData = JSON.parse(artifact.data);
        console.log(`✅ Original artifact data:`, artifactData);

        // Compare fields
        const fieldsMatch = Object.keys(artifactData).every(key => {
            const match = extractedData[key] === artifactData[key];
            if (!match) {
                console.log(`❌ Field mismatch for ${key}:`);
                console.log(`  Artifact: ${artifactData[key]}`);
                console.log(`  YJS:      ${extractedData[key]}`);
            }
            return match;
        });

        if (fieldsMatch) {
            console.log(`✅ All fields match between artifact and YJS data`);
        } else {
            console.log(`❌ Some fields don't match`);
        }
    }
}

// Run the test
const artifactId = process.argv[2];
if (!artifactId) {
    console.error('Usage: ./run-ts src/server/scripts/test-yjs-data.ts <artifact-id>');
    process.exit(1);
}

testYJSData(artifactId).catch(console.error); 