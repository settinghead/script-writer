import React, { useState, useEffect, useRef } from 'react';
import { List, Empty, Spin, Typography, Tag, Avatar, Card, Space } from 'antd';
import { UserOutlined, MessageOutlined, EditOutlined, PlayCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, SendOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { Cpu } from 'iconoir-react';
import { useChatMessages } from '../../hooks/useChatMessages';
import { useProjectChatRuntime } from '../../hooks/useProjectChatRuntime';
import { ChatInput } from './ChatInput';
import { processChatMessage } from '../../utils/chatEventProcessor';
import { AppColors } from '../../../common/theme/colors';

const { Title, Paragraph, Text } = Typography;

interface BasicThreadProps {
    projectId: string;
}

// ChatMessage component similar to original but inline
const ChatMessage: React.FC<{ message: any; isStreaming?: boolean }> = ({ message, isStreaming = false }) => {
    const processedMessage = processChatMessage(
        message.id,
        message.role,
        message.content,
        message.created_at
    );

    const getAvatarIcon = () => {
        switch (message.role) {
            case 'user':
                return <UserOutlined />;
            case 'assistant':
                return <Cpu />;
            default:
                return <UserOutlined />;
        }
    };

    const getAvatarColor = () => {
        switch (message.role) {
            case 'user':
                return AppColors.human.avatar;
            case 'assistant':
                return AppColors.ai.avatar;
            default:
                return AppColors.text.muted;
        }
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getStatusTag = () => {
        if (message.status === 'failed') {
            return <Tag color="error" icon={<ExclamationCircleOutlined />}>失败</Tag>;
        }

        // Handle computation/thinking messages - show content inline with loading indicator
        if (message.display_type === 'thinking') {
            if (message.status === 'streaming') {
                return (
                    <div style={{ fontSize: '12px', color: AppColors.text.secondary, maxWidth: '300px', lineHeight: 1.4 }}>
                        <div style={{ marginBottom: '4px' }}>{processedMessage.content}</div>
                        <Spin size="small" />
                    </div>
                );
            }
            if (message.status === 'completed') {
                return <Tag color="success">完成</Tag>;
            }
        }

        // Handle regular response messages
        if (message.status === 'streaming' || processedMessage.showSpinner || isStreaming) {
            return <Tag color="processing" icon={<Spin size="small" />}>回复中...</Tag>;
        }

        return null;
    };

    const getMessageStyle = () => {
        const isUserMessage = message.role === 'user';
        const isAssistantMessage = message.role === 'assistant';

        let backgroundColor;
        let backgroundImage;

        if (isUserMessage) {
            // Human messages use regular dark background
            backgroundColor = AppColors.human.background;
        } else if (isAssistantMessage) {
            // Bot messages use darker purple gradient background
            backgroundColor = AppColors.ai.primary;
            backgroundImage = AppColors.ai.gradient;
        } else {
            backgroundColor = AppColors.human.background;
        }

        // Different styling for computation/thinking messages
        if (message.display_type === 'thinking') {
            if (isAssistantMessage) {
                // Thinking messages for bot use an even darker purple gradient
                backgroundColor = AppColors.ai.tertiary;
                backgroundImage = AppColors.ai.gradientDark;
            } else {
                backgroundColor = '#1f2937'; // Darker background for computation messages
            }
        }

        return {
            background: backgroundColor,
            backgroundImage: backgroundImage,
            border: 'none',
            borderRadius: 10,
            maxWidth: '100%',
            wordBreak: 'break-word' as const,
            boxShadow: isAssistantMessage ? `0 4px 12px ${AppColors.ai.shadow}` : 'none'
        };
    };

    const isUserMessage = message.role === 'user';
    const isThinkingMessage = message.display_type === 'thinking';

    return (
        <div style={{
            display: 'flex',
            gap: 12,
            marginBottom: 16,
            flexDirection: isUserMessage ? 'row-reverse' : 'row',
            width: '100%'
        }}>
            <Avatar
                icon={getAvatarIcon()}
                style={{
                    backgroundColor: getAvatarColor(),
                    flexShrink: 0,
                    // Slightly different styling for thinking messages
                    opacity: isThinkingMessage ? 0.8 : 1
                }}
                size="default"
            />

            <div style={{
                flex: 1,
                minWidth: 0,
                maxWidth: '80%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUserMessage ? 'flex-end' : 'flex-start'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                    flexDirection: isUserMessage ? 'row-reverse' : 'row'
                }}>
                    <Text strong style={{ color: '#e0e0e0', fontSize: 12 }}>
                        {message.role === 'user' ? '你' : '觅光'}
                        {isThinkingMessage && ' ⚙️'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        {formatTimestamp(message.created_at)}
                    </Text>
                    {getStatusTag()}
                </div>

                {/* Only show message bubble for non-thinking messages */}
                {!isThinkingMessage && (
                    <Card
                        size="small"
                        style={getMessageStyle()}
                        styles={{
                            body: {
                                padding: '10px 10px',
                                color: isUserMessage ? AppColors.text.primary : (message.role === 'assistant' ? AppColors.text.white : AppColors.text.primary),
                                // Slightly different opacity for thinking messages
                                opacity: isThinkingMessage ? 0.9 : 1
                            }
                        }}
                    >
                        <Paragraph
                            style={{
                                margin: 0,
                                color: 'inherit',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                                fontSize: isThinkingMessage ? '13px' : '14px'
                            }}
                        >
                            {processedMessage.content}
                            {(message.status === 'streaming' || processedMessage.showSpinner || isStreaming) && (
                                <Spin size="small" style={{ marginLeft: 8 }} />
                            )}
                        </Paragraph>
                    </Card>
                )}
            </div>
        </div>
    );
};

export const BasicThread: React.FC<BasicThreadProps> = ({ projectId }) => {
    const { messages, sendMessage, isLoading } = useChatMessages(projectId);
    const runtime = useProjectChatRuntime(projectId);

    // Auto-scroll functionality
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [isInitialMount, setIsInitialMount] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        if (containerRef.current) {
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior: isInitialMount ? 'auto' : 'smooth' // Instant scroll on initial mount
            });
        }
    };

    // Check if user is near bottom
    const isNearBottom = () => {
        if (!containerRef.current) return false;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const threshold = 100;
        return scrollHeight - scrollTop - clientHeight < threshold;
    };

    // Handle initial mount - always scroll to bottom immediately
    useEffect(() => {
        if (isInitialMount) {
            scrollToBottom();
            // Mark as no longer initial mount after first render
            const timer = setTimeout(() => setIsInitialMount(false), 500);
            return () => clearTimeout(timer);
        }
    }, [isInitialMount]);

    // Auto-scroll when new messages arrive or during loading
    useEffect(() => {
        // Always scroll during initial mount or loading, otherwise only if user is near bottom
        if (isInitialMount || isLoading || isNearBottom()) {
            scrollToBottom();
        }
    }, [messages.length, isLoading, isInitialMount]);

    // Track scroll position
    const handleScroll = () => {
        setIsAtBottom(isNearBottom());
    };

    const handleSendMessage = (content: string) => {
        sendMessage(content);
    };

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'transparent',
            position: 'relative'
        }}>
            {/* Messages Area */}
            <div
                ref={containerRef}
                onScroll={handleScroll}
                style={{
                    flex: 1,
                    padding: '16px',
                    overflow: 'auto',
                    background: 'transparent'
                }}
            >
                {messages.length === 0 && !isLoading ? (
                    <Empty
                        image={<MessageOutlined style={{ fontSize: 64, color: '#666' }} />}
                        style={{ marginTop: '40px' }}
                        description={
                            <div style={{ textAlign: 'center' }}>
                                <Title level={4} style={{ color: '#ccc', marginBottom: 8 }}>
                                    开始对话
                                </Title>
                                <Paragraph style={{ color: '#888', marginBottom: 24 }}>
                                    向我询问任何关于你的创作项目的问题！
                                </Paragraph>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                                    <Tag icon={<EditOutlined />} color="blue" style={{ fontSize: 12 }}>
                                        "帮我头脑风暴故事创意"
                                    </Tag>
                                    <Tag icon={<PlayCircleOutlined />} color="green" style={{ fontSize: 12 }}>
                                        "为我的剧本创建大纲"
                                    </Tag>
                                    <Tag icon={<MessageOutlined />} color="purple" style={{ fontSize: 12 }}>
                                        "为这个场景写对白"
                                    </Tag>
                                </div>
                            </div>
                        }
                    />
                ) : (
                    <List
                        dataSource={messages}
                        renderItem={(message) => (
                            <List.Item style={{ border: 'none', padding: '8px 0' }}>
                                <ChatMessage
                                    key={message.id}
                                    message={message}
                                    isStreaming={message.status === 'streaming'}
                                />
                            </List.Item>
                        )}
                        style={{ background: 'transparent' }}
                    />
                )}

                {isLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0' }}>
                        <Cpu style={{ fontSize: 20, color: AppColors.ai.primary }} />
                        <Spin size="small" />
                        <span style={{ color: '#888' }}>AI正在思考...</span>
                    </div>
                )}

                {/* Invisible element to scroll to */}
                <div ref={messagesEndRef} />
            </div>

            {/* Scroll to Bottom Button */}
            {!isAtBottom && (
                <div style={{
                    position: 'absolute',
                    bottom: '80px',
                    right: '16px',
                    zIndex: 10
                }}>
                    <button
                        onClick={scrollToBottom}
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: '#1890ff',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <ArrowDownOutlined />
                    </button>
                </div>
            )}

            {/* Input Area */}
            <div style={{
                background: 'rgba(30, 30, 30, 0.9)',
                backdropFilter: 'blur(10px)',
                borderTop: '1px solid #333',
                padding: '16px'
            }}>
                <ChatInput onSend={handleSendMessage} disabled={isLoading} />

            </div>
        </div>
    );
}; 