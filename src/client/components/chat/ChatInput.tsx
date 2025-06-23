import React, { useState, useRef, KeyboardEvent } from 'react';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    onSend,
    disabled = false,
    placeholder = "Ask me anything about your creative project..."
}) => {
    const [message, setMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSend = () => {
        const trimmedMessage = message.trim();
        if (trimmedMessage && !disabled) {
            onSend(trimmedMessage);
            setMessage('');
            resetTextareaHeight();
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const resetTextareaHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const adjustTextareaHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            const maxHeight = 120; // Maximum height in pixels
            textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        adjustTextareaHeight();
    };

    const getSuggestions = () => [
        "Help me brainstorm story ideas",
        "Create an outline for my script",
        "Write dialogue for this scene",
        "What can you help me with?",
        "Generate character ideas"
    ];

    const handleSuggestionClick = (suggestion: string) => {
        if (!disabled) {
            onSend(suggestion);
        }
    };

    return (
        <div className="chat-input-container">
            {/* Quick suggestions (shown when input is empty) */}
            {message.length === 0 && (
                <div className="chat-suggestions-quick">
                    {getSuggestions().slice(0, 3).map((suggestion, index) => (
                        <button
                            key={index}
                            className="suggestion-chip"
                            onClick={() => handleSuggestionClick(suggestion)}
                            disabled={disabled}
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}

            <div className="chat-input-wrapper">
                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={disabled ? "AI is thinking..." : placeholder}
                    disabled={disabled}
                    className="chat-input-textarea"
                    rows={1}
                    maxLength={5000}
                />

                <button
                    onClick={handleSend}
                    disabled={disabled || !message.trim()}
                    className="chat-send-button"
                    title="Send message (Enter)"
                >
                    {disabled ? (
                        <div className="send-button-loading">
                            <div className="spinner"></div>
                        </div>
                    ) : (
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M22 2L11 13" />
                            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Character count */}
            {message.length > 4000 && (
                <div className="chat-input-counter">
                    {message.length}/5000 characters
                </div>
            )}

            {/* Hint text */}
            <div className="chat-input-hint">
                Press Enter to send, Shift+Enter for new line
            </div>
        </div>
    );
}; 