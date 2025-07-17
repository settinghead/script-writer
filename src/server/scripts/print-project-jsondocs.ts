import { db } from '../database/connection';

async function printProjectJsondocs(projectId: string) {
    const jsondocs = await db.selectFrom('jsondocs').select(['id', 'schema_type', 'origin_type', 'created_at']).where('project_id', '=', projectId).orderBy('created_at').execute();
    const transformInputs = await db.selectFrom('transform_inputs').select('jsondoc_id').execute();
    const inputIds = new Set(transformInputs.map(ti => ti.jsondoc_id));
    console.log('Jsondocs for project ' + projectId + ':');
    jsondocs.forEach(j => {
        const hasDescendants = inputIds.has(j.id);
        console.log(`ID: ${j.id}, Type: ${j.schema_type}, Origin: ${j.origin_type}, Created: ${j.created_at}, Has descendants: ${hasDescendants}`);
    });

    process.exit(0);
}

const projectId = process.argv[2];
printProjectJsondocs(projectId); 