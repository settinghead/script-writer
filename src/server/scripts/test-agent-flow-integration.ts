/**
 * Integration test for AgentService flow: brainstorm generation → editing → outline creation
 * Tests the complete natural language interaction flow with seeded LLM calls
 */

import { db } from '../database/connection';
import { AgentService } from '../services/AgentService';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { ChatMessageRepository } from '../repositories/ChatMessageRepository';
import { ProjectService } from '../services/ProjectService';
import { v4 as uuidv4 } from 'uuid';
import {
    buildLineageGraph,
    findLatestArtifact,
    validateLineageIntegrity,
    findEffectiveBrainstormIdeas,
    findMainWorkflowPath,
    type LineageGraph
} from '../../common/utils/lineageResolution';

// Test configuration
const TEST_USER_ID = 'test-user-1';
const TEST_SEED = 12345; // Fixed seed for reproducible results

/**
 * Comprehensive lineage validation function
 * Validates the complete lineage graph and ensures proper relationships
 */
async function validateCompleteLineage(
    projectId: string,
    artifactRepo: ArtifactRepository,
    transformRepo: TransformRepository
): Promise<void> {

    // Get all project data needed for lineage resolution
    const artifactsRaw = await artifactRepo.getProjectArtifacts(projectId, 200);
    const transformsRaw = await transformRepo.getProjectTransforms(projectId, 200);

    // Get human transforms, transform inputs, and outputs via SQL
    const humanTransformsRaw = await db
        .selectFrom('human_transforms')
        .selectAll()
        .where('project_id', '=', projectId)
        .execute();

    const transformInputsRaw = await db
        .selectFrom('transform_inputs')
        .selectAll()
        .where('project_id', '=', projectId)
        .execute();

    const transformOutputsRaw = await db
        .selectFrom('transform_outputs')
        .selectAll()
        .where('project_id', '=', projectId)
        .execute();

    // Convert to Electric types (cast for compatibility with lineage functions)
    const artifacts = artifactsRaw as any[];
    const transforms = transformsRaw as any[];
    const humanTransforms = humanTransformsRaw as any[];
    const transformInputs = transformInputsRaw as any[];
    const transformOutputs = transformOutputsRaw as any[];

    console.log(`📊 Found: ${artifacts.length} artifacts, ${transforms.length} transforms, ${humanTransforms.length} human transforms`);
    console.log(`🔗 Found: ${transformInputs.length} transform inputs, ${transformOutputs.length} transform outputs`);

    // Step 1: Build and validate lineage graph
    console.log('\n📐 Step 1: Building lineage graph...');
    const lineageGraph = buildLineageGraph(
        artifacts,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs
    );

    console.log(`✅ Lineage graph built: ${lineageGraph.nodes.size} nodes, ${lineageGraph.edges.size} edges`);
    console.log(`🌳 Root nodes: ${lineageGraph.rootNodes.size}`);

    // Step 2: Validate lineage integrity
    console.log('\n🔍 Step 2: Validating lineage integrity...');
    const validationResult = validateLineageIntegrity(lineageGraph);

    if (!validationResult.isValid) {
        console.error('❌ Lineage integrity validation failed:');
        validationResult.errors.forEach(error => console.error(`  - ${error}`));
        throw new Error('Lineage integrity validation failed');
    }

    if (validationResult.warnings.length > 0) {
        console.warn('⚠️  Lineage validation warnings:');
        validationResult.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    console.log('✅ Lineage integrity validated successfully');

    // Step 3: Test effective brainstorm ideas resolution
    console.log('\n💡 Step 3: Testing effective brainstorm ideas resolution...');
    try {
        const effectiveIdeas = findEffectiveBrainstormIdeas(lineageGraph, artifacts);
        console.log(`✅ Found ${effectiveIdeas.length} effective brainstorm ideas`);

        effectiveIdeas.forEach((idea, index) => {
            console.log(`  ${index + 1}. Artifact ${idea.artifactId} (path: ${idea.artifactPath})`);
            console.log(`     - From collection: ${idea.isFromCollection}`);
            console.log(`     - Index: ${idea.index}`);
        });
    } catch (error) {
        console.error('❌ Effective brainstorm ideas resolution failed:', error);
        throw error;
    }

    // Step 4: Test main workflow path
    console.log('\n🗺️  Step 4: Testing main workflow path detection...');
    try {
        const workflowNodes = findMainWorkflowPath(artifacts, lineageGraph);
        console.log(`✅ Found workflow path with ${workflowNodes.length} nodes`);

        workflowNodes.forEach((node, index) => {
            console.log(`  ${index + 1}. ${node.type}: "${node.title}" (${node.artifactId})`);
        });
    } catch (error) {
        console.error('❌ Main workflow path detection failed:', error);
        throw error;
    }

    // Step 5: Test latest artifact resolution for any edits
    console.log('\n🔄 Step 5: Testing latest artifact resolution...');
    const brainstormCollections = artifacts.filter(a =>
        a.type === 'brainstorm_idea_collection' || a.schema_type === 'brainstorm_collection_schema'
    );

    for (const collection of brainstormCollections) {
        console.log(`🔍 Testing resolution for collection ${collection.id}...`);

        // Test first idea resolution
        const resolutionResult = findLatestArtifact(collection.id, '$.ideas[0]', lineageGraph);

        if (resolutionResult.artifactId !== collection.id) {
            console.log(`  ✅ Idea [0] resolved to different artifact: ${resolutionResult.artifactId}`);
            console.log(`     - Lineage depth: ${resolutionResult.depth}`);
            console.log(`     - Lineage path length: ${resolutionResult.lineagePath.length}`);
        } else {
            console.log(`  📝 Idea [0] no edits found (resolution: same artifact)`);
        }
    }

    // Step 6: Validate proper source artifact linking
    console.log('\n🔗 Step 6: Validating transform input relationships...');
    let editTransformsFound = 0;
    let sourceLinksValidated = 0;

    for (const transform of transforms) {
        if (transform.type === 'llm') {
            const inputs = transformInputs.filter((ti: any) => ti.transform_id === transform.id);
            const outputs = transformOutputs.filter((to: any) => to.transform_id === transform.id);

            // Check if this transform has both tool_input and source inputs (indicating it's an edit)
            const hasToolInput = inputs.some((input: any) => input.input_role === 'tool_input');
            const hasSourceInput = inputs.some((input: any) => input.input_role === 'source');

            if (hasToolInput && hasSourceInput) {
                editTransformsFound++;
                const sourceInput = inputs.find((input: any) => input.input_role === 'source');
                if (sourceInput) {
                    console.log(`  ✅ Edit transform ${transform.id} links to source artifact ${sourceInput.artifact_id}`);
                    sourceLinksValidated++;
                }
            }
        }
    }

    if (editTransformsFound === 0) {
        console.log('  📝 No edit transforms found (only generation transforms)');
    } else {
        console.log(`  ✅ Validated ${sourceLinksValidated}/${editTransformsFound} edit transform source links`);
    }

    console.log('\n🎉 All lineage validation tests passed!');
}

async function runAgentFlowIntegrationTest() {
    console.log('\n🚀 Starting Agent Flow Integration Test');
    console.log('===============================================');

    const projectService = new ProjectService(db);
    const transformRepo = new TransformRepository(db);
    const artifactRepo = new ArtifactRepository(db);
    const chatMessageRepo = new ChatMessageRepository(db);
    const agentService = new AgentService(transformRepo, artifactRepo);

    // Inject chat message repository
    agentService.setChatMessageRepository(chatMessageRepo);

    // Generate unique test project ID
    const testProjectId = `test-project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`📋 Test Project ID: ${testProjectId}`);
    console.log(`👤 Test User ID: ${TEST_USER_ID}`);
    console.log(`🎲 Seed: ${TEST_SEED}\n`);

    try {
        // Step 0: Create test project
        console.log('🏗️  STEP 0: Creating test project...');
        await projectService.createTestProject(testProjectId, TEST_USER_ID, 'Agent Flow Integration Test');
        console.log('✅ Test project created successfully\n');

        // Step 1: Generate brainstorm ideas with natural language request
        console.log('💡 STEP 1: Generating brainstorm ideas...');
        const brainstormRequest = {
            userRequest: '请帮我为一个现代都市甜宠剧生成一些创意故事想法。我想要男主是霸道总裁，女主是普通职场女性的设定。希望有一些误会和追妻火葬场的情节。',
            projectId: testProjectId,
            contextType: 'brainstorm' as const
        };

        await agentService.runGeneralAgent(testProjectId, TEST_USER_ID, brainstormRequest, {
            createChatMessages: true,
            enableCaching: true,
            seed: TEST_SEED,
            temperature: 0.7,
            topP: 0.9,
            maxTokens: 4000
        });
        console.log('✅ Brainstorm ideas generated successfully\n');

        // Step 2: Get generated brainstorm ideas
        console.log('📄 STEP 2: Retrieving generated brainstorm ideas...');
        const brainstormArtifacts = await artifactRepo.getArtifactsByType(testProjectId, 'brainstorm_idea_collection');

        if (brainstormArtifacts.length === 0) {
            throw new Error('No brainstorm ideas were generated');
        }

        const brainstormData = brainstormArtifacts[0].data;
        console.log(`✅ Found ${brainstormData.ideas?.length || 0} brainstorm ideas`);

        if (brainstormData.ideas && brainstormData.ideas.length > 0) {
            console.log(`📝 First idea title: "${brainstormData.ideas[0].title}"`);
            console.log(`📝 First idea summary: "${brainstormData.ideas[0].body?.substring(0, 100)}..."\n`);
        }

        // Step 3: Edit the first brainstorm idea with natural language request
        console.log('✏️  STEP 3: Editing the first brainstorm idea...');
        const editRequest = {
            userRequest: `请帮我改进第一个故事创意。我希望增加一些职场竞争的元素，让女主更加独立自强。同时加强男主的人物设定，让他不只是霸道，还要有温柔和专业的一面。请保留原有的甜宠元素。`,
            projectId: testProjectId,
            contextType: 'brainstorm' as const
        };

        await agentService.runGeneralAgent(testProjectId, TEST_USER_ID, editRequest, {
            createChatMessages: true,
            enableCaching: true,
            seed: TEST_SEED + 1, // Slightly different seed for different operation
            temperature: 0.7,
            topP: 0.9,
            maxTokens: 4000
        });
        console.log('✅ Brainstorm idea edited successfully\n');

        // Step 4: Get the edited brainstorm ideas
        console.log('📄 STEP 4: Retrieving edited brainstorm ideas...');
        const updatedBrainstormArtifacts = await artifactRepo.getArtifactsByType(testProjectId, 'brainstorm_idea_collection');

        // Get the most recent artifact
        const latestBrainstormArtifact = updatedBrainstormArtifacts.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        const updatedBrainstormData = latestBrainstormArtifact.data;
        console.log(`✅ Retrieved updated brainstorm with ${updatedBrainstormData.ideas?.length || 0} ideas`);

        if (updatedBrainstormData.ideas && updatedBrainstormData.ideas.length > 0) {
            console.log(`📝 Updated first idea title: "${updatedBrainstormData.ideas[0].title}"`);
            console.log(`📝 Updated first idea summary: "${updatedBrainstormData.ideas[0].body?.substring(0, 100)}..."\n`);
        }

        // Step 5: Generate outline from the edited idea
        console.log('📋 STEP 5: Generating outline from the edited idea...');
        const outlineRequest = {
            userRequest: `我想要基于刚才编辑过的第一个故事创意来生成一个详细的故事大纲。请创建一个80集的现代都市甜宠剧大纲，包含主要人物设定、故事发展脉络、冲突点和情感转折。`,
            projectId: testProjectId,
            contextType: 'general' as const
        };

        await agentService.runGeneralAgent(testProjectId, TEST_USER_ID, outlineRequest, {
            createChatMessages: true,
            enableCaching: true,
            seed: TEST_SEED + 2, // Slightly different seed for outline operation
            temperature: 0.7,
            topP: 0.9,
            maxTokens: 4000
        });
        console.log('✅ Outline generated successfully\n');

        // Step 6: Verify outline was generated
        console.log('📄 STEP 6: Verifying outline generation...');
        const outlineArtifacts = await artifactRepo.getArtifactsByType(testProjectId, 'outline_response');

        if (outlineArtifacts.length === 0) {
            console.log('⚠️  No outline artifacts found, checking for other outline-related artifacts...');
            const allArtifacts = await artifactRepo.getProjectArtifacts(testProjectId, 100);
            const outlineRelated = allArtifacts.filter(a => a.type.includes('outline'));
            console.log(`📋 Found ${outlineRelated.length} outline-related artifacts:`,
                outlineRelated.map(a => a.type));
        } else {
            const outlineData = outlineArtifacts[0].data;
            console.log(`✅ Outline generated successfully`);
            console.log(`📝 Outline title: "${outlineData.title || 'No title'}"`);
            console.log(`📝 Character count: ${outlineData.characters?.length || 0}`);
            console.log(`📝 Synopsis stages: ${outlineData.synopsis_stages?.length || 0}\n`);
        }

        // Step 7: Comprehensive Lineage Validation
        console.log('🔍 STEP 7: Comprehensive Lineage Validation');
        console.log('=============================================');
        await validateCompleteLineage(testProjectId, artifactRepo, transformRepo);

        // Step 8: Display final statistics
        console.log('\n📊 STEP 8: Final Test Statistics');
        console.log('================================');

        const finalArtifacts = await artifactRepo.getProjectArtifacts(testProjectId, 100);
        const finalTransforms = await transformRepo.getProjectTransforms(testProjectId, 100);
        const finalChatMessages = await chatMessageRepo.getDisplayMessages(testProjectId);

        console.log(`📋 Total artifacts created: ${finalArtifacts.length}`);
        console.log(`⚙️  Total transforms executed: ${finalTransforms.length}`);
        console.log(`💬 Total chat messages: ${finalChatMessages.length}`);

        console.log('\n📋 Artifacts by type:');
        const artifactsByType = finalArtifacts.reduce((acc, artifact) => {
            acc[artifact.type] = (acc[artifact.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        Object.entries(artifactsByType).forEach(([type, count]) => {
            console.log(`  - ${type}: ${count}`);
        });

        console.log('\n⚙️  Transforms by status:');
        const transformsByStatus = finalTransforms.reduce((acc, transform) => {
            acc[transform.status || 'unknown'] = (acc[transform.status || 'unknown'] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        Object.entries(transformsByStatus).forEach(([status, count]) => {
            console.log(`  - ${status}: ${count}`);
        });

        console.log('\n🎉 Integration test completed successfully!');

    } catch (error) {
        console.error('\n❌ Integration test failed:', error);

        // Try to get some debugging information
        try {
            const artifacts = await artifactRepo.getProjectArtifacts(testProjectId, 50);
            const transforms = await transformRepo.getProjectTransforms(testProjectId, 50);
            console.log(`\n🔍 Debug info: ${artifacts.length} artifacts, ${transforms.length} transforms created before failure`);
        } catch (debugError) {
            console.error('Could not retrieve debug information:', debugError);
        }

        throw error;

    } finally {
        // Step 9: Cleanup - wipe the test project
        console.log('\n🧹 STEP 9: Cleaning up test project...');
        try {
            await projectService.wipeProject(testProjectId);
            console.log('✅ Test project wiped successfully');
        } catch (cleanupError) {
            console.error('❌ Failed to cleanup test project:', cleanupError);
        }
    }
}

// Run the test
if (require.main === module) {
    runAgentFlowIntegrationTest()
        .then(() => {
            console.log('\n✅ Agent Flow Integration Test completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Agent Flow Integration Test failed:', error);
            process.exit(1);
        });
}

export { runAgentFlowIntegrationTest }; 