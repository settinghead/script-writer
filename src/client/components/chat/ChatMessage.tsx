import React from 'react';
import { ChatMessageDisplay } from '../../../common/schemas/chatMessages';

interface ChatMessageProps {
    message: ChatMessageDisplay;
    isStreaming?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming = false }) => {
    const getMessageClass = () => {
        const baseClass = 'chat-message';
        const roleClass = `chat-message-${message.role}`;
        const statusClass = isStreaming ? 'streaming' : '';
        const typeClass = message.display_type !== 'message' ? `type-${message.display_type}` : '';

        return [baseClass, roleClass, statusClass, typeClass].filter(Boolean).join(' ');
    };

    const getMessageIcon = () => {
        switch (message.role) {
            case 'user':
                return '👤';
            case 'assistant':
                return '🤖';
            case 'tool':
                return '🔧';
            default:
                return '';
        }
    };

    const getDisplayContent = () => {
        // Handle different display types
        if (message.display_type === 'thinking' && isStreaming) {
            return `${message.content}${isStreaming ? ' ⏳' : ''}`;
        }

        if (message.display_type === 'tool_summary') {
            return `${message.content} ✨`;
        }

        return message.content;
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className={getMessageClass()}>
            <div className="chat-message-header">
                <span className="chat-message-icon">{getMessageIcon()}</span>
                <span className="chat-message-role">
                    {message.role === 'user' ? 'You' :
                        message.role === 'assistant' ? 'AI Assistant' :
                            'System'}
                </span>
                <span className="chat-message-timestamp">
                    {formatTimestamp(message.created_at)}
                </span>
            </div>

            <div className="chat-message-content">
                {getDisplayContent()}
            </div>

            {message.status === 'failed' && (
                <div className="chat-message-error">
                    ⚠️ This message failed to process
                </div>
            )}

            {message.display_type === 'thinking' && message.status === 'streaming' && (
                <div className="chat-message-thinking-indicator">
                    <div className="thinking-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            )}
        </div>
    );
}; 