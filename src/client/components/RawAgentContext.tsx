import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Typography, Tabs, Spin, Alert, Select, Button, Space, Form, Input, Divider } from 'antd';
import { ToolOutlined, BugOutlined, FileTextOutlined, DatabaseOutlined, SaveOutlined, DeleteOutlined, ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useDebounce } from '../hooks/useDebounce';
import { useDebugParams } from '../hooks/useDebugParams';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface RawAgentContextProps {
    projectId: string;
}

interface Tool {
    name: string;
    description: string;
    inputSchema: any;
    templatePath: string;
    hasCustomTemplateVariables: boolean;
}

interface JsondocInfo {
    id: string;
    schemaType: string;
    schemaVersion: string;
    originType: string;
    createdAt: string;
    dataPreview: string;
}

interface PromptResult {
    tool: {
        name: string;
        description: string;
        templatePath: string;
    };
    input: any;
    templateVariables: Record<string, string>;
    fieldTitles: Record<string, string>;
    prompt: string;
}

// Helper function to provide default parameters for tools
const getDefaultParamsForTool = (toolName: string): Record<string, any> => {
    switch (toolName) {
        case 'edit_brainstorm_idea':
            return {
                editRequirements: '调整故事内容，增强吸引力',
                ideaIndex: 0
            };
        case 'generate_brainstorm_ideas':
            return {
                otherRequirements: '生成有创意的故事想法，快节奏，高颜值主角'
            };
        default:
            return {};
    }
};

// Helper function to get expected jsondoc types for tools
const getExpectedJsondocTypes = (toolName: string): string[] => {
    switch (toolName) {
        case 'edit_brainstorm_idea':
            return ['brainstorm_collection', 'brainstorm_idea'];
        case 'generate_brainstorm_ideas':
            return ['brainstorm_input_params'];
        default:
            return [];
    }
};

// Helper function to check if jsondoc is compatible with tool
const isJsondocCompatible = (jsondocType: string, toolName: string): boolean => {
    const expectedTypes = getExpectedJsondocTypes(toolName);
    return expectedTypes.length === 0 || expectedTypes.includes(jsondocType);
};

const RawAgentContext: React.FC<RawAgentContextProps> = ({ projectId }) => {
    const [tools, setTools] = useState<Tool[]>([]);
    const [jsondocs, setJsondocs] = useState<JsondocInfo[]>([]);
    const [promptResult, setPromptResult] = useState<PromptResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Dry run state
    const [nonPersistentRunLoading, setNonPersistentRunLoading] = useState(false);
    const [nonPersistentRunResults, setNonPersistentRunResults] = useState<any>(null);
    const [nonPersistentRunStatus, setNonPersistentRunStatus] = useState<string>('');

    // Use the debug params hook for persistence
    const {
        selectedTool,
        selectedJsondocs,
        additionalParams,
        setSelectedTool,
        setSelectedJsondocs,
        setAdditionalParams,
        saveParams,
        loadParams,
        clearParams,
        isLoading: paramsLoading,
        error: paramsError
    } = useDebugParams({ projectId });

    // Create request payload for debouncing
    const requestPayload = useMemo(() => {
        if (!selectedTool) {
            return null;
        }

        if (selectedJsondocs.length === 0) {
            return null;
        }

        let parsedParams = {};
        try {
            if (additionalParams.trim()) {
                parsedParams = JSON.parse(additionalParams);
            }
        } catch (err) {
            return null; // Invalid JSON, don't make request
        }

        // Add default values for commonly required fields
        const defaultParams = getDefaultParamsForTool(selectedTool);
        const mergedParams = { ...defaultParams, ...parsedParams };

        // Prepare jsondocs array for the request
        const jsondocsArray = selectedJsondocs.map(jsondocId => {
            const jsondoc = jsondocs.find(j => j.id === jsondocId);
            return {
                jsondocId,
                description: jsondoc ? `${jsondoc.schemaType} (${jsondoc.originType})` : 'Unknown',
                schemaType: jsondoc?.schemaType || 'unknown'
            };
        });

        const payload = {
            toolName: selectedTool,
            jsondocs: jsondocsArray,
            additionalParams: mergedParams
        };

        return payload;
    }, [selectedTool, selectedJsondocs, additionalParams, jsondocs]);

    // Single debounced request payload
    const debouncedRequestPayload = useDebounce(requestPayload, 1000);

    // Clear incompatible jsondocs when tool changes
    useEffect(() => {
        if (selectedTool && selectedJsondocs.length > 0) {
            const compatibleJsondocs = selectedJsondocs.filter(jsondocId => {
                const jsondoc = jsondocs.find(j => j.id === jsondocId);
                return jsondoc && isJsondocCompatible(jsondoc.schemaType, selectedTool);
            });

            if (compatibleJsondocs.length !== selectedJsondocs.length) {
                setSelectedJsondocs(compatibleJsondocs);
            }
        }
    }, [selectedTool, jsondocs]);

    // Populate default parameters when tool changes
    useEffect(() => {
        if (selectedTool) {
            const defaultParams = getDefaultParamsForTool(selectedTool);
            if (Object.keys(defaultParams).length > 0) {
                // Only set if additionalParams is empty or just '{}'
                if (additionalParams.trim() === '' || additionalParams.trim() === '{}') {
                    setAdditionalParams(JSON.stringify(defaultParams, null, 2));
                }
            }
        }
    }, [selectedTool]);
    const [toolsLoading, setToolsLoading] = useState(true);
    const [jsondocsLoading, setJsondocsLoading] = useState(true);

    // Load available tools
    useEffect(() => {
        const loadTools = async () => {
            try {
                setToolsLoading(true);
                const response = await fetch('/api/admin/tools', {
                    headers: {
                        'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to load tools: ${response.statusText}`);
                }

                const result = await response.json();
                if (result.success) {
                    setTools(result.tools);
                } else {
                    throw new Error(result.error || 'Failed to load tools');
                }
            } catch (err) {
                console.error('Error loading tools:', err);
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                setToolsLoading(false);
            }
        };

        loadTools();
    }, []);

    // Load project jsondocs
    useEffect(() => {
        const loadJsondocs = async () => {
            try {
                setJsondocsLoading(true);
                const response = await fetch(`/api/admin/jsondocs/${projectId}`, {
                    headers: {
                        'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to load jsondocs: ${response.statusText}`);
                }

                const result = await response.json();
                if (result.success) {
                    setJsondocs(result.jsondocs);
                } else {
                    throw new Error(result.error || 'Failed to load jsondocs');
                }
            } catch (err) {
                console.error('Error loading jsondocs:', err);
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                setJsondocsLoading(false);
            }
        };

        if (projectId) {
            loadJsondocs();
        }
    }, [projectId]);

    // Generate prompt with the given payload
    const generatePromptWithPayload = useCallback(async (requestBody: any) => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/admin/tools/${requestBody.toolName}/prompt`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer debug-auth-token-script-writer-dev'
                },
                body: JSON.stringify(requestBody)
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
            console.error('Error generating prompt:', err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    // Automatic prompt generation when debounced request payload changes
    useEffect(() => {
        if (debouncedRequestPayload) {
            generatePromptWithPayload(debouncedRequestPayload);
        } else {
            // Clear results when selections are invalid
            setPromptResult(null);
            setError(null);
        }
    }, [debouncedRequestPayload]);

    // Non-persistent run function
    const runNonPersistentRun = async (toolName: string, input: any) => {
        setNonPersistentRunLoading(true);
        setNonPersistentRunResults(null);
        setNonPersistentRunStatus('开始非持久化运行...');

        try {
            const response = await fetch(`/api/admin/tools/${toolName}/non-persistent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer debug-auth-token-script-writer-dev`
                },
                body: JSON.stringify(input)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body reader available');
            }

            let consolidatedResult: any = {};

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'chunk' && data.data) {
                                // Handle both array and object data structures
                                if (Array.isArray(data.data)) {
                                    // For array data, update the consolidated result
                                    consolidatedResult = data.data;
                                    setNonPersistentRunResults(consolidatedResult);
                                } else {
                                    // For object data, merge into consolidated result
                                    consolidatedResult = { ...consolidatedResult, ...data.data };
                                    setNonPersistentRunResults(consolidatedResult);
                                }
                                setNonPersistentRunStatus('接收数据中...');
                            } else if (data.message === 'Non-persistence run completed successfully') {
                                setNonPersistentRunStatus('非持久化运行完成');
                            } else if (data.message) {
                                setNonPersistentRunStatus(data.message);
                            }
                        } catch (e) {
                            console.warn('Failed to parse SSE data:', line);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Non-persistent run error:', error);
            setNonPersistentRunStatus(`错误: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setNonPersistentRunLoading(false);
        }
    };

    const renderCodeBlock = (content: string, maxHeight = '400px') => (
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

    // Two-column responsive layout components
    const renderConfigurationColumn = () => (
        <div style={{ minWidth: '400px' }}>
            <Alert
                message="自动生成提示词"
                description="选择工具和数据后，提示词将自动生成，无需手动点击按钮"
                type="info"
                style={{ marginBottom: 16 }}
                showIcon
            />

            <Form layout="vertical">
                <Form.Item label="选择工具">
                    <Select
                        value={selectedTool}
                        onChange={setSelectedTool}
                        placeholder="选择一个工具"
                        loading={toolsLoading}
                        size="large"
                        style={{ width: '100%' }}
                    >
                        {tools.map(tool => (
                            <Option key={tool.name} value={tool.name}>
                                <div>
                                    <Text strong>{tool.name}</Text>
                                    <br />
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        {tool.description}
                                    </Text>
                                </div>
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item label="选择数据源">
                    <Select
                        mode="multiple"
                        value={selectedJsondocs}
                        onChange={setSelectedJsondocs}
                        placeholder="选择一个或多个数据源"
                        loading={jsondocsLoading}
                        size="large"
                        style={{ width: '100%' }}
                        optionLabelProp="label"
                    >
                        {jsondocs
                            .filter(jsondoc => !selectedTool || isJsondocCompatible(jsondoc.schemaType, selectedTool))
                            .map(jsondoc => (
                                <Option
                                    key={jsondoc.id}
                                    value={jsondoc.id}
                                    label={`${jsondoc.schemaType} (${jsondoc.originType})`}
                                >
                                    <div>
                                        <Text strong>{jsondoc.schemaType}</Text>
                                        <Text type="secondary"> ({jsondoc.originType})</Text>
                                        <br />
                                        <Text type="secondary" style={{ fontSize: '11px' }}>
                                            {jsondoc.dataPreview}
                                        </Text>
                                    </div>
                                </Option>
                            ))}
                    </Select>
                    {selectedTool && (
                        <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                            <Text type="secondary">
                                期望数据类型: {getExpectedJsondocTypes(selectedTool).join(', ') || '任意类型'}
                            </Text>
                            {jsondocs.filter(jsondoc => isJsondocCompatible(jsondoc.schemaType, selectedTool)).length === 0 && (
                                <div style={{ marginTop: 4, color: '#ff4d4f' }}>
                                    ⚠️ 当前项目中没有与此工具兼容的数据
                                </div>
                            )}
                        </div>
                    )}
                </Form.Item>

                <Form.Item label="附加参数 (JSON)">
                    <TextArea
                        value={additionalParams}
                        onChange={(e) => setAdditionalParams(e.target.value)}
                        placeholder='{"key": "value"}'
                        rows={4}
                        style={{ fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace' }}
                    />
                    {selectedTool && (
                        <div style={{ marginTop: 8, fontSize: '12px' }}>
                            <Text type="secondary">默认参数:</Text>
                            <div style={{
                                marginTop: 4,
                                padding: 8,
                                backgroundColor: '#262626',
                                borderRadius: 4,
                                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                                fontSize: '11px',
                                color: '#ccc'
                            }}>
                                {JSON.stringify(getDefaultParamsForTool(selectedTool), null, 2)}
                            </div>
                        </div>
                    )}
                </Form.Item>
            </Form>

            {/* Persistence Controls */}
            <div style={{ marginTop: 16 }}>
                <Divider />
                <Space>
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
                        清除参数
                    </Button>
                    <Button
                        icon={<PlayCircleOutlined />}
                        onClick={() => {
                            if (!selectedTool || selectedJsondocs.length === 0) return;

                            let parsedParams = {};
                            try {
                                if (additionalParams.trim()) {
                                    parsedParams = JSON.parse(additionalParams);
                                }
                            } catch (e) {
                                setError('Invalid JSON in additional parameters');
                                return;
                            }

                            // Merge default parameters with user-provided parameters
                            const defaultParams = getDefaultParamsForTool(selectedTool);
                            const mergedParams = { ...defaultParams, ...parsedParams };

                            runNonPersistentRun(selectedTool, {
                                jsondocs: selectedJsondocs.map(id => {
                                    const jsondoc = jsondocs.find(j => j.id === id);
                                    return {
                                        jsondocId: id,
                                        description: jsondoc?.schemaType || 'unknown',
                                        schemaType: jsondoc?.schemaType || 'unknown'
                                    };
                                }),
                                additionalParams: mergedParams
                            });
                        }}
                        size="small"
                        loading={nonPersistentRunLoading}
                        disabled={!selectedTool || selectedJsondocs.length === 0}
                        style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: 'white' }}
                    >
                        执行测试运行
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
                    message="正在生成提示词..."
                    type="info"
                    style={{ marginTop: 16 }}
                    showIcon
                />
            )}

            {error && (
                <Alert
                    message="错误"
                    description={error}
                    type="error"
                    style={{ marginTop: 16 }}
                    closable
                    onClose={() => setError(null)}
                />
            )}

            {/* Tool Schema Section */}
            {selectedTool && (
                <div style={{ marginTop: 24 }}>
                    <Divider />
                    <Title level={5} style={{ color: '#fff' }}>
                        <DatabaseOutlined style={{ marginRight: 8 }} />
                        工具输入模式
                    </Title>
                    {(() => {
                        const tool = tools.find(t => t.name === selectedTool);
                        return tool ? renderCodeBlock(JSON.stringify(tool.inputSchema, null, 2), '200px') : null;
                    })()}
                </div>
            )}
        </div>
    );

    const renderResultsColumn = () => (
        <div style={{ minWidth: '400px' }}>
            {promptResult ? (
                <div>
                    <Title level={4} style={{ display: 'flex', alignItems: 'center', color: '#fff', marginBottom: 16 }}>
                        <FileTextOutlined style={{ marginRight: 8 }} />
                        生成结果
                    </Title>


                    <Title level={5} style={{ color: '#fff', marginTop: 20 }}>完整提示词</Title>
                    {renderCodeBlock(promptResult.prompt, '300px')}

                    <div style={{ marginBottom: 16, padding: 16, backgroundColor: '#262626', borderRadius: 8 }}>
                        <Text strong style={{ color: '#fff' }}>工具: </Text>
                        <Text code>{promptResult.tool.name}</Text>
                        <br />
                        <Text strong style={{ color: '#fff' }}>描述: </Text>
                        <Text type="secondary">{promptResult.tool.description}</Text>
                        <br />
                        <Text strong style={{ color: '#fff' }}>模板: </Text>
                        <Text type="secondary" style={{ fontSize: '12px' }}>{promptResult.tool.templatePath}</Text>
                    </div>

                    <Title level={5} style={{ color: '#fff', marginTop: 20 }}>输入数据</Title>
                    {renderCodeBlock(JSON.stringify(promptResult.input, null, 2), '150px')}

                    <Title level={5} style={{ color: '#fff', marginTop: 20 }}>模板变量</Title>
                    {Object.entries(promptResult.templateVariables).map(([key, value]) => (
                        <div key={key} style={{ marginBottom: 16 }}>
                            <Text strong style={{ color: '#1890ff' }}>%%{key}%%:</Text>
                            {renderCodeBlock(value, '120px')}
                        </div>
                    ))}

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
                    <FileTextOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                    <Text type="secondary">选择工具和数据源后，结果将在此显示</Text>
                </div>
            )}

            {/* Non-Persistent Run Results */}
            {nonPersistentRunResults && (
                <div style={{ marginTop: 24 }}>
                    <Title level={4} style={{ display: 'flex', alignItems: 'center', color: '#fff', marginBottom: 16 }}>
                        <PlayCircleOutlined style={{ marginRight: 8 }} />
                        干运行结果
                        {nonPersistentRunLoading && <Spin size="small" style={{ marginLeft: 8 }} />}
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: '14px' }}>
                            {nonPersistentRunStatus}
                        </Text>
                    </Title>

                    <div style={{
                        maxHeight: '400px',
                        overflow: 'auto',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #434343',
                        borderRadius: '6px'
                    }}>
                        <pre style={{
                            margin: '0',
                            width: '100%',
                            fontSize: '12px',
                            whiteSpace: 'pre-wrap',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            color: '#e6e6e6',
                            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                            padding: '12px'
                        }}>
                            {JSON.stringify(nonPersistentRunResults, null, 2)}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );

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
                        <BugOutlined style={{ marginRight: '12px' }} />
                        工具调试控制台
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
                    {renderConfigurationColumn()}
                    {renderResultsColumn()}
                </div>
            </Card>
        </div>
    );
};

export default RawAgentContext; 