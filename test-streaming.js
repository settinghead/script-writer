const fetch = require('node-fetch');

async function testStreaming() {
    console.log('Testing new streaming framework...');

    try {
        const response = await fetch('http://localhost:4600/api/streaming/llm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': 'auth_token=test-token' // You might need a real token
            },
            body: JSON.stringify({
                artifactIds: [],
                templateId: 'brainstorming',
                templateParams: {
                    genre: '浪漫类',
                    platform: '抖音',
                    requirementsSection: '特殊要求：要有反转'
                },
                modelName: 'deepseek-chat'
            })
        });

        if (!response.ok) {
            console.error('Response not OK:', response.status, response.statusText);
            const text = await response.text();
            console.error('Response body:', text);
            return;
        }

        console.log('Streaming response received, reading stream...');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                console.log('Stream completed');
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            accumulatedContent += chunk;

            // Log chunks as they arrive
            console.log('Chunk received:', chunk.substring(0, 100) + (chunk.length > 100 ? '...' : ''));
        }

        console.log('Final accumulated content length:', accumulatedContent.length);
        console.log('Content preview:', accumulatedContent.substring(0, 500));

    } catch (error) {
        console.error('Error testing streaming:', error);
    }
}

testStreaming(); 