#!/usr/bin/env node

import { db } from '../database/connection';

async function findProjectWithData() {
    const projects = await db
        .selectFrom('projects')
        .selectAll()
        .execute();

    console.log('Projects found:');
    for (const project of projects) {
        const jsondocCount = await db
            .selectFrom('jsondocs')
            .select(db.fn.count('id').as('count'))
            .where('project_id', '=', project.id)
            .executeTakeFirst();

        const transformCount = await db
            .selectFrom('transforms')
            .select(db.fn.count('id').as('count'))
            .where('project_id', '=', project.id)
            .executeTakeFirst();

        console.log(`- ${project.id}: ${jsondocCount?.count || 0} jsondocs, ${transformCount?.count || 0} transforms`);
    }

    process.exit(0);
}

findProjectWithData().catch(error => {
    console.error('Error:', error);
    process.exit(1);
}); 