#!/usr/bin/env node

/**
 * Test script for episode generation streaming functionality
 * Tests the complete flow from stage to episode generation
 */

console.log('🧪 Testing Episode Generation Streaming...\n');

async function testEpisodeGeneration() {
    try {
        const stageId = '38614c1b-eb41-42ed-b3d4-1082f45813f0'; // Your stage ID from the screenshot

        console.log('1. Testing episode generation API call...');

        const response = await fetch('http://localhost:4600/api/episodes/stages/' + stageId + '/episodes/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': 'auth=your-auth-token' // You may need to get this from browser
            },
            body: JSON.stringify({
                numberOfEpisodes: 12,
                customRequirements: 'Test episode generation'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('✅ Episode generation started:', result);

        const { sessionId, transformId } = result;

        // Wait and check transform status
        console.log('\n2. Monitoring transform progress...');

        let attempts = 0;
        const maxAttempts = 30; // 30 seconds

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            attempts++;

            try {
                const statusResponse = await fetch('http://localhost:4600/api/episodes/episode-generation/' + sessionId, {
                    headers: {
                        'Cookie': 'auth=your-auth-token'
                    }
                });

                if (statusResponse.ok) {
                    const sessionData = await statusResponse.json();
                    console.log(`Attempt ${attempts}: Status = ${sessionData.status}, Episodes = ${sessionData.episodes?.length || 0}`);

                    if (sessionData.status === 'completed') {
                        console.log('✅ Episode generation completed!');
                        console.log('Generated episodes:', sessionData.episodes);
                        break;
                    } else if (sessionData.status === 'failed') {
                        console.log('❌ Episode generation failed');
                        break;
                    }
                }
            } catch (error) {
                console.log(`Attempt ${attempts}: Error checking status - ${error.message}`);
            }
        }

        if (attempts >= maxAttempts) {
            console.log('⏰ Timeout waiting for completion');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Only run if server is accessible
console.log('Note: Make sure the server is running (npm run dev) and you have valid auth cookies');
console.log('You can run this test manually or check the browser network tab for the actual progress.\n');

// Uncomment the line below to run the actual test
// testEpisodeGeneration();

console.log('🔧 Manual Testing Steps:');
console.log('1. Start server: npm run dev');
console.log('2. Navigate to episode generation page');
console.log('3. Click "开始生成每集大纲"');
console.log('4. Check browser console for any errors');
console.log('5. Check server logs for streaming progress');
console.log('6. Verify episodes appear in the UI after generation');

console.log('\n🚀 The fix should now properly start the streaming job!'); 