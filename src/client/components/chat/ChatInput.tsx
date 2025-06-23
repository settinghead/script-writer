import React, { useState, useRef, KeyboardEvent } from 'react';
import { Input, Button, Space, Tag, Typography } from 'antd';
import { SendOutlined, LoadingOutlined } from '@ant-design/icons';

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
        "帮我头脑风暴故事创意",
        "为我的剧本创建大纲",
        "为这个场景写对白",
        "你能帮我做什么？",
        "生成角色创意"
    ];

    const handleSuggestionClick = (suggestion: string) => {
        if (!disabled) {
            onSend(suggestion);
        }
    };

    return (
        <div style={{ padding: 0 }}>
            {/* Quick suggestions (shown when input is empty) */}
            {message.length === 0 && (
                <div style={{ marginBottom: 12 }}>
                    <Space wrap size="small">
                        {getSuggestions().slice(0, 3).map((suggestion, index) => (
                            <Tag
                                key={index}
                                color="blue"
                                style={{
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                    opacity: disabled ? 0.5 : 1,
                                    fontSize: 11,
                                    padding: '2px 8px'
                                }}
                                onClick={() => handleSuggestionClick(suggestion)}
                            >
                                {suggestion}
                            </Tag>
                        ))}
                    </Space>
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <TextArea
                    value={message}
                    onChange={(e) => handleInputChange(e as any)}
                    onKeyDown={handleKeyDown}
                    placeholder={disabled ? "AI正在思考..." : placeholder}
                    disabled={disabled}
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    maxLength={5000}
                    style={{
                        background: '#2a2a2a',
                        borderColor: '#444',
                        color: '#e0e0e0',
                        resize: 'none'
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