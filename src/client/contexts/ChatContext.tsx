import React, { createContext, useContext, useMemo } from 'react';
import { useShape } from '@electric-sql/react';
import { useMutation } from '@tanstack/react-query';
import { createElectricConfig } from '../../common/config/electric';
import { ChatMessageDisplay } from '../../common/schemas/chatMessages';

interface ChatContextType {
    messages: ChatMessageDisplay[];
    isLoading: boolean;
    error: any;
    sendMessage: (content: string, metadata?: Record<string, any>) => void;
    isLoadingMessage: boolean;
    messageError: any;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
    projectId: string;
    children: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ projectId, children }) => {
    // Get Electric config
    const electricConfig = useMemo(() => createElectricConfig(), []);

    // Project where clause
    const projectWhereClause = useMemo(() => `project_id = '${projectId}'`, [projectId]);

    // Chat messages subscription
    const chatMessagesConfig = useMemo(() => ({
        ...electricConfig,
        params: {
            table: 'chat_messages_display',
            where: projectWhereClause,
        },
        backoffOptions: {
            initialDelay: 200,
            maxDelay: 5000,
            multiplier: 2.0,
            maxRetries: 3
        }
    }), [electricConfig, projectWhereClause]);

    const { data: chatMessages, isLoading, error } = useShape<ChatMessageDisplay>(chatMessagesConfig);

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
            const response = await fetch(`/api/chat/${projectId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer debug-auth-token-script-writer-dev` // Debug token for development
                },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to send message');
            }

            return response.json();
        },
        onError: (error) => {
            console.error('Failed to send chat message:', error);
        }
    });

    const sendMessage = (content: string, metadata?: Record<string, any>) => {
        sendMessageMutation.mutate({ content, metadata });
    };

    const contextValue: ChatContextType = {
        messages: sortedMessages,
        isLoading,
        error,
        sendMessage,
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