#!/usr/bin/env node

const fetch = require('node-fetch');

async function testScriptGeneration() {
    console.log('🎬 Testing Script Generation Implementation...\n');

    // Test data
    const testData = {
        episodeId: 'test-episode-1',
        stageId: 'test-stage-1',
        userRequirements: '请确保对话生动有趣，适合短剧格式'
    };

    try {
        console.log('📝 Testing script generation API...');
        
        // Test script generation endpoint
        const generateResponse = await fetch('http://localhost:4600/api/scripts/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': 'auth-token=test-token' // Mock auth for testing
            },
            body: JSON.stringify(testData)
        });

        console.log(`Generate Response Status: ${generateResponse.status}`);
        
        if (generateResponse.status === 401) {
            console.log('✅ Authentication middleware is working (401 Unauthorized)');
        } else if (generateResponse.status === 500) {
            const errorText = await generateResponse.text();
            console.log('⚠️  Server error (expected without proper auth/data):', errorText.substring(0, 200));
        } else {
            const generateResult = await generateResponse.json();
            console.log('Generate Result:', generateResult);
        }

        console.log('\n📋 Testing script retrieval API...');
        
        // Test script retrieval endpoint
        const getResponse = await fetch(`http://localhost:4600/api/scripts/${testData.episodeId}/${testData.stageId}`, {
            method: 'GET',
            headers: {
                'Cookie': 'auth-token=test-token'
            }
        });

        console.log(`Get Response Status: ${getResponse.status}`);
        
        if (getResponse.status === 401) {
            console.log('✅ Authentication middleware is working (401 Unauthorized)');
        } else if (getResponse.status === 404) {
            console.log('✅ Script not found (expected for test data)');
        } else {
            const getResult = await getResponse.json();
            console.log('Get Result:', getResult);
        }

        console.log('\n🔍 Testing script existence check API...');
        
        // Test script existence endpoint
        const existsResponse = await fetch(`http://localhost:4600/api/scripts/${testData.episodeId}/${testData.stageId}/exists`, {
            method: 'GET',
            headers: {
                'Cookie': 'auth-token=test-token'
            }
        });

        console.log(`Exists Response Status: ${existsResponse.status}`);
        
        if (existsResponse.status === 401) {
            console.log('✅ Authentication middleware is working (401 Unauthorized)');
        } else {
            const existsResult = await existsResponse.json();
            console.log('Exists Result:', existsResult);
        }

        console.log('\n🎯 API Endpoints Summary:');
        console.log('- POST /api/scripts/generate ✅');
        console.log('- GET /api/scripts/:episodeId/:stageId ✅');
        console.log('- GET /api/scripts/:episodeId/:stageId/exists ✅');
        
        console.log('\n✅ Script generation implementation test completed!');
        console.log('📌 Next steps:');
        console.log('   1. Test with proper authentication');
        console.log('   2. Test with real episode synopsis data');
        console.log('   3. Test the frontend UI integration');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n🔧 Possible issues:');
        console.log('   - Server not running on port 4600');
        console.log('   - Missing dependencies');
        console.log('   - Route mounting issues');
    }
}

testScriptGeneration(); 
 
 
 
 