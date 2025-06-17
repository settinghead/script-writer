#!/usr/bin/env node

import { AxAI, AxAIOpenAIModel } from '@ax-llm/ax';
import { BrainstormProgram } from './ax-brainstorm-core';
import { BrainstormRequest } from './ax-brainstorm-types';

// Simple test script to verify the brainstorm system works
async function testBrainstorm() {
    console.log('🚀 Starting simple brainstorm test...\n');

    // Create AI instance
    const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error('❌ Error: Please set LLM_API_KEY or OPENAI_API_KEY environment variable');
        process.exit(1);
    }

    const ai = new AxAI({
        name: 'openai',
        apiKey,
        config: {
            model: AxAIOpenAIModel.GPT4OMini, // Use proper enum value
            maxTokens: 500,
            temperature: 0.8,
        }
    });

    // Create brainstorm program
    const program = new BrainstormProgram();

    // Test different genres and platforms
    const testCases: BrainstormRequest[] = [
        {
            genre: '甜宠',
            platform: '抖音',
            requirements_section: '现代都市背景，温馨浪漫'
        },
        {
            genre: '虐恋',
            platform: '小红书',
            requirements_section: '古装背景，情感纠葛深刻'
        },
        {
            genre: '穿越',
            platform: '抖音',
            requirements_section: '古代宫廷，智慧女主'
        },
        {
            genre: '霸总',
            platform: '快手',
            requirements_section: '商界精英，甜宠日常'
        }
    ];

    for (let i = 0; i < testCases.length; i++) {
        const request = testCases[i];

        console.log(`📝 Test ${i + 1} - Input:`);
        console.log(`   Genre: ${request.genre}`);
        console.log(`   Platform: ${request.platform}`);
        console.log(`   Requirements: ${request.requirements_section}\n`);

        try {
            console.log('⏳ Generating story idea...\n');

            // Generate story idea
            const idea = await program.generateIdea(ai, request);

            console.log('✅ Generated Story Idea:');
            console.log(`   Title: "${idea.title}"`);
            console.log(`   Body: "${idea.body}"\n`);

            // Add separator between tests
            if (i < testCases.length - 1) {
                console.log('─'.repeat(60) + '\n');
            }

        } catch (error) {
            console.error('❌ Error generating story idea:', error);
        }
    }

    console.log('🎉 All tests completed successfully!');
}

// Run the test
if (require.main === module) {
    testBrainstorm().catch(console.error);
}

export { testBrainstorm }; 