#!/usr/bin/env node

import { db } from '../database/connection';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';

async function testArtifactEditor() {
    const artifactRepo = new ArtifactRepository(db);
    const transformRepo = new TransformRepository(db);

    console.log('🧪 Testing Artifact Editor functionality...\n');

    try {
        // 1. Create a test project
        const projectId = 'test-proj-' + Date.now();
        console.log('📁 Creating test project...');

        await db.insertInto('projects').values({
            id: projectId,
            name: 'Artifact Editor Test Project',
            description: 'Test project for artifact editor functionality',
            project_type: 'script',
            status: 'active'
        }).execute();

        console.log(`✅ Created project: ${projectId}`);

        // 2. Create sample brainstorm_idea artifacts
        console.log('📝 Creating sample brainstorm idea artifacts...');

        const idea1 = await artifactRepo.createArtifact(
            projectId,
            'brainstorm_idea',
            {
                idea_title: '逆世商凰',
                idea_text: '现代商业女强人穿越到古代成为落魄庶女，凭借卓越的商业头脑和坚韧品格，从家族边缘人逆袭成为权倾朝野的商业女皇。',
                order_index: 1,
                confidence_score: 85
            },
            'v1',
            {
                source: 'llm',
                generated_at: new Date().toISOString(),
                generator: 'test-script'
            }
        );

        console.log(`✅ Created idea 1: ${idea1.id}`);
        console.log('🎉 Artifact Editor test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

// Run the test
testArtifactEditor()
    .then(() => process.exit(0))
    .catch(() => process.exit(1)); 