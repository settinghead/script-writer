#!/usr/bin/env node

import db from '../database/connection';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { HumanTransformExecutor } from '../services/HumanTransformExecutor';

async function testHumanTransformUpsert() {
    console.log('🧪 Testing Human Transform Upsert Behavior');

    const artifactRepo = new ArtifactRepository(db);
    const transformRepo = new TransformRepository(db);
    const executor = new HumanTransformExecutor(artifactRepo, transformRepo);

    try {
        // Use the existing project ID
        const projectId = 'b1da3885-73a9-4ce0-a191-f679db11bd6c';

        // Use one of the existing brainstorm ideas
        const sourceArtifactId = 'a5a44d54-2d6e-425d-bd31-73a959009b8b';

        console.log('\n1️⃣ First call - should create new transform');
        const result1 = await executor.executeSchemaHumanTransform(
            'edit_brainstorm_idea',
            sourceArtifactId,
            '', // empty path for whole object
            projectId,
            { title: 'Modified Title 1' }
        );

        console.log('Result 1:', {
            transformId: result1.transform.id,
            derivedArtifactId: result1.derivedArtifact.id,
            wasTransformed: result1.wasTransformed,
            title: result1.derivedArtifact.data?.title || 'N/A'
        });

        console.log('\n2️⃣ Second call - should return existing transform');
        const result2 = await executor.executeSchemaHumanTransform(
            'edit_brainstorm_idea',
            sourceArtifactId,
            '', // same path
            projectId,
            { title: 'Modified Title 2', body: 'Modified Body 2' }
        );

        console.log('Result 2:', {
            transformId: result2.transform.id,
            derivedArtifactId: result2.derivedArtifact.id,
            wasTransformed: result2.wasTransformed,
            title: result2.derivedArtifact.data?.title || 'N/A',
            body: result2.derivedArtifact.data?.body || 'N/A'
        });

        console.log('\n3️⃣ Verification');
        console.log('Transform IDs match:', result1.transform.id === result2.transform.id);
        console.log('Derived artifact IDs match:', result1.derivedArtifact.id === result2.derivedArtifact.id);
        console.log('First was new transform:', result1.wasTransformed);
        console.log('Second was upsert:', !result2.wasTransformed);

        if (result1.transform.id === result2.transform.id &&
            result1.derivedArtifact.id === result2.derivedArtifact.id &&
            result1.wasTransformed && !result2.wasTransformed) {
            console.log('✅ Upsert behavior working correctly!');
        } else {
            console.log('❌ Upsert behavior not working as expected');
        }

        // Check the actual artifact in database
        console.log('\n4️⃣ Database verification');
        const finalArtifact = await artifactRepo.getArtifact(result2.derivedArtifact.id);
        console.log('Final artifact data:', finalArtifact?.data);

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await db.destroy();
    }
}

// Run the test
testHumanTransformUpsert().catch(console.error); 