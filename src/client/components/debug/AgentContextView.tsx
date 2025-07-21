import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Input, Card, Typography, Alert, Spin, Tag, Divider } from 'antd';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useAgentContextParams } from '../../hooks/useAgentContextParams';
import { useDebounce } from '../../hooks/useDebounce';
import { computeUnifiedWorkflowState } from '../../utils/actionComputation';
import { computeCanonicalJsondocsFromLineage } from '../../../common/canonicalJsondocLogic';
import type { CanonicalJsondocContext } from '../../../common/canonicalJsondocLogic';

const { TextArea } = Input;
const { Title, Text } = Typography;

interface AgentPromptResponse {
    success: boolean;
    prompt: string;
    context: {
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

// All available tool definitions (mirrors server-side logic)
const ALL_AVAILABLE_TOOLS = [
    'generate_brainstorm_ideas',
    'edit_brainstorm_idea',
    'generate_outline_settings',
    'edit_outline_settings',
    'generate_chronicles',
    'edit_chronicles',
    'generate_episode_planning',
    'edit_episode_planning',
    'generate_episode_synopsis'
];

/**
 * Compute available tools based on canonical jsondoc context (frontend mirror of server logic)
 * This mirrors the logic in src/server/services/AgentRequestBuilder.ts
 */
function computeAvailableToolsFromCanonicalContext(context: CanonicalJsondocContext): string[] {
    const availableTools: string[] = [];

    // Check what canonical jsondocs exist
    const hasBrainstormResult = context.canonicalBrainstormCollection || context.canonicalBrainstormIdea;
    const hasOutlineSettings = !!context.canonicalOutlineSettings;
    const hasChronicles = !!context.canonicalChronicles;
    const hasEpisodePlanning = !!context.canonicalEpisodePlanning;

    // Apply filtering rules (same as server)
    if (!hasBrainstormResult) {
        availableTools.push('generate_brainstorm_ideas');
    }

    if (hasBrainstormResult) {
        availableTools.push('edit_brainstorm_idea');
    }

    if (context.canonicalBrainstormIdea && !hasOutlineSettings) {
        availableTools.push('generate_outline_settings');
    }

    if (hasOutlineSettings) {
        // Add edit tools for previous stages
        if (context.canonicalBrainstormIdea) {
            availableTools.push('edit_brainstorm_idea');
        }
        availableTools.push('edit_outline_settings');

        // Add next generation tool
        if (!hasChronicles) {
            availableTools.push('generate_chronicles');
        }
    }

    if (hasChronicles) {
        // Add edit tools for previous stages
        if (context.canonicalBrainstormIdea) {
            availableTools.push('edit_brainstorm_idea');
        }
        if (hasOutlineSettings) {
            availableTools.push('edit_outline_settings');
        }
        availableTools.push('edit_chronicles');

        // Add next generation tool
        if (!hasEpisodePlanning) {
            availableTools.push('generate_episode_planning');
        }
    }

    if (hasEpisodePlanning) {
        // Add edit tools for all previous stages
        if (context.canonicalBrainstormIdea) {
            availableTools.push('edit_brainstorm_idea');
        }
        if (hasOutlineSettings) {
            availableTools.push('edit_outline_settings');
        }
        if (hasChronicles) {
            availableTools.push('edit_chronicles');
        }
        availableTools.push('edit_episode_planning');

        // Episode synopsis can be generated multiple times
        availableTools.push('generate_episode_synopsis');
    }

    // Remove duplicates and return
    return [...new Set(availableTools)];
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
                hasActiveTransforms: unifiedState.parameters.hasActiveTransforms,
                actions: unifiedState.actions,
                displayComponents: unifiedState.displayComponents,
                parameters: unifiedState.parameters
            };

            debugLog('Workflow state computed:', {
                hasActiveTransforms: result.hasActiveTransforms,
                actionsCount: result.actions.length,
                displayComponentsCount: result.displayComponents.length
            });

            return result;
        } catch (error) {
            debugLog('Error computing workflow state:', error);
            return null;
        }
    }, [projectData, projectId, debugLog]);

    // Compute canonical context and filtered tools
    const toolFilteringState = useMemo(() => {
        if (!projectData ||
            projectData.jsondocs === "pending" || projectData.jsondocs === "error" ||
            projectData.transforms === "pending" || projectData.transforms === "error" ||
            projectData.humanTransforms === "pending" || projectData.humanTransforms === "error" ||
            projectData.transformInputs === "pending" || projectData.transformInputs === "error" ||
            projectData.transformOutputs === "pending" || projectData.transformOutputs === "error" ||
            projectData.lineageGraph === "pending" || projectData.lineageGraph === "error") {
            return null;
        }

        try {
            // Compute canonical context using the same logic as server
            const canonicalContext = computeCanonicalJsondocsFromLineage(
                projectData.lineageGraph,
                projectData.jsondocs,
                projectData.transforms,
                projectData.humanTransforms,
                projectData.transformInputs,
                projectData.transformOutputs
            );

            // Compute filtered tools based on canonical context
            const filteredTools = computeAvailableToolsFromCanonicalContext(canonicalContext);
            const excludedTools = ALL_AVAILABLE_TOOLS.filter(tool => !filteredTools.includes(tool));

            return {
                canonicalContext,
                filteredTools,
                excludedTools,
                hasCanonicalContent: !!(
                    canonicalContext.canonicalBrainstormIdea ||
                    canonicalContext.canonicalBrainstormCollection ||
                    canonicalContext.canonicalOutlineSettings ||
                    canonicalContext.canonicalChronicles ||
                    canonicalContext.canonicalEpisodePlanning ||
                    canonicalContext.canonicalBrainstormInput
                )
            };
        } catch (error) {
            debugLog('Error computing tool filtering state:', error);
            return null;
        }
    }, [projectData, debugLog]);

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

    // Render tool filtering section
    const renderToolFiltering = useCallback(() => {
        if (!toolFilteringState) {
            return (
                <div style={{
                    padding: '16px',
                    backgroundColor: '#262626',
                    borderRadius: '8px',
                    marginBottom: '16px'
                }}>
                    <Text type="secondary">工具过滤状态计算中...</Text>
                </div>
            );
        }

        const { filteredTools, excludedTools, canonicalContext, hasCanonicalContent } = toolFilteringState;

        return (
            <div style={{
                padding: '16px',
                backgroundColor: '#262626',
                borderRadius: '8px',
                marginBottom: '16px'
            }}>
                <div style={{ marginBottom: '12px' }}>
                    <Text strong style={{ color: '#fff' }}>项目状态: </Text>
                    <Tag color={hasCanonicalContent ? 'green' : 'orange'}>
                        {hasCanonicalContent ? '有内容' : '空项目'}
                    </Tag>
                </div>

                <div style={{ marginBottom: '12px' }}>
                    <Text strong style={{ color: '#fff' }}>规范内容: </Text>
                    <div style={{ marginTop: '4px' }}>
                        {canonicalContext.canonicalBrainstormCollection && (
                            <Tag color="purple" style={{ marginBottom: '4px' }}>头脑风暴集合</Tag>
                        )}
                        {canonicalContext.canonicalBrainstormIdea && (
                            <Tag color="purple" style={{ marginBottom: '4px' }}>单个创意</Tag>
                        )}
                        {canonicalContext.canonicalOutlineSettings && (
                            <Tag color="blue" style={{ marginBottom: '4px' }}>剧本设定</Tag>
                        )}
                        {canonicalContext.canonicalChronicles && (
                            <Tag color="cyan" style={{ marginBottom: '4px' }}>时间顺序大纲</Tag>
                        )}
                        {canonicalContext.canonicalEpisodePlanning && (
                            <Tag color="geekblue" style={{ marginBottom: '4px' }}>剧集框架</Tag>
                        )}
                        {canonicalContext.canonicalBrainstormInput && (
                            <Tag color="volcano" style={{ marginBottom: '4px' }}>头脑风暴输入</Tag>
                        )}
                        {!hasCanonicalContent && (
                            <Tag color="default" style={{ marginBottom: '4px' }}>无内容</Tag>
                        )}
                    </div>
                </div>

                <Divider style={{ margin: '12px 0', borderColor: '#444' }} />

                <div style={{ marginBottom: '12px' }}>
                    <Text strong style={{ color: '#52c41a' }}>可用工具 ({filteredTools.length}): </Text>
                    <div style={{ marginTop: '4px' }}>
                        {filteredTools.map(tool => (
                            <Tag key={tool} color="green" style={{ marginBottom: '4px' }}>
                                {tool}
                            </Tag>
                        ))}
                    </div>
                </div>

                {excludedTools.length > 0 && (
                    <div>
                        <Text strong style={{ color: '#ff7875' }}>已过滤工具 ({excludedTools.length}): </Text>
                        <div style={{ marginTop: '4px' }}>
                            {excludedTools.map(tool => (
                                <Tag key={tool} color="red" style={{ marginBottom: '4px' }}>
                                    {tool}
                                </Tag>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }, [toolFilteringState]);

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
                    {/* Left Column - Input, Workflow State, and Tool Filtering */}
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

                        {/* Tool Filtering Section */}
                        <div style={{ marginBottom: '24px' }}>
                            <Title level={4} style={{ color: '#fff', marginBottom: '16px' }}>
                                智能工具过滤
                            </Title>
                            {renderToolFiltering()}
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
                                        <Text strong style={{ color: '#fff' }}>活跃变换: </Text>
                                        <Text type={workflowState.hasActiveTransforms ? 'warning' : 'success'}>
                                            {workflowState.hasActiveTransforms ? '是' : '否'}
                                        </Text>
                                        <br />
                                        <Text strong style={{ color: '#fff' }}>可用操作: </Text>
                                        <Text type="secondary">{workflowState.actions.length} 个</Text>
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
                                    <Text strong style={{ color: '#fff' }}>实际可用工具: </Text>
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