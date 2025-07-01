import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Typography, Card, Form, InputNumber, Select, Input, message, Space, Divider, Row, Col, Tag } from 'antd';
import { FileTextOutlined, EyeOutlined, ArrowLeftOutlined, CheckCircleOutlined, BookOutlined, DoubleRightOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { ArtifactEditor } from '../shared/ArtifactEditor';
import { BRAINSTORM_IDEA_FIELDS } from '../shared/fieldConfigs';
import { useOutlineDescendants } from '../../hooks/useOutlineDescendants';

const { Title, Text } = Typography;

interface SingleBrainstormIdeaEditorProps {
    originalArtifactId: string;
    originalArtifactPath: string;
    editableArtifactId: string;
    index: number;
    isFromCollection: boolean;
    onViewOriginalIdeas?: () => void;
}

export const SingleBrainstormIdeaEditor: React.FC<SingleBrainstormIdeaEditorProps> = ({
    originalArtifactId,
    originalArtifactPath,
    editableArtifactId,
    index,
    isFromCollection,
    onViewOriginalIdeas
}) => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const projectData = useProjectData();
    const [form] = Form.useForm();

    // Check for outline descendants
    const { hasOutlineDescendants, latestOutline, isLoading: outlineLoading } = useOutlineDescendants(editableArtifactId);

    // Get the editable artifact data to display title
    const editableArtifact = projectData.getArtifactById(editableArtifactId);
    let ideaTitle = '选中的创意';

    if (editableArtifact) {
        try {
            const data = JSON.parse(editableArtifact.data);
            ideaTitle = data.title || `创意 ${index + 1}`;
        } catch (error) {
            console.warn('Failed to parse editable artifact data:', error);
        }
    }

    // Handle navigation to outline
    const handleViewOutline = useCallback(() => {
        if (latestOutline) {
            // Scroll to the outline section
            const outlineSection = document.getElementById('story-outline');
            if (outlineSection) {
                outlineSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [latestOutline]);

    // Outline generation mutation
    const outlineGenerationMutation = useMutation({
        mutationFn: async (params: {
            sourceArtifactId: string;
            totalEpisodes: number;
            episodeDuration: number;
            selectedPlatform: string;
            selectedGenrePaths: string[][];
            requirements?: string;
        }) => {
            const agentRequest = {
                userRequest: `基于artifact ID ${params.sourceArtifactId} 的故事创意，生成详细的叙事大纲。要求：${params.totalEpisodes}集，每集${params.episodeDuration}分钟，平台${params.selectedPlatform}，类型${params.selectedGenrePaths.map(path => path.join(' > ')).join(', ')}${params.requirements ? `，其他要求：${params.requirements}` : ''}`,
                projectId: projectId!
            };

            const response = await fetch(`/api/projects/${projectId}/agent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer debug-auth-token-script-writer-dev`
                },
                body: JSON.stringify(agentRequest)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate outline');
            }

            return response.json();
        },
        onSuccess: () => {
            message.success('大纲生成已开始！请查看下方或浏览项目页面查看进度。');
            form.resetFields();
        },
        onError: (error) => {
            message.error(`生成大纲失败：${error.message}`);
        }
    });

    const handleGenerateOutline = () => {
        form.validateFields().then((values) => {
            outlineGenerationMutation.mutate({
                sourceArtifactId: editableArtifactId,
                totalEpisodes: values.totalEpisodes,
                episodeDuration: values.episodeDuration,
                selectedPlatform: values.platform,
                selectedGenrePaths: values.genrePaths || [['都市', '爽文']],
                requirements: values.requirements
            });
        }).catch((error) => {
            console.warn('Form validation failed:', error);
        });
    };

    // Render compact mode if outline descendants exist
    if (hasOutlineDescendants && latestOutline) {
        return (
            <div className="single-brainstorm-idea-editor-compact" style={{ marginBottom: '16px' }}>
                <Card
                    size="small"
                    style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #722ed1',
                        borderRadius: '6px'
                    }}
                    styles={{ body: { padding: '16px' } }}
                >
                    {/* Compact Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircleOutlined style={{ color: '#722ed1', fontSize: '16px' }} />
                            <div>
                                <Title level={5} style={{ margin: 0, color: '#722ed1', fontSize: '14px' }}>
                                    {ideaTitle}
                                </Title>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    {isFromCollection && `• 灵感来自集合第 ${index + 1} 个想法`}
                                </Text>
                            </div>
                        </div>

                        {onViewOriginalIdeas && (
                            <Button
                                type="text"
                                icon={<DoubleRightOutlined />}
                                onClick={onViewOriginalIdeas}
                                size="small"
                                style={{ color: '#1890ff' }}
                            >
                                查看所有创意
                            </Button>
                        )}
                    </div>

                    {/* Compact Content */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ flex: 1 }}>
                            <Space direction="vertical" size="small">
                                <div>
                                    <Tag color="purple" icon={<BookOutlined />}>
                                        {latestOutline.title || '时序大纲'}
                                    </Tag>
                                </div>

                            </Space>
                        </div>

                        <Button
                            type="primary"
                            icon={<BookOutlined />}
                            onClick={handleViewOutline}
                            style={{
                                background: 'linear-gradient(100deg, #722ed1, #9254de)',
                                border: 'none',
                                borderRadius: '4px'
                            }}
                        >
                            查看时序大纲
                        </Button>
                    </div>

                    {/* Read-only preview of the idea */}
                    <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#0f0f0f', borderRadius: '4px', border: '1px solid #333' }}>

                        {editableArtifact && (() => {
                            try {
                                const data = JSON.parse(editableArtifact.data);
                                return (
                                    <div style={{ fontSize: '12px', lineHeight: 1.4 }}>
                                        {data.title && (
                                            <div style={{ marginBottom: '6px' }}>
                                                <span style={{ color: '#888', marginRight: '8px' }}>标题:</span>
                                                <span style={{ color: '#fff' }}>{data.title}</span>
                                            </div>
                                        )}
                                        {data.body && (
                                            <div>
                                                <span style={{ color: '#888', marginRight: '8px' }}>内容:</span>
                                                <span style={{ color: '#ccc' }}>{data.body.substring(0, 100)}{data.body.length > 100 ? '...' : ''}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            } catch (error) {
                                return <div style={{ color: '#888', fontSize: '12px' }}>无法解析创意内容</div>;
                            }
                        })()}
                    </div>
                </Card>
            </div>
        );
    }

    // Normal editing mode
    return (
        <div className="single-brainstorm-idea-editor" style={{ marginBottom: '24px' }}>
            <Card
                style={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #52c41a',
                    borderRadius: '8px'
                }}
                styles={{ body: { padding: '24px' } }}
            >
                {/* Header */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '6px',
                                height: '32px',
                                backgroundColor: '#52c41a',
                                borderRadius: '3px'
                            }} />
                            <div>
                                <Title level={4} style={{ margin: 0, color: '#52c41a' }}>
                                    ✏️ 正在编辑创意
                                </Title>
                                <Text type="secondary" style={{ fontSize: '14px' }}>
                                    {ideaTitle} {isFromCollection && `• 来自集合第 ${index + 1} 个想法`}
                                </Text>
                            </div>
                        </div>

                        {onViewOriginalIdeas && (
                            <Button
                                type="text"
                                icon={<EyeOutlined />}
                                onClick={onViewOriginalIdeas}
                                style={{ color: '#1890ff' }}
                            >
                                查看所有创意
                            </Button>
                        )}
                    </div>
                </div>

                {/* Artifact Editor */}
                <div style={{ marginBottom: '24px' }}>
                    <ArtifactEditor
                        artifactId={editableArtifactId}
                        fields={BRAINSTORM_IDEA_FIELDS}
                        statusLabel="📝 已编辑版本"
                        statusColor="green"
                    />
                </div>

                <Divider style={{ borderColor: '#434343', margin: '24px 0' }} />

                {/* Configuration Form */}
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        totalEpisodes: 60,
                        episodeDuration: 2,
                        platform: '抖音',
                        genrePaths: [['都市', '爽文']],
                        requirements: ''
                    }}
                    style={{ marginBottom: '24px' }}
                >
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item
                                name="totalEpisodes"
                                label="总集数"
                                rules={[{ required: true, message: '请输入总集数' }]}
                            >
                                <InputNumber
                                    min={6}
                                    max={200}
                                    placeholder="请输入总集数"
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item
                                name="episodeDuration"
                                label="每集时长（分钟）"
                                rules={[{ required: true, message: '请输入每集时长' }]}
                            >
                                <InputNumber
                                    min={1}
                                    max={30}
                                    placeholder="请输入每集时长"
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item
                                name="platform"
                                label="目标平台"
                                rules={[{ required: true, message: '请选择目标平台' }]}
                            >
                                <Select placeholder="请选择目标平台">
                                    <Select.Option value="抖音">抖音</Select.Option>
                                    <Select.Option value="快手">快手</Select.Option>
                                    <Select.Option value="小红书">小红书</Select.Option>
                                    <Select.Option value="B站">B站</Select.Option>
                                    <Select.Option value="通用">通用</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        name="requirements"
                        label="其他要求（可选）"
                    >
                        <Input.TextArea
                            rows={3}
                            placeholder="如：加强悬疑色彩、突出女性角色、适合年轻观众等..."
                        />
                    </Form.Item>
                </Form>

                {/* Action Button */}
                <div style={{ textAlign: 'center' }}>
                    <Button
                        type="primary"
                        size="large"
                        icon={<FileTextOutlined />}
                        onClick={handleGenerateOutline}
                        loading={outlineGenerationMutation.isPending}
                        style={{
                            background: 'linear-gradient(100deg, #40a9ff, rgb(22, 106, 184))',
                            border: 'none',
                            borderRadius: '6px',
                            padding: "24px 32px",
                            fontSize: "18px",
                            height: 'auto'
                        }}
                    >
                        用这个灵感继续 &gt;&gt;
                    </Button>
                    <br />
                    <Text type="secondary" style={{ fontSize: '14px', marginTop: '8px', display: 'block' }}>
                        生成叙事大纲
                    </Text>
                </div>
            </Card>
        </div>
    );
}; 