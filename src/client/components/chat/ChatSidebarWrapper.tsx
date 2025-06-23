import React from 'react';
import { ChatProvider } from '../../contexts/ChatContext';
import { ChatSidebar } from './ChatSidebar';

interface ChatSidebarWrapperProps {
    projectId: string;
}

export const ChatSidebarWrapper: React.FC<ChatSidebarWrapperProps> = ({ projectId }) => {
    return (
        <ChatProvider projectId={projectId}>
            <ChatSidebar projectId={projectId} />
        </ChatProvider>
    );
}; 