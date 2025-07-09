import { useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { useChatContext } from '../contexts/ChatContext';
import { apiService } from '../services/apiService';

export const useChatMessages = (projectId: string) => {
    const chatContext = useChatContext();

    return {
        messages: chatContext.messages,
        sendMessage: chatContext.sendMessage,
        isLoading: chatContext.isLoadingMessage,
        error: chatContext.messageError
    };
};

export const useClearChat = (projectId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => apiService.clearChat(projectId),
        onSuccess: () => {
            // Invalidate chat-related queries to trigger a refresh
            queryClient.invalidateQueries({ queryKey: ['chat', projectId] });
            message.success('对话已清空');
        },
        onError: (error: Error) => {
            console.error('Failed to clear chat:', error);
            message.error('清空对话失败: ' + error.message);
        }
    });
}; 