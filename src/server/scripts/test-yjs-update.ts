import { db } from '../database/connection';
import * as Y from 'yjs';

async function testYJSUpdate() {
    const jsondocId = 'a568024a-d7c0-4c09-91d6-c64a0cebad2e';
    const projectId = '47722409-763c-453c-b3b3-9e0d5291b910';

    console.log('=== Testing YJS Update Mechanism ===\n');

    // 0. Clear existing YJS documents for this jsondoc
    await db
        .deleteFrom('jsondoc_yjs_documents')
        .where('jsondoc_id', '=', jsondocId)
        .execute();
    console.log('✅ Cleared existing YJS documents');

    // 1. Create a new YJS document with updated content
    const doc = new Y.Doc();
    const yMap = doc.getMap('content');

    // Set the new title
    const yText = new Y.Text();
    yText.insert(0, '觉醒吧，南京赛亚人！');
    yMap.set('title', yText);

    // Set empty body
    const yBodyText = new Y.Text();
    yBodyText.insert(0, '');
    yMap.set('body', yBodyText);

    console.log('✅ Created YJS document with new title');

    // 2. Generate update
    const update = Y.encodeStateAsUpdate(doc);
    console.log(`✅ Generated update (${update.length} bytes)`);

    // 3. Save update to database (simulating what the API would do)
    const roomId = `jsondoc-${jsondocId}`;

    await db
        .insertInto('jsondoc_yjs_documents')
        .values({
            jsondoc_id: jsondocId,
            project_id: projectId,
            room_id: roomId,
            document_state: Buffer.from(update)
        })
        .execute();

    console.log('✅ Saved update to jsondoc_yjs_documents table');

    // 4. Now simulate the sync process (from yjsRoutes.ts)
    console.log('\n🔄 Running sync process...');

    // Get all YJS updates for this jsondoc
    const updates = await db
        .selectFrom('jsondoc_yjs_documents')
        .select(['document_state', 'created_at'])
        .where('jsondoc_id', '=', jsondocId)
        .orderBy('created_at', 'asc')
        .execute();

    console.log(`Found ${updates.length} YJS updates`);

    // Create a temporary YJS document and apply all updates
    const tempDoc = new Y.Doc();
    let updateCount = 0;

    for (const update of updates) {
        try {
            const updateData = Buffer.from(update.document_state);

            if (updateData.length > 0) {
                Y.applyUpdate(tempDoc, updateData);
                updateCount++;
                console.log(`✅ Applied update from ${update.created_at} (${updateData.length} bytes)`);
            }
        } catch (error) {
            console.log(`❌ Failed to apply update from ${update.created_at}:`, error);
        }
    }

    console.log(`Applied ${updateCount} updates`);

    // 5. Extract data from the YJS document
    const contentMap = tempDoc.getMap('content');
    const extractedData: any = {};

    contentMap.forEach((value: any, key: string) => {
        if (value && typeof value.toString === 'function') {
            extractedData[key] = value.toString();
        } else {
            extractedData[key] = value;
        }
    });

    console.log('\n🎯 Extracted data from YJS:');
    console.log(JSON.stringify(extractedData, null, 2));

    // 6. Update the jsondoc in the database
    const updateTime = new Date().toISOString();

    const updateResult = await db
        .updateTable('jsondocs')
        .set({
            data: JSON.stringify(extractedData),
            updated_at: updateTime
        })
        .where('id', '=', jsondocId)
        .execute();

    console.log('\n✅ Updated jsondoc in database');
    console.log('Update result:', updateResult);

    // 7. Verify the jsondoc was updated
    const updatedJsondoc = await db
        .selectFrom('jsondocs')
        .selectAll()
        .where('id', '=', jsondocId)
        .executeTakeFirst();

    if (updatedJsondoc) {
        const data = typeof updatedJsondoc.data === 'string' ? JSON.parse(updatedJsondoc.data) : updatedJsondoc.data;
        console.log('\n🔍 Final jsondoc data:');
        console.log(JSON.stringify(data, null, 2));

        if (data.title === '觉醒吧，南京赛亚人！') {
            console.log('\n🎉 SUCCESS: Title was updated correctly!');
        } else {
            console.log('\n❌ FAILED: Title was not updated correctly');
        }
    }
}

testYJSUpdate().catch(console.error); 