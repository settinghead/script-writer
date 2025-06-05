#!/usr/bin/env node

import Database from 'better-sqlite3';

const db = new Database('./ideations.db');

// Get the latest script generation transform raw response
const result = db.prepare(`
    SELECT transform_id, raw_response, status 
    FROM llm_transforms lt
    JOIN transforms t ON lt.transform_id = t.id
    WHERE t.execution_context LIKE '%script_generation%'
    ORDER BY t.created_at DESC 
    LIMIT 1
`).get();

if (result) {
    console.log('Transform ID:', result.transform_id);
    console.log('Status:', result.status);
    console.log('Raw response length:', result.raw_response.length);
    console.log('\nFirst 500 chars of raw response:');
    console.log(result.raw_response.substring(0, 500));
    console.log('\nLast 500 chars of raw response:');
    console.log(result.raw_response.substring(result.raw_response.length - 500));
    
    // Try to parse it manually
    console.log('\n=== Manual JSON Parsing Test ===');
    try {
        // Remove code blocks if present
        let jsonText = result.raw_response;
        if (jsonText.includes('```json')) {
            jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
        }
        
        const parsed = JSON.parse(jsonText);
        console.log('✅ JSON parsing successful!');
        console.log('Episode Number:', parsed.episodeNumber);
        console.log('Script Content Length:', parsed.scriptContent?.length || 0);
        console.log('Script Content Preview:', parsed.scriptContent?.substring(0, 100) || 'none');
        console.log('Scenes Count:', parsed.scenes?.length || 0);
        
        // Check if this looks like valid script data
        if (parsed.episodeNumber && (parsed.scriptContent || parsed.scenes)) {
            console.log('✅ This looks like valid script data that should create an artifact');
        } else {
            console.log('❌ Missing required script fields');
        }
        
    } catch (error) {
        console.log('❌ JSON parsing failed:', error.message);
    }
} else {
    console.log('No script generation transforms found');
}

db.close(); 