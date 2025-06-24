import React, { useEffect, useRef } from 'react';
import { List, Empty, Spin, Typography, Tag } from 'antd';
import { RobotOutlined, MessageOutlined, EditOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { ChatMessage } from './ChatMessage';
import { ChatMessageDisplay } from '../../../common/schemas/chatMessages';

const { Title, Paragraph } = Typography;

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
            style={{
                height: '100%',
                padding: '16px',
                overflow: 'auto',
                background: '#1a1a1a'
            }}
        >
            {messages.length === 0 && !isLoading ? (
                <Empty
                    image={<MessageOutlined style={{ fontSize: 64, color: '#666' }} />}
                    styles={{ image: { height: 80 } }}
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
                    <RobotOutlined style={{ fontSize: 20, color: '#10b981' }} />
                    <Spin size="small" />
                    <span style={{ color: '#888' }}>AI正在思考...</span>
                </div>
            )}

            {/* Invisible element to scroll to */}
            <div ref={messagesEndRef} />
        </div>
    );
}; 