import { db } from '../database/connection';

async function printProjectJsondocs(projectId: string) {
    const jsondocs = await db.selectFrom('jsondocs').select(['id', 'schema_type', 'origin_type', 'created_at']).where('project_id', '=', projectId).orderBy('created_at').execute();
    const transformInputs = await db.selectFrom('transform_inputs').select('jsondoc_id').execute();
    const inputIds = new Set(transformInputs.map(ti => ti.jsondoc_id));

    // Fetch all particles for this project
    const particles = await db.selectFrom('particles').select(['id', 'jsondoc_id', 'type', 'title', 'path', 'is_active']).where('project_id', '=', projectId).execute();

    // Group particles by jsondoc_id
    const particlesByJsondoc = new Map<string, typeof particles>();
    particles.forEach(particle => {
        if (!particlesByJsondoc.has(particle.jsondoc_id)) {
            particlesByJsondoc.set(particle.jsondoc_id, []);
        }
        particlesByJsondoc.get(particle.jsondoc_id)!.push(particle);
    });

    console.log(`Jsondocs for project ${projectId}:`);
    console.log('='.repeat(80));

    jsondocs.forEach(j => {
        const hasDescendants = inputIds.has(j.id);
        console.log(`📄 ID: ${j.id}`);
        console.log(`   Type: ${j.schema_type}, Origin: ${j.origin_type}`);
        console.log(`   Created: ${j.created_at}`);
        console.log(`   Has descendants: ${hasDescendants}`);

        const jsondocParticles = particlesByJsondoc.get(j.id) || [];
        if (jsondocParticles.length > 0) {
            console.log(`   Particles (${jsondocParticles.length}):`);
            jsondocParticles.forEach(p => {
                const status = p.is_active ? '✅' : '❌';
                console.log(`     ${status} ${p.id} - ${p.title} (${p.type}) [${p.path}]`);
            });
        } else {
            console.log(`   Particles: None`);
        }

        console.log('─'.repeat(80));
    });

    console.log(`\nSummary:`);
    console.log(`Total jsondocs: ${jsondocs.length}`);
    console.log(`Total particles: ${particles.length}`);
    console.log(`Active particles: ${particles.filter(p => p.is_active).length}`);

    process.exit(0);
}

const projectId = process.argv[2];
if (!projectId) {
    console.error('Usage: ./run-ts src/server/scripts/print-project-jsondocs.ts <project_id>');
    process.exit(1);
}

printProjectJsondocs(projectId); 