import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Typography, Tabs, Spin, Alert, Select, Button, Space, Form, Input, Divider } from 'antd';
import { ToolOutlined, BugOutlined, FileTextOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useProjectData } from '../contexts/ProjectDataContext';
import { useDebounce } from '../hooks/useDebounce';

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
            return ['brainstorm_collection', 'brainstorm_idea_collection'];
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
    const [selectedTool, setSelectedTool] = useState<string>('');
    const [selectedJsondocs, setSelectedJsondocs] = useState<string[]>([]);
    const [additionalParams, setAdditionalParams] = useState<string>('{}');
    const [promptResult, setPromptResult] = useState<PromptResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Create request payload for debouncing
    const requestPayload = useMemo(() => {
        if (!selectedTool) {
            return null;
        }

        if (selectedJsondocs.length === 0) {
            console.log('Debug: No jsondocs selected for tool:', selectedTool);
            return null;
        }

        let parsedParams = {};
        try {
            if (additionalParams.trim()) {
                parsedParams = JSON.parse(additionalParams);
            }
        } catch (err) {
            console.log('Debug: Invalid JSON params:', err);
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

        console.log('Debug: Created payload for tool:', selectedTool, payload);
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
        console.log('Debug: debouncedRequestPayload changed:', debouncedRequestPayload);
        if (debouncedRequestPayload) {
            console.log('Debug: Making request with payload:', debouncedRequestPayload);
            generatePromptWithPayload(debouncedRequestPayload);
        } else {
            // Clear results when selections are invalid
            setPromptResult(null);
            setError(null);
        }
    }, [debouncedRequestPayload]);

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

    const tabItems = [
        {
            key: 'tool-selection',
            label: (
                <Space>
                    <ToolOutlined />
                    工具选择
                </Space>
            ),
            children: (
                <div style={{ padding: '16px' }}>
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
                                style={{ width: '100%' }}
                            >
                                {tools.map(tool => (
                                    <Option key={tool.name} value={tool.name}>
                                        <Space direction="vertical" size={0}>
                                            <Text strong>{tool.name}</Text>
                                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                                {tool.description}
                                            </Text>
                                        </Space>
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item label="选择 Jsondocs">
                            <Select
                                mode="multiple"
                                value={selectedJsondocs}
                                onChange={setSelectedJsondocs}
                                placeholder="选择一个或多个 Jsondoc"
                                loading={jsondocsLoading}
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
                                        此工具期望的数据类型: {getExpectedJsondocTypes(selectedTool).join(', ') || '任意类型'}
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
                                rows={3}
                                style={{ fontFamily: 'monospace' }}
                            />
                            {selectedTool && (
                                <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                                    <Text type="secondary">
                                        默认参数: {JSON.stringify(getDefaultParamsForTool(selectedTool), null, 2)}
                                    </Text>
                                </div>
                            )}
                        </Form.Item>
                    </Form>

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
                </div>
            )
        },
        {
            key: 'prompt-result',
            label: (
                <Space>
                    <FileTextOutlined />
                    提示词结果
                </Space>
            ),
            children: promptResult ? (
                <div style={{ padding: '16px' }}>
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <Card
                            title="工具信息"
                            size="small"
                            style={{ background: '#1a1a1a', border: '1px solid #333' }}
                        >
                            <Space direction="vertical" size="small">
                                <Text><strong>名称:</strong> {promptResult.tool.name}</Text>
                                <Text><strong>描述:</strong> {promptResult.tool.description}</Text>
                                <Text><strong>模板路径:</strong> {promptResult.tool.templatePath}</Text>
                            </Space>
                        </Card>

                        <Card
                            title="输入数据"
                            size="small"
                            style={{ background: '#1a1a1a', border: '1px solid #333' }}
                        >
                            {renderCodeBlock(JSON.stringify(promptResult.input, null, 2), '200px')}
                        </Card>

                        <Card
                            title="模板变量"
                            size="small"
                            style={{ background: '#1a1a1a', border: '1px solid #333' }}
                        >
                            {Object.entries(promptResult.templateVariables).map(([key, value]) => (
                                <div key={key} style={{ marginBottom: '16px' }}>
                                    <Text strong style={{ color: '#1890ff' }}>%%{key}%%:</Text>
                                    {renderCodeBlock(value, '150px')}
                                </div>
                            ))}
                        </Card>

                        <Card
                            title="完整提示词"
                            size="small"
                            style={{ background: '#1a1a1a', border: '1px solid #333' }}
                        >
                            {renderCodeBlock(promptResult.prompt)}
                        </Card>
                    </Space>
                </div>
            ) : (
                <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#888'
                }}>
                    <FileTextOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                    <div>请先在"工具选择"标签页中选择工具和数据</div>
                </div>
            )
        },
        {
            key: 'tool-schemas',
            label: (
                <Space>
                    <DatabaseOutlined />
                    工具模式
                </Space>
            ),
            children: (
                <div style={{ padding: '16px' }}>
                    {selectedTool ? (
                        <div>
                            <Title level={5} style={{ color: '#fff' }}>
                                {selectedTool} - 输入模式
                            </Title>
                            {(() => {
                                const tool = tools.find(t => t.name === selectedTool);
                                return tool ? renderCodeBlock(JSON.stringify(tool.inputSchema, null, 2)) : null;
                            })()}
                        </div>
                    ) : (
                        <div style={{
                            padding: '40px',
                            textAlign: 'center',
                            color: '#888'
                        }}>
                            <DatabaseOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                            <div>请先选择一个工具来查看其模式</div>
                        </div>
                    )}
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
                        <BugOutlined style={{ marginRight: '8px' }} />
                        工具调试控制台
                    </Title>
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
                    color: '#fff',
                    padding: 0
                }}
            >
                <Tabs
                    items={tabItems}
                    defaultActiveKey="tool-selection"
                    style={{
                        color: '#fff',
                        minHeight: '600px'
                    }}
                />
            </Card>
        </div>
    );
};

export default RawAgentContext; 