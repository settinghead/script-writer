import { db } from '../database/connection';

async function cleanYJSData() {
    console.log('Cleaning corrupted YJS data...');

    const result = await db
        .deleteFrom('jsondoc_yjs_documents')
        .where('jsondoc_id', '=', 'da5238e0-8c10-489e-bf4e-65402b3884a2')
        .execute();

    console.log('Deleted', result.length, 'corrupted records');

    const awarenessResult = await db
        .deleteFrom('jsondoc_yjs_awareness')
        .where('jsondoc_id', '=', 'da5238e0-8c10-489e-bf4e-65402b3884a2')
        .execute();

    console.log('Deleted', awarenessResult.length, 'awareness records');
}

cleanYJSData().then(() => process.exit(0)).catch(console.error); 