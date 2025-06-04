const { v4: uuidv4 } = require('uuid');

exports.up = async function (knex) {
    console.log('Starting synopsis stages refactoring migration...');

    // 1. Find all outline_synopsis_stages artifacts
    const synopsisStagesArtifacts = await knex('artifacts')
        .where('type', 'outline_synopsis_stages')
        .where('type_version', 'v1');

    console.log(`Found ${synopsisStagesArtifacts.length} synopsis_stages artifacts to refactor`);

    for (const artifact of synopsisStagesArtifacts) {
        try {
            const data = JSON.parse(artifact.data);
            const outlineSessionId = await getOutlineSessionId(knex, artifact.id);

            if (!outlineSessionId) {
                console.warn(`Could not find outline session for artifact ${artifact.id}, skipping`);
                continue;
            }

            // 2. Extract individual stages from the array
            const stages = data.synopsis_stages || [];
            const newStageArtifactIds = [];

            for (let i = 0; i < stages.length; i++) {
                const stage = stages[i];
                const stageArtifactId = uuidv4();

                // 3. Create new outline_synopsis_stage artifact for each stage
                await knex('artifacts').insert({
                    id: stageArtifactId,
                    user_id: artifact.user_id,
                    type: 'outline_synopsis_stage',
                    type_version: 'v1',
                    data: JSON.stringify({
                        stageNumber: i + 1,
                        stageSynopsis: stage.stageSynopsis,
                        numberOfEpisodes: stage.numberOfEpisodes,
                        outlineSessionId: outlineSessionId
                    }),
                    metadata: artifact.metadata,
                    created_at: artifact.created_at
                });

                newStageArtifactIds.push(stageArtifactId);
                console.log(`Created stage artifact ${stageArtifactId} for stage ${i + 1}`);
            }

            // 4. Update transforms to reference new artifacts
            const transforms = await knex('transform_outputs')
                .where('artifact_id', artifact.id);

            for (const transform of transforms) {
                // Add new stage artifacts as outputs
                for (const stageArtifactId of newStageArtifactIds) {
                    await knex('transform_outputs').insert({
                        transform_id: transform.transform_id,
                        artifact_id: stageArtifactId,
                        output_role: 'synopsis_stage'
                    });
                }
            }

            // 5. Delete old outline_synopsis_stages artifact
            await knex('transform_outputs').where('artifact_id', artifact.id).del();
            await knex('artifacts').where('id', artifact.id).del();

            console.log(`Successfully refactored artifact ${artifact.id} into ${newStageArtifactIds.length} stage artifacts`);

        } catch (error) {
            console.error(`Error refactoring artifact ${artifact.id}:`, error);
            // Continue with other artifacts rather than failing the whole migration
        }
    }

    console.log('Synopsis stages refactoring migration completed');
};

exports.down = async function (knex) {
    console.log('Reversing synopsis stages refactoring migration...');

    // Group stage artifacts by outline session
    const stageArtifacts = await knex('artifacts')
        .where('type', 'outline_synopsis_stage')
        .where('type_version', 'v1')
        .orderBy('created_at');

    const stagesBySession = {};

    for (const artifact of stageArtifacts) {
        const data = JSON.parse(artifact.data);
        const sessionId = data.outlineSessionId;

        if (!stagesBySession[sessionId]) {
            stagesBySession[sessionId] = [];
        }
        stagesBySession[sessionId].push({
            artifact,
            data,
            stageNumber: data.stageNumber
        });
    }

    // Recreate synopsis_stages arrays
    for (const [sessionId, stages] of Object.entries(stagesBySession)) {
        if (stages.length === 0) continue;

        // Sort by stage number
        stages.sort((a, b) => a.stageNumber - b.stageNumber);

        const firstStage = stages[0];
        const synopsisStagesId = uuidv4();

        // Create synopsis_stages array artifact
        const synopsisStagesData = {
            synopsis_stages: stages.map(stage => ({
                stageSynopsis: stage.data.stageSynopsis,
                numberOfEpisodes: stage.data.numberOfEpisodes
            }))
        };

        await knex('artifacts').insert({
            id: synopsisStagesId,
            user_id: firstStage.artifact.user_id,
            type: 'outline_synopsis_stages',
            type_version: 'v1',
            data: JSON.stringify(synopsisStagesData),
            metadata: firstStage.artifact.metadata,
            created_at: firstStage.artifact.created_at
        });

        // Update transforms
        const stageArtifactIds = stages.map(s => s.artifact.id);
        const transforms = await knex('transform_outputs')
            .whereIn('artifact_id', stageArtifactIds)
            .groupBy('transform_id');

        for (const transform of transforms) {
            await knex('transform_outputs').insert({
                transform_id: transform.transform_id,
                artifact_id: synopsisStagesId,
                output_role: 'synopsis_stages'
            });
        }

        // Delete individual stage artifacts
        await knex('transform_outputs').whereIn('artifact_id', stageArtifactIds).del();
        await knex('artifacts').whereIn('id', stageArtifactIds).del();

        console.log(`Restored synopsis_stages artifact for session ${sessionId}`);
    }

    console.log('Synopsis stages refactoring migration reversed');
};

// Helper function to find the outline session ID for a given artifact
async function getOutlineSessionId(knex, artifactId) {
    // Find transforms that have this artifact as output
    const transformOutputs = await knex('transform_outputs')
        .where('artifact_id', artifactId);

    for (const output of transformOutputs) {
        // Get the transform execution context
        const transform = await knex('transforms')
            .where('id', output.transform_id)
            .first();

        if (transform && transform.execution_context) {
            const context = JSON.parse(transform.execution_context);
            if (context.outline_session_id) {
                return context.outline_session_id;
            }
        }
    }

    return null;
} 