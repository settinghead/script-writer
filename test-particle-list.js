#!/usr/bin/env node

/**
 * Test script to verify the new particle list endpoint
 */

const BASE_URL = 'https://localhost:4610';
const DEBUG_TOKEN = 'debug-auth-token-script-writer-dev';

// Disable SSL verification for self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testParticleListEndpoint() {
    console.log('🔍 Testing particle list endpoint...');

    try {
        // Test with a known project ID
        const params = new URLSearchParams({
            projectId: '7f8fecc9-da77-411c-9fc7-3d0b45f2ba38', // Corrected project ID
            limit: '10'
        });

        const response = await fetch(`${BASE_URL}/api/particles/list?${params}`, {
            headers: {
                'Authorization': `Bearer ${DEBUG_TOKEN}`
            }
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.log('❌ List request failed:', errorText);
            return;
        }

        const results = await response.json();
        console.log('✅ List request successful!');
        console.log('Number of particles:', results.length);

        if (results.length > 0) {
            console.log('Sample particle:', JSON.stringify(results[0], null, 2));
        }

        // Check structure
        const requiredFields = ['id', 'title', 'type', 'content_preview', 'jsondoc_id', 'path'];
        let allFieldsPresent = true;

        for (const result of results) {
            for (const field of requiredFields) {
                if (!(field in result)) {
                    console.log(`❌ Missing field "${field}" in result`);
                    allFieldsPresent = false;
                }
            }
        }

        if (allFieldsPresent) {
            console.log('✅ All required fields present in results');
        }

    } catch (error) {
        console.log('❌ List endpoint error:', error.message);
    }
}

async function testHealthEndpoint() {
    console.log('🔍 Testing particle health endpoint...');

    try {
        const response = await fetch(`${BASE_URL}/api/particles/health`);
        const data = await response.json();

        if (response.ok && data.available) {
            console.log('✅ Health endpoint working - particle system available');
        } else {
            console.log('⚠️ Health endpoint shows particle system unavailable:', data);
        }
    } catch (error) {
        console.log('❌ Health endpoint error:', error.message);
    }
}

async function main() {
    console.log('🚀 Testing particle list functionality...\n');

    await testHealthEndpoint();
    console.log('');
    await testParticleListEndpoint();

    console.log('\n✅ Test completed!');
}

main().catch(console.error); 