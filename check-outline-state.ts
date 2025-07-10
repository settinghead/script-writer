import { createDb } from './src/server/database/connection.js';

const db = createDb();

async function checkState() {
    try {
        // Get all outline settings artifacts
        const outlineArtifacts = await db
            .selectFrom('artifacts')
            .selectAll()
            .where('project_id', '=', 'test-project-1')
            .where('schema_type', '=', 'outline_settings_schema')
            .orderBy('created_at', 'desc')
            .execute();

        console.log('=== Outline Settings Artifacts ===');
        outlineArtifacts.forEach(a => {
            console.log({
                id: a.id.substring(0, 8),
                origin_type: a.origin_type,
                created_at: a.created_at
            });
        });

        // Check transform inputs for each
        for (const artifact of outlineArtifacts) {
            const inputs = await db
                .selectFrom('transform_inputs')
                .selectAll()
                .where('artifact_id', '=', artifact.id)
                .execute();

            console.log(`Artifact ${artifact.id.substring(0, 8)} has ${inputs.length} descendants`);
            if (inputs.length > 0) {
                inputs.forEach(input => {
                    console.log(`  -> Transform: ${input.transform_id.substring(0, 8)}`);
                });
            }
        }

        // Get chronicles artifacts
        const chroniclesArtifacts = await db
            .selectFrom('artifacts')
            .selectAll()
            .where('project_id', '=', 'test-project-1')
            .where('schema_type', '=', 'chronicles_schema')
            .orderBy('created_at', 'desc')
            .execute();

        console.log('\n=== Chronicles Artifacts ===');
        chroniclesArtifacts.forEach(a => {
            console.log({
                id: a.id.substring(0, 8),
                origin_type: a.origin_type,
                created_at: a.created_at
            });
        });

        // Check chronicle stage artifacts too
        const stageArtifacts = await db
            .selectFrom('artifacts')
            .selectAll()
            .where('project_id', '=', 'test-project-1')

            .orderBy('created_at', 'desc')
            .execute();

        console.log('\n=== Chronicle Stage Artifacts ===');
        stageArtifacts.forEach(a => {
            console.log({
                id: a.id.substring(0, 8),
                origin_type: a.origin_type,
                created_at: a.created_at
            });
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkState(); 