import { db } from '../database/connection';

async function cleanAllYJSData() {
    console.log('Cleaning all YJS data...');

    // Delete all YJS documents
    const docResult = await db
        .deleteFrom('jsondoc_yjs_documents')
        .execute();

    console.log('Deleted', docResult.length, 'YJS document records');

    // Delete all YJS awareness
    const awarenessResult = await db
        .deleteFrom('jsondoc_yjs_awareness')
        .execute();

    console.log('Deleted', awarenessResult.length, 'YJS awareness records');

    console.log('All YJS data cleaned - ready for fresh testing!');
}

cleanAllYJSData().then(() => process.exit(0)).catch(console.error); 