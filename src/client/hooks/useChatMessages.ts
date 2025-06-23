import { useChatContext } from '../contexts/ChatContext';

export const useChatMessages = (projectId: string) => {
    const chatContext = useChatContext();

    return {
        messages: chatContext.messages,
        sendMessage: chatContext.sendMessage,
        isLoading: chatContext.isLoadingMessage,
        error: chatContext.messageError
    };
}; 