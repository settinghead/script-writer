#!/usr/bin/env node

/**
 * Search Conversations
 * 
 * Search conversations across projects using various criteria including
 * content text, tool names, status, date ranges, and more.
 * 
 * Usage:
 *   ./run-ts src/server/scripts/search-conversations.ts --project <project-id> --text "error"
 *   ./run-ts src/server/scripts/search-conversations.ts --project <project-id> --tool brainstorm_generation
 *   ./run-ts src/server/scripts/search-conversations.ts --project <project-id> --status failed
 *   ./run-ts src/server/scripts/search-conversations.ts --project <project-id> --days 7 --type agent
 *   ./run-ts src/server/scripts/search-conversations.ts --text "user message" --limit 50
 */

import { db } from '../database/connection.js';
import { getConversationMessages } from '../conversation/ConversationManager.js';
import type { ConversationType } from '../conversation/ConversationManager.js';

interface SearchCriteria {
    projectId?: string;
    text?: string;
    toolName?: string;
    status?: string;
    type?: ConversationType;
    days?: number;
    role?: string;
    hasErrors?: boolean;
    cacheHitsOnly?: boolean;
    limit: number;
}

interface SearchResult {
    id: string;
    project_id: string;
    type: ConversationType;
    status: string;
    messageCount: number;
    matchedMessages: Array<{
        id: string;
        role: string;
        content: string;
        tool_name?: string;
        created_at: Date;
        match_reason: string;
    }>;
    created_at: Date;
    updated_at: Date;
    metadata: Record<string, any>;
}

async function searchConversations(criteria: SearchCriteria): Promise<SearchResult[]> {
    // Build base conversation query
    let conversationQuery = db
        .selectFrom('conversations')
        .selectAll()
        .orderBy('created_at', 'desc')
        .limit(criteria.limit);

    // Apply conversation-level filters
    if (criteria.projectId) {
        conversationQuery = conversationQuery.where('project_id', '=', criteria.projectId);
    }

    if (criteria.type) {
        conversationQuery = conversationQuery.where('type', '=', criteria.type);
    }

    if (criteria.status) {
        conversationQuery = conversationQuery.where('status', '=', criteria.status);
    }

    if (criteria.days) {
        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - criteria.days);
        conversationQuery = conversationQuery.where('created_at', '>=', dateThreshold);
    }

    const conversations = await conversationQuery.execute();

    // Process each conversation and check message-level criteria
    const results: SearchResult[] = [];

    for (const conversation of conversations) {
        try {
            const messages = await getConversationMessages(conversation.id);
            const matchedMessages: SearchResult['matchedMessages'] = [];

            // Check each message against criteria
            for (const message of messages) {
                const matchReasons: string[] = [];

                // Text search
                if (criteria.text && message.content.toLowerCase().includes(criteria.text.toLowerCase())) {
                    matchReasons.push(`content contains "${criteria.text}"`);
                }

                // Tool name search
                if (criteria.toolName && message.tool_name === criteria.toolName) {
                    matchReasons.push(`tool is "${criteria.toolName}"`);
                }

                // Role filter
                if (criteria.role && message.role === criteria.role) {
                    matchReasons.push(`role is "${criteria.role}"`);
                }

                // Error filter
                if (criteria.hasErrors && message.error_message) {
                    matchReasons.push(`has error: ${message.error_message}`);
                }

                // Cache hits filter
                if (criteria.cacheHitsOnly && message.cache_hit) {
                    matchReasons.push(`cache hit with ${message.cached_tokens} tokens`);
                }

                // If no specific message-level criteria, match all messages for conversation-level searches
                if (!criteria.text && !criteria.toolName && !criteria.role && !criteria.hasErrors && !criteria.cacheHitsOnly) {
                    matchReasons.push('conversation-level match');
                }

                // Add to matched messages if criteria are met
                if (matchReasons.length > 0) {
                    matchedMessages.push({
                        id: message.id,
                        role: message.role,
                        content: message.content.substring(0, 200),
                        tool_name: message.tool_name || undefined,
                        created_at: new Date(message.created_at),
                        match_reason: matchReasons.join(', ')
                    });
                }
            }

            // Include conversation if it has matching messages or meets conversation-level criteria
            if (matchedMessages.length > 0) {
                results.push({
                    id: conversation.id,
                    project_id: conversation.project_id,
                    type: conversation.type as ConversationType,
                    status: conversation.status,
                    messageCount: messages.length,
                    matchedMessages,
                    created_at: conversation.created_at,
                    updated_at: conversation.updated_at,
                    metadata: typeof conversation.metadata === 'string'
                        ? JSON.parse(conversation.metadata)
                        : conversation.metadata || {}
                });
            }
        } catch (error) {
            console.error(`⚠️  Error processing conversation ${conversation.id}:`, error);
        }
    }

    return results;
}

function displaySearchResults(results: SearchResult[], criteria: SearchCriteria): void {
    if (results.length === 0) {
        console.log('🔍 No conversations found matching the search criteria');
        return;
    }

    console.log(`🔍 SEARCH RESULTS (${results.length} conversations):`);
    console.log('═'.repeat(80));

    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const statusEmoji = {
            'active': '🔄',
            'completed': '✅',
            'failed': '❌'
        }[result.status] || '❓';

        const typeEmoji = result.type === 'agent' ? '🤖' : '🔧';

        console.log(`\n${i + 1}. ${statusEmoji} ${typeEmoji} Conversation ${result.id}`);
        console.log(`   📂 Project: ${result.project_id}`);
        console.log(`   📅 Created: ${result.created_at.toISOString()}`);
        console.log(`   📊 ${result.messageCount} total messages, ${result.matchedMessages.length} matches`);

        if (Object.keys(result.metadata).length > 0) {
            console.log(`   📋 Metadata: ${JSON.stringify(result.metadata)}`);
        }

        // Show matched messages
        console.log(`   📨 Matched Messages:`);
        result.matchedMessages.slice(0, 5).forEach((msg, msgIndex) => {
            const roleEmoji = {
                'system': '⚙️',
                'user': '👤',
                'assistant': '🤖',
                'tool': '🔧'
            }[msg.role] || '❓';

            console.log(`      ${msgIndex + 1}. ${roleEmoji} ${msg.role} [${msg.created_at.toISOString()}]`);
            if (msg.tool_name) {
                console.log(`         🔧 Tool: ${msg.tool_name}`);
            }
            console.log(`         📝 Match: ${msg.match_reason}`);
            console.log(`         📄 Content: ${msg.content}${msg.content.length >= 200 ? '...' : ''}`);
        });

        if (result.matchedMessages.length > 5) {
            console.log(`      ... and ${result.matchedMessages.length - 5} more matches`);
        }
    }

    // Summary statistics
    console.log(`\n📊 SEARCH SUMMARY:`);
    console.log('─'.repeat(40));
    console.log(`Total conversations found: ${results.length}`);

    const totalMatches = results.reduce((sum, r) => sum + r.matchedMessages.length, 0);
    console.log(`Total matched messages: ${totalMatches}`);

    const byType = results.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    console.log(`By type:`);
    for (const [type, count] of Object.entries(byType)) {
        console.log(`  ${type}: ${count}`);
    }

    const byStatus = results.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    console.log(`By status:`);
    for (const [status, count] of Object.entries(byStatus)) {
        console.log(`  ${status}: ${count}`);
    }

    // Most common tools
    const tools = results.flatMap(r =>
        r.matchedMessages
            .map(m => m.tool_name)
            .filter(Boolean)
    );

    if (tools.length > 0) {
        const toolCounts = tools.reduce((acc, tool) => {
            acc[tool!] = (acc[tool!] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const topTools = Object.entries(toolCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        console.log(`Most common tools:`);
        topTools.forEach(([tool, count]) => {
            console.log(`  ${tool}: ${count} messages`);
        });
    }

    // Date range
    if (results.length > 1) {
        const dates = results.map(r => r.created_at.getTime());
        const earliest = new Date(Math.min(...dates));
        const latest = new Date(Math.max(...dates));
        console.log(`Date range: ${earliest.toISOString()} to ${latest.toISOString()}`);
    }
}

function parseArguments(): SearchCriteria {
    const args = process.argv.slice(2);
    const criteria: SearchCriteria = {
        limit: 20
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--project':
                criteria.projectId = args[++i];
                break;
            case '--text':
                criteria.text = args[++i];
                break;
            case '--tool':
                criteria.toolName = args[++i];
                break;
            case '--status':
                criteria.status = args[++i];
                break;
            case '--type':
                criteria.type = args[++i] as ConversationType;
                break;
            case '--days':
                criteria.days = parseInt(args[++i], 10);
                break;
            case '--role':
                criteria.role = args[++i];
                break;
            case '--limit':
                criteria.limit = parseInt(args[++i], 10);
                break;
            case '--has-errors':
                criteria.hasErrors = true;
                break;
            case '--cache-hits-only':
                criteria.cacheHitsOnly = true;
                break;
        }
    }

    return criteria;
}

async function main() {
    try {
        const criteria = parseArguments();

        // Validate arguments
        if (!criteria.projectId && !criteria.text && !criteria.toolName && !criteria.hasErrors && !criteria.cacheHitsOnly) {
            console.error('❌ Usage: ./run-ts src/server/scripts/search-conversations.ts [options]');
            console.error('');
            console.error('Options:');
            console.error('  --project <project-id>     Search within specific project');
            console.error('  --text <search-text>       Search message content');
            console.error('  --tool <tool-name>         Search for specific tool usage');
            console.error('  --status <status>          Filter by conversation status');
            console.error('  --type <agent|tool>        Filter by conversation type');
            console.error('  --days <N>                 Search within last N days');
            console.error('  --role <role>              Filter by message role');
            console.error('  --limit <N>                Limit results (default: 20)');
            console.error('  --has-errors               Only conversations with errors');
            console.error('  --cache-hits-only          Only messages with cache hits');
            console.error('');
            console.error('Examples:');
            console.error('  ./run-ts src/server/scripts/search-conversations.ts --project abc123 --text "error"');
            console.error('  ./run-ts src/server/scripts/search-conversations.ts --tool brainstorm_generation --days 7');
            console.error('  ./run-ts src/server/scripts/search-conversations.ts --has-errors --limit 50');
            process.exit(1);
        }

        console.log('🔍 Searching conversations with criteria:');
        console.log('─'.repeat(40));
        if (criteria.projectId) console.log(`📂 Project: ${criteria.projectId}`);
        if (criteria.text) console.log(`📝 Text: "${criteria.text}"`);
        if (criteria.toolName) console.log(`🔧 Tool: ${criteria.toolName}`);
        if (criteria.status) console.log(`📊 Status: ${criteria.status}`);
        if (criteria.type) console.log(`🔧 Type: ${criteria.type}`);
        if (criteria.days) console.log(`📅 Last ${criteria.days} days`);
        if (criteria.role) console.log(`👤 Role: ${criteria.role}`);
        if (criteria.hasErrors) console.log(`❌ Has errors: true`);
        if (criteria.cacheHitsOnly) console.log(`💾 Cache hits only: true`);
        console.log(`📊 Limit: ${criteria.limit}`);
        console.log('');

        const results = await searchConversations(criteria);
        displaySearchResults(results, criteria);

    } catch (error) {
        console.error('❌ Error searching conversations:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

if (require.main === module) {
    main();
} 