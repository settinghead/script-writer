import React, { useMemo, useState, useEffect } from 'react';
import { Card, Typography, Space, Tag, Divider, Empty, Select, Alert } from 'antd';
import { useShape } from '@electric-sql/react';
import { createElectricConfig } from '../../common/config/electric';
import type { ElectricRawChatMessage } from '@/common/transform-jsondoc-types';

const { Text, Paragraph } = Typography;
const { Option } = Select;

interface RawChatMessagesProps {
    projectId: string;
}

interface Conversation {
    id: string;
    tool_name: string;
    tool_call_id: string;
    messages: any[];
    created_at: string;
    updated_at: string;
}

const RawChatMessages: React.FC<RawChatMessagesProps> = ({ projectId }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string>('');
    const [conversationsLoading, setConversationsLoading] = useState(true);
    const [conversationsError, setConversationsError] = useState<string>('');

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

    const { data: rawChatMessages, isLoading: rawMessagesLoading } = useShape<ElectricRawChatMessage>(rawChatMessagesConfig);

    // Fetch conversations from admin API
    useEffect(() => {
        const fetchConversations = async () => {
            try {
                setConversationsLoading(true);
                setConversationsError('');

                const response = await fetch(`/api/admin/tool-conversations/${projectId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                    },
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                if (data.success && data.conversations) {
                    setConversations(data.conversations);
                    // Auto-select the most recent conversation
                    if (data.conversations.length > 0 && !selectedConversationId) {
                        setSelectedConversationId(data.conversations[0].id);
                    }
                } else {
                    setConversationsError('Failed to fetch conversations');
                }
            } catch (error) {
                console.error('Error fetching conversations:', error);
                setConversationsError(error instanceof Error ? error.message : 'Unknown error');
            } finally {
                setConversationsLoading(false);
            }
        };

        if (projectId) {
            fetchConversations();
        }
    }, [projectId, selectedConversationId]);

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

    // Filter raw messages by selected conversation
    const filteredMessages = useMemo(() => {
        if (!rawChatMessages || !selectedConversationId) return [];

        return rawChatMessages
            .map(msg => ({
                ...msg,
                metadata: safeJsonParse(msg.metadata),
                tool_parameters: safeJsonParse(msg.tool_parameters),
                tool_result: safeJsonParse(msg.tool_result),
            }))
            .filter(msg => {
                const metadata = msg.metadata;
                const toolCallId = metadata?.toolCallId || metadata?.tool_call_id;
                return toolCallId === selectedConversationId;
            })
            .sort((a, b) => {
                // Sort by created_at in ascending order (oldest first for conversation flow)
                const dateA = new Date(a.created_at).getTime();
                const dateB = new Date(b.created_at).getTime();
                return dateA - dateB;
            });
    }, [rawChatMessages, selectedConversationId]);

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

    // Get selected conversation details
    const selectedConversation = conversations.find(conv => conv.id === selectedConversationId);

    if (conversationsLoading || rawMessagesLoading) {
        return (
            <div style={{ padding: '24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#666' }}>加载中...</Text>
            </div>
        );
    }

    if (conversationsError) {
        return (
            <div style={{ padding: '24px', height: '100%' }}>
                <Alert
                    message="加载对话失败"
                    description={conversationsError}
                    type="error"
                    showIcon
                />
            </div>
        );
    }

    if (conversations.length === 0) {
        return (
            <div style={{ padding: '24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty
                    description="暂无对话记录"
                    style={{ color: '#666' }}
                />
            </div>
        );
    }

    return (
        <div style={{
            padding: '16px',
            height: '100%',
            background: '#0a0a0a',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header with conversation selector */}
            <div style={{ marginBottom: '16px', flexShrink: 0 }}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div>
                        <Text strong style={{ color: '#fff', fontSize: '16px' }}>
                            对话记录 ({conversations.length} 个会话)
                        </Text>
                    </div>

                    <div>
                        <Text style={{ color: '#999', marginRight: '8px' }}>选择对话:</Text>
                        <Select
                            value={selectedConversationId}
                            onChange={setSelectedConversationId}
                            style={{ width: '100%', maxWidth: '500px' }}
                            placeholder="请选择一个对话会话"
                        >
                            {conversations.map(conv => (
                                <Option key={conv.id} value={conv.id}>
                                    <Space>
                                        <Tag color="purple">{conv.tool_name}</Tag>
                                        <Text style={{ fontSize: '12px' }}>
                                            {formatTimestamp(conv.created_at)}
                                        </Text>
                                        <Text type="secondary" style={{ fontSize: '11px' }}>
                                            ({conv.messages.length} 条消息)
                                        </Text>
                                    </Space>
                                </Option>
                            ))}
                        </Select>
                    </div>

                    {/* Show selected conversation info */}
                    {selectedConversation && (
                        <div style={{
                            padding: '8px 12px',
                            background: '#1a1a1a',
                            border: '1px solid #333',
                            borderRadius: '4px'
                        }}>
                            <Space>
                                <Text strong style={{ color: '#1890ff' }}>当前会话:</Text>
                                <Tag color="purple">{selectedConversation.tool_name}</Tag>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    {formatTimestamp(selectedConversation.created_at)}
                                </Text>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    ID: {selectedConversation.tool_call_id}
                                </Text>
                            </Space>
                        </div>
                    )}
                </Space>
            </div>

            {/* Messages area */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                paddingRight: '8px'
            }}>
                {filteredMessages.length === 0 ? (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%'
                    }}>
                        <Empty
                            description="该对话暂无消息"
                            style={{ color: '#666' }}
                        />
                    </div>
                ) : (
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {filteredMessages.map((message, index) => (
                            <Card
                                key={message.id}
                                size="small"
                                style={{
                                    background: '#1a1a1a',
                                    border: '1px solid #333',
                                }}
                                title={
                                    <Space>
                                        <Text style={{ color: '#666', fontSize: '12px' }}>
                                            #{index + 1}
                                        </Text>
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
                                                color: '#d9d9d9',
                                                maxHeight: '300px',
                                                overflowY: 'auto'
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
                                                    color: '#d9d9d9',
                                                    maxHeight: '200px',
                                                    overflowY: 'auto'
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
                                                    color: '#d9d9d9',
                                                    maxHeight: '200px',
                                                    overflowY: 'auto'
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
                                                    color: '#d9d9d9',
                                                    maxHeight: '150px',
                                                    overflowY: 'auto'
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
                )}
            </div>
        </div>
    );
};

export default RawChatMessages; 