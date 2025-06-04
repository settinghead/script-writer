const { ArtifactRepository } = require('./dist-server/server/repositories/ArtifactRepository');
const { TransformRepository } = require('./dist-server/server/repositories/TransformRepository');
const knex = require('knex');

// Database configuration
const db = knex({
    client: 'sqlite3',
    connection: {
        filename: './ideations.db'
    },
    useNullAsDefault: true
});

async function testCascadingParametersLineage() {
    console.log('🧪 Testing Cascading Parameters Lineage Tracing...\n');

    try {
        const artifactRepo = new ArtifactRepository(db);
        const transformRepo = new TransformRepository(db);
        const testUserId = 'test-user-lineage';

        // Clean up any existing test data
        await db('transform_outputs').where('transform_id', 'like', '%test%').del();
        await db('transform_inputs').where('transform_id', 'like', '%test%').del();
        await db('transforms').where('user_id', testUserId).del();
        await db('artifacts').where('user_id', testUserId).del();

        // 🔥 Step 1: Create a brainstorm_params artifact (this would come from brainstorming workflow)
        console.log('1️⃣ Creating brainstorm_params artifact...');
        const brainstormParams = await artifactRepo.createArtifact(
            testUserId,
            'brainstorm_params',
            {
                platform: 'TikTok',
                genre_paths: [['古装', '穿越'], ['现代', '言情']],
                genre_proportions: [60, 40],
                requirements: '注重男女主感情线快速发展，3集内必须有实质性进展'
            },
            'v1'
        );
        console.log(`✅ Created brainstorm_params: ${brainstormParams.id}`);

        // 🔥 Step 2: Create a user_input artifact (user editing their idea)
        console.log('\n2️⃣ Creating user_input artifact...');
        const userInput = await artifactRepo.createArtifact(
            testUserId,
            'user_input',
            {
                text: '现代女强人穿越到古代，与冷傲王爷的爱恨纠葛',
                source: 'manual',
                source_artifact_id: brainstormParams.id
            },
            'v1'
        );
        console.log(`✅ Created user_input: ${userInput.id}`);

        // 🔥 Step 3: Create a human transform linking brainstorm_params → user_input
        console.log('\n3️⃣ Creating human transform for parameter inheritance...');
        const humanTransform = await transformRepo.createTransform(
            testUserId,
            'human',
            'v1',
            'completed',
            {
                timestamp: new Date().toISOString(),
                action_type: 'parameter_cascade',
                source_type: 'brainstorm_params'
            }
        );

        await transformRepo.addTransformInputs(humanTransform.id, [
            { artifactId: brainstormParams.id, inputRole: 'source_params' }
        ]);
        await transformRepo.addTransformOutputs(humanTransform.id, [
            { artifactId: userInput.id, outputRole: 'user_input_with_params' }
        ]);
        console.log(`✅ Created human transform: ${humanTransform.id}`);

        // 🔥 Step 4: Generate outline using user_input (this creates outline_session_id)
        console.log('\n4️⃣ Generating outline from user input...');

        const outlineSessionId = `outline-session-${Date.now()}`;

        // Create outline_session artifact
        const outlineSession = await artifactRepo.createArtifact(
            testUserId,
            'outline_session',
            {
                id: outlineSessionId,
                ideation_session_id: 'test-ideation-session',
                status: 'active',
                created_at: new Date().toISOString()
            },
            'v1'
        );

        // Create LLM transform for outline generation
        const outlineTransform = await transformRepo.createTransform(
            testUserId,
            'llm',
            'v1',
            'completed',
            {
                outline_session_id: outlineSessionId,
                template_id: 'outline_generation',
                model_name: 'gpt-4'
            }
        );

        await transformRepo.addTransformInputs(outlineTransform.id, [
            { artifactId: userInput.id, inputRole: 'source_text' }
        ]);
        await transformRepo.addTransformOutputs(outlineTransform.id, [
            { artifactId: outlineSession.id, outputRole: 'outline_session' }
        ]);

        console.log(`✅ Created outline session: ${outlineSessionId}`);
        console.log(`✅ Created outline transform: ${outlineTransform.id}`);

        // 🔥 Step 5: Test lineage tracing functions
        console.log('\n5️⃣ Testing lineage tracing functions...');

        // 5a: Test findBrainstormParamsInLineage with userInput as source
        console.log('\n5a️⃣ Testing findBrainstormParamsInLineage with userInput source...');

        const userTransforms = await transformRepo.getUserTransforms(testUserId);
        const visitedArtifacts = new Set();
        const artifactsToCheck = [userInput.id];
        const foundBrainstormParams = [];

        while (artifactsToCheck.length > 0) {
            const currentArtifactId = artifactsToCheck.shift();

            if (visitedArtifacts.has(currentArtifactId)) {
                continue;
            }
            visitedArtifacts.add(currentArtifactId);

            // Check if this artifact is brainstorm_params
            const artifact = await artifactRepo.getArtifact(currentArtifactId, testUserId);
            if (artifact && artifact.type === 'brainstorm_params') {
                foundBrainstormParams.push(artifact);
            }

            // Find transforms that have this artifact as output (going backwards in lineage)
            for (const transform of userTransforms) {
                const outputs = await transformRepo.getTransformOutputs(transform.id);
                if (outputs.some(output => output.artifact_id === currentArtifactId)) {
                    // This transform produced the current artifact, check its inputs
                    const inputs = await transformRepo.getTransformInputs(transform.id);
                    for (const input of inputs) {
                        if (!visitedArtifacts.has(input.artifact_id)) {
                            artifactsToCheck.push(input.artifact_id);
                        }
                    }
                }
            }
        }

        console.log(`✅ Found ${foundBrainstormParams.length} brainstorm_params in lineage of userInput`);
        if (foundBrainstormParams.length > 0) {
            const params = foundBrainstormParams[0].data;
            console.log(`   📍 Platform: ${params.platform}`);
            console.log(`   📍 Genres: ${params.genre_paths.map(p => p.join(' > ')).join(', ')}`);
            console.log(`   📍 Requirements: ${params.requirements}`);
        }

        // 5b: Test session-based lineage tracing
        console.log('\n5b️⃣ Testing session-based lineage tracing...');

        // Find transforms related to the outline session
        const sessionTransforms = userTransforms.filter(t =>
            t.execution_context?.outline_session_id === outlineSessionId
        );

        console.log(`✅ Found ${sessionTransforms.length} transforms for outline session ${outlineSessionId}`);

        const relatedArtifactIds = new Set();

        // Collect all input and output artifacts from session transforms
        for (const transform of sessionTransforms) {
            const inputs = await transformRepo.getTransformInputs(transform.id);
            const outputs = await transformRepo.getTransformOutputs(transform.id);

            inputs.forEach(i => relatedArtifactIds.add(i.artifact_id));
            outputs.forEach(o => relatedArtifactIds.add(o.artifact_id));
        }

        console.log(`✅ Found ${relatedArtifactIds.size} related artifacts for session`);

        // Now find brainstorm_params in the lineage of these artifacts
        const sessionBrainstormParams = [];

        for (const artifactId of relatedArtifactIds) {
            // Re-run lineage search for each artifact
            const artifactsToCheck2 = [artifactId];
            const visitedArtifacts2 = new Set();

            while (artifactsToCheck2.length > 0) {
                const currentArtifactId = artifactsToCheck2.shift();

                if (visitedArtifacts2.has(currentArtifactId)) {
                    continue;
                }
                visitedArtifacts2.add(currentArtifactId);

                const artifact = await artifactRepo.getArtifact(currentArtifactId, testUserId);
                if (artifact && artifact.type === 'brainstorm_params') {
                    if (!sessionBrainstormParams.some(existing => existing.id === artifact.id)) {
                        sessionBrainstormParams.push(artifact);
                    }
                }

                // Find transforms that have this artifact as output
                for (const transform of userTransforms) {
                    const outputs = await transformRepo.getTransformOutputs(transform.id);
                    if (outputs.some(output => output.artifact_id === currentArtifactId)) {
                        const inputs = await transformRepo.getTransformInputs(transform.id);
                        for (const input of inputs) {
                            if (!visitedArtifacts2.has(input.artifact_id)) {
                                artifactsToCheck2.push(input.artifact_id);
                            }
                        }
                    }
                }
            }
        }

        console.log(`✅ Found ${sessionBrainstormParams.length} brainstorm_params via session lineage`);

        // 🔥 Step 6: Verify the results
        console.log('\n6️⃣ Verifying cascading parameter results...');

        if (foundBrainstormParams.length === 0) {
            console.log('❌ FAILED: No brainstorm_params found in direct lineage');
            return false;
        }

        if (sessionBrainstormParams.length === 0) {
            console.log('❌ FAILED: No brainstorm_params found via session lineage');
            return false;
        }

        // Verify they found the same parameters
        const directParams = foundBrainstormParams[0].data;
        const sessionParams = sessionBrainstormParams[0].data;

        if (directParams.platform !== sessionParams.platform) {
            console.log('❌ FAILED: Platform mismatch between direct and session lineage');
            return false;
        }

        if (JSON.stringify(directParams.genre_paths) !== JSON.stringify(sessionParams.genre_paths)) {
            console.log('❌ FAILED: Genre paths mismatch between direct and session lineage');
            return false;
        }

        if (directParams.requirements !== sessionParams.requirements) {
            console.log('❌ FAILED: Requirements mismatch between direct and session lineage');
            return false;
        }

        console.log('✅ SUCCESS: Both lineage tracing methods found the same brainstorm_params!');
        console.log('\n📊 Final Results:');
        console.log(`   🎯 Platform: ${directParams.platform}`);
        console.log(`   🎭 Genres: ${directParams.genre_paths.map(p => p.join(' > ')).join(', ')}`);
        console.log(`   📝 Requirements: ${directParams.requirements}`);

        console.log('\n🎉 Cascading Parameters Lineage Tracing: ALL TESTS PASSED!');

        // Clean up test data
        await db('transform_outputs').where('transform_id', 'like', '%test%').del();
        await db('transform_inputs').where('transform_id', 'like', '%test%').del();
        await db('transforms').where('user_id', testUserId).del();
        await db('artifacts').where('user_id', testUserId).del();

        return true;

    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    }
}

// Run the test
if (require.main === module) {
    testCascadingParametersLineage()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = { testCascadingParametersLineage }; 