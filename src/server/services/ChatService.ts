import { ChatMessageRepository } from '../repositories/ChatMessageRepository';
import { AgentService } from './AgentService';
import { TransformRepository } from '../repositories/TransformRepository';
import { ArtifactRepository } from '../repositories/ArtifactRepository';
import { ChatMessageRaw, ChatMessageDisplay } from '../../common/schemas/chatMessages';

export interface SendMessageRequest {
    content: string;
    metadata?: Record<string, any>;
}

export interface AgentResponse {
    type: 'message' | 'tool_call' | 'thinking';
    content: string;
    toolName?: string;
    toolResult?: any;
    metadata?: Record<string, any>;
}

export class ChatService {
    constructor(
        private chatRepo: ChatMessageRepository,
        private agentService: AgentService,
        private transformRepo: TransformRepository,
        private artifactRepo: ArtifactRepository
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
            // 1. Create user message using event-based system (this handles both raw and display)
            await this.chatRepo.createUserMessage(projectId, request.content);

            // 2. Create thinking message to show agent is processing
            const thinkingInfo = await this.chatRepo.createAgentThinkingMessage(
                projectId,
                '分析您的请求并确定最佳方法'
            );

            // 3. Trigger agent processing in background
            this.processAgentResponse(projectId, userId, request.content, thinkingInfo.messageId, thinkingInfo.startTime)
                .catch(error => {
                    console.error('Agent processing failed:', error);
                    // Add error to thinking message
                    this.chatRepo.addAgentError(thinkingInfo.messageId, '处理您的请求时遇到错误。请重试。');
                });

        } catch (error) {
            console.error('Error sending user message:', error);
            throw error;
        }
    }

    private async processAgentResponse(
        projectId: string,
        userId: string,
        userMessage: string,
        thinkingMessageId: string,
        thinkingStartTime: string
    ): Promise<void> {
        try {
            // Get recent chat history for context
            const recentMessages = await this.getRecentChatHistory(projectId, 10);

            // Determine what kind of request this is and route to appropriate agent
            const agentResponse = await this.routeToAgent(projectId, userId, userMessage, recentMessages, thinkingMessageId, thinkingStartTime);

            // Finish thinking and add responses
            await this.chatRepo.finishAgentThinking(
                thinkingMessageId,
                '分析您的请求并确定最佳方法',
                thinkingStartTime
            );

            // Add agent responses to the same message
            for (const response of agentResponse) {
                await this.chatRepo.addAgentResponse(thinkingMessageId, response.content);
            }

        } catch (error) {
            console.error('Agent processing error:', error);

            // Add error to thinking message
            await this.chatRepo.addAgentError(thinkingMessageId, '处理您的请求时遇到错误。请重试。');
        }
    }

    private async routeToAgent(
        projectId: string,
        userId: string,
        userMessage: string,
        chatHistory: ChatMessageDisplay[],
        thinkingMessageId?: string,
        thinkingStartTime?: string
    ): Promise<AgentResponse[]> {
        try {
            // Route all requests to general agent (it can handle brainstorm, editing, and general queries)
            await this.agentService.runGeneralAgent(projectId, userId, {
                userRequest: userMessage,
                projectId: projectId,
                contextType: 'general' // Let the agent decide what to do
            }, {
                createChatMessages: false, // ChatService already handles chat messages
                existingThinkingMessageId: thinkingMessageId,
                existingThinkingStartTime: thinkingStartTime
            });

            return [{
                type: 'tool_call',
                content: '我已处理您的请求。',
                toolName: 'general_agent',
                toolResult: null,
                metadata: { agentType: 'general' }
            }];

        } catch (error) {
            console.error('Agent routing error:', error);
            return [{
                type: 'message',
                content: '抱歉，处理您的请求时遇到问题。请重新表述您的问题或稍后再试。',
                metadata: { agentType: 'error', error: error instanceof Error ? error.message : String(error) }
            }];
        }
    }

    private async getRecentChatHistory(projectId: string, limit: number = 10): Promise<ChatMessageDisplay[]> {
        const allMessages = await this.chatRepo.getDisplayMessages(projectId);
        return allMessages.slice(-limit);
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