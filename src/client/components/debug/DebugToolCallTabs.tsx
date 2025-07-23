import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Tabs, Select, Spin, Alert, Empty, Button } from 'antd';
import { BugOutlined, MessageOutlined, HistoryOutlined, ReloadOutlined } from '@ant-design/icons';
import DebugRawToolCall from './DebugRawToolCall';

const { Title, Text } = Typography;
const { Option } = Select;

interface DebugToolCallTabsProps {
    projectId: string;
}

interface ToolCallConversation {
    id: string;
    tool_name: string;
    tool_call_id: string;
    messages: Array<{ role: string; content: string }>;
    created_at: string;
    updated_at: string;
}

interface RawMessage {
    id: string;
    role: 'user' | 'assistant' | 'tool' | 'system';
    content: string;
    tool_name?: string;
    tool_parameters?: any;
    tool_result?: any;
    metadata?: any;
    created_at: string;
}

const DebugToolCallTabs: React.FC<DebugToolCallTabsProps> = ({ projectId }) => {
    const [activeTab, setActiveTab] = useState('raw-tool-call');

    // Tool call conversations state
    const [conversations, setConversations] = useState<ToolCallConversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [conversationsLoading, setConversationsLoading] = useState(false);
    const [conversationError, setConversationError] = useState<string | null>(null);

    // Raw messages grouped by tool call ID
    const [rawMessages, setRawMessages] = useState<RawMessage[]>([]);
    const [rawMessagesLoading, setRawMessagesLoading] = useState(false);
    const [rawMessagesError, setRawMessagesError] = useState<string | null>(null);

    // Load tool call conversations
    const loadConversations = async () => {
        setConversationsLoading(true);
        setConversationError(null);

        try {
            const response = await fetch(`/api/admin/tool-conversations/${projectId}`, {
                headers: {
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to load conversations: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.success) {
                setConversations(result.conversations);
            } else {
                throw new Error(result.error || 'Failed to load conversations');
            }
        } catch (err) {
            console.error('Error loading conversations:', err);
            setConversationError(err instanceof Error ? err.message : String(err));
        } finally {
            setConversationsLoading(false);
        }
    };

    // Load raw messages for tool call analysis
    const loadRawMessages = async () => {
        setRawMessagesLoading(true);
        setRawMessagesError(null);

        try {
            const response = await fetch(`/api/admin/raw-messages/${projectId}`, {
                headers: {
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to load raw messages: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.success) {
                setRawMessages(result.messages);
            } else {
                throw new Error(result.error || 'Failed to load raw messages');
            }
        } catch (err) {
            console.error('Error loading raw messages:', err);
            setRawMessagesError(err instanceof Error ? err.message : String(err));
        } finally {
            setRawMessagesLoading(false);
        }
    };

    // Load data when tab changes or component mounts
    useEffect(() => {
        if (activeTab === 'conversation-history') {
            loadConversations();
            loadRawMessages();
        }
    }, [activeTab, projectId]);

    // Group raw messages by tool call ID
    const messagesByToolCall = useMemo(() => {
        const grouped: Record<string, RawMessage[]> = {};

        rawMessages.forEach(message => {
            const toolCallId = message.metadata?.toolCallId || message.metadata?.tool_call_id;
            if (toolCallId) {
                if (!grouped[toolCallId]) {
                    grouped[toolCallId] = [];
                }
                grouped[toolCallId].push(message);
            }
        });

        // Sort messages within each group by creation time
        Object.keys(grouped).forEach(toolCallId => {
            grouped[toolCallId].sort((a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
        });

        return grouped;
    }, [rawMessages]);

    // Get unique tool call IDs for dropdown
    const toolCallOptions = useMemo(() => {
        const options: Array<{ value: string; label: string; data: any }> = [];

        // Add from conversations
        conversations.forEach(conv => {
            if (conv.tool_call_id) {
                options.push({
                    value: `conv-${conv.id}`,
                    label: `${conv.tool_name} (${new Date(conv.created_at).toLocaleString()})`,
                    data: { type: 'conversation', ...conv }
                });
            }
        });

        // Add from raw messages
        Object.keys(messagesByToolCall).forEach(toolCallId => {
            const messages = messagesByToolCall[toolCallId];
            const toolName = messages.find(m => m.tool_name)?.tool_name || 'Unknown Tool';
            const latestMessage = messages[messages.length - 1];

            options.push({
                value: `raw-${toolCallId}`,
                label: `${toolName} [Raw] (${new Date(latestMessage.created_at).toLocaleString()})`,
                data: { type: 'raw', toolCallId, messages }
            });
        });

        // Sort by creation time (newest first)
        return options.sort((a, b) => {
            const timeA = a.data.type === 'conversation'
                ? new Date(a.data.created_at).getTime()
                : new Date(a.data.messages[a.data.messages.length - 1].created_at).getTime();
            const timeB = b.data.type === 'conversation'
                ? new Date(b.data.created_at).getTime()
                : new Date(b.data.messages[b.data.messages.length - 1].created_at).getTime();
            return timeB - timeA;
        });
    }, [conversations, messagesByToolCall]);

    // Get selected conversation data
    const selectedConversationData = useMemo(() => {
        if (!selectedConversationId) return null;

        const option = toolCallOptions.find(opt => opt.value === selectedConversationId);
        return option?.data || null;
    }, [selectedConversationId, toolCallOptions]);

    const renderCodeBlock = (content: string, maxHeight = '600px') => (
        <div style={{
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            fontSize: '14px',
            lineHeight: '1.4',
            color: '#e6e6e6',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#0d1117',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid #30363d',
            maxHeight,
            overflow: 'auto'
        }}>
            {content}
        </div>
    );

    const renderConversationHistory = () => (
        <div style={{ padding: '20px' }}>
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Select
                    value={selectedConversationId}
                    onChange={setSelectedConversationId}
                    placeholder="选择一个工具调用对话"
                    style={{ minWidth: '400px' }}
                    loading={conversationsLoading || rawMessagesLoading}
                    allowClear
                >
                    {toolCallOptions.map(option => (
                        <Option key={option.value} value={option.value}>
                            <div>
                                <Text strong>{option.label}</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    {option.data.type === 'conversation' ? 'Structured Conversation' : 'Raw Messages'}
                                    {option.data.tool_call_id && ` • ID: ${option.data.tool_call_id}`}
                                </Text>
                            </div>
                        </Option>
                    ))}
                </Select>

                <Button
                    icon={<ReloadOutlined />}
                    onClick={() => {
                        loadConversations();
                        loadRawMessages();
                    }}
                    loading={conversationsLoading || rawMessagesLoading}
                >
                    刷新
                </Button>
            </div>

            {conversationError && (
                <Alert
                    message="加载对话历史时出错"
                    description={conversationError}
                    type="error"
                    style={{ marginBottom: '16px' }}
                    closable
                    onClose={() => setConversationError(null)}
                />
            )}

            {rawMessagesError && (
                <Alert
                    message="加载原始消息时出错"
                    description={rawMessagesError}
                    type="error"
                    style={{ marginBottom: '16px' }}
                    closable
                    onClose={() => setRawMessagesError(null)}
                />
            )}

            {selectedConversationData ? (
                <div>
                    <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#262626', borderRadius: '8px' }}>
                        <Text strong style={{ color: '#fff' }}>工具: </Text>
                        <Text code>{selectedConversationData.tool_name}</Text>
                        <br />
                        <Text strong style={{ color: '#fff' }}>类型: </Text>
                        <Text type="secondary">
                            {selectedConversationData.type === 'conversation' ? '结构化对话' : '原始消息'}
                        </Text>
                        <br />
                        <Text strong style={{ color: '#fff' }}>工具调用ID: </Text>
                        <Text code style={{ fontSize: '12px' }}>
                            {selectedConversationData.tool_call_id || selectedConversationData.toolCallId}
                        </Text>
                        <br />
                        <Text strong style={{ color: '#fff' }}>时间: </Text>
                        <Text type="secondary">
                            {selectedConversationData.type === 'conversation'
                                ? new Date(selectedConversationData.created_at).toLocaleString()
                                : new Date(selectedConversationData.messages[0].created_at).toLocaleString()
                            }
                        </Text>
                    </div>

                    <Title level={4} style={{ color: '#fff', marginBottom: '16px' }}>
                        <MessageOutlined style={{ marginRight: '8px' }} />
                        对话内容
                    </Title>

                    {selectedConversationData.type === 'conversation' ? (
                        // Render structured conversation
                        <div>
                            {selectedConversationData.messages.map((message: any, index: number) => (
                                <div key={index} style={{ marginBottom: '16px' }}>
                                    <div style={{
                                        fontWeight: 'bold',
                                        marginBottom: '8px',
                                        color: message.role === 'user' ? '#1890ff' : '#52c41a'
                                    }}>
                                        {message.role === 'user' ? 'User' : 'Assistant'}
                                    </div>
                                    {renderCodeBlock(message.content)}
                                </div>
                            ))}
                        </div>
                    ) : (
                        // Render raw messages
                        <div>
                            {selectedConversationData.messages.map((message: RawMessage, index: number) => (
                                <div key={message.id} style={{ marginBottom: '16px' }}>
                                    <div style={{
                                        fontWeight: 'bold',
                                        marginBottom: '8px',
                                        color: message.role === 'user' ? '#1890ff' :
                                            message.role === 'assistant' ? '#52c41a' :
                                                message.role === 'tool' ? '#faad14' : '#999'
                                    }}>
                                        {message.role.charAt(0).toUpperCase() + message.role.slice(1)}
                                        {message.tool_name && (
                                            <span style={{ color: '#666', marginLeft: '8px' }}>
                                                ({message.tool_name})
                                            </span>
                                        )}
                                        <span style={{ color: '#666', marginLeft: '8px', fontSize: '12px' }}>
                                            {new Date(message.created_at).toLocaleString()}
                                        </span>
                                    </div>

                                    <div style={{ marginBottom: '8px' }}>
                                        <Text strong style={{ color: '#fff' }}>Content:</Text>
                                        {renderCodeBlock(message.content, '200px')}
                                    </div>

                                    {message.tool_parameters && (
                                        <div style={{ marginBottom: '8px' }}>
                                            <Text strong style={{ color: '#fff' }}>Tool Parameters:</Text>
                                            {renderCodeBlock(JSON.stringify(message.tool_parameters, null, 2), '150px')}
                                        </div>
                                    )}

                                    {message.tool_result && (
                                        <div style={{ marginBottom: '8px' }}>
                                            <Text strong style={{ color: '#fff' }}>Tool Result:</Text>
                                            {renderCodeBlock(JSON.stringify(message.tool_result, null, 2), '150px')}
                                        </div>
                                    )}

                                    {message.metadata && (
                                        <div style={{ marginBottom: '8px' }}>
                                            <Text strong style={{ color: '#fff' }}>Metadata:</Text>
                                            {renderCodeBlock(JSON.stringify(message.metadata, null, 2), '100px')}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '400px',
                    border: '2px dashed #555',
                    borderRadius: '8px',
                    color: '#999',
                    backgroundColor: '#262626'
                }}>
                    <HistoryOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                    <Text type="secondary">选择一个工具调用对话查看详细历史记录</Text>
                    {toolCallOptions.length === 0 && !conversationsLoading && !rawMessagesLoading && (
                        <Text type="secondary" style={{ marginTop: '8px' }}>
                            当前项目没有找到工具调用对话记录
                        </Text>
                    )}
                </div>
            )}
        </div>
    );

    const tabItems = [
        {
            key: 'raw-tool-call',
            label: (
                <span>
                    <BugOutlined />
                    工具调试
                </span>
            ),
            children: <DebugRawToolCall projectId={projectId} />
        },
        {
            key: 'conversation-history',
            label: (
                <span>
                    <HistoryOutlined />
                    对话历史
                    {conversationsLoading || rawMessagesLoading ? (
                        <Spin size="small" style={{ marginLeft: '8px' }} />
                    ) : null}
                </span>
            ),
            children: renderConversationHistory()
        }
    ];

    return (
        <div style={{
            height: '100%',
            overflow: 'auto',
            background: '#0a0a0a'
        }}>
            <Card
                title={
                    <Title level={3} style={{ margin: 0, color: '#fff' }}>
                        <BugOutlined style={{ marginRight: '12px' }} />
                        工具调试与对话历史
                    </Title>
                }
                style={{
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    height: '100%'
                }}
                styles={{
                    header: {
                        background: '#262626',
                        borderBottom: '1px solid #333'
                    },
                    body: {
                        background: '#1a1a1a',
                        color: '#fff',
                        padding: 0,
                        height: 'calc(100% - 64px)'
                    }
                }}
            >
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={tabItems}
                    style={{ height: '100%' }}
                />
            </Card>
        </div>
    );
};

export default DebugToolCallTabs; 