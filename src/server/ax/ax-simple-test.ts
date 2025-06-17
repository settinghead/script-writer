#!/usr/bin/env node

import { AxAI, AxAIOpenAIModel } from '@ax-llm/ax';
import { BrainstormProgram } from './ax-brainstorm-core';
import { BrainstormRequest } from './ax-brainstorm-types';
import { getLLMCredentials } from '../services/LLMConfig';
import { StoryEvaluationSystem } from './ax-evaluation-system-simple';

// Simple test script to verify the brainstorm system works
async function testBrainstorm() {
    console.log('🚀 Starting simple brainstorm test with evaluation...\n');
    const credentials = getLLMCredentials();

    const ai = new AxAI({
        name: credentials.provider as any,
        apiKey: credentials.apiKey,
        apiURL: credentials.baseUrl,
        config: {
            model: credentials.modelName as AxAIOpenAIModel, // Use proper enum value
            maxTokens: 3000,
            temperature: 1.5,
        }
    });

    // Create brainstorm program and evaluation system
    const program = new BrainstormProgram();
    const evaluationSystem = new StoryEvaluationSystem();

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

    const chosenTestCase = testCases[Math.floor(Math.random() * testCases.length)];
    const request = chosenTestCase;

    console.log(`📝 Randomly chosen test case: ${chosenTestCase.genre}`);
    console.log(`   Genre: ${request.genre}`);
    console.log(`   Platform: ${request.platform}`);
    console.log(`   Requirements: ${request.requirements_section}\n`);

    try {
        // Step 1: Generate story idea
        console.log('⏳ Generating story idea...\n');
        const idea = await program.generateIdea(ai, request);

        console.log('✅ Generated Story Idea:');
        console.log(`   Title: "${idea.title}"`);
        console.log(`   Body: "${idea.body}"\n`);

        // Step 2: Evaluate the generated story
        console.log('🔍 Evaluating the generated story...\n');
        const evaluation = await evaluationSystem.evaluateStoryIdea(
            idea,
            request.genre,
            request.platform
        );

        // Display evaluation results
        console.log('📊 Evaluation Results:');
        console.log('─'.repeat(50));
        console.log(`Overall Score: ${evaluation.overall_score.toFixed(2)}/10`);
        console.log('─'.repeat(50));
        console.log(`新颖性 (Novelty): ${evaluation.novelty_score}/10`);
        console.log(`可行性 (Feasibility): ${evaluation.feasibility_score}/10`);
        console.log(`结构 (Structure): ${evaluation.structure_score}/10`);
        console.log(`详细程度 (Detail): ${evaluation.detail_score}/10`);
        console.log(`逻辑连贯性 (Logical Coherence): ${evaluation.logical_coherence_score}/10`);
        console.log(`题材一致性 (Genre Consistency): ${evaluation.genre_score}/10`);
        console.log(`吸引力 (Engagement): ${evaluation.engagement_score}/10`);
        console.log('─'.repeat(50));

        console.log('\n📝 Detailed Feedback:');
        console.log(evaluation.feedback);

        console.log('\n🎉 Test completed successfully!');

    } catch (error) {
        console.error('❌ Error during test:', error);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testBrainstorm().catch(console.error);
}

export { testBrainstorm }; 