import { db } from '../database/connection';

async function clearYJSForTesting() {
    const jsondocId = 'a568024a-d7c0-4c09-91d6-c64a0cebad2e';

    // Clear existing YJS documents
    await db
        .deleteFrom('jsondoc_yjs_documents')
        .where('jsondoc_id', '=', jsondocId)
        .execute();

    console.log('✅ Cleared existing YJS documents for testing');

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
    console.log('\n🎯 Ready for testing! Try editing the title in the UI now.');
}

clearYJSForTesting().catch(console.error); 