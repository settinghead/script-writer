import { Kysely } from 'kysely';
import { v4 as uuidv4 } from 'uuid';
import type { DB } from '../database/types';
import {
    ChatMessageRaw,
    ChatMessageDisplay,
    ChatEvent,
    createEventMessage,
    parseEventMessage,
    ChatEventHelpers
} from '../../common/schemas/chatMessages';

export class ChatMessageRepository {
    constructor(private db: Kysely<DB>) { }

    // Raw messages (internal use only)
    async createRawMessage(
        projectId: string,
        role: 'user' | 'assistant' | 'tool' | 'system',
        content: string,
        options: {
            toolName?: string;
            toolParameters?: Record<string, any>;
            toolResult?: Record<string, any>;
            metadata?: Record<string, any>;
        } = {}
    ): Promise<ChatMessageRaw> {
        const id = uuidv4();
        const now = new Date().toISOString();

        const rawMessage = {
            id,
            project_id: projectId,
            role,
            content,
            tool_name: options.toolName || null,
            tool_parameters: options.toolParameters ? JSON.stringify(options.toolParameters) : null,
            tool_result: options.toolResult ? JSON.stringify(options.toolResult) : null,
            metadata: options.metadata ? JSON.stringify(options.metadata) : null,
            created_at: now,
            updated_at: now
        };

        await this.db
            .insertInto('chat_messages_raw')
            .values(rawMessage)
            .execute();

        return {
            ...rawMessage,
            tool_parameters: options.toolParameters,
            tool_result: options.toolResult,
            metadata: options.metadata
        } as ChatMessageRaw;
    }

    async getRawMessages(projectId: string): Promise<ChatMessageRaw[]> {
        const results = await this.db
            .selectFrom('chat_messages_raw')
            .selectAll()
            .where('project_id', '=', projectId)
            .orderBy('created_at', 'asc')
            .execute();

        return results.map(row => ({
            ...row,
            created_at: row.created_at.toISOString(),
            updated_at: row.updated_at.toISOString(),
            tool_parameters: row.tool_parameters && typeof row.tool_parameters === 'string'
                ? JSON.parse(row.tool_parameters) : row.tool_parameters,
            tool_result: row.tool_result && typeof row.tool_result === 'string'
                ? JSON.parse(row.tool_result) : row.tool_result,
            metadata: row.metadata && typeof row.metadata === 'string'
                ? JSON.parse(row.metadata) : row.metadata
        })) as ChatMessageRaw[];
    }

    async getRawMessageById(id: string): Promise<ChatMessageRaw | null> {
        const result = await this.db
            .selectFrom('chat_messages_raw')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        if (!result) return null;

        return {
            ...result,
            created_at: result.created_at.toISOString(),
            updated_at: result.updated_at.toISOString(),
            tool_parameters: result.tool_parameters && typeof result.tool_parameters === 'string'
                ? JSON.parse(result.tool_parameters) : result.tool_parameters,
            tool_result: result.tool_result && typeof result.tool_result === 'string'
                ? JSON.parse(result.tool_result) : result.tool_result,
            metadata: result.metadata && typeof result.metadata === 'string'
                ? JSON.parse(result.metadata) : result.metadata
        } as ChatMessageRaw;
    }

    // Display messages (Electric SQL synced)
    async createDisplayMessage(
        projectId: string,
        role: 'user' | 'assistant' | 'tool',
        content: string,
        options: {
            displayType?: 'message' | 'tool_summary' | 'thinking';
            status?: 'pending' | 'streaming' | 'completed' | 'failed';
            rawMessageId?: string;
        } = {}
    ): Promise<ChatMessageDisplay> {
        const id = uuidv4();
        const now = new Date().toISOString();

        const displayMessage = {
            id,
            project_id: projectId,
            role,
            content,
            display_type: options.displayType || 'message',
            status: options.status || 'completed',
            raw_message_id: options.rawMessageId || null,
            created_at: now,
            updated_at: now
        };

        await this.db
            .insertInto('chat_messages_display')
            .values(displayMessage)
            .execute();

        return displayMessage as ChatMessageDisplay;
    }

    async updateDisplayMessage(
        id: string,
        updates: Partial<Pick<ChatMessageDisplay, 'content' | 'status' | 'display_type'>>
    ): Promise<void> {
        const updateData = {
            ...updates,
            updated_at: new Date().toISOString()
        };

        await this.db
            .updateTable('chat_messages_display')
            .set(updateData)
            .where('id', '=', id)
            .execute();
    }

    async getDisplayMessages(projectId: string): Promise<ChatMessageDisplay[]> {
        const results = await this.db
            .selectFrom('chat_messages_display')
            .selectAll()
            .where('project_id', '=', projectId)
            .orderBy('created_at', 'asc')
            .execute();

        return results.map(row => ({
            ...row,
            created_at: row.created_at.toISOString(),
            updated_at: row.updated_at.toISOString(),
            display_type: row.display_type || 'message',
            status: row.status || 'completed',
            raw_message_id: row.raw_message_id || undefined
        })) as ChatMessageDisplay[];
    }

    async getDisplayMessageById(id: string): Promise<ChatMessageDisplay | null> {
        const result = await this.db
            .selectFrom('chat_messages_display')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        if (!result) return null;

        return {
            ...result,
            created_at: result.created_at.toISOString(),
            updated_at: result.updated_at.toISOString(),
            display_type: result.display_type || 'message',
            status: result.status || 'completed',
            raw_message_id: result.raw_message_id || undefined
        } as ChatMessageDisplay;
    }

    // Event-based message methods
    async createEventMessage(
        projectId: string,
        role: 'user' | 'assistant' | 'tool',
        events: ChatEvent[]
    ): Promise<ChatMessageDisplay> {
        const id = uuidv4();
        const now = new Date().toISOString();
        const content = createEventMessage(events);

        const displayMessage = {
            id,
            project_id: projectId,
            role,
            content,
            display_type: 'message' as const,
            status: 'completed' as const,
            raw_message_id: undefined,
            created_at: now,
            updated_at: now
        };

        await this.db
            .insertInto('chat_messages_display')
            .values(displayMessage)
            .execute();

        return displayMessage as ChatMessageDisplay;
    }

    async appendEventToMessage(
        messageId: string,
        event: ChatEvent
    ): Promise<ChatMessageDisplay> {
        // Get current message
        const currentMessage = await this.getDisplayMessageById(messageId);
        if (!currentMessage) {
            throw new Error(`Message with id ${messageId} not found`);
        }

        // Parse existing events
        const existingEvents = parseEventMessage(currentMessage.content);

        // Add new event
        const updatedEvents = [...existingEvents, event];
        const updatedContent = createEventMessage(updatedEvents);

        // Update message
        await this.db
            .updateTable('chat_messages_display')
            .set({
                content: updatedContent,
                updated_at: new Date().toISOString()
            })
            .where('id', '=', messageId)
            .execute();

        // Return updated message
        const updatedMessage = await this.getDisplayMessageById(messageId);
        return updatedMessage!;
    }

    // Helper methods for common event patterns
    async createUserMessage(projectId: string, content: string): Promise<ChatMessageDisplay> {
        const event = ChatEventHelpers.userMessage(content);
        return this.createEventMessage(projectId, 'user', [event]);
    }

    async createAgentThinkingMessage(projectId: string, task: string): Promise<{ messageId: string; startTime: string }> {
        const startEvent = ChatEventHelpers.agentThinkingStart(task);
        const message = await this.createEventMessage(projectId, 'assistant', [startEvent]);
        return { messageId: message.id, startTime: startEvent.timestamp };
    }

    async finishAgentThinking(messageId: string, task: string, startTime: string): Promise<ChatMessageDisplay> {
        const endEvent = ChatEventHelpers.agentThinkingEnd(task, startTime);
        return this.appendEventToMessage(messageId, endEvent);
    }

    async addAgentResponse(messageId: string, content: string): Promise<ChatMessageDisplay> {
        const responseEvent = ChatEventHelpers.agentResponse(content);
        return this.appendEventToMessage(messageId, responseEvent);
    }

    async addAgentError(messageId: string, errorMessage: string): Promise<ChatMessageDisplay> {
        const errorEvent = ChatEventHelpers.agentError(errorMessage);
        return this.appendEventToMessage(messageId, errorEvent);
    }

    // New methods for streaming computation and response messages
    async createComputationMessage(projectId: string, initialContent: string = "🔄 正在思考..."): Promise<ChatMessageDisplay> {
        return this.createDisplayMessage(
            projectId,
            'assistant',
            initialContent,
            {
                displayType: 'thinking',
                status: 'streaming'
            }
        );
    }

    async updateComputationMessage(messageId: string, content: string, status: 'streaming' | 'completed' | 'failed' = 'streaming'): Promise<void> {
        await this.updateDisplayMessage(messageId, {
            content,
            status
        });
    }

    async createResponseMessage(projectId: string, initialContent: string = ""): Promise<ChatMessageDisplay> {
        return this.createDisplayMessage(
            projectId,
            'assistant',
            initialContent,
            {
                displayType: 'message',
                status: 'streaming'
            }
        );
    }

    async updateResponseMessage(messageId: string, content: string, status: 'streaming' | 'completed' | 'failed' = 'streaming'): Promise<void> {
        await this.updateDisplayMessage(messageId, {
            content,
            status
        });
    }

    // Message sanitization helper
    async sanitizeAndCreateDisplayMessage(rawMessage: ChatMessageRaw): Promise<ChatMessageDisplay> {
        let sanitizedContent = rawMessage.content;
        let displayType: 'message' | 'tool_summary' | 'thinking' = 'message';

        // Sanitize based on role and content
        if (rawMessage.role === 'tool' && rawMessage.tool_name) {
            displayType = 'tool_summary';
            sanitizedContent = this.sanitizeToolCall(rawMessage.tool_name, rawMessage.tool_parameters, rawMessage.tool_result);
        } else if (rawMessage.role === 'system') {
            // Don't create display messages for system messages
            throw new Error('System messages should not have display counterparts');
        } else if (rawMessage.role === 'assistant' && rawMessage.metadata?.thinking) {
            displayType = 'thinking';
            sanitizedContent = this.sanitizeAgentThinking(rawMessage.content);
        }

        return this.createDisplayMessage(
            rawMessage.project_id,
            rawMessage.role as 'user' | 'assistant' | 'tool',
            sanitizedContent,
            {
                displayType,
                rawMessageId: rawMessage.id
            }
        );
    }

    private sanitizeToolCall(toolName: string, parameters?: any, result?: any): string {
        switch (toolName) {
            case 'brainstorm':
                return `我已根据您的请求生成了一些创意故事想法。`;
            case 'outline':
                return `我已为您创建了详细的时间顺序大纲。`;
            case 'script':
                return `我已根据您的规格编写了剧本。`;
            case 'episode':
                return `我已为您的故事生成了剧集内容。`;
            default:
                return `我已完成一项任务来帮助您的项目。`;
        }
    }

    private sanitizeAgentThinking(content: string): string {
        // Remove sensitive information, keep user-friendly progress updates
        if (content.includes('analyzing') || content.includes('processing') || content.includes('分析') || content.includes('处理')) {
            return `我正在分析您的请求并确定最佳方法...`;
        }
        if (content.includes('generating') || content.includes('creating') || content.includes('生成') || content.includes('创建')) {
            return `我正在为您创建内容...`;
        }
        return `我正在思考如何帮助您处理这个请求...`;
    }

    // Utility methods
    async deleteMessagesForProject(projectId: string): Promise<void> {
        // Delete display messages first (due to foreign key)
        await this.db
            .deleteFrom('chat_messages_display')
            .where('project_id', '=', projectId)
            .execute();

        // Then delete raw messages
        await this.db
            .deleteFrom('chat_messages_raw')
            .where('project_id', '=', projectId)
            .execute();
    }

    async getMessageCount(projectId: string): Promise<number> {
        const result = await this.db
            .selectFrom('chat_messages_display')
            .select(({ fn }) => [fn.count<number>('id').as('count')])
            .where('project_id', '=', projectId)
            .executeTakeFirst();

        return result?.count || 0;
    }

    // Project access validation
    async validateProjectAccess(userId: string, projectId: string): Promise<boolean> {
        const result = await this.db
            .selectFrom('projects_users')
            .select('id')
            .where('user_id', '=', userId)
            .where('project_id', '=', projectId)
            .executeTakeFirst();

        return !!result;
    }
} 