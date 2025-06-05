#!/usr/bin/env node

import { ArtifactRepository } from './src/server/repositories/ArtifactRepository.js';
import Database from 'better-sqlite3';

const db = new Database('./database.db');
const artifactRepo = new ArtifactRepository(db);

async function debugScriptExists() {
    try {
        // Get all users
        const users = db.prepare('SELECT id, username FROM users').all();
        console.log('🔍 Available users:', users);

        for (const user of users) {
            console.log(`\n📋 Checking artifacts for user: ${user.username} (${user.id})`);
            
            // Get all episode_script artifacts for this user
            const scriptArtifacts = await artifactRepo.getArtifactsByType(user.id, 'episode_script');
            console.log(`🎬 Found ${scriptArtifacts.length} episode_script artifacts`);
            
            for (const artifact of scriptArtifacts) {
                const scriptData = artifact.data;
                console.log(`   📄 Script artifact ${artifact.id}:`);
                console.log(`      - Episode Number: ${scriptData.episodeNumber}`);
                console.log(`      - Script Content Length: ${scriptData.scriptContent?.length || 0}`);
                console.log(`      - Scenes Count: ${scriptData.scenes?.length || 0}`);
                console.log(`      - Created: ${artifact.created_at}`);
                
                // Check if scriptContent is placeholder
                if (scriptData.scriptContent) {
                    const isPlaceholder = scriptData.scriptContent.includes('完整剧本文本') || 
                                         scriptData.scriptContent.includes('剧本内容') ||
                                         scriptData.scriptContent.length < 20;
                    console.log(`      - Is Placeholder: ${isPlaceholder}`);
                }
            }
            
            // Test the specific query that checkScriptExists uses
            console.log(`\n🔍 Testing checkScriptExists for episode 1:`);
            const matchingScript = scriptArtifacts.find(artifact => {
                const scriptData = artifact.data;
                return scriptData.episodeNumber.toString() === '1';
            });
            console.log(`   Result: ${!!matchingScript ? 'EXISTS' : 'NOT FOUND'}`);
            
            if (matchingScript) {
                console.log(`   Matched artifact: ${matchingScript.id}`);
                console.log(`   Episode number: ${matchingScript.data.episodeNumber}`);
            }
        }

        // Also check transforms related to script generation
        console.log(`\n🔄 Checking script generation transforms:`);
        const transforms = db.prepare(`
            SELECT id, status, execution_context, created_at 
            FROM transforms 
            WHERE execution_context LIKE '%script_generation%' 
            ORDER BY created_at DESC 
            LIMIT 10
        `).all();
        
        for (const transform of transforms) {
            const context = JSON.parse(transform.execution_context || '{}');
            console.log(`   🔄 Transform ${transform.id}:`);
            console.log(`      - Status: ${transform.status}`);
            console.log(`      - Template: ${context.template_id}`);
            console.log(`      - Created: ${transform.created_at}`);
            
            // Check outputs
            const outputs = db.prepare(`
                SELECT artifact_id, output_role 
                FROM transform_outputs 
                WHERE transform_id = ?
            `).all(transform.id);
            
            console.log(`      - Outputs: ${outputs.length}`);
            for (const output of outputs) {
                console.log(`        * ${output.output_role}: ${output.artifact_id}`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        db.close();
    }
}

debugScriptExists(); 