#!/usr/bin/env node

import { db } from '../database/connection.js';
import { createConversation, getConversationMessages } from '../conversation/ConversationManager.js';
import { createConversationContext } from '../conversation/StreamingWrappers.js';

async function debugConversationStreaming() {
    console.log('🔍 Debugging conversation streaming...\n');

    try {
        // Create a test conversation
        const projectId = 'fdc86792-8ddf-43ac-8a2e-85635c443395'; // Use existing project
        const conversationId = await createConversation(projectId, 'agent', {
            debug: true,
            testCase: 'streaming-debug'
        });

        console.log(`✅ Created test conversation: ${conversationId}`);

        // Get conversation context
        const existingMessages = await getConversationMessages(conversationId);
        const context = createConversationContext(conversationId, projectId, existingMessages);

        console.log('📝 Testing simple streamText call...');

        // Test a simple streaming call
        const systemMessage = 'You are a helpful assistant. Respond with exactly: "Hello, this is a test response."';
        const testMessages = [
            { role: 'user', content: 'Say hello for testing' }
        ];

        console.log('🚀 Starting stream...');

        const result = await context.streamText({
            messages: testMessages as any,
            system: systemMessage,
            temperature: 0,
            maxTokens: 50
        });

        console.log('📡 Stream result received, collecting response...');

        // Collect the full response
        let fullResponse = '';
        const chunks: string[] = [];

        for await (const chunk of result.textStream) {
            chunks.push(chunk);
            fullResponse += chunk;
            console.log(`📦 Chunk ${chunks.length}: "${chunk}"`);
        }

        console.log(`\n✅ Streaming completed!`);
        console.log(`📊 Total chunks: ${chunks.length}`);
        console.log(`📝 Full response: "${fullResponse}"`);

        // Check if the message was updated in the database
        console.log('\n🔍 Checking database for updated message...');

        const messages = await getConversationMessages(conversationId);
        console.log(`📊 Total messages in conversation: ${messages.length}`);

        for (const msg of messages) {
            console.log(`📝 Message ${msg.id}:`);
            console.log(`   Role: ${msg.role}`);
            console.log(`   Status: ${msg.status}`);
            console.log(`   Content length: ${msg.content ? msg.content.length : 'NULL'} chars`);
            console.log(`   Content: "${msg.content || 'EMPTY'}"`);
            console.log(`   Created: ${msg.created_at}`);
            console.log('');
        }

        // Check for the assistant message specifically
        const assistantMessage = messages.find(m => m.role === 'assistant');
        if (assistantMessage) {
            if (assistantMessage.content && assistantMessage.content.length > 0) {
                console.log('✅ SUCCESS: Assistant message has content!');
                console.log(`📝 Assistant response: "${assistantMessage.content}"`);
            } else {
                console.log('❌ FAILURE: Assistant message is still empty');
                console.log(`⚠️  Status: ${assistantMessage.status}`);
                console.log(`⚠️  Error: ${assistantMessage.error_message || 'none'}`);
            }
        } else {
            console.log('❌ FAILURE: No assistant message found');
        }

        // Clean up test conversation
        await db
            .deleteFrom('conversation_messages')
            .where('conversation_id', '=', conversationId)
            .execute();

        await db
            .deleteFrom('conversations')
            .where('id', '=', conversationId)
            .execute();

        console.log('🧹 Cleaned up test conversation');

    } catch (error) {
        console.error('❌ Error during streaming test:', error);
        if (error instanceof Error) {
            console.error('Stack trace:', error.stack);
        }
    }
}

if (require.main === module) {
    debugConversationStreaming()
        .catch(console.error)
        .finally(() => process.exit(0));
} 