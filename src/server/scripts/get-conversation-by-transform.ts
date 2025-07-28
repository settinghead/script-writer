#!/usr/bin/env node

/**
 * Get Conversation by Transform
 * 
 * Finds the conversation that generated a specific transform and displays
 * the full conversation history with detailed message information.
 * 
 * Usage:
 *   ./run-ts src/server/scripts/get-conversation-by-transform.ts <transform-id>
 *   ./run-ts src/server/scripts/get-conversation-by-transform.ts <transform-id> --verbose
 */

import { db } from '../database/connection.js';
import { getConversation, getConversationMessages } from '../conversation/ConversationManager.js';
import type { ConversationMessage } from '../conversation/ConversationManager.js';

async function getTransformConversation(transformId: string): Promise<{
    transform: any;
    conversation: any;
    messages: ConversationMessage[];
    triggerMessage?: ConversationMessage;
} | null> {
    // First, get the transform and its conversation info
    const transform = await db
        .selectFrom('transforms')
        .selectAll()
        .where('id', '=', transformId)
        .executeTakeFirst();

    if (!transform) {
        return null;
    }

    console.log(`🔍 Found transform: ${transform.id}`);
    console.log(`📂 Project: ${transform.project_id}`);
    console.log(`🔧 Type: ${transform.type}`);
    console.log(`📅 Created: ${transform.created_at}`);
    console.log(`📊 Status: ${transform.status}`);

    // Get conversation if available
    if (!transform.conversation_id) {
        console.log('⚠️  No conversation linked to this transform');
        return { transform, conversation: null, messages: [], triggerMessage: undefined };
    }

    const conversation = await getConversation(transform.conversation_id);
    if (!conversation) {
        console.log('❌ Conversation not found');
        return { transform, conversation: null, messages: [], triggerMessage: undefined };
    }

    // Get all messages in the conversation
    const messages = await getConversationMessages(transform.conversation_id, true);

    // Get trigger message if available
    let triggerMessage: ConversationMessage | undefined;
    if (transform.trigger_message_id) {
        triggerMessage = messages.find(msg => msg.id === transform.trigger_message_id);
    }

    return { transform, conversation, messages, triggerMessage };
}

function formatMessage(message: ConversationMessage, index: number, isVerbose: boolean = false): void {
    const timestamp = message.created_at.toISOString();
    const roleEmoji = {
        'system': '🤖',
        'user': '👤',
        'assistant': '🤖',
        'tool': '🔧'
    }[message.role] || '❓';

    console.log(`${index + 1}. ${roleEmoji} ${message.role.toUpperCase()} [${timestamp}]`);

    if (message.status !== 'completed') {
        console.log(`   Status: ${message.status}`);
    }

    if (message.error_message) {
        console.log(`   ❌ Error: ${message.error_message}`);
    }

    // Show tool information
    if (message.tool_name) {
        console.log(`   🔧 Tool: ${message.tool_name}`);

        if (message.tool_call_id) {
            console.log(`   🆔 Call ID: ${message.tool_call_id}`);
        }

        if (message.tool_parameters && Object.keys(message.tool_parameters).length > 0) {
            if (isVerbose) {
                console.log(`   📝 Parameters: ${JSON.stringify(message.tool_parameters, null, 4)}`);
            } else {
                const paramKeys = Object.keys(message.tool_parameters);
                console.log(`   📝 Parameters: ${paramKeys.join(', ')}`);
            }
        }

        if (message.tool_result && Object.keys(message.tool_result).length > 0) {
            if (isVerbose) {
                console.log(`   📤 Result: ${JSON.stringify(message.tool_result, null, 4)}`);
            } else {
                console.log(`   📤 Result: [${Object.keys(message.tool_result).length} fields]`);
            }
        }
    }

    // Show LLM parameters
    if (message.model_name) {
        console.log(`   🧠 Model: ${message.model_name}`);

        if (isVerbose && (message.temperature || message.top_p || message.max_tokens)) {
            const params = [];
            if (message.temperature) params.push(`temp=${message.temperature}`);
            if (message.top_p) params.push(`top_p=${message.top_p}`);
            if (message.max_tokens) params.push(`max_tokens=${message.max_tokens}`);
            console.log(`   ⚙️  Params: ${params.join(', ')}`);
        }
    }

    // Show caching info
    if (message.cache_hit) {
        console.log(`   💾 Cache hit: ${message.cached_tokens} tokens`);
    }

    // Show content (truncated unless verbose)
    const content = message.content;
    if (isVerbose) {
        console.log(`   📄 Content:\n${content}`);
    } else {
        const truncated = content.length > 200 ? content.substring(0, 200) + '...' : content;
        console.log(`   📄 Content: ${truncated}`);
    }

    console.log(''); // Empty line between messages
}

async function main() {
    try {
        const args = process.argv.slice(2);

        if (args.length === 0) {
            console.error('❌ Usage: ./run-ts src/server/scripts/get-conversation-by-transform.ts <transform-id> [--verbose]');
            process.exit(1);
        }

        const transformId = args[0];
        const isVerbose = args.includes('--verbose');

        console.log(`🔍 Looking up conversation for transform: ${transformId}\n`);

        const result = await getTransformConversation(transformId);

        if (!result) {
            console.log('❌ Transform not found');
            return;
        }

        const { transform, conversation, messages, triggerMessage } = result;

        if (!conversation) {
            console.log('⚠️  Transform exists but has no associated conversation');
            console.log(`   This might be a legacy transform from before the conversation system.`);
            return;
        }

        console.log(`\n💬 CONVERSATION DETAILS:`);
        console.log('─'.repeat(50));
        console.log(`ID: ${conversation.id}`);
        console.log(`Type: ${conversation.type}`);
        console.log(`Status: ${conversation.status}`);
        console.log(`Created: ${conversation.created_at.toISOString()}`);
        console.log(`Updated: ${conversation.updated_at.toISOString()}`);

        if (Object.keys(conversation.metadata).length > 0) {
            console.log(`Metadata: ${JSON.stringify(conversation.metadata, null, 2)}`);
        }

        if (triggerMessage) {
            console.log(`\n🎯 TRIGGER MESSAGE:`);
            console.log('─'.repeat(30));
            formatMessage(triggerMessage, -1, isVerbose);
        }

        console.log(`\n📨 CONVERSATION MESSAGES (${messages.length}):`);
        console.log('─'.repeat(50));

        if (messages.length === 0) {
            console.log('📭 No messages in this conversation');
            return;
        }

        for (let i = 0; i < messages.length; i++) {
            formatMessage(messages[i], i, isVerbose);
        }

        // Show conversation statistics
        console.log('📊 CONVERSATION STATISTICS:');
        console.log('─'.repeat(30));
        console.log(`Total messages: ${messages.length}`);

        const messagesByRole = messages.reduce((acc, msg) => {
            acc[msg.role] = (acc[msg.role] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        for (const [role, count] of Object.entries(messagesByRole)) {
            console.log(`${role}: ${count}`);
        }

        const toolsUsed = [...new Set(messages.map(msg => msg.tool_name).filter(Boolean))];
        if (toolsUsed.length > 0) {
            console.log(`Tools used: ${toolsUsed.join(', ')}`);
        }

        const failedMessages = messages.filter(msg => msg.status === 'failed');
        if (failedMessages.length > 0) {
            console.log(`Failed messages: ${failedMessages.length}`);
        }

        const cachedMessages = messages.filter(msg => msg.cache_hit);
        if (cachedMessages.length > 0) {
            const totalCachedTokens = cachedMessages.reduce((sum, msg) => sum + (msg.cached_tokens || 0), 0);
            console.log(`Cache hits: ${cachedMessages.length} messages, ${totalCachedTokens} tokens`);
        }

        // Show duration
        if (messages.length > 1) {
            const firstMessage = messages[0];
            const lastMessage = messages[messages.length - 1];
            const duration = Math.round(
                (lastMessage.created_at.getTime() - firstMessage.created_at.getTime()) / 1000
            );
            console.log(`Duration: ${duration} seconds`);
        }

    } catch (error) {
        console.error('❌ Error looking up conversation:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
} 