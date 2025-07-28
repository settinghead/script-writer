import React, { useMemo, useState, useEffect } from 'react';
import { Card, Typography, Space, Tag, Divider, Empty, Select, Alert, Button, Checkbox, Badge } from 'antd';
import { AppColors } from '@/common/theme/colors';

const { Text, Paragraph, Title } = Typography;
const { Option } = Select;

interface RawChatMessagesProps {
    projectId: string;
}

interface Conversation {
    id: string;
    type: 'agent' | 'tool';
    status: 'active' | 'completed' | 'failed';
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
}

interface ConversationMessage {
    id: string;
    conversation_id: string;
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_name?: string;
    tool_call_id?: string;
    tool_parameters?: Record<string, any>;
    tool_result?: Record<string, any>;
    model_name?: string;
    temperature?: number;
    cache_hit?: boolean;
    cached_tokens?: number;
    status: 'streaming' | 'completed' | 'failed';
    metadata: Record<string, any>;
    created_at: string;
}

const RawChatMessages: React.FC<RawChatMessagesProps> = ({ projectId }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string>('');
    const [messages, setMessages] = useState<ConversationMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    // Message type filters
    const [filterSystem, setFilterSystem] = useState(true);
    const [filterUser, setFilterUser] = useState(true);
    const [filterAssistant, setFilterAssistant] = useState(true);
    const [filterTool, setFilterTool] = useState(true);

    // Fetch conversations for the project
    useEffect(() => {
        const fetchConversations = async () => {
            try {
                setLoading(true);
                setError('');

                const response = await fetch(`/api/chat/conversations/${projectId}`, {
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
                setConversations(data);

                // Auto-select the most recent conversation
                if (data.length > 0 && !selectedConversationId) {
                    setSelectedConversationId(data[0].id);
                }
            } catch (error) {
                console.error('Error fetching conversations:', error);
                setError(error instanceof Error ? error.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        if (projectId) {
            fetchConversations();
        }
    }, [projectId]);

    // Fetch messages for selected conversation
    useEffect(() => {
        const fetchMessages = async () => {
            if (!selectedConversationId) {
                setMessages([]);
                return;
            }

            try {
                const response = await fetch(`/api/chat/conversations/${selectedConversationId}/messages`, {
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
                setMessages(data);
            } catch (error) {
                console.error('Error fetching messages:', error);
                setError(error instanceof Error ? error.message : 'Unknown error');
            }
        };

        fetchMessages();
    }, [selectedConversationId]);

    // Filter messages based on role filters
    const filteredMessages = useMemo(() => {
        return messages.filter(msg => {
            switch (msg.role) {
                case 'system': return filterSystem;
                case 'user': return filterUser;
                case 'assistant': return filterAssistant;
                case 'tool': return filterTool;
                default: return true;
            }
        });
    }, [messages, filterSystem, filterUser, filterAssistant, filterTool]);

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
            case 'system': return 'purple';
            case 'user': return 'blue';
            case 'assistant': return 'green';
            case 'tool': return 'orange';
            default: return 'default';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'processing';
            case 'completed': return 'success';
            case 'failed': return 'error';
            case 'streaming': return 'processing';
            default: return 'default';
        }
    };

    const formatJson = (obj: any) => {
        if (!obj) return 'null';
        try {
            return JSON.stringify(obj, null, 2);
        } catch (error) {
            return String(obj);
        }
    };

    const selectedConversation = conversations.find(c => c.id === selectedConversationId);

    if (loading) {
        return <Card loading title="对话历史" />;
    }

    if (error) {
        return (
            <Card title="对话历史">
                <Alert message="加载失败" description={error} type="error" showIcon />
            </Card>
        );
    }

    return (
        <Card
            title="对话历史"
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        >
            {/* Conversation Selection */}
            <Space direction="vertical" style={{ marginBottom: 16, width: '100%' }}>
                <div>
                    <Text strong>选择对话:</Text>
                    <Select
                        style={{ width: '100%', marginTop: 8 }}
                        placeholder="选择一个对话"
                        value={selectedConversationId}
                        onChange={setSelectedConversationId}
                        showSearch
                        optionFilterProp="children"
                    >
                        {conversations.map(conv => (
                            <Option key={conv.id} value={conv.id}>
                                <Space>
                                    <Badge status={getStatusColor(conv.status)} />
                                    <Tag color={conv.type === 'agent' ? 'blue' : 'green'}>
                                        {conv.type === 'agent' ? '智能体' : '工具'}
                                    </Tag>
                                    <Text>{formatTimestamp(conv.created_at)}</Text>
                                    {conv.metadata?.userRequest && (
                                        <Text type="secondary" ellipsis style={{ maxWidth: 200 }}>
                                            {conv.metadata.userRequest.substring(0, 50)}...
                                        </Text>
                                    )}
                                </Space>
                            </Option>
                        ))}
                    </Select>
                </div>

                {/* Message Type Filters */}
                <div>
                    <Text strong>消息类型过滤:</Text>
                    <div style={{ marginTop: 8 }}>
                        <Space wrap>
                            <Checkbox
                                checked={filterSystem}
                                onChange={(e) => setFilterSystem(e.target.checked)}
                            >
                                <Tag color="purple">系统消息</Tag>
                            </Checkbox>
                            <Checkbox
                                checked={filterUser}
                                onChange={(e) => setFilterUser(e.target.checked)}
                            >
                                <Tag color="blue">用户消息</Tag>
                            </Checkbox>
                            <Checkbox
                                checked={filterAssistant}
                                onChange={(e) => setFilterAssistant(e.target.checked)}
                            >
                                <Tag color="green">助手回复</Tag>
                            </Checkbox>
                            <Checkbox
                                checked={filterTool}
                                onChange={(e) => setFilterTool(e.target.checked)}
                            >
                                <Tag color="orange">工具调用</Tag>
                            </Checkbox>
                        </Space>
                    </div>
                </div>
            </Space>

            <Divider />

            {/* Conversation Metadata */}
            {selectedConversation && (
                <Card size="small" style={{ marginBottom: 16 }}>
                    <Title level={5}>对话信息</Title>
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <div>
                            <Text strong>类型: </Text>
                            <Tag color={selectedConversation.type === 'agent' ? 'blue' : 'green'}>
                                {selectedConversation.type === 'agent' ? '智能体对话' : '工具调用'}
                            </Tag>
                            <Text strong>状态: </Text>
                            <Badge status={getStatusColor(selectedConversation.status)} text={
                                selectedConversation.status === 'active' ? '进行中' :
                                    selectedConversation.status === 'completed' ? '已完成' : '失败'
                            } />
                        </div>
                        <div>
                            <Text strong>创建时间: </Text>
                            <Text>{formatTimestamp(selectedConversation.created_at)}</Text>
                        </div>
                        <div>
                            <Text strong>更新时间: </Text>
                            <Text>{formatTimestamp(selectedConversation.updated_at)}</Text>
                        </div>
                        {selectedConversation.metadata && Object.keys(selectedConversation.metadata).length > 0 && (
                            <div>
                                <Text strong>元数据: </Text>
                                <pre style={{
                                    fontSize: '12px',
                                    backgroundColor: '#f5f5f5',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    maxHeight: '100px',
                                    overflow: 'auto'
                                }}>
                                    {formatJson(selectedConversation.metadata)}
                                </pre>
                            </div>
                        )}
                    </Space>
                </Card>
            )}

            {/* Messages List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredMessages.length === 0 ? (
                    <Empty
                        description={selectedConversationId ? "没有符合过滤条件的消息" : "请选择一个对话"}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                ) : (
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        {filteredMessages.map((message, index) => (
                            <Card
                                key={message.id}
                                size="small"
                                style={{
                                    borderLeft: `4px solid ${message.role === 'system' ? '#722ed1' :
                                            message.role === 'user' ? '#1890ff' :
                                                message.role === 'assistant' ? '#52c41a' : '#fa8c16'
                                        }`
                                }}
                            >
                                <div style={{ marginBottom: 8 }}>
                                    <Space wrap>
                                        <Tag color={getRoleColor(message.role)}>
                                            {message.role === 'system' ? '系统' :
                                                message.role === 'user' ? '用户' :
                                                    message.role === 'assistant' ? '助手' : '工具'}
                                        </Tag>
                                        <Badge status={getStatusColor(message.status)} text={
                                            message.status === 'streaming' ? '流式传输中' :
                                                message.status === 'completed' ? '已完成' : '失败'
                                        } />
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            {formatTimestamp(message.created_at)}
                                        </Text>
                                        {message.cache_hit && (
                                            <Tag color="gold">
                                                缓存命中 ({message.cached_tokens || 0} tokens)
                                            </Tag>
                                        )}
                                        {message.model_name && (
                                            <Tag color="cyan">{message.model_name}</Tag>
                                        )}
                                        {message.temperature !== undefined && (
                                            <Tag>温度: {message.temperature}</Tag>
                                        )}
                                    </Space>
                                </div>

                                {/* Message Content */}
                                <div style={{ marginBottom: 8 }}>
                                    <Text strong>内容:</Text>
                                    <Paragraph
                                        style={{
                                            marginTop: 4,
                                            backgroundColor: '#fafafa',
                                            padding: '8px',
                                            borderRadius: '4px',
                                            marginBottom: 8
                                        }}
                                    >
                                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                                            {message.content}
                                        </pre>
                                    </Paragraph>
                                </div>

                                {/* Tool Information */}
                                {message.tool_name && (
                                    <div style={{ marginBottom: 8 }}>
                                        <Text strong>工具: </Text>
                                        <Tag color="orange">{message.tool_name}</Tag>
                                        {message.tool_call_id && (
                                            <>
                                                <Text strong> 调用ID: </Text>
                                                <Text code style={{ fontSize: '12px' }}>{message.tool_call_id}</Text>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Tool Parameters */}
                                {message.tool_parameters && Object.keys(message.tool_parameters).length > 0 && (
                                    <div style={{ marginBottom: 8 }}>
                                        <Text strong>工具参数:</Text>
                                        <pre style={{
                                            fontSize: '12px',
                                            backgroundColor: '#f0f2f5',
                                            padding: '8px',
                                            borderRadius: '4px',
                                            marginTop: '4px',
                                            maxHeight: '200px',
                                            overflow: 'auto'
                                        }}>
                                            {formatJson(message.tool_parameters)}
                                        </pre>
                                    </div>
                                )}

                                {/* Tool Result */}
                                {message.tool_result && Object.keys(message.tool_result).length > 0 && (
                                    <div style={{ marginBottom: 8 }}>
                                        <Text strong>工具结果:</Text>
                                        <pre style={{
                                            fontSize: '12px',
                                            backgroundColor: '#f6ffed',
                                            padding: '8px',
                                            borderRadius: '4px',
                                            marginTop: '4px',
                                            maxHeight: '200px',
                                            overflow: 'auto'
                                        }}>
                                            {formatJson(message.tool_result)}
                                        </pre>
                                    </div>
                                )}

                                {/* Metadata */}
                                {message.metadata && Object.keys(message.metadata).length > 0 && (
                                    <div>
                                        <Text strong>元数据:</Text>
                                        <pre style={{
                                            fontSize: '12px',
                                            backgroundColor: '#f5f5f5',
                                            padding: '8px',
                                            borderRadius: '4px',
                                            marginTop: '4px',
                                            maxHeight: '100px',
                                            overflow: 'auto'
                                        }}>
                                            {formatJson(message.metadata)}
                                        </pre>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </Space>
                )}
            </div>
        </Card>
    );
};

export default RawChatMessages; 