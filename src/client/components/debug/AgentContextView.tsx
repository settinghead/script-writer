import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Typography, Alert, Spin, Divider, Input, Button, Space } from 'antd';
import { ToolOutlined, FileTextOutlined, MessageOutlined, SaveOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useDebounce } from '../../hooks/useDebounce';
import { useAgentContextParams } from '../../hooks/useAgentContextParams';
import { computeUnifiedWorkflowState } from '../../utils/actionComputation';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface AgentContextViewProps {
    projectId: string;
}

interface AgentPromptResult {
    prompt: string;
    context: {
        currentStage: string;
        hasActiveTransforms: boolean;
        availableTools: string[];
        workflowState: any;
    };
    input: {
        userRequest: string;
        contextType: string;
        contextData: any;
    };
    success: boolean;
    error?: string;
}

export const AgentContextView: React.FC<AgentContextViewProps> = ({ projectId }) => {
    const [promptResult, setPromptResult] = useState<AgentPromptResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const projectData = useProjectData();

    // Use the persistence hook for user input
    const {
        userInput,
        setUserInput,
        saveParams,
        loadParams,
        clearParams,
        isLoading: paramsLoading,
        error: paramsError
    } = useAgentContextParams({ projectId });

    // Debug logging
    console.log('[AgentContextView] Component render:', {
        projectId,
        userInputLength: userInput?.length || 0,
        loading,
        paramsLoading,
        hasError: !!error,
        hasParamsError: !!paramsError,
        hasPromptResult: !!promptResult,
        projectDataStatus: typeof projectData
    });

    // Track component lifecycle
    useEffect(() => {
        console.log('[AgentContextView] Component mounted');
        return () => {
            console.log('[AgentContextView] Component unmounted');
        };
    }, []);

    // Compute current workflow state - memoize with deep comparison to prevent unnecessary re-renders
    const workflowState = useMemo(() => {
        console.log('[AgentContextView] Computing workflow state');
        return computeUnifiedWorkflowState(projectData, projectId);
    }, [projectData, projectId]);

    // Memoize the workflow state to prevent re-renders when the object reference changes but content is the same
    const stableWorkflowState = useMemo(() => {
        console.log('[AgentContextView] Stabilizing workflow state');
        return JSON.stringify(workflowState);
    }, [workflowState]);

    // Debounced user input to avoid too many requests
    const debouncedUserInput = useDebounce(userInput, 1000);

    // Memoize the input change handler to prevent re-renders
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        console.log('[AgentContextView] Input change:', e.target.value.length);
        setUserInput(e.target.value);
    }, []);

    // Generate prompt data when input changes
    useEffect(() => {
        console.log('[AgentContextView] useEffect triggered for prompt generation:', {
            debouncedUserInput: debouncedUserInput?.length || 0,
            stableWorkflowState: stableWorkflowState?.length || 0
        });

        if (!debouncedUserInput.trim()) {
            setPromptResult(null);
            setError(null);
            return;
        }

        const generatePrompt = async () => {
            try {
                console.log('[AgentContextView] Starting prompt generation');
                setLoading(true);
                setError(null);

                const response = await fetch(`/api/admin/agent-prompt`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                    },
                    body: JSON.stringify({
                        projectId,
                        userRequest: debouncedUserInput,
                        contextType: 'general',
                        contextData: {
                            workflowState: JSON.parse(stableWorkflowState)
                        }
                    })
                });

                if (!response.ok) {
                    const errorResult = await response.json();
                    throw new Error(errorResult.error || `HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                if (result.success) {
                    setPromptResult(result);
                } else {
                    throw new Error(result.error || 'Failed to generate prompt');
                }
            } catch (err) {
                console.error('Error generating agent prompt:', err);
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                setLoading(false);
            }
        };

        generatePrompt();
    }, [debouncedUserInput, projectId, stableWorkflowState]);

    const renderCodeBlock = useCallback((content: string, maxHeight = '400px') => {
        console.log('[AgentContextView] renderCodeBlock called:', content.length);
        return (
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
    }, []);

    return (
        <div style={{
            height: '100%',
            overflow: 'auto',
            padding: '20px',
            background: '#0a0a0a'
        }}>
            <Card
                title={
                    <Title level={3} style={{ margin: 0, color: '#fff' }}>
                        <ToolOutlined style={{ marginRight: '12px' }} />
                        Agent上下文分析
                    </Title>
                }
                style={{
                    background: '#1a1a1a',
                    border: '1px solid #333'
                }}
                styles={{
                    header: {
                        background: '#262626',
                        borderBottom: '1px solid #333'
                    },
                    body: {
                        background: '#1a1a1a',
                        color: '#fff',
                        padding: '24px'
                    }
                }}
            >
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                    gap: '32px'
                }}>
                    {/* Input Section */}
                    <div style={{ minWidth: '400px' }}>
                        <Alert
                            message="输入用户请求"
                            description="输入一个用户请求，查看Agent会如何构建提示词和上下文"
                            type="info"
                            style={{ marginBottom: 16 }}
                            showIcon
                        />

                        <div style={{ marginBottom: 16 }}>
                            <Text strong style={{ color: '#fff', display: 'block', marginBottom: 8 }}>
                                用户请求:
                            </Text>
                            <TextArea
                                value={userInput}
                                onChange={handleInputChange}
                                placeholder="输入用户请求..."
                                disabled={loading}
                                rows={3}
                                style={{ fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace' }}
                                autoFocus={false}
                            />
                        </div>

                        {/* Persistence Controls */}
                        <div style={{ marginBottom: 16 }}>
                            <Space>
                                <Button
                                    icon={<SaveOutlined />}
                                    onClick={saveParams}
                                    size="small"
                                    loading={paramsLoading}
                                    disabled={!userInput.trim()}
                                >
                                    保存
                                </Button>
                                <Button
                                    icon={<ReloadOutlined />}
                                    onClick={loadParams}
                                    size="small"
                                    loading={paramsLoading}
                                >
                                    重新加载
                                </Button>
                                <Button
                                    icon={<DeleteOutlined />}
                                    onClick={clearParams}
                                    size="small"
                                    danger
                                    loading={paramsLoading}
                                >
                                    清除
                                </Button>
                            </Space>

                            {paramsError && (
                                <Alert
                                    message="参数保存错误"
                                    description={paramsError}
                                    type="warning"
                                    style={{ marginTop: 8 }}
                                    closable
                                />
                            )}

                            {paramsLoading && (
                                <div style={{ marginTop: 8 }}>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        <Spin size="small" style={{ marginRight: 4 }} />
                                        正在处理参数...
                                    </Text>
                                </div>
                            )}
                        </div>

                        {loading && (
                            <Alert
                                message={
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Spin size="small" />
                                        <span>正在分析Agent上下文...</span>
                                    </div>
                                }
                                type="info"
                                style={{ marginBottom: 16 }}
                            />
                        )}

                        {error && (
                            <Alert
                                message="错误"
                                description={error}
                                type="error"
                                style={{ marginBottom: 16 }}
                                closable
                                onClose={() => setError(null)}
                            />
                        )}

                        {/* Workflow State Display */}
                        <div style={{ marginTop: 24 }}>
                            <Divider />
                            <Title level={5} style={{ color: '#fff' }}>
                                <FileTextOutlined style={{ marginRight: 8 }} />
                                当前工作流状态
                            </Title>
                            <div style={{ marginBottom: 16, padding: 16, backgroundColor: '#262626', borderRadius: 8 }}>
                                <Text strong style={{ color: '#fff' }}>当前阶段: </Text>
                                <Text code>{workflowState.parameters.currentStage}</Text>
                                <br />
                                <Text strong style={{ color: '#fff' }}>活跃转换: </Text>
                                <Text type={workflowState.parameters.hasActiveTransforms ? 'warning' : 'success'}>
                                    {workflowState.parameters.hasActiveTransforms ? '是' : '否'}
                                </Text>
                                <br />
                                <Text strong style={{ color: '#fff' }}>可用操作: </Text>
                                <Text type="secondary">{workflowState.actions.length} 个</Text>
                            </div>
                        </div>
                    </div>

                    {/* Results Section */}
                    <div style={{ minWidth: '400px' }}>
                        {promptResult ? (
                            <div>
                                <Title level={4} style={{ display: 'flex', alignItems: 'center', color: '#fff', marginBottom: 16 }}>
                                    <MessageOutlined style={{ marginRight: 8 }} />
                                    Agent提示词构建结果
                                </Title>

                                <div style={{ marginBottom: 16, padding: 16, backgroundColor: '#262626', borderRadius: 8 }}>
                                    <Text strong style={{ color: '#fff' }}>上下文类型: </Text>
                                    <Text code>{promptResult.input.contextType}</Text>
                                    <br />
                                    <Text strong style={{ color: '#fff' }}>工作流阶段: </Text>
                                    <Text code>{promptResult.context.currentStage}</Text>
                                    <br />
                                    <Text strong style={{ color: '#fff' }}>可用工具: </Text>
                                    <Text type="secondary">{promptResult.context.availableTools.join(', ')}</Text>
                                </div>

                                <Title level={5} style={{ color: '#fff', marginTop: 20 }}>用户输入</Title>
                                {renderCodeBlock(promptResult.input.userRequest, '100px')}

                                <Title level={5} style={{ color: '#fff', marginTop: 20 }}>完整Agent提示词</Title>
                                {renderCodeBlock(promptResult.prompt, '400px')}

                                <Title level={5} style={{ color: '#fff', marginTop: 20 }}>上下文数据</Title>
                                {renderCodeBlock(JSON.stringify(promptResult.context.workflowState, null, 2), '200px')}
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
                                <MessageOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                                <Text type="secondary">输入用户请求后，Agent提示词构建结果将在此显示</Text>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}; 