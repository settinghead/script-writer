import React, { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatMessageDisplay } from '../../../common/schemas/chatMessages';

interface ChatMessageListProps {
    messages: ChatMessageDisplay[];
    isLoading?: boolean;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
    messages,
    isLoading = false
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'end'
            });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Check if user is near bottom to decide whether to auto-scroll
    const isNearBottom = () => {
        if (!containerRef.current) return true;

        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const threshold = 100; // pixels from bottom

        return scrollHeight - scrollTop - clientHeight < threshold;
    };

    // Only auto-scroll if user is near bottom (prevents interrupting reading)
    useEffect(() => {
        if (isNearBottom()) {
            scrollToBottom();
        }
    }, [messages]);

    const getStreamingMessage = () => {
        return messages.find(msg => msg.status === 'streaming');
    };

    return (
        <div
            ref={containerRef}
            className="chat-messages-container"
        >
            {messages.length === 0 && !isLoading ? (
                <div className="chat-empty-state">
                    <div className="chat-empty-icon">💬</div>
                    <h3>Start a conversation</h3>
                    <p>Ask me anything about your creative writing project!</p>
                    <div className="chat-suggestions">
                        <div className="suggestion-item">💡 "Help me brainstorm story ideas"</div>
                        <div className="suggestion-item">📝 "Create an outline for my script"</div>
                        <div className="suggestion-item">🎭 "Write dialogue for this scene"</div>
                    </div>
                </div>
            ) : (
                <div className="chat-messages-list">
                    {messages.map((message) => (
                        <ChatMessage
                            key={message.id}
                            message={message}
                            isStreaming={message.status === 'streaming'}
                        />
                    ))}

                    {isLoading && (
                        <div className="chat-loading-message">
                            <div className="chat-message chat-message-assistant">
                                <div className="chat-message-header">
                                    <span className="chat-message-icon">🤖</span>
                                    <span className="chat-message-role">AI Assistant</span>
                                </div>
                                <div className="chat-message-content">
                                    <div className="thinking-dots">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Invisible element to scroll to */}
            <div ref={messagesEndRef} />
        </div>
    );
}; 