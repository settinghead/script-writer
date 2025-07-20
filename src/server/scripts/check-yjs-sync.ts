import { db } from '../database/connection';
import * as Y from 'yjs';

async function checkYJSSync() {
    const jsondocId = 'a568024a-d7c0-4c09-91d6-c64a0cebad2e';

    console.log(`=== Checking YJS sync for jsondoc: ${jsondocId} ===\n`);

    // 1. Check the jsondoc record
    const jsondoc = await db
        .selectFrom('jsondocs')
        .selectAll()
        .where('id', '=', jsondocId)
        .executeTakeFirst();

    console.log('📄 Current jsondoc data:');
    if (jsondoc) {
        const data = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.log('❌ Jsondoc not found');
        return;
    }

    // 2. Check YJS documents
    const yjsDocs = await db
        .selectFrom('jsondoc_yjs_documents')
        .selectAll()
        .where('jsondoc_id', '=', jsondocId)
        .orderBy('created_at', 'desc')
        .execute();

    console.log(`\n📝 YJS documents count: ${yjsDocs.length}`);

    if (yjsDocs.length === 0) {
        console.log('❌ No YJS documents found');
        return;
    }

    // 3. Reconstruct YJS document from all updates
    console.log('\n🔄 Reconstructing YJS document from updates...');
    const doc = new Y.Doc();
    let appliedUpdates = 0;
    let skippedUpdates = 0;

    for (const update of yjsDocs.reverse()) { // Apply in chronological order
        try {
            const updateData = new Uint8Array(update.document_state);
            if (updateData.length > 0) {
                Y.applyUpdate(doc, updateData);
                appliedUpdates++;
                console.log(`✅ Applied update from ${update.created_at} (${updateData.length} bytes)`);
            } else {
                skippedUpdates++;
                console.log(`⚠️ Skipped empty update from ${update.created_at}`);
            }
        } catch (error) {
            skippedUpdates++;
            console.log(`❌ Failed to apply update from ${update.created_at}:`, error);
        }
    }

    console.log(`\n📊 Applied: ${appliedUpdates}, Skipped: ${skippedUpdates}`);

    // 4. Extract data from YJS document
    const contentMap = doc.getMap('content');
    const extractedData: any = {};

    contentMap.forEach((value: any, key: string) => {
        if (value && typeof value.toArray === 'function') {
            // Handle YJS Arrays
            const arrayItems = value.toArray();
            extractedData[key] = arrayItems.map((item: any) => {
                if (item && typeof item.toString === 'function') {
                    const stringValue = item.toString();
                    try {
                        return JSON.parse(stringValue);
                    } catch {
                        return stringValue;
                    }
                }
                return item;
            });
        } else if (value && typeof value.toString === 'function') {
            // Handle YJS Text
            const stringValue = value.toString();
            try {
                extractedData[key] = JSON.parse(stringValue);
            } catch {
                extractedData[key] = stringValue;
            }
        } else {
            // Handle primitive values
            extractedData[key] = value;
        }
    });

    console.log('\n🎯 YJS document content:');
    console.log(JSON.stringify(extractedData, null, 2));

    // 5. Compare jsondoc vs YJS data
    const jsondocData = typeof jsondoc.data === 'string' ? JSON.parse(jsondoc.data) : jsondoc.data;

    console.log('\n🔍 Comparison:');
    console.log('Jsondoc title:', jsondocData.title);
    console.log('YJS title:', extractedData.title);
    console.log('Titles match:', jsondocData.title === extractedData.title);

    if (jsondocData.title !== extractedData.title) {
        console.log('\n❌ SYNC ISSUE DETECTED: YJS changes not synced to jsondoc!');
    } else {
        console.log('\n✅ Data is in sync');
    }
}

checkYJSSync().catch(console.error); 