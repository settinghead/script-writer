const http = require('http');

function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        data: JSON.parse(data)
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', reject);

        if (postData) {
            req.write(JSON.stringify(postData));
        }

        req.end();
    });
}

async function testAPILineage() {
    console.log('🧪 Testing API lineage tracing...\n');

    const artifactId = '411af9dc-fea8-48b9-8cbe-24e1b98692bc';

    try {
        // Test direct artifact lineage
        console.log('1️⃣ Testing sourceArtifactId lineage...');
        const response1 = await makeRequest({
            hostname: 'localhost',
            port: 4600,
            path: `/api/artifacts?type=brainstorm_params&sourceArtifactId=${artifactId}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // Note: In production, you'd need proper authentication cookies
                'Cookie': 'auth-token=test'
            }
        });

        console.log('Response 1 Status:', response1.statusCode);
        console.log('Response 1 Data:', JSON.stringify(response1.data, null, 2));

        if (response1.statusCode === 200 && Array.isArray(response1.data) && response1.data.length > 0) {
            const params = response1.data[0].data;
            console.log('✅ Found brainstorm_params via sourceArtifactId!');
            console.log('   Platform:', params.platform);
            console.log('   Genres:', params.genre_paths?.map(p => p.join(' > ')).join(', '));
            console.log('   Requirements:', params.requirements);
        } else {
            console.log('❌ No brainstorm_params found via sourceArtifactId');
        }

        // Test session-based lineage  
        console.log('\n2️⃣ Testing sessionId lineage...');
        const sessionId = '2444e035-972f-4e5a-ac3b-9185012c3c8a';
        const response2 = await makeRequest({
            hostname: 'localhost',
            port: 4600,
            path: `/api/artifacts?type=brainstorm_params&sessionId=${sessionId}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': 'auth-token=test'
            }
        });

        console.log('Response 2 Status:', response2.statusCode);
        console.log('Response 2 Data:', JSON.stringify(response2.data, null, 2));

        if (response2.statusCode === 200 && Array.isArray(response2.data) && response2.data.length > 0) {
            console.log('✅ Found brainstorm_params via sessionId!');
        } else {
            console.log('❌ No brainstorm_params found via sessionId');
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testAPILineage(); 