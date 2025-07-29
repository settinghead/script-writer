import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useShape } from '@electric-sql/react';
import { useMutation } from '@tanstack/react-query';
import { createElectricConfig } from '../../common/config/electric';
import { apiService } from '../services/apiService';

interface ChatMessageDisplay {
    id: string;
    conversation_id: string;
    raw_message_id: string;
    role: 'user' | 'assistant';
    content: string;
    display_type: 'message' | 'thinking' | 'progress';
    created_at: string;
    updated_at: string;
}

interface ChatContextType {
    currentConversationId: string | null;
    messages: ChatMessageDisplay[];
    isLoading: boolean;
    error: any;
    sendMessage: (content: string, metadata?: Record<string, any>) => void;
    createNewConversation: () => Promise<string>;
    setCurrentConversation: (conversationId: string) => void;
    isLoadingMessage: boolean;
    messageError: any;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
    projectId: string;
    children: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ projectId, children }) => {
    // Current conversation state
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [loadingConversation, setLoadingConversation] = useState(true);

    // Get Electric config
    const electricConfig = useMemo(() => createElectricConfig(), []);

    // Display messages subscription - only subscribe when we have a conversation ID
    const chatMessagesConfig = useMemo(() => {
        if (!currentConversationId) {
            return null; // Don't subscribe if no conversation ID
        }

        return {
            ...electricConfig,
            params: {
                table: 'conversation_messages_display',
                where: `conversation_id = '${currentConversationId}'`,
            },
            backoffOptions: {
                initialDelay: 200,
                maxDelay: 5000,
                multiplier: 2.0,
                maxRetries: 3
            }
        };
    }, [electricConfig, currentConversationId]);

    const { data: chatMessages, isLoading: messagesLoading, error } = useShape<ChatMessageDisplay>(
        chatMessagesConfig || {
            ...electricConfig,
            params: {
                table: 'conversation_messages_display',
                where: 'FALSE' // No results when no conversation ID
            }
        }
    );

    // Load current conversation on mount
    useEffect(() => {
        const loadCurrentConversation = async () => {
            try {
                setLoadingConversation(true);
                const { conversationId } = await apiService.getCurrentConversation(projectId);

                setCurrentConversationId(conversationId);
            } catch (error) {
                console.error('Failed to load current conversation:', error);
            } finally {
                setLoadingConversation(false);
            }
        };

        loadCurrentConversation();
    }, [projectId]);

    // Sort messages by creation time
    const sortedMessages = useMemo(() => {
        if (!chatMessages) return [];
        return [...chatMessages].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
    }, [chatMessages]);

    // Send message mutation
    const sendMessageMutation = useMutation({
        mutationFn: async (request: { content: string; metadata?: Record<string, any> }) => {
            // Get or create conversation if needed
            let conversationId = currentConversationId;
            if (!conversationId) {
                const { conversationId: newConversationId } = await apiService.createNewConversation(projectId);
                conversationId = newConversationId;
                setCurrentConversationId(conversationId);
            }

            return apiService.sendChatMessage(projectId, conversationId, request.content, request.metadata);
        },
        onError: (error) => {
            console.error('Failed to send chat message:', error);
        }
    });

    const sendMessage = (content: string, metadata?: Record<string, any>) => {
        sendMessageMutation.mutate({ content, metadata });
    };

    const createNewConversation = async (): Promise<string> => {
        const { conversationId } = await apiService.createNewConversation(projectId);
        setCurrentConversationId(conversationId);
        return conversationId;
    };

    const setCurrentConversation = async (conversationId: string) => {
        await apiService.setCurrentConversation(projectId, conversationId);
        setCurrentConversationId(conversationId);
    };

    const contextValue: ChatContextType = {
        currentConversationId,
        messages: sortedMessages,
        isLoading: loadingConversation || messagesLoading,
        error,
        sendMessage,
        createNewConversation,
        setCurrentConversation,
        isLoadingMessage: sendMessageMutation.isPending,
        messageError: sendMessageMutation.error
    };

    return (
        <ChatContext.Provider value={contextValue}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChatContext = (): ChatContextType => {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChatContext must be used within a ChatProvider');
    }
    return context;
};

export default ChatContext; 