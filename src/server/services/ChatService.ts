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
        // Simple routing logic - can be enhanced with more sophisticated intent detection
        const lowerMessage = userMessage.toLowerCase();

        try {
            if (lowerMessage.includes('brainstorm') || lowerMessage.includes('idea') || lowerMessage.includes('story') ||
                lowerMessage.includes('头脑风暴') || lowerMessage.includes('创意') || lowerMessage.includes('故事') ||
                lowerMessage.includes('编辑') || lowerMessage.includes('修改') || lowerMessage.includes('改进') ||
                lowerMessage.includes('长一点') || lowerMessage.includes('短一点') || lowerMessage.includes('更新') ||
                lowerMessage.includes('edit') || lowerMessage.includes('modify') || lowerMessage.includes('improve') ||
                lowerMessage.includes('change') || lowerMessage.includes('update')) {
                // Route to general agent (supports both generation and editing)
                await this.agentService.runGeneralAgent(projectId, userId, {
                    userRequest: userMessage,
                    projectId: projectId,
                    contextType: 'brainstorm'
                }, {
                    createChatMessages: false, // ChatService already handles chat messages
                    existingThinkingMessageId: thinkingMessageId,
                    existingThinkingStartTime: thinkingStartTime
                });

                return [{
                    type: 'tool_call',
                    content: '我已根据您的请求处理了故事创意。',
                    toolName: 'general_agent',
                    toolResult: null,
                    metadata: { agentType: 'general_brainstorm' }
                }];

            } else if (lowerMessage.includes('outline') || lowerMessage.includes('structure') || lowerMessage.includes('大纲') || lowerMessage.includes('结构')) {
                // Route to outline agent (when implemented)
                return [{
                    type: 'message',
                    content: '我可以帮您创建故事大纲。请提供更多关于您故事概念的详细信息，我将为您生成一个全面的大纲。',
                    metadata: { agentType: 'outline', needsMoreInfo: true }
                }];

            } else if (lowerMessage.includes('script') || lowerMessage.includes('dialogue') || lowerMessage.includes('剧本') || lowerMessage.includes('对白')) {
                // Route to script agent (when implemented)
                return [{
                    type: 'message',
                    content: '我可以帮您编写剧本。请提供故事大纲或具体场景详情，我将为您生成剧本内容。',
                    metadata: { agentType: 'script', needsMoreInfo: true }
                }];

            } else {
                // General conversational response
                return [{
                    type: 'message',
                    content: this.generateConversationalResponse(userMessage, chatHistory),
                    metadata: { agentType: 'conversational' }
                }];
            }

        } catch (error) {
            console.error('Agent routing error:', error);
            return [{
                type: 'message',
                content: '抱歉，处理您的请求时遇到问题。请重新表述您的问题或稍后再试。',
                metadata: { agentType: 'error', error: error instanceof Error ? error.message : String(error) }
            }];
        }
    }

    private generateConversationalResponse(userMessage: string, chatHistory: ChatMessageDisplay[]): string {
        const lowerMessage = userMessage.toLowerCase();

        // Simple pattern matching for common queries
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('你好') || lowerMessage.includes('嗨')) {
            return '您好！我是您的AI剧本写作助手。我可以帮您头脑风暴创意、创建大纲和编写剧本。您今天想要做什么？';
        }

        if (lowerMessage.includes('help') || lowerMessage.includes('帮助')) {
            return '我可以在剧本写作的各个方面为您提供帮助：\n\n• **头脑风暴**：生成创意故事想法和概念\n• **大纲创建**：创建详细的故事结构和角色弧线\n• **剧本编写**：编写对白和场景描述\n\n只需告诉我您想要做什么，我就会帮您开始！';
        }

        if (lowerMessage.includes('what can you do') || lowerMessage.includes('你能做什么')) {
            return '我专门帮助创意写作项目。我可以：\n\n• 生成故事创意和情节概念\n• 创建角色简介和发展弧线\n• 用详细的大纲构建您的故事\n• 编写格式正确的剧本\n• 提供反馈和建议\n\n您正在做什么类型的项目？';
        }

        // Default response
        return '我在这里帮助您的创意写作项目。您能告诉我更多关于您想要做什么的信息吗？例如，您可以要求我头脑风暴故事创意、创建大纲或帮助编写剧本。';
    }

    private formatChatHistoryForAgent(chatHistory: ChatMessageDisplay[]): string {
        if (chatHistory.length === 0) return '';

        const formattedHistory = chatHistory
            .filter(msg => msg.role !== 'tool' && msg.display_type !== 'thinking')
            .slice(-5) // Last 5 relevant messages
            .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
            .join('\n');

        return `Recent conversation context:\n${formattedHistory}`;
    }

    private async createDisplayMessageFromAgentResponse(
        projectId: string,
        response: AgentResponse
    ): Promise<ChatMessageDisplay> {
        // Create raw message first
        const rawMessage = await this.chatRepo.createRawMessage(
            projectId,
            response.type === 'tool_call' ? 'tool' : 'assistant',
            response.content,
            {
                toolName: response.toolName,
                toolResult: response.toolResult,
                metadata: response.metadata
            }
        );

        // Create sanitized display message
        let displayContent = response.content;
        let displayType: 'message' | 'tool_summary' | 'thinking' = 'message';

        if (response.type === 'tool_call') {
            displayType = 'tool_summary';
            // Content is already sanitized in the agent response
        } else if (response.type === 'thinking') {
            displayType = 'thinking';
        }

        return this.chatRepo.createDisplayMessage(
            projectId,
            response.type === 'tool_call' ? 'tool' : 'assistant',
            displayContent,
            {
                displayType,
                rawMessageId: rawMessage.id
            }
        );
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