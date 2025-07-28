import {
    createConversation,
    getConversationsByProject,
    getConversationMessages,
    userHasConversationAccess
} from '../conversation/ConversationManager.js';
import {
    createConversationContext
} from '../conversation/StreamingWrappers.js';
import { AgentService } from './AgentService';
import { TransformJsondocRepository } from './TransformJsondocRepository';

export interface SendMessageRequest {
    content: string;
    metadata?: Record<string, any>;
}

// Functional conversation creators - replacing the ChatService class

/**
 * Send a user message and start a new agent conversation
 */
export async function sendUserMessage(
    projectId: string,
    userId: string,
    request: SendMessageRequest,
    dependencies: {
        agentService: AgentService;
        jsondocRepo: TransformJsondocRepository;
    }
): Promise<void> {
    const { agentService, jsondocRepo } = dependencies;

    // Validate project access
    const hasAccess = await jsondocRepo.userHasProjectAccess(userId, projectId);
    if (!hasAccess) {
        throw new Error('User does not have access to this project');
    }

    try {
        // Let AgentService handle the conversation creation and processing
        await agentService.runGeneralAgent(projectId, userId, {
            userRequest: request.content,
            projectId: projectId,
            contextType: 'general'
        }, {
            createChatMessages: false // We're managing conversations directly now
        });

    } catch (error) {
        console.error('Error processing user message:', error);
        throw error;
    }
}

/**
 * Get all conversation messages for a project (replaces getChatMessages)
 */
export async function getProjectConversationMessages(
    projectId: string,
    userId: string,
    jsondocRepo: TransformJsondocRepository
): Promise<Array<{
    id: string;
    conversationId: string;
    role: string;
    content: string;
    createdAt: Date;
    metadata?: any;
}>> {
    // Validate project access
    const hasAccess = await jsondocRepo.userHasProjectAccess(userId, projectId);
    if (!hasAccess) {
        throw new Error('User does not have access to this project');
    }

    // Get all conversations for the project
    const conversations = await getConversationsByProject(projectId);

    // Get messages from all conversations
    const allMessages = [];
    for (const conversation of conversations) {
        const messages = await getConversationMessages(conversation.id);

        // Transform to match expected format
        const transformedMessages = messages.map(msg => ({
            id: msg.id,
            conversationId: conversation.id,
            role: msg.role,
            content: msg.content,
            createdAt: new Date(msg.created_at),
            metadata: msg.metadata
        }));

        allMessages.push(...transformedMessages);
    }

    // Sort by creation time
    return allMessages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Get conversation message count for a project
 */
export async function getProjectConversationMessageCount(
    projectId: string,
    userId: string,
    jsondocRepo: TransformJsondocRepository
): Promise<number> {
    // Validate project access
    const hasAccess = await jsondocRepo.userHasProjectAccess(userId, projectId);
    if (!hasAccess) {
        throw new Error('User does not have access to this project');
    }

    const messages = await getProjectConversationMessages(projectId, userId, jsondocRepo);
    return messages.length;
}

/**
 * Delete all conversations and messages for a project
 */
export async function deleteProjectConversations(
    projectId: string,
    userId: string,
    jsondocRepo: TransformJsondocRepository
): Promise<void> {
    // Validate project access
    const hasAccess = await jsondocRepo.userHasProjectAccess(userId, projectId);
    if (!hasAccess) {
        throw new Error('User does not have access to this project');
    }

    // Get all conversations for the project
    const conversations = await getConversationsByProject(projectId);

    // Delete each conversation (messages will cascade delete)
    const { db } = await import('../database/connection.js');

    for (const conversation of conversations) {
        await db
            .deleteFrom('conversations')
            .where('id', '=', conversation.id)
            .execute();
    }

    console.log(`[ChatService] Deleted ${conversations.length} conversations for project ${projectId}`);
}

/**
 * Legacy class wrapper for backward compatibility during transition
 * This maintains the existing interface while using functional implementations
 */
export class ChatService {
    constructor(
        private chatRepo: any, // Not used anymore but kept for interface compatibility
        private agentService: AgentService,
        private jsondocRepo?: TransformJsondocRepository
    ) { }

    async sendUserMessage(
        projectId: string,
        userId: string,
        request: SendMessageRequest
    ): Promise<void> {
        if (!this.jsondocRepo) {
            throw new Error('ChatService not properly initialized with jsondocRepo');
        }

        return sendUserMessage(projectId, userId, request, {
            agentService: this.agentService,
            jsondocRepo: this.jsondocRepo
        });
    }

    async getChatMessages(projectId: string, userId: string): Promise<any[]> {
        if (!this.jsondocRepo) {
            throw new Error('ChatService not properly initialized with jsondocRepo');
        }

        return getProjectConversationMessages(projectId, userId, this.jsondocRepo);
    }

    async getChatMessageCount(projectId: string, userId: string): Promise<number> {
        if (!this.jsondocRepo) {
            throw new Error('ChatService not properly initialized with jsondocRepo');
        }

        return getProjectConversationMessageCount(projectId, userId, this.jsondocRepo);
    }

    async deleteProjectChat(projectId: string, userId: string): Promise<void> {
        if (!this.jsondocRepo) {
            throw new Error('ChatService not properly initialized with jsondocRepo');
        }

        return deleteProjectConversations(projectId, userId, this.jsondocRepo);
    }
} 