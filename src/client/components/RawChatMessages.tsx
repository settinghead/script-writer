import React, { useMemo } from 'react';
import { Card, Typography, Space, Tag, Divider, Empty } from 'antd';
import { useShape } from '@electric-sql/react';
import { createElectricConfig } from '../../common/config/electric';
import type { ElectricRawChatMessage } from '../../common/types';

const { Text, Paragraph } = Typography;

interface RawChatMessagesProps {
    projectId: string;
}

const RawChatMessages: React.FC<RawChatMessagesProps> = ({ projectId }) => {
    // Electric SQL subscription for raw chat messages
    const electricConfig = useMemo(() => createElectricConfig(), []);

    const rawChatMessagesConfig = useMemo(() => ({
        ...electricConfig,
        params: {
            table: 'chat_messages_raw',
            where: `project_id = '${projectId}'`,
        },
        backoffOptions: {
            initialDelay: 200,
            maxDelay: 5000,
            multiplier: 2.0,
            maxRetries: 3
        }
    }), [electricConfig, projectId]);

    const { data: rawChatMessages, isLoading } = useShape<ElectricRawChatMessage>(rawChatMessagesConfig);

    // Safe JSON parsing function
    const safeJsonParse = (value: any) => {
        if (!value) return null;
        if (typeof value === 'object') return value; // Already parsed
        if (typeof value !== 'string') return value; // Not a string, return as-is

        try {
            return JSON.parse(value);
        } catch (error) {
            console.warn('Failed to parse JSON:', value, error);
            return value; // Return original value if parsing fails
        }
    };

    // Get raw chat messages from Electric SQL and parse JSON fields
    // Sort in reverse chronological order (newest first)
    const rawMessages = useMemo(() => {
        if (!rawChatMessages) return [];

        return rawChatMessages.map(msg => ({
            ...msg,
            metadata: safeJsonParse(msg.metadata),
            tool_parameters: safeJsonParse(msg.tool_parameters),
            tool_result: safeJsonParse(msg.tool_result),
        })).sort((a, b) => {
            // Sort by created_at in descending order (newest first)
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA;
        });
    }, [rawChatMessages]);

    const formatTimestamp = (timestamp: string) => {
        return new Date(timestamp).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'user': return 'blue';
            case 'assistant': return 'green';
            case 'tool': return 'orange';
            default: return 'default';
        }
    };

    const formatJson = (obj: any) => {
        if (!obj) return 'null';
        try {
            return JSON.stringify(obj, null, 2);
        } catch {
            return String(obj);
        }
    };

    if (isLoading) {
        return (
            <div style={{ padding: '24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#666' }}>加载中...</Text>
            </div>
        );
    }

    if (rawMessages.length === 0) {
        return (
            <div style={{ padding: '24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty
                    description="暂无原始聊天消息"
                    style={{ color: '#666' }}
                />
            </div>
        );
    }

    return (
        <div style={{
            padding: '16px',
            height: '100%',
            overflowY: 'auto',
            background: '#0a0a0a'
        }}>
            <div style={{ marginBottom: '16px' }}>
                <Text strong style={{ color: '#fff', fontSize: '16px' }}>
                    原始聊天消息 ({rawMessages.length})
                </Text>
            </div>

            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {rawMessages.map((message) => (
                    <Card
                        key={message.id}
                        size="small"
                        style={{
                            background: '#1a1a1a',
                            border: '1px solid #333',
                        }}
                        title={
                            <Space>
                                <Tag color={getRoleColor(message.role)}>
                                    {message.role.toUpperCase()}
                                </Tag>
                                {message.tool_name && (
                                    <Tag color="purple">{message.tool_name}</Tag>
                                )}
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    {formatTimestamp(message.created_at)}
                                </Text>
                            </Space>
                        }
                    >
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            {/* Message ID */}
                            <div>
                                <Text strong style={{ color: '#1890ff' }}>ID: </Text>
                                <Text code style={{ fontSize: '11px' }}>{message.id}</Text>
                            </div>

                            {/* Content */}
                            <div>
                                <Text strong style={{ color: '#1890ff' }}>Content:</Text>
                                <Paragraph
                                    style={{
                                        background: '#262626',
                                        padding: '8px',
                                        borderRadius: '4px',
                                        margin: '4px 0 0 0',
                                        fontSize: '12px',
                                        fontFamily: 'monospace',
                                        whiteSpace: 'pre-wrap',
                                        color: '#d9d9d9'
                                    }}
                                >
                                    {message.content}
                                </Paragraph>
                            </div>

                            {/* Tool Parameters */}
                            {message.tool_parameters && (
                                <div>
                                    <Text strong style={{ color: '#1890ff' }}>Tool Parameters:</Text>
                                    <Paragraph
                                        style={{
                                            background: '#262626',
                                            padding: '8px',
                                            borderRadius: '4px',
                                            margin: '4px 0 0 0',
                                            fontSize: '11px',
                                            fontFamily: 'monospace',
                                            whiteSpace: 'pre-wrap',
                                            color: '#d9d9d9'
                                        }}
                                    >
                                        {formatJson(message.tool_parameters)}
                                    </Paragraph>
                                </div>
                            )}

                            {/* Tool Result */}
                            {message.tool_result && (
                                <div>
                                    <Text strong style={{ color: '#1890ff' }}>Tool Result:</Text>
                                    <Paragraph
                                        style={{
                                            background: '#262626',
                                            padding: '8px',
                                            borderRadius: '4px',
                                            margin: '4px 0 0 0',
                                            fontSize: '11px',
                                            fontFamily: 'monospace',
                                            whiteSpace: 'pre-wrap',
                                            color: '#d9d9d9'
                                        }}
                                    >
                                        {formatJson(message.tool_result)}
                                    </Paragraph>
                                </div>
                            )}

                            {/* Metadata */}
                            {message.metadata && (
                                <div>
                                    <Text strong style={{ color: '#1890ff' }}>Metadata:</Text>
                                    <Paragraph
                                        style={{
                                            background: '#262626',
                                            padding: '8px',
                                            borderRadius: '4px',
                                            margin: '4px 0 0 0',
                                            fontSize: '11px',
                                            fontFamily: 'monospace',
                                            whiteSpace: 'pre-wrap',
                                            color: '#d9d9d9'
                                        }}
                                    >
                                        {formatJson(message.metadata)}
                                    </Paragraph>
                                </div>
                            )}

                            {/* Timestamps */}
                            <Divider style={{ margin: '8px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Text type="secondary" style={{ fontSize: '11px' }}>
                                    Created: {formatTimestamp(message.created_at)}
                                </Text>
                                <Text type="secondary" style={{ fontSize: '11px' }}>
                                    Updated: {formatTimestamp(message.updated_at)}
                                </Text>
                            </div>
                        </Space>
                    </Card>
                ))}
            </Space>
        </div>
    );
};

export default RawChatMessages; 