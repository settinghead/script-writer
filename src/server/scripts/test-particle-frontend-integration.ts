#!/usr/bin/env node

/**
 * Test script to verify particle system frontend-backend integration
 * This script tests the API endpoints that the frontend will use
 */

// Using built-in fetch (Node.js 18+)

const BASE_URL = 'https://localhost:4610';
const DEBUG_TOKEN = 'debug-auth-token-script-writer-dev';

// Disable SSL verification for self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testParticleHealthEndpoint() {
    console.log('\n🔍 Testing particle health endpoint...');

    try {
        const response = await fetch(`${BASE_URL}/api/particles/health`);
        const data = await response.json();

        if (response.ok && data.available) {
            console.log('✅ Health endpoint working');
            console.log('   Services:', Object.entries(data.services).map(([k, v]) => `${k}: ${v ? '✅' : '❌'}`).join(', '));
        } else {
            console.log('❌ Health endpoint failed:', data);
        }
    } catch (error) {
        console.log('❌ Health endpoint error:', error instanceof Error ? error.message : String(error));
    }
}

async function testParticleSearchEndpoint() {
    console.log('\n🔍 Testing particle search endpoint...');

    try {
        const searchQueries = [
            { query: '测试', projectId: '1', expected: 2 },
            { query: '角色', projectId: '1', expected: 1 },
            { query: '创意', projectId: '1', expected: 1 },
            { query: 'nonexistent', projectId: '1', expected: 0 }
        ];

        for (const { query, projectId, expected } of searchQueries) {
            const params = new URLSearchParams({ query, projectId, limit: '10' });
            const response = await fetch(`${BASE_URL}/api/particles/search?${params}`, {
                headers: {
                    'Authorization': `Bearer ${DEBUG_TOKEN}`
                }
            });

            if (!response.ok) {
                console.log(`❌ Search failed for "${query}": ${response.status} ${response.statusText}`);
                continue;
            }

            const results = await response.json();
            const actualCount = results.length;

            if (actualCount === expected) {
                console.log(`✅ Search for "${query}": ${actualCount} results (expected ${expected})`);
            } else {
                console.log(`⚠️  Search for "${query}": ${actualCount} results (expected ${expected})`);
            }

            // Show sample result for debugging
            if (results.length > 0) {
                const sample = results[0];
                console.log(`   Sample: ${sample.title} (${sample.type})`);
            }
        }
    } catch (error) {
        console.log('❌ Search endpoint error:', error instanceof Error ? error.message : String(error));
    }
}

async function testAuthenticationFlow() {
    console.log('\n🔍 Testing authentication flow...');

    try {
        // Test without token
        const noAuthResponse = await fetch(`${BASE_URL}/api/particles/search?query=test&projectId=1`);
        if (noAuthResponse.status === 401) {
            console.log('✅ Unauthenticated request properly rejected');
        } else {
            console.log('⚠️  Unauthenticated request not rejected:', noAuthResponse.status);
        }

        // Test with invalid token
        const badAuthResponse = await fetch(`${BASE_URL}/api/particles/search?query=test&projectId=1`, {
            headers: { 'Authorization': 'Bearer invalid-token' }
        });
        if (badAuthResponse.status === 401) {
            console.log('✅ Invalid token properly rejected');
        } else {
            console.log('⚠️  Invalid token not rejected:', badAuthResponse.status);
        }

        // Test with valid debug token
        const goodAuthResponse = await fetch(`${BASE_URL}/api/particles/search?query=test&projectId=1`, {
            headers: { 'Authorization': `Bearer ${DEBUG_TOKEN}` }
        });
        if (goodAuthResponse.ok) {
            console.log('✅ Valid debug token accepted');
        } else {
            console.log('❌ Valid debug token rejected:', goodAuthResponse.status);
        }

    } catch (error) {
        console.log('❌ Authentication test error:', error instanceof Error ? error.message : String(error));
    }
}

async function testFrontendCompatibility() {
    console.log('\n🔍 Testing frontend compatibility...');

    try {
        const response = await fetch(`${BASE_URL}/api/particles/search?query=测试&projectId=1`, {
            headers: { 'Authorization': `Bearer ${DEBUG_TOKEN}` }
        });

        if (!response.ok) {
            console.log('❌ Search request failed');
            return;
        }

        const results = await response.json();

        // Check that results have the expected structure for frontend
        const requiredFields = ['id', 'title', 'type', 'content_preview', 'jsondoc_id', 'path'];
        let allFieldsPresent = true;

        for (const result of results) {
            for (const field of requiredFields) {
                if (!(field in result)) {
                    console.log(`❌ Missing field "${field}" in result:`, result);
                    allFieldsPresent = false;
                }
            }
        }

        if (allFieldsPresent && results.length > 0) {
            console.log('✅ Results have correct structure for frontend');
            console.log('   Sample result structure:', Object.keys(results[0]));
        } else if (results.length === 0) {
            console.log('✅ Empty results handled correctly');
        } else {
            console.log('❌ Results missing required fields');
        }

    } catch (error) {
        console.log('❌ Frontend compatibility test error:', error instanceof Error ? error.message : String(error));
    }
}

async function main() {
    console.log('🧪 Testing Particle System Frontend Integration');
    console.log('='.repeat(50));

    await testParticleHealthEndpoint();
    await testParticleSearchEndpoint();
    await testAuthenticationFlow();
    await testFrontendCompatibility();

    console.log('\n✨ Frontend integration tests completed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Open https://localhost:4610 in browser');
    console.log('   2. Navigate to a project chat');
    console.log('   3. Type "@" in the chat input to test ParticleMentions');
    console.log('   4. Search for "测试" to see mock particles');
}

if (require.main === module) {
    main().catch(console.error);
} 