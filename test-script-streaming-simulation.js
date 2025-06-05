#!/usr/bin/env node

import Database from 'better-sqlite3';

const db = new Database('./ideations.db');

// Get all chunks for the latest script generation transform
const chunks = db.prepare(`
    SELECT chunk_index, chunk_data 
    FROM transform_chunks 
    WHERE transform_id = '2e5cb1ba-cb86-47d2-ba7c-c518a6047f0f'
    ORDER BY chunk_index ASC
`).all();

console.log(`Found ${chunks.length} chunks`);

// Simulate the accumulated content building process
let accumulatedContent = '';

for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    // Extract the actual content from "0:content" format
    if (chunk.chunk_data.startsWith('0:')) {
        try {
            const content = JSON.parse(chunk.chunk_data.substring(2));
            accumulatedContent += content;
            
            console.log(`\n=== Chunk ${i + 1}/${chunks.length} ===`);
            console.log('Chunk content length:', content.length);
            console.log('Accumulated length:', accumulatedContent.length);
            console.log('Accumulated preview (last 100 chars):', 
                accumulatedContent.length > 100 
                    ? '...' + accumulatedContent.substring(accumulatedContent.length - 100)
                    : accumulatedContent
            );
            
            // Try to simulate what ScriptStreamingService.parsePartial would receive
            if (accumulatedContent.length > 50) { // Only test when we have substantial content
                console.log('\n--- Testing parsePartial simulation ---');
                
                // Clean the content (similar to what the service does)
                let cleanedContent = accumulatedContent;
                if (cleanedContent.includes('```json')) {
                    cleanedContent = cleanedContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
                }
                
                console.log('After cleaning length:', cleanedContent.length);
                
                // Try to find JSON boundaries
                const objectStart = cleanedContent.indexOf('{');
                if (objectStart >= 0) {
                    const jsonPart = cleanedContent.substring(objectStart);
                    console.log('JSON part length:', jsonPart.length);
                    console.log('JSON preview:', jsonPart.substring(0, 200));
                    
                    // Try to parse
                    try {
                        const parsed = JSON.parse(jsonPart);
                        console.log('✅ Full JSON parsing successful at chunk', i + 1);
                        console.log('Episode Number:', parsed.episodeNumber);
                        console.log('Script Content:', parsed.scriptContent);
                        console.log('Scenes Count:', parsed.scenes?.length || 0);
                        break; // Successfully parsed complete JSON
                    } catch (parseError) {
                        console.log('❌ JSON parsing failed:', parseError.message.substring(0, 100));
                        
                        // Try jsonrepair (like the service does)
                        try {
                            const { jsonrepair } = await import('jsonrepair');
                            const repaired = jsonrepair(jsonPart);
                            const repairedParsed = JSON.parse(repaired);
                            console.log('✅ JSON repair successful at chunk', i + 1);
                            console.log('Repaired Episode Number:', repairedParsed.episodeNumber);
                            console.log('Repaired Script Content:', repairedParsed.scriptContent);
                            break; // Successfully repaired and parsed
                        } catch (repairError) {
                            console.log('❌ JSON repair also failed:', repairError.message.substring(0, 50));
                        }
                    }
                }
            }
        } catch (error) {
            console.log('Error processing chunk:', error.message);
        }
    }
}

console.log('\n=== Final Accumulated Content ===');
console.log('Total length:', accumulatedContent.length);
console.log('First 200 chars:', accumulatedContent.substring(0, 200));
console.log('Last 200 chars:', accumulatedContent.substring(accumulatedContent.length - 200));

db.close(); 