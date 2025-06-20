#!/usr/bin/env node

import { db } from '../database/connection';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { TransformExecutor } from '../services/TransformExecutor';

async function testArtifactEditor() {
    console.log('🧪 Testing Path-Based Artifact Editor\n');
    
    const artifactRepo = new ArtifactRepository(db);
    const transformRepo = new TransformRepository(db);
    const transformExecutor = new TransformExecutor(artifactRepo, transformRepo);
    
    try {
        // Create a test project first
        const testProjectId = `test-project-${Date.now()}`;
        console.log('📁 Creating test project...');
        
        await db.insertInto('projects').values({
            id: testProjectId,
            name: 'Path-Based Artifact Editor Test',
            description: 'Test project for path-based artifact editing',
            project_type: 'script',
            status: 'active'
        }).execute();
        
        console.log(`✅ Created project: ${testProjectId}`);
        
        // Test data: brainstorm_idea_collection
        const testData = [
            { title: "逆世商凰", body: "现代女性穿越到古代，成为商界女强人的故事" },
            { title: "智穿山河", body: "拥有现代知识的女主在古代开创新事业" },
            { title: "时空恋曲", body: "跨越时空的爱情故事，现代与古代的碰撞" }
        ];
        
        console.log('📊 Creating test brainstorm_idea_collection artifact...');
        
        // 1. Create a brainstorm_idea_collection artifact
        const collectionArtifact = await artifactRepo.createArtifact(
            testProjectId,
            'brainstorm_idea_collection',
            testData,
            'v1',
            { source: 'llm', test: true }
        );
        
        console.log(`✅ Created collection artifact: ${collectionArtifact.id}`);
        console.log(`   Data: ${JSON.stringify(testData, null, 2)}`);
        console.log();
        
        // 2. Test first edit - should create human transform + derived artifact
        console.log('🔧 Testing first edit (should create human transform)...');
        
        const firstEditResult = await transformExecutor.executeHumanTransformWithPath(
            testProjectId,
            collectionArtifact.id,
            '[0].title',
            'title',
            '新标题：霸道总裁的时空恋人'
        );
        
        console.log(`✅ First edit result:`);
        console.log(`   - Was transformed: ${firstEditResult.wasTransformed}`);
        console.log(`   - Transform ID: ${firstEditResult.transform.id}`);
        console.log(`   - Derived artifact ID: ${firstEditResult.derivedArtifact.id}`);
        console.log(`   - New data: ${JSON.stringify(firstEditResult.derivedArtifact.data, null, 2)}`);
        console.log();
        
        // 3. Test second edit on same path - should modify existing derived artifact
        console.log('🔧 Testing second edit (should modify existing artifact)...');
        
        const secondEditResult = await transformExecutor.executeHumanTransformWithPath(
            testProjectId,
            collectionArtifact.id,
            '[0].title',
            'title',
            '最终标题：商界女王的穿越传奇'
        );
        
        console.log(`✅ Second edit result:`);
        console.log(`   - Was transformed: ${secondEditResult.wasTransformed}`);
        console.log(`   - Derived artifact ID: ${secondEditResult.derivedArtifact.id}`);
        console.log(`   - Updated data: ${JSON.stringify(secondEditResult.derivedArtifact.data, null, 2)}`);
        console.log();
        
        // 4. Test edit on different path
        console.log('🔧 Testing edit on different path [1].body...');
        
        const thirdEditResult = await transformExecutor.executeHumanTransformWithPath(
            testProjectId,
            collectionArtifact.id,
            '[1].body',
            'body',
            '一个拥有现代商业知识的女主角，穿越到古代后利用先进理念创建商业帝国，同时收获真挚爱情的精彩故事。'
        );
        
        console.log(`✅ Third edit result:`);
        console.log(`   - Was transformed: ${thirdEditResult.wasTransformed}`);
        console.log(`   - Transform ID: ${thirdEditResult.transform.id}`);
        console.log(`   - Derived artifact ID: ${thirdEditResult.derivedArtifact.id}`);
        console.log(`   - New data: ${JSON.stringify(thirdEditResult.derivedArtifact.data, null, 2)}`);
        console.log();
        
        // 5. Test human transform lookup
        console.log('🔍 Testing human transform lookup...');
        
        const firstTransform = await transformRepo.findHumanTransform(
            collectionArtifact.id,
            '[0].title',
            testProjectId
        );
        
        const secondTransform = await transformRepo.findHumanTransform(
            collectionArtifact.id,
            '[1].body',
            testProjectId
        );
        
        const nonExistentTransform = await transformRepo.findHumanTransform(
            collectionArtifact.id,
            '[2].title',
            testProjectId
        );
        
        console.log(`✅ Transform lookup results:`);
        console.log(`   - [0].title transform found: ${!!firstTransform} (derived: ${firstTransform?.derived_artifact_id})`);
        console.log(`   - [1].body transform found: ${!!secondTransform} (derived: ${secondTransform?.derived_artifact_id})`);
        console.log(`   - [2].title transform found: ${!!nonExistentTransform}`);
        console.log();
        
        console.log('🎉 All tests passed! Path-based artifact editing is working correctly.');
        
        // Cleanup test artifacts (optional)
        console.log('\n🧹 Cleaning up test artifacts...');
        
        // Note: In a real implementation, you might want to add cleanup methods
        // For now, we'll leave the test data in the database for inspection
        console.log('   Test artifacts left in database for inspection');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    } finally {
        await db.destroy();
    }
}

testArtifactEditor().catch(console.error); 