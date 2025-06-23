import React, { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Input, Button, Space, Tag, Typography } from 'antd';
import { SendOutlined, LoadingOutlined } from '@ant-design/icons';
import { useTypewriter } from '../../hooks/useTypewriter';

const { TextArea } = Input;
const { Text } = Typography;

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    onSend,
    disabled = false,
    placeholder = "向我询问任何关于你的创作项目的问题..."
}) => {
    const [message, setMessage] = useState('');
    const [isHidingSuggestions, setIsHidingSuggestions] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { displayText, isTyping, startTyping } = useTypewriter({
        speed: 30, // 30ms per character for smooth but fast typing
        onComplete: () => {
            // Auto-resize textarea when typing is complete
            adjustTextareaHeight();
        }
    });

    // Sync the typewriter display text with the message state
    useEffect(() => {
        if (isTyping) {
            setMessage(displayText);
        }
    }, [displayText, isTyping]);

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
        // Only allow manual input if not currently typing
        if (!isTyping) {
            setMessage(e.target.value);
            adjustTextareaHeight();
            // Reset animation state if user manually types
            if (isHidingSuggestions) {
                setIsHidingSuggestions(false);
            }
        }
    };

    const getSuggestions = () => [
        "都不满意，再生成几个",
        "太老套，创新一点",
        "每个再长一点",
    ];

    const handleSuggestionClick = (suggestion: string) => {
        if (!disabled) {
            // Start the hide animation
            setIsHidingSuggestions(true);

            // Start typewriter effect after animation begins
            setTimeout(() => {
                startTyping(suggestion);
            }, 100);
        }
    };

    return (
        <div style={{ padding: 0 }}>
            {/* Quick suggestions (shown when input is empty) */}
            {message.length === 0 && (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: 8,
                        width: '100%',
                        opacity: isHidingSuggestions ? 0 : 1,
                        maxHeight: isHidingSuggestions ? 0 : '60px',
                        overflow: 'hidden',
                        transition: 'opacity 0.3s ease-out, max-height 0.4s ease-out, margin-bottom 0.4s ease-out',
                        marginBottom: isHidingSuggestions ? 0 : 12
                    }}
                >
                    {getSuggestions().slice(0, 3).map((suggestion, index) => (
                        <Tag
                            key={index}
                            style={{
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                opacity: disabled ? 0.5 : 1,
                                fontSize: 14,
                                fontWeight: 500,
                                padding: '10px 12px',
                                textAlign: 'center',
                                margin: 0,
                                whiteSpace: 'normal',
                                wordWrap: 'break-word',
                                lineHeight: '1.3',
                                minHeight: '44px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#1e3a8a',
                                color: '#93c5fd',
                                border: '1px solid #3b82f6',
                                borderRadius: '6px',
                                transition: 'all 0.2s ease-in-out'
                            }}
                            onMouseEnter={(e) => {
                                if (!disabled && !isHidingSuggestions) {
                                    e.currentTarget.style.background = '#1e40af';
                                    e.currentTarget.style.color = '#bfdbfe';
                                    e.currentTarget.style.borderColor = '#60a5fa';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!disabled && !isHidingSuggestions) {
                                    e.currentTarget.style.background = '#1e3a8a';
                                    e.currentTarget.style.color = '#93c5fd';
                                    e.currentTarget.style.borderColor = '#3b82f6';
                                    e.currentTarget.style.transform = 'translateY(0px)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }
                            }}
                            onClick={() => handleSuggestionClick(suggestion)}
                        >
                            {suggestion}
                        </Tag>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <TextArea
                    value={message}
                    onChange={(e) => handleInputChange(e as any)}
                    onKeyDown={handleKeyDown}
                    placeholder={disabled ? "AI正在思考..." : placeholder}
                    disabled={disabled || isTyping}
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    maxLength={5000}
                    style={{
                        background: '#2a2a2a',
                        borderColor: '#444',
                        color: '#e0e0e0',
                        resize: 'none',
                        cursor: isTyping ? 'default' : 'text'
                    }}
                    showCount={message.length > 4000}
                />

                <Button
                    type="primary"
                    icon={disabled ? <LoadingOutlined /> : <SendOutlined />}
                    onClick={handleSend}
                    disabled={disabled || !message.trim()}
                    title="发送消息 (回车键)"
                    style={{
                        background: disabled || !message.trim() ? '#374151' : '#4f46e5',
                        borderColor: disabled || !message.trim() ? '#374151' : '#4f46e5',
                        height: 'auto',
                        minHeight: 32
                    }}
                />
            </div>

            {/* Hint text */}
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8, textAlign: 'center' }}>
                按回车键发送，Shift+回车键换行
            </Text>
        </div>
    );
}; 