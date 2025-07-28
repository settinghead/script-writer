#!/usr/bin/env node

/**
 * Get Conversation Content
 * 
 * Displays the full content of a specific conversation including all messages,
 * tool calls, parameters, and detailed information. Useful for debugging
 * specific conversation flows.
 * 
 * Usage:
 *   ./run-ts src/server/scripts/get-conversation-content.ts <conversation-id>
 *   ./run-ts src/server/scripts/get-conversation-content.ts <conversation-id> --verbose
 *   ./run-ts src/server/scripts/get-conversation-content.ts <conversation-id> --include-failed
 *   ./run-ts src/server/scripts/get-conversation-content.ts <conversation-id> --format json
 */

import { db } from '../database/connection.js';
import { getConversation, getConversationMessages } from '../conversation/ConversationManager.js';
import type { ConversationMessage, Conversation } from '../conversation/ConversationManager.js';

interface ConversationContentOptions {
    verbose: boolean;
    includeFailed: boolean;
    format: 'text' | 'json';
}

async function getFullConversationContent(
    conversationId: string,
    options: ConversationContentOptions
): Promise<{
    conversation: Conversation;
    messages: ConversationMessage[];
    relatedTransforms: any[];
} | null> {
    const conversation = await getConversation(conversationId);
    if (!conversation) {
        return null;
    }

    const messages = await getConversationMessages(conversationId, options.includeFailed);

    // Get related transforms
    const relatedTransforms = await db
        .selectFrom('transforms')
        .selectAll()
        .where('conversation_id', '=', conversationId)
        .orderBy('created_at', 'asc')
        .execute();

    return { conversation, messages, relatedTransforms };
}

function formatMessageContent(message: ConversationMessage, index: number, options: ConversationContentOptions): void {
    const timestamp = message.created_at.toISOString();
    const roleEmoji = {
        'system': '⚙️',
        'user': '👤',
        'assistant': '🤖',
        'tool': '🔧'
    }[message.role] || '❓';

    console.log(`\n${index + 1}. ${roleEmoji} ${message.role.toUpperCase()} MESSAGE`);
    console.log(`   🆔 ID: ${message.id}`);
    console.log(`   📅 Time: ${timestamp}`);
    console.log(`   📊 Status: ${message.status}`);

    if (message.error_message) {
        console.log(`   ❌ Error: ${message.error_message}`);
    }

    // Tool information
    if (message.tool_name) {
        console.log(`   🔧 Tool: ${message.tool_name}`);

        if (message.tool_call_id) {
            console.log(`   🏷️  Call ID: ${message.tool_call_id}`);
        }

        if (message.tool_parameters && Object.keys(message.tool_parameters).length > 0) {
            console.log(`   📥 Parameters:`);
            if (options.verbose) {
                console.log(JSON.stringify(message.tool_parameters, null, 6));
            } else {
                const keys = Object.keys(message.tool_parameters);
                console.log(`      Keys: ${keys.join(', ')}`);
                // Show first few parameter values if not too long
                keys.slice(0, 3).forEach(key => {
                    const value = message.tool_parameters![key];
                    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
                    const truncated = valueStr.length > 100 ? valueStr.substring(0, 100) + '...' : valueStr;
                    console.log(`      ${key}: ${truncated}`);
                });
            }
        }

        if (message.tool_result && Object.keys(message.tool_result).length > 0) {
            console.log(`   📤 Tool Result:`);
            if (options.verbose) {
                console.log(JSON.stringify(message.tool_result, null, 6));
            } else {
                const keys = Object.keys(message.tool_result);
                console.log(`      Keys: ${keys.join(', ')}`);
            }
        }
    }

    // LLM parameters
    if (message.model_name || message.temperature || message.top_p || message.max_tokens) {
        console.log(`   🧠 LLM Settings:`);
        if (message.model_name) console.log(`      Model: ${message.model_name}`);
        if (message.temperature) console.log(`      Temperature: ${message.temperature}`);
        if (message.top_p) console.log(`      Top-p: ${message.top_p}`);
        if (message.max_tokens) console.log(`      Max tokens: ${message.max_tokens}`);
        if (message.seed) console.log(`      Seed: ${message.seed}`);
    }

    // Caching information
    if (message.content_hash) {
        console.log(`   🔗 Content Hash: ${message.content_hash}`);
    }

    if (message.cache_hit) {
        console.log(`   💾 Cache Hit: ${message.cached_tokens} tokens`);
    }

    // Metadata
    if (message.metadata && Object.keys(message.metadata).length > 0) {
        console.log(`   📋 Metadata:`);
        if (options.verbose) {
            console.log(JSON.stringify(message.metadata, null, 6));
        } else {
            console.log(`      Keys: ${Object.keys(message.metadata).join(', ')}`);
        }
    }

    // Content
    console.log(`   📄 Content (${message.content.length} chars):`);
    if (options.verbose || message.content.length <= 500) {
        // Show full content for verbose mode or short messages
        const lines = message.content.split('\n');
        lines.forEach((line, i) => {
            console.log(`      ${i + 1}: ${line}`);
        });
    } else {
        // Show truncated content with line numbers
        const truncatedContent = message.content.substring(0, 500);
        const lines = truncatedContent.split('\n');
        lines.forEach((line, i) => {
            console.log(`      ${i + 1}: ${line}`);
        });
        console.log(`      ... (${message.content.length - 500} more characters)`);
    }
}

function displayConversationOverview(
    conversation: Conversation,
    messages: ConversationMessage[],
    relatedTransforms: any[]
): void {
    console.log(`💬 CONVERSATION OVERVIEW:`);
    console.log('─'.repeat(60));
    console.log(`🆔 ID: ${conversation.id}`);
    console.log(`📂 Project: ${conversation.project_id}`);
    console.log(`🔧 Type: ${conversation.type}`);
    console.log(`📊 Status: ${conversation.status}`);
    console.log(`📅 Created: ${conversation.created_at.toISOString()}`);
    console.log(`🔄 Updated: ${conversation.updated_at.toISOString()}`);

    const duration = Math.round((conversation.updated_at.getTime() - conversation.created_at.getTime()) / 1000);
    console.log(`⏱️  Duration: ${duration} seconds`);

    if (Object.keys(conversation.metadata).length > 0) {
        console.log(`📋 Metadata:`);
        console.log(JSON.stringify(conversation.metadata, null, 2));
    }

    // Message statistics
    console.log(`\n📊 MESSAGE STATISTICS:`);
    console.log('─'.repeat(30));
    console.log(`Total messages: ${messages.length}`);

    const messagesByRole = messages.reduce((acc, msg) => {
        acc[msg.role] = (acc[msg.role] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    for (const [role, count] of Object.entries(messagesByRole)) {
        const roleEmoji = {
            'system': '⚙️',
            'user': '👤',
            'assistant': '🤖',
            'tool': '🔧'
        }[role] || '❓';
        console.log(`${roleEmoji} ${role}: ${count}`);
    }

    const failedMessages = messages.filter(msg => msg.status === 'failed');
    if (failedMessages.length > 0) {
        console.log(`❌ Failed messages: ${failedMessages.length}`);
    }

    const cachedMessages = messages.filter(msg => msg.cache_hit);
    if (cachedMessages.length > 0) {
        const totalCachedTokens = cachedMessages.reduce((sum, msg) => sum + (msg.cached_tokens || 0), 0);
        console.log(`💾 Cache hits: ${cachedMessages.length} messages, ${totalCachedTokens} tokens`);
    }

    const toolsUsed = [...new Set(messages.map(msg => msg.tool_name).filter(Boolean))];
    if (toolsUsed.length > 0) {
        console.log(`🛠️  Tools used: ${toolsUsed.join(', ')}`);
    }

    // Related transforms
    if (relatedTransforms.length > 0) {
        console.log(`\n🔄 RELATED TRANSFORMS (${relatedTransforms.length}):`);
        console.log('─'.repeat(40));
        relatedTransforms.forEach((transform, i) => {
            console.log(`${i + 1}. ${transform.id} (${transform.type}) - ${transform.status}`);
            console.log(`   Created: ${transform.created_at}`);
            if (transform.trigger_message_id) {
                console.log(`   Trigger: ${transform.trigger_message_id}`);
            }
        });
    }
}

function outputAsJson(
    conversation: Conversation,
    messages: ConversationMessage[],
    relatedTransforms: any[]
): void {
    const output = {
        conversation,
        messages,
        relatedTransforms,
        metadata: {
            exportedAt: new Date().toISOString(),
            totalMessages: messages.length,
            messagesByRole: messages.reduce((acc, msg) => {
                acc[msg.role] = (acc[msg.role] || 0) + 1;
                return acc;
            }, {} as Record<string, number>),
            toolsUsed: [...new Set(messages.map(msg => msg.tool_name).filter(Boolean))],
            duration: Math.round((conversation.updated_at.getTime() - conversation.created_at.getTime()) / 1000)
        }
    };

    console.log(JSON.stringify(output, null, 2));
}

async function main() {
    try {
        const args = process.argv.slice(2);

        if (args.length === 0) {
            console.error('❌ Usage: ./run-ts src/server/scripts/get-conversation-content.ts <conversation-id> [--verbose] [--include-failed] [--format json]');
            process.exit(1);
        }

        const conversationId = args[0];
        const options: ConversationContentOptions = {
            verbose: args.includes('--verbose'),
            includeFailed: args.includes('--include-failed'),
            format: args.includes('--format') && args[args.indexOf('--format') + 1] === 'json' ? 'json' : 'text'
        };

        console.log(`🔍 Getting conversation content: ${conversationId}`);
        if (options.includeFailed) console.log(`⚠️  Including failed messages`);
        if (options.verbose) console.log(`📝 Verbose mode enabled`);
        console.log('');

        const result = await getFullConversationContent(conversationId, options);

        if (!result) {
            console.log('❌ Conversation not found');
            return;
        }

        const { conversation, messages, relatedTransforms } = result;

        if (options.format === 'json') {
            outputAsJson(conversation, messages, relatedTransforms);
            return;
        }

        // Text format output
        displayConversationOverview(conversation, messages, relatedTransforms);

        if (messages.length === 0) {
            console.log('\n📭 No messages in this conversation');
            return;
        }

        console.log(`\n📨 CONVERSATION MESSAGES:`);
        console.log('═'.repeat(80));

        for (let i = 0; i < messages.length; i++) {
            formatMessageContent(messages[i], i, options);
        }

        console.log('\n✅ Conversation content displayed successfully');

    } catch (error) {
        console.error('❌ Error getting conversation content:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
} 