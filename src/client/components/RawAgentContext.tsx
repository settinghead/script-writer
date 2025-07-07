import React, { useState, useEffect } from 'react';
import { Card, Typography, Tabs, Spin, Alert, Input } from 'antd';
import { LoadingOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useProjectData } from '../contexts/ProjectDataContext';
import { prepareAgentPromptContext } from '../../common/utils/agentContext';
import { useDebounce } from '../hooks/useDebounce';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

interface RawAgentContextProps {
    projectId: string;
}

interface AgentDebugData {
    prompt: string;
    tools: Array<{
        name: string;
        description: string;
        inputSchema: any;
        outputSchema: any;
    }>;
    contextData: {
        context: string;
        requestType: string;
        artifacts?: any[];
        transforms?: any[];
        humanTransforms?: any[];
        transformInputs?: any[];
        transformOutputs?: any[];
        contextString?: string;
    };
}

const RawAgentContext: React.FC<RawAgentContextProps> = ({ projectId }) => {
    const {
        artifacts,
        transforms,
        humanTransforms,
        transformInputs,
        transformOutputs,
        isLoading,
        isError,
        error
    } = useProjectData();

    const [debugData, setDebugData] = useState<AgentDebugData | null>(null);
    const [loading, setLoading] = useState(false);
    const [debugError, setDebugError] = useState<string | null>(null);
    const [userRequest, setUserRequest] = useState('给我生成一些故事想法');
    const [lastFetchedRequest, setLastFetchedRequest] = useState('');

    // Debounce the user request to avoid too many API calls
    const debouncedUserRequest = useDebounce(userRequest, 1000);

    // Generate the agent context using the common function (client-side)
    const [agentContext, setAgentContext] = useState<string | null>(null);

    useEffect(() => {
        if (isLoading || !artifacts.length) {
            setAgentContext(null);
            return;
        }

        const generateContext = async () => {
            try {
                const context = await prepareAgentPromptContext({
                    artifacts: Array.isArray(artifacts) ? artifacts : [],
                    transforms: Array.isArray(transforms) ? transforms : [],
                    humanTransforms: Array.isArray(humanTransforms) ? humanTransforms : [],
                    transformInputs: Array.isArray(transformInputs) ? transformInputs : [],
                    transformOutputs: Array.isArray(transformOutputs) ? transformOutputs : []
                }, projectId);
                setAgentContext(context);
            } catch (error) {
                console.error('Failed to generate agent context:', error);
                setAgentContext('生成上下文失败');
            }
        };

        generateContext();
    }, [artifacts, transforms, humanTransforms, transformInputs, transformOutputs, isLoading, projectId]);

    const fetchDebugData = async (requestText: string) => {
        if (!requestText.trim()) {
            setDebugError('请输入用户请求');
            return;
        }

        setLoading(true);
        setDebugError(null);

        try {
            const response = await fetch(`/api/admin/agent-debug?projectId=${projectId}&userId=test-user-1&userRequest=${encodeURIComponent(requestText)}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.success) {
                setDebugData(result.data);
                setLastFetchedRequest(requestText);
            } else {
                throw new Error(result.error || '获取调试数据失败');
            }
        } catch (err) {
            setDebugError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    // Effect to fetch debug data when debounced request changes
    useEffect(() => {
        if (debouncedUserRequest && debouncedUserRequest !== lastFetchedRequest) {
            fetchDebugData(debouncedUserRequest);
        }
    }, [debouncedUserRequest, lastFetchedRequest]);

    const renderCodeBlock = (content: string, maxHeight = '600px') => (
        <div style={{
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            fontSize: '12px',
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

    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px'
            }}>
                <Spin size="large" />
            </div>
        );
    }

    if (isError) {
        return (
            <Alert
                message="加载失败"
                description={error?.message || '无法加载智能体上下文数据'}
                type="error"
                showIcon
                style={{ margin: '16px' }}
            />
        );
    }

    const tabItems = [
        {
            key: 'context',
            label: '上下文',
            children: (
                <div>
                    {debugData ? (
                        <div>
                            <div style={{
                                marginBottom: '16px',
                                padding: '8px 12px',
                                background: '#0f1419',
                                borderRadius: '4px',
                                border: '1px solid #1890ff',
                                color: '#1890ff',
                                fontSize: '14px'
                            }}>
                                请求类型: {debugData.contextData.requestType}
                            </div>
                            {renderCodeBlock(debugData.contextData.context)}
                        </div>
                    ) : (
                        renderCodeBlock(agentContext || '正在生成上下文...')
                    )}
                    <div style={{
                        marginTop: '16px',
                        padding: '12px',
                        background: '#0f1419',
                        borderRadius: '4px',
                        border: '1px solid #333'
                    }}>
                        <Paragraph style={{
                            margin: 0,
                            fontSize: '12px',
                            color: '#888',
                            fontStyle: 'italic'
                        }}>
                            💡 这是发送给LLM的完整上下文信息。
                        </Paragraph>
                    </div>
                </div>
            )
        },
        {
            key: 'prompt',
            label: '提示词',
            children: debugData ? (
                <div>
                    {renderCodeBlock(debugData.prompt)}
                    <div style={{
                        marginTop: '16px',
                        padding: '12px',
                        background: '#0f1419',
                        borderRadius: '4px',
                        border: '1px solid #333'
                    }}>
                        <Paragraph style={{
                            margin: 0,
                            fontSize: '12px',
                            color: '#888',
                            fontStyle: 'italic'
                        }}>
                            🤖 这是完整的提示词，包含用户请求、项目背景和任务指导。
                        </Paragraph>
                    </div>
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Paragraph style={{ color: '#888' }}>
                        点击右上角"获取调试数据"按钮来加载提示词
                    </Paragraph>
                </div>
            )
        },
        {
            key: 'tools',
            label: '工具定义',
            children: debugData ? (
                <div>
                    {renderCodeBlock(JSON.stringify(debugData.tools, null, 2))}
                    <div style={{
                        marginTop: '16px',
                        padding: '12px',
                        background: '#0f1419',
                        borderRadius: '4px',
                        border: '1px solid #333'
                    }}>
                        <Paragraph style={{
                            margin: 0,
                            fontSize: '12px',
                            color: '#888',
                            fontStyle: 'italic'
                        }}>
                            🔧 这是智能体可以使用的工具定义，包含输入/输出模式。
                        </Paragraph>
                    </div>
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Paragraph style={{ color: '#888' }}>
                        点击右上角"获取调试数据"按钮来加载工具定义
                    </Paragraph>
                </div>
            )
        }
    ];

    return (
        <div style={{
            height: '100%',
            overflow: 'auto',
            padding: '16px',
            background: '#0a0a0a'
        }}>
            <Card
                title={
                    <Title level={4} style={{ margin: 0, color: '#fff' }}>
                        智能体调试 (Agent Debug)
                    </Title>
                }
                extra={
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <TextArea
                                value={userRequest}
                                onChange={(e) => setUserRequest(e.target.value)}
                                placeholder="输入用户请求..."
                                style={{ width: '300px', resize: 'none' }}
                                rows={1}
                            />
                            <div style={{ fontSize: '10px', color: '#666' }}>
                                示例: "给我生成一些故事想法" | "创建大纲" | "让这些故事更现代一些"
                            </div>
                        </div>
                        <div style={{
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {loading ? (
                                <LoadingOutlined style={{ color: '#1890ff' }} />
                            ) : debugData && lastFetchedRequest === userRequest ? (
                                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                            ) : null}
                        </div>
                        {debugData && (
                            <div style={{
                                fontSize: '12px',
                                color: '#1890ff',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                border: '1px solid #1890ff'
                            }}>
                                {debugData.contextData.requestType}
                            </div>
                        )}
                    </div>
                }
                style={{
                    background: '#1a1a1a',
                    border: '1px solid #333'
                }}
                headStyle={{
                    background: '#262626',
                    borderBottom: '1px solid #333'
                }}
                bodyStyle={{
                    background: '#1a1a1a',
                    color: '#fff'
                }}
            >
                {debugError && (
                    <Alert
                        message="错误"
                        description={debugError}
                        type="error"
                        style={{ marginBottom: 16 }}
                    />
                )}

                <Tabs
                    items={tabItems}
                    defaultActiveKey="context"
                />
            </Card>
        </div>
    );
};

export default RawAgentContext; 