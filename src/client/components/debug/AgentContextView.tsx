import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Input, Card, Typography, Alert, Spin } from 'antd';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useAgentContextParams } from '../../hooks/useAgentContextParams';
import { useDebounce } from '../../hooks/useDebounce';
import { computeUnifiedWorkflowState } from '../../utils/actionComputation';

const { TextArea } = Input;
const { Title, Text } = Typography;

interface AgentPromptResponse {
    success: boolean;
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
}

interface AgentContextViewProps {
    projectId: string;
}

export const AgentContextView: React.FC<AgentContextViewProps> = ({ projectId }) => {
    const projectData = useProjectData();

    // Use the persistent params hook
    const {
        params,
        updateUserInput,
        hasError: paramsHasError
    } = useAgentContextParams(projectId);

    const [promptResponse, setPromptResponse] = useState<AgentPromptResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Debug logging
    const debugLog = useCallback((message: string, data?: any) => {
        console.log(`[AgentContextView] ${message}`, data);
    }, []);

    debugLog('Component render:', {
        projectId,
        userInputLength: params.userInput.length,
        loading,
        hasError: !!error,
        paramsHasError
    });

    // Compute workflow state once and memoize it
    const workflowState = useMemo(() => {
        if (!projectData || !projectId) return null;

        try {
            const unifiedState = computeUnifiedWorkflowState(projectData, projectId);
            const result = {
                currentStage: unifiedState.parameters.currentStage,
                hasActiveTransforms: unifiedState.parameters.hasActiveTransforms,
                actions: unifiedState.actions,
                steps: unifiedState.steps,
                displayComponents: unifiedState.displayComponents,
                parameters: unifiedState.parameters
            };

            debugLog('Workflow state computed:', {
                currentStage: result.currentStage,
                hasActiveTransforms: result.hasActiveTransforms,
                actionsCount: result.actions.length,
                stepsCount: result.steps.length,
                displayComponentsCount: result.displayComponents.length
            });

            return result;
        } catch (error) {
            debugLog('Error computing workflow state:', error);
            return null;
        }
    }, [projectData, projectId, debugLog]);

    // Debounce user input to avoid excessive API calls
    const debouncedUserInput = useDebounce(params.userInput, 1000);

    // Stable workflow state for useEffect dependency
    const stableWorkflowState = useMemo(() => {
        return workflowState ? JSON.stringify(workflowState).length : 0;
    }, [workflowState]);

    // Input change handler
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        debugLog('Input change:', newValue.length);
        updateUserInput(newValue);
    }, [updateUserInput, debugLog]);

    // Generate agent prompt when debounced input or workflow state changes
    useEffect(() => {
        debugLog('useEffect triggered for prompt generation:', {
            debouncedUserInput: debouncedUserInput.length,
            stableWorkflowState
        });

        if (!projectId || !workflowState || !debouncedUserInput.trim()) {
            setPromptResponse(null);
            return;
        }

        const generatePrompt = async () => {
            try {
                debugLog('Starting prompt generation');
                setLoading(true);
                setError(null);

                const response = await fetch('/api/admin/agent-prompt', {
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
                            workflowState
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                setPromptResponse(data);
                debugLog('Prompt generation completed');
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                setError(errorMessage);
                debugLog('Prompt generation error:', errorMessage);
            } finally {
                setLoading(false);
            }
        };

        generatePrompt();
    }, [debouncedUserInput, stableWorkflowState, projectId, workflowState, debugLog]);

    // Memoized render functions to prevent unnecessary re-renders
    const renderCodeBlock = useCallback((content: string, maxHeight = '400px') => {
        debugLog('renderCodeBlock called:', content.length);
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
    }, [debugLog]);

    if (!projectData) {
        return <Spin size="large" />;
    }

    return (
        <div style={{
            padding: '20px',
            height: '100%',
            overflow: 'auto',
            background: '#0a0a0a'
        }}>
            <Card
                title={
                    <Title level={3} style={{ margin: 0, color: '#fff' }}>
                        Agent上下文调试
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
                    {/* Left Column - Input and Workflow State */}
                    <div style={{ minWidth: '400px' }}>
                        {/* Input Section */}
                        <div style={{ marginBottom: '24px' }}>
                            <Title level={4} style={{ color: '#fff', marginBottom: '16px' }}>
                                用户输入
                            </Title>
                            <TextArea
                                value={params.userInput}
                                onChange={handleInputChange}
                                placeholder="输入你想要发送给Agent的消息..."
                                rows={4}
                                style={{
                                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
                                }}
                            />

                            {paramsHasError && (
                                <Alert message="参数存储错误" type="error" style={{ marginTop: '8px' }} />
                            )}
                        </div>

                        {/* Current Workflow State */}
                        <div style={{ marginBottom: '24px' }}>
                            <Title level={4} style={{ color: '#fff', marginBottom: '16px' }}>
                                当前工作流状态
                            </Title>
                            <div style={{
                                padding: '16px',
                                backgroundColor: '#262626',
                                borderRadius: '8px',
                                marginBottom: '16px'
                            }}>
                                {workflowState ? (
                                    <div>
                                        <Text strong style={{ color: '#fff' }}>当前阶段: </Text>
                                        <Text code>{workflowState.currentStage}</Text>
                                        <br />
                                        <Text strong style={{ color: '#fff' }}>活跃变换: </Text>
                                        <Text type={workflowState.hasActiveTransforms ? 'warning' : 'success'}>
                                            {workflowState.hasActiveTransforms ? '是' : '否'}
                                        </Text>
                                        <br />
                                        <Text strong style={{ color: '#fff' }}>可用操作: </Text>
                                        <Text type="secondary">{workflowState.actions.length} 个</Text>
                                        <br />
                                        <Text strong style={{ color: '#fff' }}>工作流步骤: </Text>
                                        <Text type="secondary">{workflowState.steps.length} 个</Text>
                                        <br />
                                        <Text strong style={{ color: '#fff' }}>显示组件: </Text>
                                        <Text type="secondary">{workflowState.displayComponents.length} 个</Text>
                                    </div>
                                ) : (
                                    <Text type="secondary">无工作流状态</Text>
                                )}
                            </div>
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
                    </div>

                    {/* Right Column - Agent Prompt Results */}
                    <div style={{ minWidth: '400px' }}>
                        {promptResponse ? (
                            <div>
                                <Title level={4} style={{ color: '#fff', marginBottom: '16px' }}>
                                    Agent提示构建结果
                                </Title>

                                <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#262626', borderRadius: '8px' }}>
                                    <Text strong style={{ color: '#fff' }}>上下文类型: </Text>
                                    <Text code>{promptResponse.input.contextType}</Text>
                                    <br />
                                    <Text strong style={{ color: '#fff' }}>工作流阶段: </Text>
                                    <Text code>{promptResponse.context.currentStage}</Text>
                                    <br />
                                    <Text strong style={{ color: '#fff' }}>可用工具: </Text>
                                    <Text type="secondary">{promptResponse.context.availableTools.join(', ')}</Text>
                                </div>

                                <Title level={5} style={{ color: '#fff', marginTop: 20 }}>
                                    用户输入
                                </Title>
                                {renderCodeBlock(promptResponse.input.userRequest, '100px')}

                                <Title level={5} style={{ color: '#fff', marginTop: 20 }}>
                                    完整Agent提示词
                                </Title>
                                {renderCodeBlock(promptResponse.prompt, '400px')}

                                <Title level={5} style={{ color: '#fff', marginTop: 20 }}>
                                    上下文数据
                                </Title>
                                {renderCodeBlock(JSON.stringify(promptResponse.context.workflowState, null, 2), '200px')}
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
                                <Title level={4} style={{ color: '#999', marginBottom: '16px' }}>
                                    Agent提示构建结果
                                </Title>
                                <Text type="secondary">输入用户请求后，Agent提示词构建结果将在此显示</Text>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}; 