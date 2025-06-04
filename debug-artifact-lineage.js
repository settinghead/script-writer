const { ArtifactRepository } = require('./dist-server/server/repositories/ArtifactRepository');
const { TransformRepository } = require('./dist-server/server/repositories/TransformRepository');
const knex = require('knex');

const db = knex({
    client: 'sqlite3',
    connection: { filename: './ideations.db' },
    useNullAsDefault: true
});

async function debugArtifactLineage() {
    const artifactRepo = new ArtifactRepository(db);
    const transformRepo = new TransformRepository(db);
    const artifactId = '411af9dc-fea8-48b9-8cbe-24e1b98692bc';

    console.log('🔍 Debugging artifact lineage for:', artifactId);

    try {
        // 1. Check if the artifact exists
        const artifact = await artifactRepo.getArtifact(artifactId);
        if (!artifact) {
            console.log('❌ Artifact not found');
            process.exit(1);
        }

        console.log('✅ Found artifact:');
        console.log('   Type:', artifact.type);
        console.log('   User ID:', artifact.user_id);
        console.log('   Created:', artifact.created_at);
        console.log('   Data:', JSON.stringify(artifact.data, null, 2));

        // 2. Get all transforms for this user
        const userTransforms = await transformRepo.getUserTransforms(artifact.user_id);
        console.log('\n📊 Found', userTransforms.length, 'transforms for user');

        // Show all transforms with their context
        userTransforms.forEach((transform, i) => {
            console.log(`   ${i + 1}. Transform ${transform.id}`);
            console.log(`      Type: ${transform.type}, Status: ${transform.status}`);
            console.log(`      Created: ${transform.created_at}`);
            if (transform.execution_context) {
                console.log(`      Context:`, JSON.stringify(transform.execution_context, null, 8));
            }
        });

        // 3. Look for brainstorm_params in lineage
        console.log('\n🔄 Tracing lineage...');
        const visitedArtifacts = new Set();
        const artifactsToCheck = [artifactId];
        const foundBrainstormParams = [];
        let depth = 0;

        while (artifactsToCheck.length > 0 && depth < 10) {
            const currentArtifactId = artifactsToCheck.shift();
            depth++;

            if (visitedArtifacts.has(currentArtifactId)) {
                console.log(`   [Depth ${depth}] Skipping already visited:`, currentArtifactId);
                continue;
            }
            visitedArtifacts.add(currentArtifactId);

            console.log(`   [Depth ${depth}] Checking artifact:`, currentArtifactId);

            // Check if this artifact is brainstorm_params
            const currentArtifact = await artifactRepo.getArtifact(currentArtifactId, artifact.user_id);
            if (currentArtifact) {
                console.log(`   [Depth ${depth}] Found artifact type:`, currentArtifact.type);
                if (currentArtifact.type === 'brainstorm_params') {
                    foundBrainstormParams.push(currentArtifact);
                    console.log('🎯 Found brainstorm_params:', currentArtifact.id);
                    console.log('   Platform:', currentArtifact.data.platform);
                    console.log('   Genre paths:', currentArtifact.data.genre_paths);
                    console.log('   Requirements:', currentArtifact.data.requirements);
                }
            } else {
                console.log(`   [Depth ${depth}] Artifact not found or no access`);
            }

            // Find transforms that have this artifact as output
            let foundTransform = false;
            for (const transform of userTransforms) {
                const outputs = await transformRepo.getTransformOutputs(transform.id);
                if (outputs.some(output => output.artifact_id === currentArtifactId)) {
                    foundTransform = true;
                    console.log(`   [Depth ${depth}] 📤 Transform ${transform.id} produced this artifact`);
                    // Check its inputs
                    const inputs = await transformRepo.getTransformInputs(transform.id);
                    console.log(`   [Depth ${depth}] 📥 Transform has ${inputs.length} inputs:`);
                    for (const input of inputs) {
                        console.log(`   [Depth ${depth}]    Input: ${input.artifact_id} (role: ${input.input_role || 'none'})`);
                        if (!visitedArtifacts.has(input.artifact_id)) {
                            artifactsToCheck.push(input.artifact_id);
                        }
                    }
                }
            }

            if (!foundTransform) {
                console.log(`   [Depth ${depth}] ❌ No transform found that produces this artifact`);
            }
        }

        console.log('\n🏁 Final result:', foundBrainstormParams.length, 'brainstorm_params found');

        if (foundBrainstormParams.length === 0) {
            console.log('\n❌ No brainstorm_params found in lineage!');
            console.log('🔍 Let\'s check all brainstorm_params for this user:');
            const allBrainstormParams = await artifactRepo.getArtifactsByType(artifact.user_id, 'brainstorm_params');
            console.log('   Found', allBrainstormParams.length, 'brainstorm_params artifacts:');
            allBrainstormParams.forEach((bp, i) => {
                console.log(`   ${i + 1}. ${bp.id} (created: ${bp.created_at})`);
                console.log('      Platform:', bp.data.platform);
                console.log('      Genres:', bp.data.genre_paths?.map(p => p.join(' > ')).join(', '));
            });
        }

    } catch (error) {
        console.error('❌ Debug failed:', error);
    } finally {
        await db.destroy();
    }
}

debugArtifactLineage().catch(console.error); 