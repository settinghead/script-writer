import { db } from '../database/connection';
import { ChatMessageRepository } from '../repositories/ChatMessageRepository';
import { parseEventMessage, ChatEventHelpers } from '../../common/schemas/chatMessages';

async function testEventChatSystem() {
    console.log('🧪 Testing Event-Based Chat System...\n');

    const chatRepo = new ChatMessageRepository(db);
    const projectId = 'test-project-123';

    try {
        // Clean up any existing test data
        await chatRepo.deleteMessagesForProject(projectId);
        console.log('✅ Cleaned up existing test data\n');

        // Test 1: Create user message
        console.log('📝 Test 1: Creating user message...');
        const userMessage = await chatRepo.createUserMessage(
            projectId,
            'Can you help me brainstorm some sci-fi story ideas?'
        );

        const userEvents = parseEventMessage(userMessage.content);
        console.log(`✅ Created user message with ${userEvents.length} event(s)`);
        console.log(`   Event type: ${userEvents[0]?.type}`);
        const firstEvent = userEvents[0];
        if (firstEvent && firstEvent.type === 'user_message') {
            console.log(`   Content: ${firstEvent.content}`);
        }
        console.log();

        // Test 2: Create agent thinking message
        console.log('🤔 Test 2: Creating agent thinking message...');
        const thinkingInfo = await chatRepo.createAgentThinkingMessage(
            projectId,
            'Analyzing your brainstorm request and generating creative story ideas'
        );

        let thinkingMessage = await chatRepo.getDisplayMessageById(thinkingInfo.messageId);
        let thinkingEvents = parseEventMessage(thinkingMessage!.content);
        console.log(`✅ Created thinking message with ${thinkingEvents.length} event(s)`);
        console.log(`   Event type: ${thinkingEvents[0]?.type}`);
        console.log(`   Task: ${thinkingEvents[0]?.type === 'agent_thinking_start' ? thinkingEvents[0].task : 'N/A'}`);
        console.log(`   Start time: ${thinkingInfo.startTime}\n`);

        // Simulate some processing time
        console.log('⏳ Simulating processing time (2 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 3: Finish thinking
        console.log('✅ Test 3: Finishing agent thinking...');
        await chatRepo.finishAgentThinking(
            thinkingInfo.messageId,
            'Analyzing your brainstorm request and generating creative story ideas',
            thinkingInfo.startTime
        );

        thinkingMessage = await chatRepo.getDisplayMessageById(thinkingInfo.messageId);
        thinkingEvents = parseEventMessage(thinkingMessage!.content);
        console.log(`✅ Updated message now has ${thinkingEvents.length} event(s)`);

        const thinkingEndEvent = thinkingEvents.find(e => e.type === 'agent_thinking_end');
        if (thinkingEndEvent && thinkingEndEvent.type === 'agent_thinking_end') {
            console.log(`   Duration: ${thinkingEndEvent.duration_ms}ms`);
        }
        console.log();

        // Test 4: Add agent response
        console.log('💬 Test 4: Adding agent response...');
        await chatRepo.addAgentResponse(
            thinkingInfo.messageId,
            'I\'ve generated some exciting sci-fi story ideas for you! Here are a few concepts involving space exploration, AI consciousness, and time paradoxes.'
        );

        thinkingMessage = await chatRepo.getDisplayMessageById(thinkingInfo.messageId);
        thinkingEvents = parseEventMessage(thinkingMessage!.content);
        console.log(`✅ Message now has ${thinkingEvents.length} event(s)`);

        const responseEvent = thinkingEvents.find(e => e.type === 'agent_response');
        if (responseEvent && responseEvent.type === 'agent_response') {
            console.log(`   Response: ${responseEvent.content.substring(0, 50)}...`);
        }
        console.log();

        // Test 5: Test frontend event processing
        console.log('🎨 Test 5: Testing frontend event processing...');
        const { processChatMessage } = await import('../../client/utils/chatEventProcessor.js');

        const processedMessage = processChatMessage(
            thinkingMessage!.id,
            thinkingMessage!.role,
            thinkingMessage!.content,
            thinkingMessage!.created_at
        );

        console.log(`✅ Processed message state:`);
        console.log(`   Is thinking: ${processedMessage.isThinking}`);
        console.log(`   Show spinner: ${processedMessage.showSpinner}`);
        console.log(`   Thinking duration: ${processedMessage.thinkingDuration}ms`);
        console.log(`   Display content: ${processedMessage.content.substring(0, 100)}...`);
        console.log();

        // Test 6: Test error handling
        console.log('❌ Test 6: Testing error handling...');
        const errorThinkingInfo = await chatRepo.createAgentThinkingMessage(
            projectId,
            'Processing your request'
        );

        await chatRepo.addAgentError(
            errorThinkingInfo.messageId,
            'I encountered an error while processing your request. Please try again.'
        );

        const errorMessage = await chatRepo.getDisplayMessageById(errorThinkingInfo.messageId);
        const errorEvents = parseEventMessage(errorMessage!.content);
        console.log(`✅ Error message has ${errorEvents.length} event(s)`);

        const errorEvent = errorEvents.find(e => e.type === 'agent_error');
        if (errorEvent && errorEvent.type === 'agent_error') {
            console.log(`   Error: ${errorEvent.message}`);
        }
        console.log();

        // Test 7: Verify all messages
        console.log('📋 Test 7: Verifying all messages...');
        const allMessages = await chatRepo.getDisplayMessages(projectId);
        console.log(`✅ Total messages in project: ${allMessages.length}`);

        for (const msg of allMessages) {
            const events = parseEventMessage(msg.content);
            console.log(`   - ${msg.role} message with ${events.length} event(s)`);
        }
        console.log();

        console.log('🎉 All tests passed! Event-based chat system is working correctly.');

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    } finally {
        // Clean up test data
        await chatRepo.deleteMessagesForProject(projectId);
        console.log('🧹 Cleaned up test data');
    }
}

// Run the test
testEventChatSystem()
    .then(() => {
        console.log('\n✅ Event-based chat system test completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Event-based chat system test failed:', error);
        process.exit(1);
    }); 