import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Input, Card, Typography, Alert, Spin, Tag, Divider, Select, Button, Collapse } from 'antd';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useAgentContextParams } from '../../hooks/useAgentContextParams';
import { useDebounce } from '../../hooks/useDebounce';
import { computeUnifiedWorkflowState } from '../../utils/actionComputation';
import { computeCanonicalJsondocsFromLineage } from '../../../common/canonicalJsondocLogic';
import type { CanonicalJsondocContext } from '../../../common/canonicalJsondocLogic';
import { getAllToolNames, getParticleSearchToolNames, getWorkflowTools, ALL_AGENT_TOOLS, type WorkflowStage } from '../../../common/schemas/tools';

const { TextArea } = Input;
const { Title, Text } = Typography;
const { Option } = Select;

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

interface Intent {
    value: string;
    label: string;
    description: string;
    category: string;
}

interface IntentsResponse {
    success: boolean;
    intents: Intent[];
    categorizedIntents: Record<string, Array<{ value: string, label: string, description: string }>>;
    totalIntents: number;
}

interface AgentContextViewProps {
    projectId: string;
}

/**
 * Compute available tools based on canonical jsondoc context (frontend mirror of server logic)
 * This mirrors the logic in src/server/services/AgentRequestBuilder.ts
 */
function computeAvailableToolsFromCanonicalContext(context: CanonicalJsondocContext): string[] {
    const availableTools: string[] = [];

    // === PARTICLE SEARCH TOOLS ===
    // Always add particle search tools (they're available when particle system is initialized)
    // Note: In the actual server, this checks if particle system is available
    // For the debug view, we'll always show them to match the server behavior
    availableTools.push(...getParticleSearchToolNames());

    // === WORKFLOW TOOLS ===
    // Use shared workflow logic
    const workflowStage: WorkflowStage = {
        hasBrainstormResult: !!(context.canonicalBrainstormCollection || context.canonicalBrainstormIdea),
        hasBrainstormIdea: !!context.canonicalBrainstormIdea,
        hasOutlineSettings: !!context.canonicalOutlineSettings,
        hasChronicles: !!context.canonicalChronicles,
        hasEpisodePlanning: !!context.canonicalEpisodePlanning
    };

    availableTools.push(...getWorkflowTools(workflowStage));

    // Remove duplicates and return
    return [...new Set(availableTools)];
}

/**
 * Generate AI SDK tool format for a given tool name
 * This shows how the tool would be passed to the AI SDK
 */
function generateAISDKToolFormat(toolName: string): any {
    const toolDef = ALL_AGENT_TOOLS.find(tool => tool.name === toolName);
    if (!toolDef) {
        return { error: `Tool ${toolName} not found in registry` };
    }

    // Mock parameter schemas based on tool type - in real implementation, 
    // these would come from the actual Zod schemas
    const mockParameterSchemas: Record<string, any> = {
        'queryJsondocs': {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: '自然语言查询，描述你需要什么信息'
                },
                limit: {
                    type: 'number',
                    minimum: 1,
                    maximum: 10,
                    default: 5,
                    description: '返回结果的数量限制'
                }
            },
            required: ['query']
        },
        'getJsondocContent': {
            type: 'object',
            properties: {
                jsondoc_id: {
                    type: 'string',
                    description: '要获取的jsondoc的ID'
                },
                path: {
                    type: 'string',
                    description: '可选的JSONPath，用于获取jsondoc中的特定部分 (例如: "$.characters[0]")'
                }
            },
            required: ['jsondoc_id']
        },
        'generate_灵感创意s': {
            type: 'object',
            properties: {
                jsondocs: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            jsondocId: { type: 'string' },
                            description: { type: 'string' },
                            schemaType: { type: 'string' }
                        },
                        required: ['jsondocId', 'description']
                    },
                    description: '引用的jsondoc列表，作为工具执行的上下文和参考资料'
                }
            },
            required: ['jsondocs']
        },
        'improve_灵感创意': {
            type: 'object',
            properties: {
                jsondocs: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            jsondocId: { type: 'string' },
                            description: { type: 'string' },
                            schemaType: { type: 'string' }
                        },
                        required: ['jsondocId', 'description']
                    },
                    description: '引用的jsondoc列表，作为工具执行的上下文和参考资料'
                },
                editRequirements: {
                    type: 'string',
                    description: '具体的编辑要求，如：扩展内容、调整风格、修改情节、增加元素等'
                },
                ideaIndex: {
                    type: 'number',
                    minimum: 0,
                    description: '要编辑的故事创意在集合中的索引位置（从0开始）'
                }

            },
            required: ['jsondocs', 'editRequirements']
        },
        'generate_剧本设定': {
            type: 'object',
            properties: {
                jsondocs: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            jsondocId: { type: 'string' },
                            description: { type: 'string' },
                            schemaType: { type: 'string' }
                        },
                        required: ['jsondocId', 'description']
                    },
                    description: '引用的jsondoc列表，作为工具执行的上下文和参考资料'
                },
                title: {
                    type: 'string',
                    description: '故事标题'
                },
                requirements: {
                    type: 'string',
                    description: '故事要求'
                }
            },
            required: ['jsondocs', 'title', 'requirements']
        },
        'improve_剧本设定': {
            type: 'object',
            properties: {
                jsondocs: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            jsondocId: { type: 'string' },
                            description: { type: 'string' },
                            schemaType: { type: 'string' }
                        },
                        required: ['jsondocId', 'description']
                    },
                    description: '引用的jsondoc列表，作为工具执行的上下文和参考资料'
                },
                editRequirements: {
                    type: 'string',
                    description: '具体的编辑要求，如：修改角色设定、调整卖点、更新故事背景等'
                }
            },
            required: ['jsondocs', 'editRequirements']
        },
        'generate_chronicles': {
            type: 'object',
            properties: {
                jsondocs: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            jsondocId: { type: 'string' },
                            description: { type: 'string' },
                            schemaType: { type: 'string' }
                        },
                        required: ['jsondocId', 'description']
                    },
                    description: '引用的jsondoc列表，作为工具执行的上下文和参考资料'
                },
                requirements: {
                    type: 'string',
                    description: '时间顺序大纲生成要求'
                }
            },
            required: ['jsondocs', 'requirements']
        },
        'edit_chronicles': {
            type: 'object',
            properties: {
                jsondocs: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            jsondocId: { type: 'string' },
                            description: { type: 'string' },
                            schemaType: { type: 'string' }
                        },
                        required: ['jsondocId', 'description']
                    },
                    description: '引用的jsondoc列表，作为工具执行的上下文和参考资料'
                },
                editRequirements: {
                    type: 'string',
                    description: '具体的编辑要求，如：修改时间线、调整角色发展、更新情节推进等'
                }
            },
            required: ['jsondocs', 'editRequirements']
        },
        'generate_episode_planning': {
            type: 'object',
            properties: {
                jsondocs: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            jsondocId: { type: 'string' },
                            description: { type: 'string' },
                            schemaType: { type: 'string' }
                        },
                        required: ['jsondocId', 'description']
                    },
                    description: '引用的jsondoc列表，作为工具执行的上下文和参考资料'
                },
                requirements: {
                    type: 'string',
                    description: '分集结构生成要求'
                }
            },
            required: ['jsondocs', 'requirements']
        },
        'edit_episode_planning': {
            type: 'object',
            properties: {
                jsondocs: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            jsondocId: { type: 'string' },
                            description: { type: 'string' },
                            schemaType: { type: 'string' }
                        },
                        required: ['jsondocId', 'description']
                    },
                    description: '引用的jsondoc列表，作为工具执行的上下文和参考资料'
                },
                editRequirements: {
                    type: 'string',
                    description: '具体的编辑要求，如：调整剧集分组、修改情感节拍、更新关键事件等'
                }
            },
            required: ['jsondocs', 'editRequirements']
        },
        'generate_episode_synopsis': {
            type: 'object',
            properties: {
                jsondocs: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            jsondocId: { type: 'string' },
                            description: { type: 'string' },
                            schemaType: { type: 'string' }
                        },
                        required: ['jsondocId', 'description']
                    },
                    description: '引用的jsondoc列表，作为工具执行的上下文和参考资料'
                },
                groupIndex: {
                    type: 'number',
                    minimum: 0,
                    description: '要生成分集大纲的剧集组索引'
                },
                episodeCount: {
                    type: 'number',
                    minimum: 1,
                    maximum: 20,
                    default: 5,
                    description: '生成的分集数量'
                },
                requirements: {
                    type: 'string',
                    description: '分集大纲生成要求'
                }
            },
            required: ['jsondocs', 'groupIndex', 'requirements']
        }
    };

    return {
        name: toolName,
        description: toolDef.description,
        parameters: mockParameterSchemas[toolName] || {
            type: 'object',
            properties: {
                jsondocs: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            jsondocId: { type: 'string' },
                            description: { type: 'string' },
                            schemaType: { type: 'string' }
                        },
                        required: ['jsondocId', 'description']
                    },
                    description: '引用的jsondoc列表，作为工具执行的上下文和参考资料'
                }
            },
            required: ['jsondocs']
        }
    };
}

export const AgentContextView: React.FC<AgentContextViewProps> = ({ projectId }) => {
    const projectData = useProjectData();

    // Use the persistent params hook
    const {
        params,
        updateUserInput,
        updateIntent,
        hasError: paramsHasError
    } = useAgentContextParams(projectId);

    const [promptResponse, setPromptResponse] = useState<AgentPromptResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [intents, setIntents] = useState<Intent[]>([]);
    const [intentsLoading, setIntentsLoading] = useState(false);

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
            const excludedTools = getAllToolNames().filter(tool => !filteredTools.includes(tool));

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

    // Debounce user input and intent to avoid excessive API calls
    const debouncedUserInput = useDebounce(params.userInput, 1000);
    const debouncedIntent = useDebounce(params.intent, 1000);

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

    // Intent change handler
    const handleIntentChange = useCallback((value: string) => {
        debugLog('Intent change:', value);
        updateIntent(value === '' ? undefined : value);
    }, [updateIntent, debugLog]);



    // Fetch available intents
    useEffect(() => {
        const fetchIntents = async () => {
            try {
                setIntentsLoading(true);
                const response = await fetch('/api/admin/intents', {
                    headers: {
                        'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data: IntentsResponse = await response.json();
                setIntents(data.intents);
                debugLog('Loaded intents:', data.intents.length);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                debugLog('Error fetching intents:', errorMessage);
                // Don't set error state for intents - it's not critical
            } finally {
                setIntentsLoading(false);
            }
        };

        fetchIntents();
    }, [debugLog]);

    // Generate agent prompt when debounced input or workflow state changes
    useEffect(() => {
        debugLog('useEffect triggered for prompt generation:', {
            debouncedUserInput: debouncedUserInput.length,
            debouncedIntent,
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
                        intent: debouncedIntent,
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
    }, [debouncedUserInput, debouncedIntent, stableWorkflowState, projectId, workflowState, debugLog]);

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
                            <Tag color="geekblue" style={{ marginBottom: '4px' }}>分集结构</Tag>
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
                    <div style={{ marginTop: '12px' }}>
                        <Collapse
                            size="small"
                            ghost
                            items={filteredTools.map(tool => ({
                                key: tool,
                                label: (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Tag color="green">
                                            {tool}
                                        </Tag>
                                        <Text style={{ color: '#999', fontSize: '12px' }}>
                                            AI SDK格式
                                        </Text>
                                    </div>
                                ),
                                children: (
                                    <div style={{
                                        padding: '12px',
                                        backgroundColor: '#0d1117',
                                        border: '1px solid #30363d',
                                        borderRadius: '6px',
                                        maxHeight: '400px',
                                        overflow: 'auto'
                                    }}>
                                        <pre style={{
                                            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                                            fontSize: '12px',
                                            color: '#e6e6e6',
                                            margin: 0,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word'
                                        }}>
                                            {JSON.stringify(generateAISDKToolFormat(tool), null, 2)}
                                        </pre>
                                    </div>
                                )
                            }))}
                            style={{
                                backgroundColor: 'transparent',
                                border: 'none'
                            }}
                        />
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
                            <div style={{ marginBottom: '12px' }}>
                                <Text strong style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>
                                    意图选择 (可选)
                                </Text>
                                <Select
                                    value={params.intent || ''}
                                    onChange={handleIntentChange}
                                    placeholder="选择具体意图以优化Agent响应..."
                                    allowClear
                                    loading={intentsLoading}
                                    style={{ width: '100%' }}
                                    dropdownStyle={{ background: '#262626' }}
                                >
                                    {intents.map((intent) => (
                                        <Option key={intent.value} value={intent.value} title={intent.description}>
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>{intent.label}</div>
                                                <div style={{ fontSize: '12px', color: '#999' }}>{intent.description}</div>
                                            </div>
                                        </Option>
                                    ))}
                                </Select>
                            </div>

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
                                    <Text strong style={{ color: '#fff' }}>选择意图: </Text>
                                    <Text code>{debouncedIntent || '无'}</Text>
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