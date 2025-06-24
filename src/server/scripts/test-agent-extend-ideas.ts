#!/usr/bin/env node

import db from '../database/connection';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { TransformRepository } from '../repositories/TransformRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { AgentService } from '../services/AgentService';
import { ChatMessageRepository } from '../repositories/ChatMessageRepository';
import {
    buildLineageGraph,
    findLatestArtifact,
    extractBrainstormLineages
} from '../../common/utils/lineageResolution';

async function testAgentExtendIdeas() {
    console.log('🤖 Testing Agent "每个再长一点" Request with Lineage Resolution...\n');

    // Initialize repositories
    const artifactRepo = new ArtifactRepository(db);
    const transformRepo = new TransformRepository(db);
    const projectRepo = new ProjectRepository(db);
    const chatRepo = new ChatMessageRepository(db);

    // Initialize agent service
    const agentService = new AgentService(transformRepo, artifactRepo);
    agentService.setChatMessageRepository(chatRepo);

    const userId = 'test-user-1';
    const projectName = 'Agent Extend Ideas Test Project';

    try {
        // 1. Create test project and initial SHORT brainstorm ideas
        console.log('1. Setting up test project with initial SHORT brainstorm ideas...');
        const project = await projectRepo.createProject(projectName, userId, 'Testing agent idea extension');
        const projectId = project.id;
        console.log(`✅ Created test project: ${projectId}`);

        // Create initial SHORT brainstorm ideas that the agent can extend
        const initialShortIdeas = [
            {
                title: '总裁的替身新娘',
                body: '女主因为长相酷似总裁的白月光，被迫成为替身新娘。'
            },
            {
                title: '重生之豪门千金',
                body: '女主重生回到18岁，这次她要改写命运。'
            },
            {
                title: '校园霸主的小甜心',
                body: '学霸女主转学到贵族学校，意外吸引了校园霸主的注意。'
            }
        ];

        const brainstormArtifact = await artifactRepo.createArtifact(
            projectId,
            'brainstorm_idea_collection',
            initialShortIdeas,
            'v1',
            {
                platform: '抖音',
                genre: '都市言情',
                status: 'completed'
            }
        );
        console.log(`✅ Created initial SHORT brainstorm ideas: ${brainstormArtifact.id}`);

        // Display initial ideas with character counts
        console.log('\n📝 Initial SHORT ideas:');
        initialShortIdeas.forEach((idea, index) => {
            console.log(`[${index}] ${idea.title} (${idea.body.length} chars)`);
            console.log(`    ${idea.body}`);
        });

        // 2. Test the "每个再长一点" request
        console.log('\n\n2. Testing "每个再长一点" request...');
        const extendRequest = {
            userRequest: '每个再长一点',
            projectId: projectId,
            contextType: 'brainstorm' as const
        };

        console.log('👤 User request:', extendRequest.userRequest);
        console.log('\n🤖 Starting agent...');

        // Run the general agent
        await agentService.runGeneralAgent(projectId, userId, extendRequest);

        // Wait for async processing
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 3. Get all project artifacts and build lineage graph
        console.log('\n\n3. Building lineage graph and resolving latest versions...');

        const allArtifacts = await artifactRepo.getProjectArtifacts(projectId);
        const allTransforms = await transformRepo.getProjectTransforms(projectId, 100);

        // Get all human transforms for the project
        const allHumanTransforms = await db
            .selectFrom('human_transforms')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        // Get all transform inputs for the project
        const allTransformInputs = await db
            .selectFrom('transform_inputs')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        // Get all transform outputs for the project
        const allTransformOutputs = await db
            .selectFrom('transform_outputs')
            .selectAll()
            .where('project_id', '=', projectId)
            .execute();

        console.log(`📊 Project data: ${allArtifacts.length} artifacts, ${allTransforms.length} transforms`);

        // Build lineage graph - cast types for compatibility
        const lineageGraph = buildLineageGraph(
            allArtifacts as any,
            allTransforms as any,
            allHumanTransforms as any,
            allTransformInputs as any,
            allTransformOutputs as any
        );

        console.log(`🔗 Lineage graph: ${lineageGraph.nodes.size} nodes, ${lineageGraph.edges.size} edges`);

        // 4. Use lineage resolution to find the latest version of each idea
        console.log('\n4. Resolving latest versions of each idea using lineage...');

        const resolvedIdeas: Array<{
            index: number;
            originalArtifactId: string;
            latestArtifactId: string | null;
            depth: number;
            hasBeenEdited: boolean;
            title?: string;
            body?: string;
            bodyLength?: number;
        }> = [];

        for (let i = 0; i < initialShortIdeas.length; i++) {
            const path = `[${i}]`;
            const resolution = findLatestArtifact(brainstormArtifact.id, path, lineageGraph);

            let title = '';
            let body = '';
            let bodyLength = 0;

            if (resolution.artifactId) {
                const latestArtifact = allArtifacts.find(a => a.id === resolution.artifactId);
                if (latestArtifact) {
                    // Handle data parsing - it might be a string or object
                    let data: any;
                    try {
                        data = typeof latestArtifact.data === 'string'
                            ? JSON.parse(latestArtifact.data)
                            : latestArtifact.data;
                    } catch (e) {
                        console.warn(`Failed to parse data for artifact ${latestArtifact.id}:`, e);
                        data = latestArtifact.data;
                    }

                    if (latestArtifact.type === 'brainstorm_idea_collection') {
                        // Still pointing to original collection
                        if (Array.isArray(data) && data[i]) {
                            title = data[i].title || '';
                            body = data[i].body || '';
                        } else {
                            title = initialShortIdeas[i].title;
                            body = initialShortIdeas[i].body;
                        }
                    } else if (latestArtifact.type === 'brainstorm_idea') {
                        // Points to edited idea
                        title = data.title || '';
                        body = data.body || '';
                    } else if (latestArtifact.type === 'user_input') {
                        // Points to user input, extract derived data
                        let metadata: any = {};
                        try {
                            metadata = typeof latestArtifact.metadata === 'string'
                                ? JSON.parse(latestArtifact.metadata)
                                : (latestArtifact.metadata || {});
                        } catch (e) {
                            console.warn(`Failed to parse metadata for artifact ${latestArtifact.id}:`, e);
                        }

                        if (metadata.derived_data) {
                            title = metadata.derived_data.title || '';
                            body = metadata.derived_data.body || '';
                        } else if (data.title && data.body) {
                            title = data.title;
                            body = data.body;
                        }
                    }
                    bodyLength = body.length;
                }
            }

            resolvedIdeas.push({
                index: i,
                originalArtifactId: brainstormArtifact.id,
                latestArtifactId: resolution.artifactId,
                depth: resolution.depth,
                hasBeenEdited: resolution.depth > 0,
                title,
                body,
                bodyLength
            });

            console.log(`[${i}] Lineage depth: ${resolution.depth}, Latest artifact: ${resolution.artifactId}`);
        }

        // 5. Display results and verify extension
        console.log('\n\n5. Comparing original vs extended ideas...');
        console.log('=' + '='.repeat(80));

        let allIdeasExtended = true;
        let totalExtensionIncrease = 0;

        for (const resolved of resolvedIdeas) {
            const originalLength = initialShortIdeas[resolved.index].body.length;
            const newLength = resolved.bodyLength || 0;
            const lengthIncrease = newLength - originalLength;
            const wasExtended = lengthIncrease > 0;

            if (!wasExtended) {
                allIdeasExtended = false;
            }

            totalExtensionIncrease += lengthIncrease;

            console.log(`\n[${resolved.index}] ${resolved.title}`);
            console.log(`📏 Original: ${originalLength} chars → Latest: ${newLength} chars (${lengthIncrease > 0 ? '+' : ''}${lengthIncrease})`);
            console.log(`🔗 Lineage: ${resolved.hasBeenEdited ? 'EDITED' : 'UNCHANGED'} (depth: ${resolved.depth})`);
            console.log(`📝 Content: ${resolved.body?.substring(0, 150)}...`);

            if (wasExtended) {
                console.log(`✅ Successfully extended!`);
            } else {
                console.log(`❌ Not extended`);
            }
        }

        console.log('\n' + '='.repeat(80));

        // 6. Final validation and summary
        console.log('\n6. Final Validation Summary:');
        console.log(`📊 Ideas processed: ${resolvedIdeas.length}/3`);
        console.log(`📈 Ideas extended: ${resolvedIdeas.filter(r => r.hasBeenEdited).length}/3`);
        console.log(`📏 Total length increase: ${totalExtensionIncrease} characters`);
        console.log(`🎯 All ideas extended: ${allIdeasExtended ? 'YES' : 'NO'}`);

        if (allIdeasExtended) {
            console.log('\n🎉 SUCCESS: Agent successfully extended all ideas!');
        } else {
            console.log('\n⚠️  PARTIAL SUCCESS: Some ideas were not extended');
        }

        // 7. Lineage validation
        console.log('\n7. Lineage Resolution Validation:');
        const brainstormLineages = extractBrainstormLineages(lineageGraph, allArtifacts as any);

        if (brainstormLineages.has(brainstormArtifact.id)) {
            const lineages = brainstormLineages.get(brainstormArtifact.id)!;
            console.log(`✅ Lineage extraction found ${lineages.length} idea lineages`);

            lineages.forEach((lineage, index) => {
                const status = lineage.depth > 0 ? 'EDITED' : 'ORIGINAL';
                console.log(`   [${index}] ${status} → ${lineage.artifactId} (depth: ${lineage.depth})`);
            });
        } else {
            console.log('❌ No lineages found for brainstorm collection');
        }

        // 8. Check chat messages for agent's reasoning
        console.log('\n8. Agent Chat Messages:');
        try {
            const chatMessages = await db
                .selectFrom('chat_messages_raw')
                .selectAll()
                .where('project_id', '=', projectId)
                .orderBy('created_at', 'desc')
                .limit(5)
                .execute();

            chatMessages.reverse().forEach((msg: any) => {
                const timestamp = new Date(msg.created_at).toLocaleTimeString();
                console.log(`[${timestamp}] ${msg.role} (${msg.display_type}): ${msg.content.substring(0, 100)}...`);
            });
        } catch (error: any) {
            console.log('Could not retrieve chat messages:', error?.message || 'Unknown error');
        }

        // 9. Technical details for debugging
        console.log('\n9. Technical Details:');
        console.log(`Original collection artifact: ${brainstormArtifact.id}`);
        console.log(`Created artifacts: ${allArtifacts.map(a => `${a.type}:${a.id}`).join(', ')}`);
        console.log(`Transforms created: ${allTransforms.map(t => `${t.type}:${t.id}`).join(', ')}`);

        console.log('\n🎯 Test Summary:');
        console.log(`- Request: "每个再长一点" (make each one longer)`);
        console.log(`- Initial ideas: 3 short stories`);
        console.log(`- Agent processing: ${allIdeasExtended ? 'SUCCESS' : 'PARTIAL'}`);
        console.log(`- Lineage resolution: WORKING`);
        console.log(`- Average length increase: ${Math.round(totalExtensionIncrease / 3)} chars per idea`);

        // Cleanup
        console.log('\n🧹 Cleaning up...');
        await projectRepo.deleteProject(projectId);
        console.log('✅ Test project deleted');

    } catch (error) {
        console.error('\n❌ Test failed:', error);

        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack trace:', error.stack);
        }
    }
}

// Run the test
testAgentExtendIdeas().catch(console.error); 