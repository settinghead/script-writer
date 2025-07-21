import { JsondocRepository } from './src/server/transform-jsondoc-framework/JsondocRepository.js';
import { db } from './src/server/database/connection.js';
import { computeCanonicalJsondocsFromLineage } from './src/common/canonicalJsondocLogic.js';
import { buildLineageGraph } from './src/common/transform-jsondoc-framework/lineageResolution.js';

async function checkCanonicalContext() {
    const repo = new JsondocRepository(db);
    const projectId = '6b43f133-14ed-405a-9f29-89a2e26b59f0';

    console.log('Getting project data for lineage computation...');

    // Get all project data for lineage computation
    const jsondocs = await repo.getAllProjectJsondocsForLineage(projectId);
    const transforms = await repo.getAllProjectTransformsForLineage(projectId);
    const humanTransforms = await repo.getAllProjectHumanTransformsForLineage(projectId);
    const transformInputs = await repo.getAllProjectTransformInputsForLineage(projectId);
    const transformOutputs = await repo.getAllProjectTransformOutputsForLineage(projectId);

    console.log('Building lineage graph...');

    // Build lineage graph
    const lineageGraph = buildLineageGraph(
        jsondocs,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    console.log('Computing canonical jsondocs...');

    // Compute canonical jsondocs
    const canonicalContext = computeCanonicalJsondocsFromLineage(
        lineageGraph,
        jsondocs,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    console.log('\nCanonical Context:');
    console.log('- hasBrainstormInput:', !!canonicalContext.canonicalBrainstormInput);
    console.log('- hasBrainstormCollection:', !!canonicalContext.canonicalBrainstormCollection);
    console.log('- hasBrainstormIdea:', !!canonicalContext.canonicalBrainstormIdea);
    console.log('- hasOutlineSettings:', !!canonicalContext.canonicalOutlineSettings);
    console.log('- hasChronicles:', !!canonicalContext.canonicalChronicles);
    console.log('- hasEpisodePlanning:', !!canonicalContext.canonicalEpisodePlanning);
    console.log('- hasEpisodeSynopsis count:', canonicalContext.canonicalEpisodeSynopsisList.length);

    if (canonicalContext.canonicalEpisodePlanning) {
        console.log('\nEpisode Planning Details:');
        console.log('- ID:', canonicalContext.canonicalEpisodePlanning.id);
        console.log('- Schema Type:', canonicalContext.canonicalEpisodePlanning.schema_type);
        console.log('- Origin Type:', canonicalContext.canonicalEpisodePlanning.origin_type);
    } else {
        console.log('\nNo episode planning found!');

        // Let's check what jsondocs exist
        console.log('\nAll jsondocs:');
        jsondocs.forEach(doc => {
            console.log(`- ${doc.schema_type}: ${doc.id} (${doc.origin_type})`);
        });
    }

    // Let's also check what tools would be available
    console.log('\nTool availability check:');
    const hasBrainstormResult = !!canonicalContext.canonicalBrainstormCollection || !!canonicalContext.canonicalBrainstormIdea;
    console.log('- generate_brainstorm_ideas:', !hasBrainstormResult);
    console.log('- edit_brainstorm_idea:', hasBrainstormResult);
    console.log('- generate_outline_settings:', !!canonicalContext.canonicalBrainstormIdea && !canonicalContext.canonicalOutlineSettings);
    console.log('- edit_outline_settings:', !!canonicalContext.canonicalOutlineSettings);
    console.log('- generate_chronicles:', !!canonicalContext.canonicalOutlineSettings && !canonicalContext.canonicalChronicles);
    console.log('- edit_chronicles:', !!canonicalContext.canonicalChronicles);
    console.log('- generate_episode_planning:', !!canonicalContext.canonicalChronicles && !canonicalContext.canonicalEpisodePlanning);
    console.log('- edit_episode_planning:', !!canonicalContext.canonicalEpisodePlanning);
    console.log('- generate_episode_synopsis:', !!canonicalContext.canonicalEpisodePlanning);
}

checkCanonicalContext().catch(console.error).finally(() => process.exit(0)); 