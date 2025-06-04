#!/usr/bin/env node

/**
 * Debug script to inspect stage artifacts in the database
 */

const path = require('path');
const fs = require('fs');

// Add the dist directory to the module path
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    require('module')._nodeModulePaths.unshift(distPath);
}

const { ArtifactRepository } = require('./dist/server/repositories/ArtifactRepository.js');
const { createDatabaseConnection } = require('./dist/server/database/connection.js');

async function debugStageArtifacts() {
    console.log('🔍 Debugging Stage Artifacts in Database\n');

    let db;
    try {
        // Create database connection
        db = await createDatabaseConnection();
        console.log('✅ Connected to database');

        const artifactRepo = new ArtifactRepository(db);

        // Get all stage artifacts
        const query = `
            SELECT id, user_id, type, type_version, data, created_at 
            FROM artifacts 
            WHERE type = 'outline_synopsis_stage' 
            ORDER BY created_at DESC 
            LIMIT 5
        `;

        const result = await db.all(query);
        console.log(`\n📊 Found ${result.length} stage artifacts:\n`);

        result.forEach((artifact, index) => {
            console.log(`--- Stage Artifact ${index + 1} ---`);
            console.log(`ID: ${artifact.id}`);
            console.log(`User: ${artifact.user_id}`);
            console.log(`Type: ${artifact.type} v${artifact.type_version}`);
            console.log(`Created: ${artifact.created_at}`);

            try {
                const data = JSON.parse(artifact.data);
                console.log('Data Fields:');
                Object.keys(data).forEach(key => {
                    if (key === 'keyPoints' && Array.isArray(data[key])) {
                        console.log(`  • ${key}: [${data[key].length} items]`);
                        if (data[key].length > 0) {
                            const firstPoint = data[key][0];
                            console.log(`    - First point: ${firstPoint.event || 'no event field'}`);
                            if (firstPoint.emotionArcs) {
                                console.log(`    - Emotion arcs: ${firstPoint.emotionArcs.length}`);
                            }
                            if (firstPoint.relationshipDevelopments) {
                                console.log(`    - Relationship developments: ${firstPoint.relationshipDevelopments.length}`);
                            }
                        }
                    } else {
                        const value = data[key];
                        const display = typeof value === 'string' 
                            ? (value.length > 50 ? value.substring(0, 50) + '...' : value)
                            : value;
                        console.log(`  • ${key}: ${display}`);
                    }
                });

                // Check for enhanced fields specifically
                const enhancedFields = [
                    'timeframe', 'startingCondition', 'endingCondition', 
                    'stageStartEvent', 'stageEndEvent', 'keyPoints', 'externalPressure'
                ];
                
                const hasEnhanced = enhancedFields.some(field => data[field]);
                const missingEnhanced = enhancedFields.filter(field => !data[field]);
                
                console.log(`Enhanced structure: ${hasEnhanced ? '✅ Present' : '❌ Missing'}`);
                if (missingEnhanced.length > 0) {
                    console.log(`Missing fields: ${missingEnhanced.join(', ')}`);
                }

            } catch (e) {
                console.log('❌ Error parsing data:', e.message);
            }
            console.log('');
        });

        // Also check if there are any existing keyMilestones (old format)
        const legacyQuery = `
            SELECT id, data 
            FROM artifacts 
            WHERE type = 'outline_synopsis_stage' 
            AND json_extract(data, '$.keyMilestones') IS NOT NULL
            LIMIT 3
        `;

        const legacyResult = await db.all(legacyQuery);
        if (legacyResult.length > 0) {
            console.log(`\n⚠️  Found ${legacyResult.length} stage artifacts with legacy keyMilestones format`);
            legacyResult.forEach((artifact, index) => {
                const data = JSON.parse(artifact.data);
                console.log(`  Legacy ${index + 1}: Has keyMilestones (${data.keyMilestones?.length || 0} items)`);
            });
        }

    } catch (error) {
        console.error('❌ Database error:', error);
    } finally {
        if (db) {
            await db.close();
            console.log('\n✅ Database connection closed');
        }
    }
}

debugStageArtifacts().catch(console.error); 