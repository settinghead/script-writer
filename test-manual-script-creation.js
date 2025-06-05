#!/usr/bin/env node

import Database from 'better-sqlite3';

const db = new Database('./ideations.db');

// Simulate the createScriptArtifacts function manually
async function testScriptArtifactCreation() {
    try {
        // Get the parsed script data from the latest transform
        const result = db.prepare(`
            SELECT transform_id, raw_response, user_id
            FROM llm_transforms lt
            JOIN transforms t ON lt.transform_id = t.id
            WHERE t.execution_context LIKE '%script_generation%'
            ORDER BY t.created_at DESC 
            LIMIT 1
        `).get();

        if (!result) {
            console.log('No script generation transforms found');
            return;
        }

        console.log('Testing script artifact creation for transform:', result.transform_id);
        console.log('User ID:', result.user_id);

        // Parse the JSON response
        let jsonText = result.raw_response;
        if (jsonText.includes('```json')) {
            jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
        }
        const scriptData = JSON.parse(jsonText);

        console.log('\nParsed script data:');
        console.log('- Episode Number:', scriptData.episodeNumber);
        console.log('- Script Content:', scriptData.scriptContent);
        console.log('- Scenes Count:', scriptData.scenes?.length);

        // Generate a unique artifact ID (similar to how createArtifact works)
        const artifactId = `artifact-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

        // Prepare the artifact data as the createScriptArtifacts method would
        const artifactData = {
            episodeNumber: scriptData.episodeNumber || 1,
            scriptContent: scriptData.scriptContent || '', // 🔥 This should be the issue!
            scenes: scriptData.scenes || [],
            wordCount: scriptData.wordCount || 0,
            estimatedDuration: scriptData.estimatedDuration || 0,
            generatedAt: new Date().toISOString(),
            // Legacy fields for compatibility
            title: scriptData.title || '未命名剧本',
            characterList: scriptData.characterList || [],
            summary: scriptData.summary || '',
            totalDialogueLines: scriptData.totalDialogueLines || 0
        };

        console.log('\nArtifact data that would be saved:');
        console.log('- episodeNumber:', artifactData.episodeNumber);
        console.log('- scriptContent length:', artifactData.scriptContent.length);
        console.log('- scriptContent value:', JSON.stringify(artifactData.scriptContent));
        console.log('- scenes count:', artifactData.scenes.length);

        // Check if we can convert scenes to scriptContent as a fallback
        if (!artifactData.scriptContent || artifactData.scriptContent.length < 10 || 
            artifactData.scriptContent.includes('完整剧本文本')) {
            console.log('\n🔧 ScriptContent is placeholder, converting from scenes...');
            
            const convertedScript = artifactData.scenes.map(scene => {
                let sceneText = `【第${scene.sceneNumber}场：${scene.location}·${scene.timeOfDay}】\n\n`;
                
                if (scene.action) {
                    sceneText += `（${scene.action}）\n\n`;
                }
                
                if (scene.dialogue && scene.dialogue.length > 0) {
                    scene.dialogue.forEach(line => {
                        sceneText += `${line.character}：${line.line}\n`;
                        if (line.direction) {
                            sceneText += `（${line.direction}）\n`;
                        }
                        sceneText += '\n';
                    });
                }
                
                return sceneText.trim();
            }).join('\n\n');

            console.log('Converted script content length:', convertedScript.length);
            console.log('Converted script preview:', convertedScript.substring(0, 200));
            
            // This is what should be saved instead
            artifactData.scriptContent = convertedScript;
        }

        // Try to manually insert the artifact
        console.log('\n📝 Testing manual artifact insertion...');
        
        const insertStmt = db.prepare(`
            INSERT INTO artifacts (id, user_id, type, type_version, data, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const metadata = JSON.stringify({ transform_id: result.transform_id });
        const dataJson = JSON.stringify(artifactData);

        try {
            insertStmt.run(
                artifactId,
                result.user_id,
                'episode_script',
                'v1',
                dataJson,
                metadata,
                new Date().toISOString()
            );

            console.log('✅ Artifact inserted successfully with ID:', artifactId);

            // Also add transform output link
            const outputStmt = db.prepare(`
                INSERT INTO transform_outputs (transform_id, artifact_id, output_role)
                VALUES (?, ?, ?)
            `);
            
            outputStmt.run(result.transform_id, artifactId, 'episode_script');
            console.log('✅ Transform output link created');

            // Verify the script exists check now works
            const checkStmt = db.prepare(`
                SELECT COUNT(*) as count
                FROM artifacts 
                WHERE user_id = ? AND type = 'episode_script' AND JSON_EXTRACT(data, '$.episodeNumber') = '1'
            `);
            
            const checkResult = checkStmt.get(result.user_id);
            console.log(`✅ Script exists check result: ${checkResult.count > 0 ? 'EXISTS' : 'NOT FOUND'}`);

        } catch (error) {
            console.log('❌ Failed to insert artifact:', error.message);
        }

    } catch (error) {
        console.log('❌ Error:', error.message);
    } finally {
        db.close();
    }
}

testScriptArtifactCreation(); 