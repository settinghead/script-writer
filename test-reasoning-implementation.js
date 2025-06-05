#!/usr/bin/env node

/**
 * Test script to verify reasoning implementation
 * This tests the backend reasoning detection and LLM service integration
 */

const { LLMService } = require('./src/server/services/LLMService.ts');

async function testReasoningDetection() {
    console.log('🧠 Testing Reasoning Implementation\n');

    const llmService = new LLMService();

    // Test reasoning model detection
    console.log('1. Testing reasoning model detection:');
    const testModels = [
        'deepseek-r1',
        'deepseek-r1-distill', 
        'gpt-4o',
        'claude-3-sonnet',
        'some-model-r1',
        'regular-model'
    ];

    testModels.forEach(model => {
        const isReasoning = llmService.isReasoningModel(model);
        console.log(`   ${model}: ${isReasoning ? '✅ Reasoning' : '❌ Standard'}`);
    });

    // Test model info
    console.log('\n2. Testing model info:');
    testModels.slice(0, 3).forEach(model => {
        const info = llmService.getModelInfo(model);
        console.log(`   ${model}:`, info);
    });

    console.log('\n✅ Reasoning detection tests completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Start the development server: npm run dev');
    console.log('   2. Test with a reasoning model (e.g., deepseek-r1)');
    console.log('   3. Create a new brainstorming session');
    console.log('   4. Look for reasoning indicators in the UI');
}

// Run the test
testReasoningDetection().catch(console.error); 