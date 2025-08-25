import React, { useState, useEffect, useRef } from 'react';
import { List, Empty, Spin, Typography, Tag, Avatar, Card, Tooltip } from 'antd';
import { UserOutlined, MessageOutlined, EditOutlined, PlayCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
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

// Custom Scrollbar Component
const CustomScrollbar: React.FC<{
    containerRef: React.RefObject<HTMLDivElement | null>;
    onScroll?: () => void;
}> = ({ containerRef, onScroll }) => {
    const [scrollThumb, setScrollThumb] = useState({ height: 0, top: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ y: 0, scrollTop: 0 });
    const thumbRef = useRef<HTMLDivElement>(null);

    const updateScrollThumb = () => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        const scrollTop = container.scrollTop;

        // Calculate available track height (excluding header and input areas)
        const trackHeight = clientHeight - 224; // 64px header + 160px input

        if (scrollHeight <= clientHeight || trackHeight <= 0) {
            setScrollThumb({ height: 0, top: 0 });
            return;
        }

        const thumbHeight = Math.max(20, (clientHeight / scrollHeight) * trackHeight);
        const maxThumbTop = trackHeight - thumbHeight;
        const thumbTop = Math.min(maxThumbTop, (scrollTop / (scrollHeight - clientHeight)) * maxThumbTop);

        setScrollThumb({ height: thumbHeight, top: Math.max(0, thumbTop) });
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let scrollTimeout: NodeJS.Timeout;
        const handleScroll = () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                updateScrollThumb();
                onScroll?.();
            }, 16); // ~60fps
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        updateScrollThumb();

        // Update on resize
        const resizeObserver = new ResizeObserver(() => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(updateScrollThumb, 16);
        });
        resizeObserver.observe(container);

        return () => {
            clearTimeout(scrollTimeout);
            container.removeEventListener('scroll', handleScroll);
            resizeObserver.disconnect();
        };
    }, [containerRef, onScroll]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!containerRef.current) return;

        setIsDragging(true);
        setDragStart({
            y: e.clientY,
            scrollTop: containerRef.current.scrollTop
        });

        e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging || !containerRef.current) return;

        const container = containerRef.current;
        const trackHeight = container.clientHeight - 224;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;

        const deltaY = e.clientY - dragStart.y;
        const scrollRatio = deltaY / (trackHeight - scrollThumb.height);
        const newScrollTop = dragStart.scrollTop + scrollRatio * (scrollHeight - clientHeight);

        container.scrollTop = Math.max(0, Math.min(newScrollTop, scrollHeight - clientHeight));
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragStart, scrollThumb]);

    const handleTrackClick = (e: React.MouseEvent) => {
        if (!containerRef.current || !thumbRef.current) return;

        const container = containerRef.current;
        const trackHeight = container.clientHeight - 224;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;

        const rect = e.currentTarget.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const scrollRatio = clickY / trackHeight;
        const newScrollTop = scrollRatio * (scrollHeight - clientHeight);

        container.scrollTop = Math.max(0, Math.min(newScrollTop, scrollHeight - clientHeight));
    };

    if (scrollThumb.height === 0) return null;

    return (
        <div className="custom-scrollbar-track" onClick={handleTrackClick}>
            <div
                ref={thumbRef}
                className="custom-scrollbar-thumb"
                style={{
                    height: `${scrollThumb.height}px`,
                    top: `${scrollThumb.top}px`,
                }}
                onMouseDown={handleMouseDown}
            />
        </div>
    );
};

// ChatMessage component similar to original but inline
const ChatMessage: React.FC<{
    message: any;
    isStreaming?: boolean;
    onUserMessageClick?: (content: string) => void;
}> = ({ message, isStreaming = false, onUserMessageClick }) => {
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
                    <div style={{ fontSize: '12px', color: AppColors.text.secondary, maxWidth: '300px', lineHeight: 1.4, display: "flex", flexWrap: "wrap" }}>
                        <div style={{ marginBottom: '4px' }}>{processedMessage.content}</div>
                        <Spin size="small" style={{ display: 'inline-block' }} />
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
        const isThinkingMessage = message.display_type === 'thinking';

        // Glass effect classes will handle most styling
        let glassClass = '';
        if (isThinkingMessage) {
            glassClass = 'chat-message-glass-thinking';
        } else if (isUserMessage) {
            glassClass = 'chat-message-glass-user';
        } else if (isAssistantMessage) {
            glassClass = 'chat-message-glass-assistant';
        }

        return {
            maxWidth: '100%',
            wordBreak: 'break-word' as const,
            className: glassClass
        };
    };

    const getMessageClassName = () => {
        const isUserMessage = message.role === 'user';
        const isAssistantMessage = message.role === 'assistant';
        const isThinkingMessage = message.display_type === 'thinking';

        if (isThinkingMessage) {
            return 'chat-message-glass-thinking';
        } else if (isUserMessage) {
            return 'chat-message-glass-user';
        } else if (isAssistantMessage) {
            return 'chat-message-glass-assistant';
        }
        return '';
    };

    const isUserMessage = message.role === 'user';
    const isThinkingMessage = message.display_type === 'thinking';

    const handleMessageClick = () => {
        if (isUserMessage && onUserMessageClick && !isThinkingMessage) {
            onUserMessageClick(processedMessage.content);
        }
    };

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
                    flexWrap: 'wrap',
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
                    <Tooltip
                        title={isUserMessage ? "点击重复此消息到输入框" : undefined}
                        placement="top"
                        mouseEnterDelay={0.5}
                    >
                        <Card
                            size="small"
                            className={getMessageClassName()}
                            style={{
                                maxWidth: '100%',
                                wordBreak: 'break-word' as const,
                                cursor: isUserMessage ? 'pointer' : 'default',
                                transition: 'all 0.2s ease-in-out'
                            }}
                            styles={{
                                body: {
                                    padding: '12px 14px',
                                    color: isUserMessage ? AppColors.text.primary : (message.role === 'assistant' ? AppColors.text.white : AppColors.text.primary),
                                    position: 'relative',
                                    zIndex: 1
                                }
                            }}
                            onClick={handleMessageClick}
                            onMouseEnter={(e) => {
                                if (isUserMessage) {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(80, 70, 229, 0.3)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (isUserMessage) {
                                    e.currentTarget.style.transform = 'translateY(0px)';
                                    e.currentTarget.style.boxShadow = '';
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
                                    <Spin size="small" style={{ marginLeft: 8, display: 'inline-block' }} />
                                )}
                            </Paragraph>
                        </Card>
                    </Tooltip>
                )}
            </div>
        </div>
    );
};

export const BasicThread: React.FC<BasicThreadProps> = ({ projectId }) => {
    const { messages, sendMessage, isLoading } = useChatMessages(projectId);
    const runtime = useProjectChatRuntime(projectId);

    // Input state management
    const [inputValue, setInputValue] = useState('');

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
        setInputValue(''); // Clear input after sending
    };

    const handleUserMessageClick = (content: string) => {
        setInputValue(content);
    };

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'transparent',
            position: 'relative'
        }}>
            {/* Messages Area with Custom Scrollbar */}
            <div className="chat-messages-container">
                <div
                    ref={containerRef}
                    className="chat-messages-scrollable"
                >
                    <CustomScrollbar
                        containerRef={containerRef}
                        onScroll={handleScroll}
                    />
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
                                        onUserMessageClick={handleUserMessageClick}
                                    />
                                </List.Item>
                            )}
                        />
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Fixed Input Area */}
            <div
                className="chat-input-glass"
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '5px 16px',
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(10px)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    zIndex: 10
                }}
            >
                <ChatInput
                    onSend={handleSendMessage}
                    disabled={isLoading}
                    projectId={projectId}
                    value={inputValue}
                    onValueChange={setInputValue}
                />
            </div>
        </div>
    );
}; 