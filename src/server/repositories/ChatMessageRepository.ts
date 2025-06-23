import { Kysely } from 'kysely';
import { v4 as uuidv4 } from 'uuid';
import type { DB } from '../database/types';
import { ChatMessageRaw, ChatMessageDisplay } from '../../common/schemas/chatMessages';

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
            tool_parameters: row.tool_parameters ? JSON.parse(row.tool_parameters) : undefined,
            tool_result: row.tool_result ? JSON.parse(row.tool_result) : undefined,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined
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
            tool_parameters: result.tool_parameters ? JSON.parse(result.tool_parameters) : undefined,
            tool_result: result.tool_result ? JSON.parse(result.tool_result) : undefined,
            metadata: result.metadata ? JSON.parse(result.metadata) : undefined
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

        return results as ChatMessageDisplay[];
    }

    async getDisplayMessageById(id: string): Promise<ChatMessageDisplay | null> {
        const result = await this.db
            .selectFrom('chat_messages_display')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        return result as ChatMessageDisplay | null;
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
                return `I've generated some creative story ideas based on your request.`;
            case 'outline':
                return `I've created a detailed story outline for you.`;
            case 'script':
                return `I've written a script based on your specifications.`;
            case 'episode':
                return `I've generated episode content for your story.`;
            default:
                return `I've completed a task to help with your project.`;
        }
    }

    private sanitizeAgentThinking(content: string): string {
        // Remove sensitive information, keep user-friendly progress updates
        if (content.includes('analyzing') || content.includes('processing')) {
            return `I'm analyzing your request and determining the best approach...`;
        }
        if (content.includes('generating') || content.includes('creating')) {
            return `I'm working on creating content for you...`;
        }
        return `I'm thinking about how to help you with this request...`;
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