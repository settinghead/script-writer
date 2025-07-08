import React from 'react';
import { AssistantChatSidebar } from './AssistantChatSidebar';
import { ChatProvider } from '../../contexts/ChatContext';

interface ChatSidebarWrapperProps {
    projectId: string;
}

export const ChatSidebarWrapper: React.FC<ChatSidebarWrapperProps> = ({ projectId }) => {
    // Use the assistant-ui interface as the default, wrapped with ChatProvider
    return (
        <ChatProvider projectId={projectId}>
            <AssistantChatSidebar projectId={projectId} />
        </ChatProvider>
    );
}; 