#!/usr/bin/env node

import { ArtifactRepository } from '../repositories/ArtifactRepository.js';
import { db } from '../database/connection.js';

async function testLatestBrainstormIdeas() {
    const artifactRepo = new ArtifactRepository(db);

    try {
        console.log('🔍 Testing getLatestBrainstormIdeas method...\n');

        // Find a project with brainstorm ideas
        const projects = await db
            .selectFrom('projects')
            .select('id')
            .limit(5)
            .execute();

        for (const project of projects) {
            console.log(`📁 Testing project: ${project.id}`);

            // Get regular brainstorm ideas (all versions)
            const allIdeas = await artifactRepo.getProjectArtifactsByType(project.id, 'brainstorm_idea');
            console.log(`   All brainstorm_idea artifacts: ${allIdeas.length}`);

            // Get latest brainstorm ideas (resolved versions)
            const latestIdeas = await artifactRepo.getLatestBrainstormIdeas(project.id);
            console.log(`   Latest brainstorm ideas: ${latestIdeas.length}`);

            if (latestIdeas.length > 0) {
                console.log('   Latest ideas:');
                latestIdeas.forEach((idea, index) => {
                    if (idea.data && (idea.data.title || idea.data.body)) {
                        const title = idea.data.title || 'Untitled';
                        const body = idea.data.body || idea.data.idea_text || 'No content';
                        console.log(`   ${index + 1}. **${title}** (ID: ${idea.id})`);
                        console.log(`      ${body.substring(0, 100)}${body.length > 100 ? '...' : ''}`);
                    }
                });
                console.log('');
                break; // Found data, stop testing other projects
            }
        }

        console.log('✅ Test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
        }
    } finally {
        await db.destroy();
    }
}

testLatestBrainstormIdeas().catch(console.error); 