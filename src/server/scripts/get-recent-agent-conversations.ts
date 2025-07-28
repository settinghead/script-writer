#!/usr/bin/env node

/**
 * Get Recent Agent Conversations
 * 
 * Retrieves recent agent conversations for a project with detailed statistics
 * and analysis including tools used, success rates, and timing information.
 * 
 * Usage:
 *   ./run-ts src/server/scripts/get-recent-agent-conversations.ts <project-id>
 *   ./run-ts src/server/scripts/get-recent-agent-conversations.ts <project-id> --limit 10
 *   ./run-ts src/server/scripts/get-recent-agent-conversations.ts <project-id> --days 7
 *   ./run-ts src/server/scripts/get-recent-agent-conversations.ts <project-id> --verbose
 */

import { db } from '../database/connection.js';
import { getConversationMessages } from '../conversation/ConversationManager.js';
import type { ConversationMessage } from '../conversation/ConversationManager.js';

interface AgentConversationAnalysis {
    id: string;
    status: string;
    messageCount: number;
    toolCalls: number;
    successfulToolCalls: number;
    failedToolCalls: number;
    toolsUsed: string[];
    duration: number; // in seconds
    userMessages: number;
    assistantMessages: number;
    cacheHits: number;
    cachedTokens: number;
    firstUserMessage?: string;
    lastAssistantMessage?: string;
    errorMessages: string[];
    created_at: Date;
    updated_at: Date;
}

async function analyzeAgentConversation(conversationId: string): Promise<AgentConversationAnalysis> {
    const conversation = await db
        .selectFrom('conversations')
        .selectAll()
        .where('id', '=', conversationId)
        .executeTakeFirst();

    if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
    }

    const messages = await getConversationMessages(conversationId, true);

    // Analyze messages
    const toolCalls = messages.filter(msg => msg.tool_name);
    const successfulToolCalls = toolCalls.filter(msg => msg.status === 'completed');
    const failedToolCalls = toolCalls.filter(msg => msg.status === 'failed');
    const toolsUsed = [...new Set(toolCalls.map(msg => msg.tool_name).filter((name): name is string => Boolean(name)))];

    const userMessages = messages.filter(msg => msg.role === 'user');
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');

    const cacheHits = messages.filter(msg => msg.cache_hit);
    const cachedTokens = cacheHits.reduce((sum, msg) => sum + (msg.cached_tokens || 0), 0);

    const errorMessages = messages
        .filter(msg => msg.error_message)
        .map(msg => msg.error_message!)
        .filter(Boolean);

    // Calculate duration
    const duration = messages.length > 1
        ? Math.round((conversation.updated_at.getTime() - conversation.created_at.getTime()) / 1000)
        : 0;

    // Get first user message and last assistant message
    const firstUserMessage = userMessages[0]?.content?.substring(0, 150);
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1]?.content?.substring(0, 150);

    return {
        id: conversationId,
        status: conversation.status,
        messageCount: messages.length,
        toolCalls: toolCalls.length,
        successfulToolCalls: successfulToolCalls.length,
        failedToolCalls: failedToolCalls.length,
        toolsUsed,
        duration,
        userMessages: userMessages.length,
        assistantMessages: assistantMessages.length,
        cacheHits: cacheHits.length,
        cachedTokens,
        firstUserMessage,
        lastAssistantMessage,
        errorMessages,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at
    };
}

async function getRecentAgentConversations(
    projectId: string,
    limit: number = 20,
    days?: number
): Promise<AgentConversationAnalysis[]> {
    let query = db
        .selectFrom('conversations')
        .select('id')
        .where('project_id', '=', projectId)
        .where('type', '=', 'agent')
        .orderBy('created_at', 'desc')
        .limit(limit);

    // Filter by date if specified
    if (days) {
        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - days);
        query = query.where('created_at', '>=', dateThreshold);
    }

    const conversations = await query.execute();

    // Analyze each conversation
    const analyses: AgentConversationAnalysis[] = [];
    for (const conv of conversations) {
        try {
            const analysis = await analyzeAgentConversation(conv.id);
            analyses.push(analysis);
        } catch (error) {
            console.error(`⚠️  Failed to analyze conversation ${conv.id}:`, error);
        }
    }

    return analyses;
}

function displayConversationSummary(analysis: AgentConversationAnalysis, index: number, isVerbose: boolean = false): void {
    const statusEmoji = {
        'active': '🔄',
        'completed': '✅',
        'failed': '❌'
    }[analysis.status] || '❓';

    console.log(`${index + 1}. ${statusEmoji} ${analysis.id}`);
    console.log(`   📅 ${analysis.created_at.toISOString()}`);
    console.log(`   📊 ${analysis.messageCount} messages | ⏱️  ${analysis.duration}s | 👤 ${analysis.userMessages} user | 🤖 ${analysis.assistantMessages} assistant`);

    if (analysis.toolCalls > 0) {
        const toolSuccessRate = ((analysis.successfulToolCalls / analysis.toolCalls) * 100).toFixed(1);
        console.log(`   🔧 ${analysis.toolCalls} tool calls (${analysis.successfulToolCalls} ✅, ${analysis.failedToolCalls} ❌) | Success: ${toolSuccessRate}%`);

        if (analysis.toolsUsed.length > 0) {
            console.log(`   🛠️  Tools: ${analysis.toolsUsed.join(', ')}`);
        }
    }

    if (analysis.cacheHits > 0) {
        console.log(`   💾 ${analysis.cacheHits} cache hits | ${analysis.cachedTokens} cached tokens`);
    }

    if (analysis.errorMessages.length > 0) {
        console.log(`   ⚠️  ${analysis.errorMessages.length} errors`);
        if (isVerbose) {
            analysis.errorMessages.forEach(error => {
                console.log(`      - ${error}`);
            });
        }
    }

    if (analysis.firstUserMessage) {
        const truncated = analysis.firstUserMessage.length >= 150 ? '...' : '';
        console.log(`   💬 First: "${analysis.firstUserMessage}${truncated}"`);
    }

    if (analysis.lastAssistantMessage && isVerbose) {
        const truncated = analysis.lastAssistantMessage.length >= 150 ? '...' : '';
        console.log(`   🤖 Last: "${analysis.lastAssistantMessage}${truncated}"`);
    }

    console.log(''); // Empty line between conversations
}

function displayAggregateStatistics(analyses: AgentConversationAnalysis[]): void {
    if (analyses.length === 0) {
        return;
    }

    console.log('📈 AGGREGATE STATISTICS:');
    console.log('─'.repeat(50));

    // Basic counts
    console.log(`Total agent conversations: ${analyses.length}`);

    const statusCounts = analyses.reduce((acc, conv) => {
        acc[conv.status] = (acc[conv.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    console.log(`Status breakdown:`);
    for (const [status, count] of Object.entries(statusCounts)) {
        const percentage = ((count / analyses.length) * 100).toFixed(1);
        console.log(`  ${status}: ${count} (${percentage}%)`);
    }

    // Message statistics
    const totalMessages = analyses.reduce((sum, conv) => sum + conv.messageCount, 0);
    const avgMessages = (totalMessages / analyses.length).toFixed(1);
    console.log(`Average messages per conversation: ${avgMessages}`);

    const totalUserMessages = analyses.reduce((sum, conv) => sum + conv.userMessages, 0);
    const totalAssistantMessages = analyses.reduce((sum, conv) => sum + conv.assistantMessages, 0);
    console.log(`Total user messages: ${totalUserMessages}`);
    console.log(`Total assistant messages: ${totalAssistantMessages}`);

    // Tool usage statistics
    const totalToolCalls = analyses.reduce((sum, conv) => sum + conv.toolCalls, 0);
    const totalSuccessfulToolCalls = analyses.reduce((sum, conv) => sum + conv.successfulToolCalls, 0);
    const totalFailedToolCalls = analyses.reduce((sum, conv) => sum + conv.failedToolCalls, 0);

    if (totalToolCalls > 0) {
        const overallSuccessRate = ((totalSuccessfulToolCalls / totalToolCalls) * 100).toFixed(1);
        console.log(`Tool calls: ${totalToolCalls} total (${totalSuccessfulToolCalls} ✅, ${totalFailedToolCalls} ❌)`);
        console.log(`Overall tool success rate: ${overallSuccessRate}%`);

        // Most used tools
        const toolUsage = analyses.reduce((acc, conv) => {
            conv.toolsUsed.forEach(tool => {
                acc[tool] = (acc[tool] || 0) + 1;
            });
            return acc;
        }, {} as Record<string, number>);

        const sortedTools = Object.entries(toolUsage)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        if (sortedTools.length > 0) {
            console.log(`Most used tools:`);
            sortedTools.forEach(([tool, count]) => {
                console.log(`  ${tool}: ${count} conversations`);
            });
        }
    }

    // Timing statistics
    const avgDuration = (analyses.reduce((sum, conv) => sum + conv.duration, 0) / analyses.length).toFixed(1);
    console.log(`Average conversation duration: ${avgDuration} seconds`);

    const maxDuration = Math.max(...analyses.map(conv => conv.duration));
    const minDuration = Math.min(...analyses.map(conv => conv.duration));
    console.log(`Duration range: ${minDuration}s - ${maxDuration}s`);

    // Cache statistics
    const totalCacheHits = analyses.reduce((sum, conv) => sum + conv.cacheHits, 0);
    const totalCachedTokens = analyses.reduce((sum, conv) => sum + conv.cachedTokens, 0);

    if (totalCacheHits > 0) {
        console.log(`Cache performance: ${totalCacheHits} hits, ${totalCachedTokens} tokens cached`);
        const avgCacheHitsPerConv = (totalCacheHits / analyses.length).toFixed(1);
        console.log(`Average cache hits per conversation: ${avgCacheHitsPerConv}`);
    }

    // Error statistics
    const conversationsWithErrors = analyses.filter(conv => conv.errorMessages.length > 0);
    if (conversationsWithErrors.length > 0) {
        const errorRate = ((conversationsWithErrors.length / analyses.length) * 100).toFixed(1);
        console.log(`Conversations with errors: ${conversationsWithErrors.length} (${errorRate}%)`);
    }
}

async function main() {
    try {
        const args = process.argv.slice(2);

        if (args.length === 0) {
            console.error('❌ Usage: ./run-ts src/server/scripts/get-recent-agent-conversations.ts <project-id> [--limit N] [--days N] [--verbose]');
            process.exit(1);
        }

        const projectId = args[0];
        let limit = 20;
        let days: number | undefined;
        const isVerbose = args.includes('--verbose');

        // Parse optional arguments
        for (let i = 1; i < args.length; i++) {
            if (args[i] === '--limit' && args[i + 1]) {
                limit = parseInt(args[i + 1], 10);
                i++; // Skip next arg
            } else if (args[i] === '--days' && args[i + 1]) {
                days = parseInt(args[i + 1], 10);
                i++; // Skip next arg
            }
        }

        console.log(`🤖 Getting recent agent conversations for project: ${projectId}`);
        console.log(`📊 Limit: ${limit} conversations`);
        if (days) console.log(`📅 Time window: Last ${days} days`);
        console.log('');

        const analyses = await getRecentAgentConversations(projectId, limit, days);

        if (analyses.length === 0) {
            console.log('💬 No agent conversations found for this project');
            return;
        }

        console.log(`🤖 RECENT AGENT CONVERSATIONS (${analyses.length}):`);
        console.log('─'.repeat(80));

        for (let i = 0; i < analyses.length; i++) {
            displayConversationSummary(analyses[i], i, isVerbose);
        }

        displayAggregateStatistics(analyses);

    } catch (error) {
        console.error('❌ Error getting recent agent conversations:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

if (require.main === module) {
    main();
} 