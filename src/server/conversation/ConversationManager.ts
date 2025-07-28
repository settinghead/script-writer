import { db } from '../database/connection.js';
import type { ColumnType } from 'kysely';

// Core conversation types
export type ConversationId = string;
export type MessageId = string;

export type ConversationType = 'agent' | 'tool';
export type ConversationStatus = 'active' | 'completed' | 'failed';
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';
export type MessageStatus = 'streaming' | 'completed' | 'failed';

// Database interface types
export interface Conversation {
    id: ConversationId;
    project_id: string;
    type: ConversationType;
    status: ConversationStatus;
    metadata: Record<string, any>;
    created_at: Date;
    updated_at: Date;
}

export interface ConversationMessage {
    id: MessageId;
    conversation_id: ConversationId;
    role: MessageRole;
    content: string;

    // Tool-specific fields (allow both null and undefined for compatibility)
    tool_name?: string | null;
    tool_call_id?: string | null;
    tool_parameters?: Record<string, any> | null;
    tool_result?: Record<string, any> | null;

    // LLM parameters
    model_name?: string | null;
    temperature?: number | null;
    top_p?: number | null;
    max_tokens?: number | null;
    seed?: number | null;

    // Caching support
    content_hash?: string | null;
    cache_hit?: boolean;
    cached_tokens?: number;

    // Status tracking
    status: MessageStatus;
    error_message?: string | null;

    // Metadata
    metadata: Record<string, any>;
    created_at: Date;
    updated_at: Date;
}

// Core conversation management functions
export async function createConversation(
    projectId: string,
    type: ConversationType,
    metadata: Record<string, any> = {}
): Promise<ConversationId> {
    console.log(`[ConversationManager] Creating ${type} conversation for project ${projectId}`);

    const result = await db
        .insertInto('conversations')
        .values({
            project_id: projectId,
            type,
            status: 'active' as const,
            metadata: JSON.stringify(metadata)
        })
        .returning('id')
        .executeTakeFirst();

    if (!result) {
        throw new Error('Failed to create conversation');
    }

    const conversationId = result.id;
    console.log(`[ConversationManager] ✅ Created conversation ${conversationId}`);

    return conversationId;
}

export async function getConversation(
    conversationId: ConversationId
): Promise<Conversation | null> {
    const result = await db
        .selectFrom('conversations')
        .selectAll()
        .where('id', '=', conversationId)
        .executeTakeFirst();

    if (!result) {
        return null;
    }

    return {
        ...result,
        type: result.type as ConversationType,
        status: result.status as ConversationStatus,
        metadata: typeof result.metadata === 'string'
            ? JSON.parse(result.metadata)
            : result.metadata || {}
    };
}

export async function getConversationMessages(
    conversationId: ConversationId,
    includeFailedMessages: boolean = false
): Promise<ConversationMessage[]> {
    let query = db
        .selectFrom('conversation_messages')
        .selectAll()
        .where('conversation_id', '=', conversationId)
        .orderBy('created_at', 'asc');

    if (!includeFailedMessages) {
        query = query.where('status', '!=', 'failed');
    }

    const results = await query.execute();

    return results.map(message => ({
        ...message,
        role: message.role as MessageRole,
        status: message.status as MessageStatus,
        temperature: message.temperature ? Number(message.temperature) : null,
        top_p: message.top_p ? Number(message.top_p) : null,
        tool_parameters: typeof message.tool_parameters === 'string'
            ? JSON.parse(message.tool_parameters)
            : message.tool_parameters || {},
        tool_result: typeof message.tool_result === 'string'
            ? JSON.parse(message.tool_result)
            : message.tool_result || {},
        metadata: typeof message.metadata === 'string'
            ? JSON.parse(message.metadata)
            : message.metadata || {}
    }));
}

export async function addMessage(
    conversationId: ConversationId,
    role: MessageRole,
    content: string,
    options: {
        toolName?: string;
        toolCallId?: string;
        toolParameters?: Record<string, any>;
        toolResult?: Record<string, any>;
        modelName?: string;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
        seed?: number;
        contentHash?: string;
        cacheHit?: boolean;
        cachedTokens?: number;
        status?: MessageStatus;
        errorMessage?: string;
        metadata?: Record<string, any>;
    } = {}
): Promise<MessageId> {
    const result = await db
        .insertInto('conversation_messages')
        .values({
            conversation_id: conversationId,
            role,
            content,
            tool_name: options.toolName || null,
            tool_call_id: options.toolCallId || null,
            tool_parameters: options.toolParameters ? JSON.stringify(options.toolParameters) : null,
            tool_result: options.toolResult ? JSON.stringify(options.toolResult) : null,
            model_name: options.modelName || null,
            temperature: options.temperature || null,
            top_p: options.topP || null,
            max_tokens: options.maxTokens || null,
            seed: options.seed || null,
            content_hash: options.contentHash || null,
            cache_hit: options.cacheHit || false,
            cached_tokens: options.cachedTokens || 0,
            status: options.status || 'completed',
            error_message: options.errorMessage || null,
            metadata: JSON.stringify(options.metadata || {})
        })
        .returning('id')
        .executeTakeFirst();

    if (!result) {
        throw new Error('Failed to add message to conversation');
    }

    return result.id;
}

export async function updateMessage(
    messageId: MessageId,
    updates: {
        content?: string;
        status?: MessageStatus;
        errorMessage?: string;
        toolResult?: Record<string, any>;
        cacheHit?: boolean;
        cachedTokens?: number;
        metadata?: Record<string, any>;
    }
): Promise<void> {
    const updateValues: any = {};

    if (updates.content !== undefined) updateValues.content = updates.content;
    if (updates.status !== undefined) updateValues.status = updates.status;
    if (updates.errorMessage !== undefined) updateValues.error_message = updates.errorMessage;
    if (updates.toolResult !== undefined) updateValues.tool_result = JSON.stringify(updates.toolResult);
    if (updates.cacheHit !== undefined) updateValues.cache_hit = updates.cacheHit;
    if (updates.cachedTokens !== undefined) updateValues.cached_tokens = updates.cachedTokens;
    if (updates.metadata !== undefined) updateValues.metadata = JSON.stringify(updates.metadata);

    await db
        .updateTable('conversation_messages')
        .set(updateValues)
        .where('id', '=', messageId)
        .execute();
}

export async function updateConversationStatus(
    conversationId: ConversationId,
    status: ConversationStatus,
    metadata?: Record<string, any>
): Promise<void> {
    const updateValues: any = {
        status
    };

    if (metadata) {
        updateValues.metadata = JSON.stringify(metadata);
    }

    await db
        .updateTable('conversations')
        .set(updateValues)
        .where('id', '=', conversationId)
        .execute();
}

export async function getConversationsByProject(
    projectId: string,
    type?: ConversationType,
    limit: number = 50
): Promise<Conversation[]> {
    let query = db
        .selectFrom('conversations')
        .selectAll()
        .where('project_id', '=', projectId)
        .orderBy('created_at', 'desc')
        .limit(limit);

    if (type) {
        query = query.where('type', '=', type);
    }

    const results = await query.execute();

    return results.map(conversation => ({
        ...conversation,
        type: conversation.type as ConversationType,
        status: conversation.status as ConversationStatus,
        metadata: typeof conversation.metadata === 'string'
            ? JSON.parse(conversation.metadata)
            : conversation.metadata || {}
    }));
}

// Helper function to get conversation history formatted for LLM
export async function getConversationHistoryForLLM(
    conversationId: ConversationId,
    excludeFailedMessages: boolean = true
): Promise<Array<{ role: string; content: string }>> {
    const messages = await getConversationMessages(conversationId, !excludeFailedMessages);

    return messages
        .filter(msg => ['system', 'user', 'assistant'].includes(msg.role))
        .map(msg => ({
            role: msg.role,
            content: msg.content
        }));
}

// Helper function to check if user has access to conversation
export async function userHasConversationAccess(
    userId: string,
    conversationId: ConversationId
): Promise<boolean> {
    const result = await db
        .selectFrom('conversations')
        .innerJoin('projects_users', 'conversations.project_id', 'projects_users.project_id')
        .select('conversations.id')
        .where('conversations.id', '=', conversationId)
        .where('projects_users.user_id', '=', userId)
        .executeTakeFirst();

    return !!result;
} 