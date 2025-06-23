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
            // 1. Create raw user message
            const rawUserMessage = await this.chatRepo.createRawMessage(
                projectId,
                'user',
                request.content,
                { metadata: request.metadata }
            );

            // 2. Create display user message
            await this.chatRepo.createDisplayMessage(
                projectId,
                'user',
                request.content,
                { rawMessageId: rawUserMessage.id }
            );

            // 3. Create thinking message to show agent is processing
            const thinkingMessage = await this.chatRepo.createDisplayMessage(
                projectId,
                'assistant',
                'I\'m analyzing your request and determining the best approach...',
                { displayType: 'thinking', status: 'streaming' }
            );

            // 4. Trigger agent processing in background
            this.processAgentResponse(projectId, userId, request.content, thinkingMessage.id)
                .catch(error => {
                    console.error('Agent processing failed:', error);
                    // Update thinking message to show error
                    this.chatRepo.updateDisplayMessage(thinkingMessage.id, {
                        content: 'I encountered an error while processing your request. Please try again.',
                        status: 'failed'
                    });
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
        thinkingMessageId: string
    ): Promise<void> {
        try {
            // Get recent chat history for context
            const recentMessages = await this.getRecentChatHistory(projectId, 10);

            // Determine what kind of request this is and route to appropriate agent
            const agentResponse = await this.routeToAgent(projectId, userId, userMessage, recentMessages);

            // Update thinking message to completed
            await this.chatRepo.updateDisplayMessage(thinkingMessageId, {
                status: 'completed'
            });

            // Create display messages for agent responses
            for (const response of agentResponse) {
                await this.createDisplayMessageFromAgentResponse(projectId, response);
            }

        } catch (error) {
            console.error('Agent processing error:', error);

            // Update thinking message to show error
            await this.chatRepo.updateDisplayMessage(thinkingMessageId, {
                content: 'I encountered an error while processing your request. Please try again.',
                status: 'failed'
            });
        }
    }

    private async routeToAgent(
        projectId: string,
        userId: string,
        userMessage: string,
        chatHistory: ChatMessageDisplay[]
    ): Promise<AgentResponse[]> {
        // Simple routing logic - can be enhanced with more sophisticated intent detection
        const lowerMessage = userMessage.toLowerCase();

        try {
            if (lowerMessage.includes('brainstorm') || lowerMessage.includes('idea') || lowerMessage.includes('story')) {
                // Route to brainstorm agent
                const result = await this.agentService.runBrainstormAgent(projectId, userId, {
                    userRequest: userMessage,
                    platform: 'web',
                    genre: 'general',
                    other_requirements: this.formatChatHistoryForAgent(chatHistory)
                });

                return [{
                    type: 'tool_call',
                    content: 'I\'ve generated some creative story ideas based on your request.',
                    toolName: 'brainstorm',
                    toolResult: result,
                    metadata: { agentType: 'brainstorm' }
                }];

            } else if (lowerMessage.includes('outline') || lowerMessage.includes('structure')) {
                // Route to outline agent (when implemented)
                return [{
                    type: 'message',
                    content: 'I can help you create a story outline. Please provide more details about your story concept, and I\'ll generate a comprehensive outline for you.',
                    metadata: { agentType: 'outline', needsMoreInfo: true }
                }];

            } else if (lowerMessage.includes('script') || lowerMessage.includes('dialogue')) {
                // Route to script agent (when implemented)
                return [{
                    type: 'message',
                    content: 'I can help you write scripts. Please provide the story outline or specific scene details, and I\'ll generate script content for you.',
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
                content: 'I apologize, but I encountered an issue while processing your request. Please try rephrasing your question or try again later.',
                metadata: { agentType: 'error', error: error instanceof Error ? error.message : String(error) }
            }];
        }
    }

    private generateConversationalResponse(userMessage: string, chatHistory: ChatMessageDisplay[]): string {
        const lowerMessage = userMessage.toLowerCase();

        // Simple pattern matching for common queries
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
            return 'Hello! I\'m your AI assistant for script writing. I can help you brainstorm ideas, create outlines, and write scripts. What would you like to work on today?';
        }

        if (lowerMessage.includes('help')) {
            return 'I can assist you with various aspects of script writing:\n\n• **Brainstorming**: Generate creative story ideas and concepts\n• **Outlining**: Create detailed story structures and character arcs\n• **Scripting**: Write dialogue and scene descriptions\n\nJust tell me what you\'d like to work on, and I\'ll help you get started!';
        }

        if (lowerMessage.includes('what can you do')) {
            return 'I\'m specialized in helping with creative writing projects. I can:\n\n• Generate story ideas and plot concepts\n• Create character profiles and development arcs\n• Structure your story with detailed outlines\n• Write scripts with proper formatting\n• Provide feedback and suggestions\n\nWhat type of project are you working on?';
        }

        // Default response
        return 'I\'m here to help with your creative writing project. Could you tell me more about what you\'d like to work on? For example, you could ask me to brainstorm story ideas, create an outline, or help with script writing.';
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