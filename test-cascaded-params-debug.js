const fetch = require('node-fetch');

const ARTIFACT_ID = '411af9dc-fea8-48b9-8cbe-24e1b98692bc';

async function testCascadedParametersLoad() {
    console.log('Testing cascaded parameters loading for artifact:', ARTIFACT_ID);

    try {
        // First, get the artifact itself
        const artifactResponse = await fetch(`http://localhost:4600/api/artifacts/${ARTIFACT_ID}`);

        if (!artifactResponse.ok) {
            console.error('Failed to fetch artifact:', artifactResponse.status);
            return;
        }

        const artifact = await artifactResponse.json();
        console.log('\n1. Source artifact:', {
            id: artifact.id,
            type: artifact.type,
            created_at: artifact.created_at
        });

        // Now test the cascaded parameters API call
        const paramsResponse = await fetch(`http://localhost:4600/api/artifacts?type=brainstorm_params&sourceArtifactId=${ARTIFACT_ID}`);

        if (!paramsResponse.ok) {
            console.error('Failed to fetch cascaded parameters:', paramsResponse.status);
            const errorText = await paramsResponse.text();
            console.error('Error response:', errorText);
            return;
        }

        const brainstormArtifacts = await paramsResponse.json();
        console.log('\n2. Cascaded parameters API response:');
        console.log('Number of artifacts found:', brainstormArtifacts.length);

        if (brainstormArtifacts.length > 0) {
            const latestBrainstorm = brainstormArtifacts[0];
            console.log('\n3. Latest brainstorm artifact:', {
                id: latestBrainstorm.id,
                type: latestBrainstorm.type,
                created_at: latestBrainstorm.created_at,
                data: latestBrainstorm.data
            });

            // Check if this would set the right values
            const brainstormData = latestBrainstorm.data;
            console.log('\n4. Values that would be set:');
            console.log('Platform:', brainstormData.platform || '通用');
            console.log('Genre paths:', brainstormData.genre_paths || []);
            console.log('Genre proportions:', brainstormData.genre_proportions || []);
            console.log('Requirements:', brainstormData.requirements || '');
        } else {
            console.log('\n3. No brainstorm artifacts found in lineage');
        }

    } catch (error) {
        console.error('Error testing cascaded parameters:', error);
    }
}

// Run the test
testCascadedParametersLoad(); 