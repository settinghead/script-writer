import React, { useState, useRef } from 'react';
import { Button, Card, Typography, Spin, Alert, Flex, Empty, Input, Form, Space, Divider } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const streamingQueryKey = ['agent-streaming-ideation-test'];

interface StreamingState {
    status: 'idle' | 'streaming' | 'completed' | 'error';
    ideas: any[] | null;
    resultIds: string[];
    error: string | null;
    agentMessages: string[];
}

interface AgentIdeationRequest {
    userRequest: string;
    platform?: string;
    genre?: string;
    other_requirements?: string;
}

const useStreamingAgentIdeation = () => {
    const queryClient = useQueryClient();
    const abortControllerRef = useRef<AbortController | null>(null);

    const startStreaming = (input: AgentIdeationRequest) => {
        // Abort previous request if it exists
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Initialize streaming state
        queryClient.setQueryData<StreamingState>(streamingQueryKey, {
            status: 'streaming',
            ideas: null,
            resultIds: [],
            error: null,
            agentMessages: [],
        });

        fetch('/api/ideation/agent/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(input),
            signal: controller.signal,
        }).then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Handle the streaming response
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body reader available');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            const readStream = () => {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        queryClient.setQueryData<StreamingState>(streamingQueryKey, (oldData) => ({
                            ...(oldData!),
                            status: 'completed',
                        }));
                        abortControllerRef.current = null;
                        return;
                    }

                    // Decode the chunk and add to buffer
                    buffer += decoder.decode(value, { stream: true });

                    // Process complete lines
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));

                                queryClient.setQueryData<StreamingState>(streamingQueryKey, (oldData) => {
                                    if (!oldData) return oldData;

                                    const newData = { ...oldData };

                                    switch (data.type) {
                                        case 'chunk':
                                            // Update ideas with streaming chunk
                                            newData.ideas = data.data;
                                            break;
                                        case 'resultId':
                                            newData.resultIds = [...newData.resultIds, data.resultId];
                                            break;
                                        case 'complete':
                                            newData.ideas = data.results.flat();
                                            newData.status = 'completed';
                                            break;
                                        case 'error':
                                            newData.error = data.error;
                                            newData.status = 'error';
                                            break;
                                        default:
                                            // Handle other message types (like status updates)
                                            if (data.message) {
                                                newData.agentMessages = [...newData.agentMessages, data.message];
                                            }
                                    }

                                    return newData;
                                });
                            } catch (e) {
                                console.error('Error parsing SSE data:', e);
                            }
                        } else if (line.startsWith('event: done')) {
                            queryClient.setQueryData<StreamingState>(streamingQueryKey, (oldData) => ({
                                ...(oldData!),
                                status: 'completed',
                            }));
                            abortControllerRef.current = null;
                            return;
                        }
                    }

                    readStream(); // Continue reading
                }).catch(err => {
                    if (err.name === 'AbortError') {
                        console.log('Streaming stopped by user.');
                        return;
                    }
                    console.error('Stream reading error:', err);
                    queryClient.setQueryData<StreamingState>(streamingQueryKey, (oldData) => ({
                        ...(oldData!),
                        status: 'error',
                        error: 'Stream reading failed',
                    }));
                });
            };

            readStream();
        }).catch(err => {
            if (err.name === 'AbortError') {
                console.log('Fetch aborted by user.');
                return;
            }
            console.error('Fetch error:', err);
            queryClient.setQueryData<StreamingState>(streamingQueryKey, (oldData) => ({
                ...(oldData!),
                status: 'error',
                error: err.message,
            }));
        });
    };

    const stopStreaming = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            queryClient.setQueryData<StreamingState>(streamingQueryKey, (oldData) => ({
                ...(oldData!),
                status: 'idle'
            }));
        }
    };

    return { startStreaming, stopStreaming };
};

const StreamingIdeationTestPage: React.FC = () => {
    const [form] = Form.useForm();
    const { startStreaming, stopStreaming } = useStreamingAgentIdeation();

    const { data } = useQuery<StreamingState>({
        queryKey: streamingQueryKey,
        queryFn: () => Promise.resolve({
            status: 'idle',
            ideas: null,
            resultIds: [],
            error: null,
            agentMessages: []
        }),
        initialData: {
            status: 'idle',
            ideas: null,
            resultIds: [],
            error: null,
            agentMessages: []
        },
        staleTime: Infinity,
        gcTime: Infinity,
    });

    const { status, ideas, resultIds, error, agentMessages } = data;

    const handleStart = () => {
        const values = form.getFieldsValue();

        // Hardcode userRequest and dynamically insert platform/genre if they exist.
        const userRequest = `I need to create story ideas for ${values.platform || 'social media'} videos. The genre should be ${values.genre || 'any'}. The main story is about a modern CEO who accidentally travels back to ancient times, becomes a fallen noble family's young master, uses modern knowledge for business and court intrigue, eventually becomes incredibly wealthy and wins the heart of a beautiful woman. Keywords should include business warfare, political schemes, and face-slapping moments. The style should be fast-paced with many plot twists.`;

        const request: AgentIdeationRequest = {
            userRequest,
            platform: values.platform?.trim(),
            genre: values.genre?.trim(),
            other_requirements: values.other_requirements?.trim(),
        };

        startStreaming(request);
    };

    const handleReset = () => {
        form.resetFields();
        // Set some example values
        form.setFieldsValue({
            platform: "抖音",
            genre: "穿越, 爽文",
        });
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <Card title={<Title level={4}>智能创意生成测试 (Agent架构)</Title>}>
                <Paragraph>
                    使用AI Agent架构生成创意内容。Agent将自动调用合适的工具来生成故事创意。
                </Paragraph>

                <Form
                    form={form}
                    layout="vertical"
                    style={{ marginBottom: '20px' }}
                >
                    <Divider orientation="left">可指定参数</Divider>

                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Form.Item label="目标平台" name="platform">
                            <Input placeholder="如：抖音、快手、小红书等" />
                        </Form.Item>

                        <Form.Item label="故事类型" name="genre">
                            <Input placeholder="如：虐恋、穿越、爽文等" />
                        </Form.Item>

                        <Form.Item label="其他要求" name="other_requirements">
                            <TextArea rows={2} placeholder="其他特殊要求..." />
                        </Form.Item>
                    </Space>
                </Form>

                <Flex gap="small" style={{ marginBottom: '20px' }}>
                    <Button
                        type="primary"
                        onClick={handleStart}
                        disabled={status === 'streaming'}
                        loading={status === 'streaming'}
                    >
                        {status === 'streaming' ? '生成中...' : '开始生成'}
                    </Button>
                    <Button
                        onClick={stopStreaming}
                        disabled={status !== 'streaming'}
                    >
                        停止
                    </Button>
                    <Button onClick={handleReset}>
                        填充示例
                    </Button>
                </Flex>

                {/* Agent Messages */}
                {agentMessages.length > 0 && (
                    <Card size="small" title="Agent状态" style={{ marginBottom: '20px' }}>
                        {agentMessages.map((message, index) => (
                            <div key={index} style={{ marginBottom: '4px' }}>
                                <Text type="secondary">{message}</Text>
                            </div>
                        ))}
                    </Card>
                )}

                {/* Result IDs */}
                {resultIds.length > 0 && (
                    <Card size="small" title="生成结果ID" style={{ marginBottom: '20px' }}>
                        <Text code>{resultIds.join(', ')}</Text>
                    </Card>
                )}

                <div style={{ marginTop: '20px' }}>
                    <Spin spinning={status === 'streaming'} tip="Agent正在工作中...">
                        {status === 'error' && (
                            <Alert message={error} type="error" showIcon style={{ marginBottom: '20px' }} />
                        )}

                        <div style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {ideas && ideas.length > 0 ? (
                                <Flex wrap="wrap" gap="middle">
                                    {ideas.map((idea, index) => (
                                        <Card
                                            key={index}
                                            title={idea.title || 'Generating Title...'}
                                            style={{ flex: '1 1 300px', minWidth: '300px' }}
                                            loading={!idea.body}
                                        >
                                            <Paragraph style={{ minHeight: '100px' }}>
                                                {idea.body}
                                            </Paragraph>
                                        </Card>
                                    ))}
                                </Flex>
                            ) : (
                                <>
                                    {status === 'completed' && <Empty description="没有生成任何创意" />}
                                    {status === 'idle' && <Empty description="点击'开始生成'来创建创意" />}
                                </>
                            )}
                        </div>
                    </Spin>
                </div>
            </Card>
        </div>
    );
};

export default StreamingIdeationTestPage; 