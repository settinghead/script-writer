const fetch = require('node-fetch');

// Test configuration
const BASE_URL = 'http://localhost:3000/api';
const TEST_USER_ID = 'test-user-123';

// Mock authentication by setting a cookie (you may need to adjust this based on your auth system)
const headers = {
    'Content-Type': 'application/json',
    'Cookie': `auth-token=test-token-${TEST_USER_ID}` // Adjust based on your auth implementation
};

async function testOutlineEditing() {
    console.log('🧪 Testing Outline Editing Implementation...\n');

    try {
        // Step 1: Create a test outline session (you may need to create this first)
        console.log('1. Creating test outline session...');

        // For this test, we'll assume you have an existing outline session
        // In a real scenario, you'd create one first
        const testSessionId = 'test-session-' + Date.now();

        console.log(`   Using session ID: ${testSessionId}\n`);

        // Step 2: Test updating a component (this should create a specific edit artifact)
        console.log('2. Testing component update...');

        const updateResponse = await fetch(`${BASE_URL}/outlines/${testSessionId}/components/title`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ value: 'Updated Test Title' })
        });

        if (updateResponse.ok) {
            console.log('   ✅ Component update successful');
            const updateResult = await updateResponse.json();
            console.log('   📄 Update result:', updateResult);
        } else {
            console.log('   ❌ Component update failed:', updateResponse.status, await updateResponse.text());
        }

        console.log();

        // Step 3: Test getting original data
        console.log('3. Testing original data retrieval...');

        const originalResponse = await fetch(`${BASE_URL}/outlines/${testSessionId}/original`, {
            headers
        });

        if (originalResponse.ok) {
            console.log('   ✅ Original data retrieval successful');
            const originalData = await originalResponse.json();
            console.log('   📄 Original data keys:', Object.keys(originalData));
        } else {
            console.log('   ❌ Original data retrieval failed:', originalResponse.status, await originalResponse.text());
        }

        console.log();

        // Step 4: Test clearing edits
        console.log('4. Testing edit clearing...');

        const clearResponse = await fetch(`${BASE_URL}/outlines/${testSessionId}/edits`, {
            method: 'DELETE',
            headers
        });

        if (clearResponse.ok) {
            console.log('   ✅ Edit clearing successful');
            const clearResult = await clearResponse.json();
            console.log('   📄 Clear result:', clearResult);
        } else {
            console.log('   ❌ Edit clearing failed:', clearResponse.status, await clearResponse.text());
        }

        console.log();

        // Step 5: Test episode generation endpoint
        console.log('5. Testing episode generation...');

        const episodeResponse = await fetch(`${BASE_URL}/episodes/generate`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                outlineSessionId: testSessionId,
                episode_count: 5,
                episode_duration: 3,
                generation_strategy: 'sequential',
                custom_requirements: 'Test requirements',
                use_modified_outline: true
            })
        });

        if (episodeResponse.ok) {
            console.log('   ✅ Episode generation endpoint accessible');
            const episodeResult = await episodeResponse.json();
            console.log('   📄 Episode result:', episodeResult);
        } else {
            console.log('   ❌ Episode generation failed:', episodeResponse.status, await episodeResponse.text());
        }

        console.log('\n🎉 Test completed!');

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
    }
}

// Run the test
testOutlineEditing(); 