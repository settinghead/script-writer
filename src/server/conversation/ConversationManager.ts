import { db } from '../database/connection.js';
import {
    generateUserFriendlyContent,
    updateStreamingDisplayMessage,
    type MessageOptions as DisplayMessageOptions
} from '../services/UserFriendlyMessageGenerator.js';

export type ConversationId = string;
export type MessageId = string;
export type ConversationType = 'agent' | 'tool';
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';
export type MessageStatus = 'streaming' | 'completed' | 'failed';

export interface ConversationMessage {
    id: string;
    conversation_id: string;
    role: MessageRole;
    content: string;
    tool_name?: string;
    tool_call_id?: string;
    tool_parameters?: any;
    tool_result?: any;
    model_name?: string;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    seed?: number;
    content_hash?: string;
    cache_hit?: boolean;
    cached_tokens?: number;
    status: MessageStatus;
    error_message?: string;
    metadata: any;
    created_at: string;
    updated_at: string;
}

export interface DisplayMessage {
    id: string;
    conversation_id: string;
    raw_message_id: string;
    role: 'user' | 'assistant';
    content: string;
    display_type: 'message' | 'thinking' | 'progress';
    created_at: string;
    updated_at: string;
}

export interface Conversation {
    id: string;
    project_id: string;
    type: ConversationType;
    metadata: any;
    created_at: string;
    updated_at: string;
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

export async function getConversation(conversationId: ConversationId): Promise<Conversation | null> {
    const conversation = await db
        .selectFrom('conversations')
        .selectAll()
        .where('id', '=', conversationId)
        .executeTakeFirst();

    if (!conversation) {
        return null;
    }

    return {
        id: conversation.id,
        project_id: conversation.project_id,
        type: conversation.type as ConversationType,
        metadata: typeof conversation.metadata === 'string' ? JSON.parse(conversation.metadata) : conversation.metadata,
        created_at: conversation.created_at.toISOString(),
        updated_at: conversation.updated_at.toISOString()
    };
}

export async function getConversationsByProject(projectId: string): Promise<Conversation[]> {
    const conversations = await db
        .selectFrom('conversations')
        .selectAll()
        .where('project_id', '=', projectId)
        .orderBy('created_at', 'desc')
        .execute();

    return conversations.map(conv => ({
        id: conv.id,
        project_id: conv.project_id,
        type: conv.type as ConversationType,
        metadata: typeof conv.metadata === 'string' ? JSON.parse(conv.metadata) : conv.metadata,
        created_at: conv.created_at.toISOString(),
        updated_at: conv.updated_at.toISOString()
    }));
}

export async function getConversationMessages(conversationId: ConversationId): Promise<ConversationMessage[]> {
    const messages = await db
        .selectFrom('conversation_messages')
        .selectAll()
        .where('conversation_id', '=', conversationId)
        .orderBy('created_at', 'asc')
        .execute();

    return messages.map(message => ({
        id: message.id,
        conversation_id: message.conversation_id,
        role: message.role as MessageRole,
        content: message.content,
        tool_name: message.tool_name || undefined,
        tool_call_id: message.tool_call_id || undefined,
        tool_parameters: message.tool_parameters
            ? (typeof message.tool_parameters === 'string' ? JSON.parse(message.tool_parameters) : message.tool_parameters)
            : undefined,
        tool_result: message.tool_result
            ? (typeof message.tool_result === 'string' ? JSON.parse(message.tool_result) : message.tool_result)
            : undefined,
        model_name: message.model_name || undefined,
        temperature: message.temperature ? Number(message.temperature) : undefined,
        top_p: message.top_p ? Number(message.top_p) : undefined,
        max_tokens: message.max_tokens || undefined,
        seed: message.seed || undefined,
        content_hash: message.content_hash || undefined,
        cache_hit: message.cache_hit || false,
        cached_tokens: message.cached_tokens || 0,
        status: message.status as MessageStatus,
        error_message: message.error_message || undefined,
        metadata: message.metadata
            ? (typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata)
            : {},
        created_at: message.created_at.toISOString(),
        updated_at: message.updated_at.toISOString()
    }));
}

export async function userHasConversationAccess(userId: string, conversationId: ConversationId): Promise<boolean> {
    const result = await db
        .selectFrom('conversations')
        .innerJoin('projects', 'conversations.project_id', 'projects.id')
        .innerJoin('projects_users', 'projects.id', 'projects_users.project_id')
        .select('conversations.id')
        .where('conversations.id', '=', conversationId)
        .where('projects_users.user_id', '=', userId)
        .executeTakeFirst();

    return !!result;
}

// New transactional message creation with display messages
export async function createMessageWithDisplay(
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
): Promise<{ rawMessageId: MessageId; displayMessageId?: MessageId }> {
    return await db.transaction().execute(async (trx) => {
        // 1. Create raw message
        const rawResult = await trx
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

        if (!rawResult) {
            throw new Error('Failed to create raw message');
        }

        const rawMessageId = rawResult.id;

        // 2. Create display message (only for user and assistant messages)
        let displayMessageId: MessageId | undefined;

        if (role === 'user' || role === 'assistant' || role === 'tool') {
            const displayOptions: DisplayMessageOptions = {
                toolName: options.toolName,
                toolCallId: options.toolCallId,
                toolParameters: options.toolParameters,
                toolResult: options.toolResult,
                status: options.status,
                errorMessage: options.errorMessage
            };

            const displayMessage = generateUserFriendlyContent(role, content, displayOptions);

            // Only create display message if there's content (system messages return empty)
            if (displayMessage.content) {
                const displayRole = role === 'tool' ? 'assistant' : role as 'user' | 'assistant';

                const displayResult = await trx
                    .insertInto('conversation_messages_display')
                    .values({
                        conversation_id: conversationId,
                        raw_message_id: rawMessageId,
                        role: displayRole,
                        content: displayMessage.content,
                        display_type: displayMessage.displayType
                    })
                    .returning('id')
                    .executeTakeFirst();

                if (displayResult) {
                    displayMessageId = displayResult.id;
                }
            }
        }

        return { rawMessageId, displayMessageId };
    });
}

// Legacy addMessage function for backward compatibility
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
    const { rawMessageId } = await createMessageWithDisplay(conversationId, role, content, options);
    return rawMessageId;
}

// Update message with display message sync
export async function updateMessageWithDisplay(
    messageId: MessageId,
    updates: {
        content?: string;
        status?: MessageStatus;
        errorMessage?: string;
        metadata?: Record<string, any>;
    }
): Promise<void> {
    await db.transaction().execute(async (trx) => {
        // 1. Get the original message to understand context
        const originalMessage = await trx
            .selectFrom('conversation_messages')
            .selectAll()
            .where('id', '=', messageId)
            .executeTakeFirst();

        if (!originalMessage) {
            throw new Error('Message not found');
        }

        // 2. Update raw message
        const updateData: any = {};
        if (updates.content !== undefined) updateData.content = updates.content;
        if (updates.status !== undefined) updateData.status = updates.status;
        if (updates.errorMessage !== undefined) updateData.error_message = updates.errorMessage;
        if (updates.metadata !== undefined) updateData.metadata = JSON.stringify(updates.metadata);

        updateData.updated_at = new Date().toISOString();

        await trx
            .updateTable('conversation_messages')
            .set(updateData)
            .where('id', '=', messageId)
            .execute();

        // 3. Update corresponding display message if it exists
        const existingDisplayMessage = await trx
            .selectFrom('conversation_messages_display')
            .selectAll()
            .where('raw_message_id', '=', messageId)
            .executeTakeFirst();

        if (existingDisplayMessage && (updates.content !== undefined || updates.status !== undefined)) {
            const displayOptions: DisplayMessageOptions = {
                toolName: originalMessage.tool_name || undefined,
                status: updates.status || originalMessage.status as any,
                errorMessage: updates.errorMessage || originalMessage.error_message || undefined
            };

            const newDisplayMessage = updateStreamingDisplayMessage(
                existingDisplayMessage.content,
                updates.content || originalMessage.content,
                updates.status || originalMessage.status as any,
                displayOptions
            );

            await trx
                .updateTable('conversation_messages_display')
                .set({
                    content: newDisplayMessage.content,
                    display_type: newDisplayMessage.displayType,
                    updated_at: new Date().toISOString()
                })
                .where('raw_message_id', '=', messageId)
                .execute();
        }
    });
}

// Legacy updateMessage function for backward compatibility
export async function updateMessage(
    messageId: MessageId,
    updates: {
        content?: string;
        status?: MessageStatus;
        errorMessage?: string;
        metadata?: Record<string, any>;
    }
): Promise<void> {
    await updateMessageWithDisplay(messageId, updates);
}

// Current conversation management
export async function getCurrentConversation(projectId: string): Promise<ConversationId | null> {
    const result = await db
        .selectFrom('project_current_conversations')
        .select('conversation_id')
        .where('project_id', '=', projectId)
        .executeTakeFirst();

    return result?.conversation_id || null;
}

export async function setCurrentConversation(projectId: string, conversationId: ConversationId): Promise<void> {
    await db
        .insertInto('project_current_conversations')
        .values({
            project_id: projectId,
            conversation_id: conversationId,
            updated_at: new Date().toISOString()
        })
        .onConflict((oc) => oc
            .column('project_id')
            .doUpdateSet({
                conversation_id: conversationId,
                updated_at: new Date().toISOString()
            })
        )
        .execute();
}

export async function createAndSetCurrentConversation(
    projectId: string,
    type: ConversationType,
    metadata: Record<string, any> = {}
): Promise<ConversationId> {
    const conversationId = await createConversation(projectId, type, metadata);
    await setCurrentConversation(projectId, conversationId);
    return conversationId;
}

// Get display messages for frontend
export async function getDisplayMessages(conversationId: ConversationId): Promise<DisplayMessage[]> {
    const messages = await db
        .selectFrom('conversation_messages_display')
        .selectAll()
        .where('conversation_id', '=', conversationId)
        .orderBy('created_at', 'asc')
        .execute();

    return messages.map(message => ({
        id: message.id,
        conversation_id: message.conversation_id,
        raw_message_id: message.raw_message_id,
        role: message.role as 'user' | 'assistant',
        content: message.content,
        display_type: message.display_type as 'message' | 'thinking' | 'progress',
        created_at: message.created_at.toISOString(),
        updated_at: message.updated_at.toISOString()
    }));
} 