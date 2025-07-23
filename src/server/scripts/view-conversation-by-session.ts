#!/usr/bin/env node

/**
 * Command-line utility to view raw conversation messages by session/conversation ID
 * Usage: ./run-ts src/server/scripts/view-conversation-by-session.ts <session-id>
 */

import { ChatMessageRepository } from '../transform-jsondoc-framework/ChatMessageRepository.js';
import { db } from '../database/connection.js';

interface RawMessage {
    id: string;
    role: 'user' | 'assistant' | 'tool' | 'system';
    content: string;
    tool_name?: string;
    tool_parameters?: any;
    tool_result?: any;
    metadata?: any;
    created_at: string;
    project_id: string;
}

function formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
    });
}

function formatContent(content: string, maxLength = 500): string {
    if (content.length <= maxLength) {
        return content;
    }
    return content.substring(0, maxLength) + '\n... (truncated, ' + (content.length - maxLength) + ' more characters)';
}

function formatJSON(obj: any, maxLength = 300): string {
    const jsonStr = JSON.stringify(obj, null, 2);
    if (jsonStr.length <= maxLength) {
        return jsonStr;
    }
    return jsonStr.substring(0, maxLength) + '\n... (truncated)';
}

async function viewConversationBySession(sessionId: string): Promise<void> {
    try {
        console.log(`\n=== 🔍 Conversation Viewer - Session ID: ${sessionId} ===\n`);

        const chatMessageRepo = new ChatMessageRepository(db);

        // First, try to find messages by toolCallId in metadata
        const allMessages = await db
            .selectFrom('chat_messages_raw')
            .selectAll()
            .execute();

        const sessionMessages: RawMessage[] = [];

        // Filter messages by session ID (could be in various metadata fields)
        for (const message of allMessages) {
            let metadata;
            try {
                metadata = typeof message.metadata === 'string'
                    ? JSON.parse(message.metadata)
                    : message.metadata;
            } catch {
                metadata = {};
            }

            // Check various possible session ID locations
            const toolCallId = metadata?.toolCallId || metadata?.tool_call_id;
            const transformId = metadata?.transform_id;

            if (toolCallId === sessionId || transformId === sessionId || message.id === sessionId) {
                sessionMessages.push({
                    id: message.id,
                    role: message.role as 'user' | 'assistant' | 'tool' | 'system',
                    content: message.content,
                    tool_name: message.tool_name || undefined,
                    tool_parameters: message.tool_parameters,
                    tool_result: message.tool_result,
                    metadata,
                    created_at: message.created_at.toISOString(),
                    project_id: message.project_id
                });
            }
        }

        if (sessionMessages.length === 0) {
            console.log(`❌ No messages found for session ID: ${sessionId}`);
            console.log(`\n💡 Tips:`);
            console.log(`   - Check if the session ID is correct`);
            console.log(`   - Session ID could be a toolCallId, transformId, or message ID`);
            console.log(`   - Use the debug tools to find valid session IDs`);
            return;
        }

        // Sort messages by creation time
        sessionMessages.sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        console.log(`✅ Found ${sessionMessages.length} messages for session ID: ${sessionId}`);
        console.log(`📁 Project ID: ${sessionMessages[0].project_id}`);
        console.log(`⏰ Time Range: ${formatTimestamp(sessionMessages[0].created_at)} → ${formatTimestamp(sessionMessages[sessionMessages.length - 1].created_at)}`);
        console.log(`\n${'='.repeat(80)}\n`);

        // Display each message
        sessionMessages.forEach((message, index) => {
            const roleIcon = {
                'user': '👤',
                'assistant': '🤖',
                'tool': '🔧',
                'system': '⚙️'
            }[message.role] || '❓';

            console.log(`${index + 1}. ${roleIcon} ${message.role.toUpperCase()}`);
            console.log(`   📅 ${formatTimestamp(message.created_at)}`);
            console.log(`   🆔 ${message.id}`);

            if (message.tool_name) {
                console.log(`   🔧 Tool: ${message.tool_name}`);
            }

            console.log(`   📝 Content:`);
            console.log(`      ${formatContent(message.content).replace(/\n/g, '\n      ')}`);

            if (message.tool_parameters && Object.keys(message.tool_parameters).length > 0) {
                console.log(`   ⚙️  Tool Parameters:`);
                console.log(`      ${formatJSON(message.tool_parameters).replace(/\n/g, '\n      ')}`);
            }

            if (message.tool_result && Object.keys(message.tool_result).length > 0) {
                console.log(`   📤 Tool Result:`);
                console.log(`      ${formatJSON(message.tool_result).replace(/\n/g, '\n      ')}`);
            }

            if (message.metadata && Object.keys(message.metadata).length > 0) {
                console.log(`   🏷️  Metadata:`);
                console.log(`      ${formatJSON(message.metadata).replace(/\n/g, '\n      ')}`);
            }

            console.log(`   ${'-'.repeat(60)}`);
        });

        console.log(`\n✨ Summary:`);
        console.log(`   Total Messages: ${sessionMessages.length}`);
        console.log(`   Roles: ${[...new Set(sessionMessages.map(m => m.role))].join(', ')}`);
        console.log(`   Tools Used: ${[...new Set(sessionMessages.map(m => m.tool_name).filter(Boolean))].join(', ') || 'None'}`);
        console.log(`   Duration: ${Math.round((new Date(sessionMessages[sessionMessages.length - 1].created_at).getTime() - new Date(sessionMessages[0].created_at).getTime()) / 1000)}s`);

    } catch (error) {
        console.error(`❌ Error viewing conversation:`, error);
        console.error(`Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');
        process.exit(1);
    }
}

async function main() {
    const sessionId = process.argv[2];

    if (!sessionId) {
        console.log(`❌ Usage: ./run-ts src/server/scripts/view-conversation-by-session.ts <session-id>`);
        console.log(`\n📖 Examples:`);
        console.log(`   ./run-ts src/server/scripts/view-conversation-by-session.ts call_abc123def456`);
        console.log(`   ./run-ts src/server/scripts/view-conversation-by-session.ts transform-uuid-here`);
        console.log(`   ./run-ts src/server/scripts/view-conversation-by-session.ts message-id-here`);
        console.log(`\n💡 Use the debug tools in the frontend to find valid session IDs.`);
        process.exit(1);
    }

    try {
        await viewConversationBySession(sessionId);
    } catch (error) {
        console.error(`❌ Fatal error:`, error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Run the script
main().catch(error => {
    console.error(`❌ Unhandled error:`, error);
    process.exit(1);
}); 