import { db } from '../database/connection';

async function debugYJSFrontend() {
    const jsondocId = 'a568024a-d7c0-4c09-91d6-c64a0cebad2e';

    console.log('=== YJS Frontend Debug ===\n');

    // Clear existing YJS documents
    await db
        .deleteFrom('jsondoc_yjs_documents')
        .where('jsondoc_id', '=', jsondocId)
        .execute();
    console.log('✅ Cleared existing YJS documents');

    // Reset jsondoc to original state
    await db
        .updateTable('jsondocs')
        .set({
            data: JSON.stringify({ title: '新创意', body: '' }),
            updated_at: new Date().toISOString()
        })
        .where('id', '=', jsondocId)
        .execute();
    console.log('✅ Reset jsondoc to original state');

    console.log('\n📋 Instructions for manual testing:');
    console.log('1. Open https://localhost:4610/projects/47722409-763c-453c-b3b3-9e0d5291b910');
    console.log('2. Open browser DevTools (F12)');
    console.log('3. Go to Network tab and filter for "yjs" or "update"');
    console.log('4. Edit the title field to "觉醒吧，南京赛亚人！"');
    console.log('5. Check if you see any network requests to /api/yjs/update');
    console.log('6. Run this script again to check if updates were received\n');

    // Wait a bit and then check for updates
    console.log('Waiting 30 seconds for you to test...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Check if any YJS updates were received
    const updates = await db
        .selectFrom('jsondoc_yjs_documents')
        .selectAll()
        .where('jsondoc_id', '=', jsondocId)
        .orderBy('created_at', 'desc')
        .execute();

    console.log(`\n📊 Found ${updates.length} YJS updates after testing:`);

    if (updates.length === 0) {
        console.log('❌ NO UPDATES RECEIVED - Frontend is not sending YJS updates to server!');
        console.log('\nPossible issues:');
        console.log('- Electric provider not working');
        console.log('- Manual update handler not firing');
        console.log('- Network requests failing');
        console.log('- YJS document not triggering update events');
    } else {
        updates.forEach((update, i) => {
            console.log(`${i + 1}. Created: ${update.created_at}, Size: ${update.document_state.length} bytes`);
        });

        // Try to reconstruct and check content
        const Y = await import('yjs');
        const tempDoc = new Y.Doc();

        for (const update of updates.reverse()) {
            try {
                const updateData = new Uint8Array(update.document_state);
                Y.applyUpdate(tempDoc, updateData);
            } catch (error) {
                console.log(`❌ Failed to apply update: ${error}`);
            }
        }

        const contentMap = tempDoc.getMap('content');
        const extractedData: any = {};

        contentMap.forEach((value: any, key: string) => {
            if (value && typeof value.toString === 'function') {
                extractedData[key] = value.toString();
            } else {
                extractedData[key] = value;
            }
        });

        console.log('\n🎯 Reconstructed data from YJS updates:');
        console.log(JSON.stringify(extractedData, null, 2));

        if (extractedData.title === '觉醒吧，南京赛亚人！') {
            console.log('\n✅ SUCCESS: YJS updates are working correctly!');
        } else {
            console.log('\n⚠️ Updates received but content doesn\'t match expected value');
        }
    }

    // Check current jsondoc state
    const currentJsondoc = await db
        .selectFrom('jsondocs')
        .selectAll()
        .where('id', '=', jsondocId)
        .executeTakeFirst();

    if (currentJsondoc) {
        const data = typeof currentJsondoc.data === 'string' ? JSON.parse(currentJsondoc.data) : currentJsondoc.data;
        console.log('\n📄 Current jsondoc data:');
        console.log(JSON.stringify(data, null, 2));
    }
}

debugYJSFrontend().catch(console.error); 