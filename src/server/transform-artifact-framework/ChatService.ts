import { ChatMessageRepository } from './ChatMessageRepository';
import { AgentService } from './AgentService';
import { ChatMessageDisplay } from '../../common/schemas/chatMessages';

export interface SendMessageRequest {
    content: string;
    metadata?: Record<string, any>;
}

export class ChatService {
    constructor(
        private chatRepo: ChatMessageRepository,
        private agentService: AgentService,
    ) { }

    async sendUserMessage(
        projectId: string,
        userId: string,
        request: SendMessageRequest
    ): Promise<void> {
        // Validate project access
        const hasAccess = await this.chatRepo.validateProjectAccess(userId, projectId);
        if (!hasAccess) {
            throw new Error('User does not have access to this project');
        }

        try {
            // Let AgentService handle all chat messages with its streaming system
            await this.agentService.runGeneralAgent(projectId, userId, {
                userRequest: request.content,
                projectId: projectId,
                contextType: 'general'
            }, {
                createChatMessages: true // Let AgentService handle the dual message system
            });

        } catch (error) {
            console.error('Error processing user message:', error);
            throw error;
        }
    }

    // Public methods for getting chat data
    async getChatMessages(projectId: string, userId: string): Promise<ChatMessageDisplay[]> {
        // Validate project access
        const hasAccess = await this.chatRepo.validateProjectAccess(userId, projectId);
        if (!hasAccess) {
            throw new Error('User does not have access to this project');
        }

        return this.chatRepo.getDisplayMessages(projectId);
    }

    async getChatMessageCount(projectId: string, userId: string): Promise<number> {
        // Validate project access
        const hasAccess = await this.chatRepo.validateProjectAccess(userId, projectId);
        if (!hasAccess) {
            throw new Error('User does not have access to this project');
        }

        return this.chatRepo.getMessageCount(projectId);
    }

    async deleteProjectChat(projectId: string, userId: string): Promise<void> {
        // Validate project access
        const hasAccess = await this.chatRepo.validateProjectAccess(userId, projectId);
        if (!hasAccess) {
            throw new Error('User does not have access to this project');
        }

        await this.chatRepo.deleteMessagesForProject(projectId);
    }
} 