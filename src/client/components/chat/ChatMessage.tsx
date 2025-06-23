import React from 'react';
import { Avatar, Card, Typography, Tag, Space, Spin } from 'antd';
import { UserOutlined, RobotOutlined, ToolOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { ChatMessageDisplay } from '../../../common/schemas/chatMessages';
import { processChatMessage } from '../../utils/chatEventProcessor';

const { Text, Paragraph } = Typography;

interface ChatMessageProps {
    message: ChatMessageDisplay;
    isStreaming?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming = false }) => {
    // Process the message using event-based logic
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
                return <RobotOutlined />;
            case 'tool':
                return <ToolOutlined />;
            default:
                return <UserOutlined />;
        }
    };

    const getAvatarColor = () => {
        switch (message.role) {
            case 'user':
                return '#4f46e5';
            case 'assistant':
                return '#10b981';
            case 'tool':
                return '#f59e0b';
            default:
                return '#666';
        }
    };

    const getDisplayContent = () => {
        return processedMessage.content;
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getStatusTag = () => {
        if (message.status === 'failed') {
            return <Tag color="error" icon={<ExclamationCircleOutlined />}>失败</Tag>;
        }
        if (processedMessage.showSpinner) {
            return <Tag color="processing" icon={<Spin size="small" />}>思考中...</Tag>;
        }
        if (processedMessage.thinkingDuration) {
            return <Tag color="success" icon={<ClockCircleOutlined />}>
                完成于 {Math.round(processedMessage.thinkingDuration / 1000)}秒
            </Tag>;
        }
        return null;
    };

    const isUserMessage = message.role === 'user';

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
                    flexShrink: 0
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
                        {message.role === 'user' ? '你' :
                            message.role === 'assistant' ? 'AI助手' :
                                '系统'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        {formatTimestamp(message.created_at)}
                    </Text>
                    {getStatusTag()}
                </div>

                <Card
                    size="small"
                    style={{
                        background: isUserMessage ? '#4f46e5' :
                            message.display_type === 'tool_summary' ? '#f59e0b20' : '#2a2a2a',
                        border: message.display_type === 'tool_summary' ? '1px solid #f59e0b40' : 'none',
                        borderRadius: 12,
                        maxWidth: '100%',
                        wordBreak: 'break-word'
                    }}
                    bodyStyle={{
                        padding: '12px 16px',
                        color: isUserMessage ? 'white' :
                            message.display_type === 'tool_summary' ? '#f59e0b' : '#e0e0e0'
                    }}
                >
                    <Paragraph
                        style={{
                            margin: 0,
                            color: 'inherit',
                            lineHeight: 1.5,
                            fontStyle: message.display_type === 'tool_summary' ? 'italic' : 'normal',
                            whiteSpace: 'pre-wrap'
                        }}
                    >
                        {getDisplayContent()}
                        {processedMessage.showSpinner && (
                            <Spin size="small" style={{ marginLeft: 8 }} />
                        )}
                    </Paragraph>
                </Card>
            </div>
        </div>
    );
}; 