import React, { useState, useCallback, useMemo } from 'react';
import { Button, Typography, Form, Input, InputNumber, Select, message } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { BaseActionProps } from './index';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { useChosenBrainstormIdea } from '../../hooks/useChosenBrainstormIdea';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface OutlineFormValues {
    title: string;
    requirements: string;
}

const OutlineGenerationForm: React.FC<BaseActionProps> = ({ projectId, onSuccess, onError }) => {
    const [form] = Form.useForm<OutlineFormValues>();
    const [isGenerating, setIsGenerating] = useState(false);
    const projectData = useProjectData();
    const { chosenIdea, isLoading: chosenIdeaLoading } = useChosenBrainstormIdea();

    // Get the chosen brainstorm idea artifact and data
    const { sourceArtifactId, ideaData } = useMemo(() => {
        if (!chosenIdea) return { sourceArtifactId: null, ideaData: null };

        // Use the editable artifact ID if available, otherwise use the original artifact ID
        const artifactId = chosenIdea.editableArtifactId || chosenIdea.originalArtifactId;

        // Get the artifact data
        const artifact = projectData.getArtifactById(artifactId);
        let ideaData = null;

        if (artifact) {
            try {
                if (artifact.type === 'user_input' && artifact.metadata && typeof artifact.metadata === 'object' && 'derived_data' in artifact.metadata) {
                    // User input artifact - use derived_data
                    ideaData = (artifact.metadata as any).derived_data;
                } else if (artifact.data) {
                    // Direct artifact data
                    ideaData = typeof artifact.data === 'string' ? JSON.parse(artifact.data) : artifact.data;
                }
            } catch (error) {
                console.warn('Failed to parse idea data:', error);
            }
        }

        return { sourceArtifactId: artifactId, ideaData };
    }, [chosenIdea, projectData]);

    // Handle outline generation
    const handleGenerateOutline = useCallback(async (values: OutlineFormValues) => {
        if (!sourceArtifactId) {
            message.error('未找到选中的创意');
            return;
        }

        setIsGenerating(true);
        try {
            // Call the outline settings generation API
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    projectId,
                    message: `请基于创意生成大纲设置。源创意ID: ${sourceArtifactId}，标题: ${values.title}，要求: ${values.requirements || '无特殊要求'}`
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to generate outline: ${response.status}`);
            }

            // The response will be handled by the streaming framework
            message.success('大纲生成已启动');
            onSuccess?.();
        } catch (error) {
            console.error('Error generating outline:', error);
            const errorMessage = `生成大纲失败: ${error instanceof Error ? error.message : '未知错误'}`;
            message.error(errorMessage);
            onError?.(error instanceof Error ? error : new Error(errorMessage));
        } finally {
            setIsGenerating(false);
        }
    }, [sourceArtifactId, projectId, onSuccess, onError]);

    // Show loading state while chosen idea is loading
    if (chosenIdeaLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '24px' }}>
                <Text type="secondary">加载选中的创意...</Text>
            </div>
        );
    }

    // Show error if no chosen idea found
    if (!chosenIdea || !sourceArtifactId) {
        return (
            <div style={{ textAlign: 'center', padding: '24px' }}>
                <Text type="secondary">请先选择一个创意</Text>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px' }}>
            <Title level={4} style={{ marginBottom: '24px', color: '#fff', textAlign: 'center' }}>
                <FileTextOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                生成大纲设置
            </Title>

            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                {/* Show selected idea info */}
                <div style={{
                    background: '#2a2a2a',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '24px',
                    border: '1px solid #434343'
                }}>
                    <Text strong style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>
                        选中的创意:
                    </Text>
                    <Text style={{ color: '#ccc', fontSize: '14px' }}>
                        {ideaData?.title || '创意标题'}
                    </Text>
                    {ideaData?.body && (
                        <div style={{ marginTop: '8px' }}>
                            <Text style={{ color: '#aaa', fontSize: '12px', lineHeight: '1.4' }}>
                                {ideaData.body.length > 200
                                    ? `${ideaData.body.substring(0, 200)}...`
                                    : ideaData.body
                                }
                            </Text>
                        </div>
                    )}
                </div>

                {/* Outline generation form */}
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleGenerateOutline}
                    initialValues={{
                        title: ideaData?.title || '',
                        requirements: ''
                    }}
                >
                    <Form.Item
                        label={<Text style={{ color: '#fff' }}>大纲标题</Text>}
                        name="title"
                        rules={[
                            { required: true, message: '请输入大纲标题' },
                            { min: 2, message: '标题至少2个字符' },
                            { max: 50, message: '标题不能超过50个字符' }
                        ]}
                    >
                        <Input
                            placeholder="输入大纲标题"
                            style={{
                                background: '#1a1a1a',
                                borderColor: '#434343',
                                color: '#fff'
                            }}
                        />
                    </Form.Item>

                    <Form.Item
                        label={<Text style={{ color: '#fff' }}>特殊要求</Text>}
                        name="requirements"
                    >
                        <TextArea
                            placeholder="描述对大纲的特殊要求，比如特定的情节设置、角色关系、风格偏好等..."
                            rows={4}
                            style={{
                                background: '#1a1a1a',
                                borderColor: '#434343',
                                color: '#fff'
                            }}
                        />
                    </Form.Item>

                    <Form.Item style={{ marginTop: '32px', textAlign: 'center' }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            size="large"
                            loading={isGenerating}
                            style={{
                                width: '200px',
                                height: '48px',
                                fontSize: '16px',
                                borderRadius: '8px'
                            }}
                        >
                            {isGenerating ? '生成中...' : '生成大纲设置'}
                        </Button>
                    </Form.Item>
                </Form>
            </div>
        </div>
    );
};

export default OutlineGenerationForm; 