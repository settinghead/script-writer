#!/usr/bin/env node

/**
 * List Project Conversations
 * 
 * Lists all conversations for a project with summary information including 
 * message counts, tools used, and timing information.
 * 
 * Usage:
 *   ./run-ts src/server/scripts/list-project-conversations.ts <project-id>
 *   ./run-ts src/server/scripts/list-project-conversations.ts <project-id> --type agent
 *   ./run-ts src/server/scripts/list-project-conversations.ts <project-id> --type tool
 *   ./run-ts src/server/scripts/list-project-conversations.ts <project-id> --limit 20
 */

import { db } from '../database/connection.js';
import type { ConversationType } from '../conversation/ConversationManager.js';

interface ConversationSummary {
    id: string;
    type: ConversationType;
    status: string;
    messageCount: number;
    toolsUsed: string[];
    duration?: number; // in minutes
    firstMessage?: string;
    lastMessage?: string;
    metadata: Record<string, any>;
    created_at: Date;
    updated_at: Date;
}

async function getConversationSummaries(
    projectId: string,
    type?: ConversationType,
    limit: number = 50
): Promise<ConversationSummary[]> {
    // Get conversations with message counts
    let conversationQuery = db
        .selectFrom('conversations')
        .leftJoin('conversation_messages', 'conversations.id', 'conversation_messages.conversation_id')
        .select([
            'conversations.id',
            'conversations.type',
            'conversations.status',
            'conversations.metadata',
            'conversations.created_at',
            'conversations.updated_at'
        ])
        .select(eb => eb.fn.count('conversation_messages.id').as('message_count'))
        .where('conversations.project_id', '=', projectId)
        .groupBy([
            'conversations.id',
            'conversations.type',
            'conversations.status',
            'conversations.metadata',
            'conversations.created_at',
            'conversations.updated_at'
        ])
        .orderBy('conversations.created_at', 'desc')
        .limit(limit);

    if (type) {
        conversationQuery = conversationQuery.where('conversations.type', '=', type);
    }

    const conversations = await conversationQuery.execute();

    // Get detailed info for each conversation
    const summaries: ConversationSummary[] = [];

    for (const conv of conversations) {
        // Get tools used in this conversation
        const toolsUsed = await db
            .selectFrom('conversation_messages')
            .select('tool_name')
            .where('conversation_id', '=', conv.id)
            .where('tool_name', 'is not', null)
            .groupBy('tool_name')
            .execute();

        // Get first and last messages
        const firstMessage = await db
            .selectFrom('conversation_messages')
            .select('content')
            .where('conversation_id', '=', conv.id)
            .orderBy('created_at', 'asc')
            .limit(1)
            .executeTakeFirst();

        const lastMessage = await db
            .selectFrom('conversation_messages')
            .select('content')
            .where('conversation_id', '=', conv.id)
            .orderBy('created_at', 'desc')
            .limit(1)
            .executeTakeFirst();

        // Calculate duration
        const duration = Math.round(
            (conv.updated_at.getTime() - conv.created_at.getTime()) / (1000 * 60)
        );

        summaries.push({
            id: conv.id,
            type: conv.type as ConversationType,
            status: conv.status,
            messageCount: Number(conv.message_count),
            toolsUsed: toolsUsed.map(t => t.tool_name!).filter(Boolean),
            duration,
            firstMessage: firstMessage?.content.substring(0, 100),
            lastMessage: lastMessage?.content.substring(0, 100),
            metadata: typeof conv.metadata === 'string'
                ? JSON.parse(conv.metadata)
                : conv.metadata || {},
            created_at: conv.created_at,
            updated_at: conv.updated_at
        });
    }

    return summaries;
}

async function main() {
    try {
        const args = process.argv.slice(2);

        if (args.length === 0) {
            console.error('❌ Usage: ./run-ts src/server/scripts/list-project-conversations.ts <project-id> [--type agent|tool] [--limit N]');
            process.exit(1);
        }

        const projectId = args[0];
        let type: ConversationType | undefined;
        let limit = 50;

        // Parse optional arguments
        for (let i = 1; i < args.length; i++) {
            if (args[i] === '--type' && args[i + 1]) {
                type = args[i + 1] as ConversationType;
                i++; // Skip next arg
            } else if (args[i] === '--limit' && args[i + 1]) {
                limit = parseInt(args[i + 1], 10);
                i++; // Skip next arg
            }
        }

        console.log(`🔍 Listing conversations for project: ${projectId}`);
        if (type) console.log(`📋 Filter: ${type} conversations only`);
        console.log(`📊 Limit: ${limit} conversations\n`);

        const summaries = await getConversationSummaries(projectId, type, limit);

        if (summaries.length === 0) {
            console.log('💬 No conversations found for this project');
            return;
        }

        console.log(`📋 Found ${summaries.length} conversations:\n`);

        // Group by type for better display
        const agentConversations = summaries.filter(s => s.type === 'agent');
        const toolConversations = summaries.filter(s => s.type === 'tool');

        if (agentConversations.length > 0) {
            console.log(`🤖 AGENT CONVERSATIONS (${agentConversations.length}):`);
            console.log('─'.repeat(80));

            for (const conv of agentConversations) {
                console.log(`ID: ${conv.id}`);
                console.log(`Status: ${conv.status} | Messages: ${conv.messageCount} | Duration: ${conv.duration}min`);
                console.log(`Created: ${conv.created_at.toISOString()}`);

                if (conv.toolsUsed.length > 0) {
                    console.log(`Tools: ${conv.toolsUsed.join(', ')}`);
                }

                if (conv.firstMessage) {
                    console.log(`First: ${conv.firstMessage}${conv.firstMessage.length >= 100 ? '...' : ''}`);
                }

                if (Object.keys(conv.metadata).length > 0) {
                    console.log(`Metadata: ${JSON.stringify(conv.metadata, null, 2)}`);
                }

                console.log(''); // Empty line between conversations
            }
        }

        if (toolConversations.length > 0) {
            console.log(`🔧 TOOL CONVERSATIONS (${toolConversations.length}):`);
            console.log('─'.repeat(80));

            for (const conv of toolConversations) {
                console.log(`ID: ${conv.id}`);
                console.log(`Status: ${conv.status} | Messages: ${conv.messageCount} | Duration: ${conv.duration}min`);
                console.log(`Created: ${conv.created_at.toISOString()}`);

                if (conv.toolsUsed.length > 0) {
                    console.log(`Tools: ${conv.toolsUsed.join(', ')}`);
                }

                if (conv.firstMessage) {
                    console.log(`First: ${conv.firstMessage}${conv.firstMessage.length >= 100 ? '...' : ''}`);
                }

                if (Object.keys(conv.metadata).length > 0) {
                    console.log(`Metadata: ${JSON.stringify(conv.metadata, null, 2)}`);
                }

                console.log(''); // Empty line between conversations
            }
        }

        // Summary statistics
        console.log('📊 SUMMARY STATISTICS:');
        console.log('─'.repeat(40));
        console.log(`Total conversations: ${summaries.length}`);
        console.log(`Agent conversations: ${agentConversations.length}`);
        console.log(`Tool conversations: ${toolConversations.length}`);

        const totalMessages = summaries.reduce((sum, conv) => sum + conv.messageCount, 0);
        console.log(`Total messages: ${totalMessages}`);

        const avgMessagesPerConv = totalMessages / summaries.length;
        console.log(`Average messages per conversation: ${avgMessagesPerConv.toFixed(1)}`);

        const allTools = [...new Set(summaries.flatMap(conv => conv.toolsUsed))];
        if (allTools.length > 0) {
            console.log(`Unique tools used: ${allTools.join(', ')}`);
        }

    } catch (error) {
        console.error('❌ Error listing conversations:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

if (require.main === module) {
    main();
} 