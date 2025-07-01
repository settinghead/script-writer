import React, { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Typography, Card, Form, InputNumber, Select, Input, message, Space, Divider, Row, Col, Tag, Spin } from 'antd';
import { FileTextOutlined, EyeOutlined, ArrowLeftOutlined, CheckCircleOutlined, BookOutlined, DoubleRightOutlined, LoadingOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { ArtifactEditor } from '../../transform-artifact-framework/ArtifactEditor';
import { BRAINSTORM_IDEA_FIELDS } from '../shared/MIGUANG_APP_FIELDS';
import { useOutlineDescendants } from '../../hooks/useOutlineDescendants';

const { Title, Text } = Typography;

interface SingleBrainstormIdeaEditorProps {
    onViewOriginalIdeas?: () => void;
}

export const SingleBrainstormIdeaEditor: React.FC<SingleBrainstormIdeaEditorProps> = ({
    onViewOriginalIdeas
}) => {
    const { projectId } = useParams<{ projectId: string }>();
    const projectData = useProjectData();
    const [form] = Form.useForm();
    const [isCreatingHumanTransform, setIsCreatingHumanTransform] = useState(false);

    // Find the editable brainstorm idea artifact and preview artifact using useMemo
    const { editableArtifactId, previewArtifactId, isEditable } = useMemo(() => {
        // Get all brainstorm idea artifacts that are user_input type
        const brainstormIdeaArtifacts = projectData.artifacts.filter(artifact =>
            (artifact.schema_type === 'brainstorm_idea' || artifact.type === 'brainstorm_idea') &&
            artifact.origin_type === 'user_input'
        );

        // Find the one that doesn't have descendants (no transforms using it as input)
        const editableArtifacts = brainstormIdeaArtifacts.filter(artifact => {
            // Check if this artifact is used as input in any transform
            const hasDescendants = projectData.transformInputs.some(input =>
                input.artifact_id === artifact.id
            );
            return !hasDescendants;
        });

        // If multiple editable artifacts exist, take the latest one
        if (editableArtifacts.length > 0) {
            editableArtifacts.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            return {
                editableArtifactId: editableArtifacts[0].id,
                previewArtifactId: editableArtifacts[0].id,
                isEditable: true
            };
        }

        // If no editable artifacts, find the latest brainstorm idea for preview
        if (brainstormIdeaArtifacts.length > 0) {
            brainstormIdeaArtifacts.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            return {
                editableArtifactId: null,
                previewArtifactId: brainstormIdeaArtifacts[0].id,
                isEditable: false
            };
        }

        return {
            editableArtifactId: null,
            previewArtifactId: null,
            isEditable: false
        };
    }, [projectData.artifacts, projectData.transformInputs]);

    // Check for outline descendants (only if we have an editable artifact)
    const { hasOutlineDescendants, latestOutline, isLoading: outlineLoading } = useOutlineDescendants(editableArtifactId || '');


    // Get the preview artifact data to display title
    const previewArtifact = useMemo(() => {
        if (!previewArtifactId) return null;
        return projectData.getArtifactById(previewArtifactId);
    }, [previewArtifactId, projectData.getArtifactById]);


    const ideaTitle = useMemo(() => {
        if (!previewArtifact) return '选中的创意';
        try {
            const data = JSON.parse(previewArtifact.data);
            return data.title || '当前创意';
        } catch (error) {
            console.warn('Failed to parse preview artifact data:', error);
            return '当前创意';
        }
    }, [previewArtifact]);





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
        if (isCreatingHumanTransform || !editableArtifactId) return;

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


    // Handle navigation to outline
    const handleViewOutline = useCallback(() => {
        if (latestOutline && !isCreatingHumanTransform) {
            // Scroll to the outline section
            const outlineSection = document.getElementById('story-outline');
            if (outlineSection) {
                outlineSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [latestOutline, isCreatingHumanTransform]);


    // If no artifacts at all, don't render the component
    if (!previewArtifactId) {
        return null;
    }


    // Render non-editable preview mode if not editable
    if (!isEditable) {
        return (
            <div className="single-brainstorm-idea-preview" style={{ marginBottom: '16px' }}>
                <Card
                    size="small"
                    style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #555',
                        borderRadius: '6px',
                        opacity: 0.7
                    }}
                    styles={{ body: { padding: '16px' } }}
                >
                    {/* Preview Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <EyeOutlined style={{ color: '#888', fontSize: '16px' }} />
                            <div>
                                <Title level={5} style={{ margin: 0, color: '#888', fontSize: '14px' }}>
                                    {ideaTitle}
                                </Title>
                                <Text type="secondary" style={{ fontSize: '12px', color: '#666' }}>
                                    已经进入大纲阶段，无法再编辑初始灵感
                                </Text>
                            </div>
                        </div>
                    </div>

                    {/* Preview Content */}
                    <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#0f0f0f', borderRadius: '4px', border: '1px solid #333' }}>
                        {previewArtifact && (() => {
                            try {
                                const data = JSON.parse(previewArtifact.data);
                                return (
                                    <div style={{ fontSize: '12px', lineHeight: 1.4 }}>
                                        {data.title && (
                                            <div style={{ marginBottom: '6px' }}>
                                                <span style={{ color: '#666', marginRight: '8px' }}>标题:</span>
                                                <span style={{ color: '#aaa' }}>{data.title}</span>
                                            </div>
                                        )}
                                        {data.body && (
                                            <div>
                                                <span style={{ color: '#666', marginRight: '8px' }}>内容:</span>
                                                <span style={{ color: '#888' }}>{data.body}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            } catch (error) {
                                return <div style={{ color: '#666', fontSize: '12px' }}>无法解析创意内容</div>;
                            }
                        })()}
                    </div>

                    {/* Navigation Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Button
                            type="text"
                            icon={<ArrowLeftOutlined />}
                            onClick={onViewOriginalIdeas}
                            style={{ color: '#1890ff' }}
                            disabled={!onViewOriginalIdeas}
                        >
                            返回头脑风暴
                        </Button>

                        {hasOutlineDescendants && (
                            <Button
                                type="text"
                                icon={<BookOutlined />}
                                onClick={handleViewOutline}
                                style={{ color: '#1890ff' }}
                            >
                                查看时序大纲
                            </Button>
                        )}
                    </div>
                </Card>
            </div>
        );
    }

    // Render compact mode if outline descendants exist (only for editable artifacts)
    if (hasOutlineDescendants && latestOutline) {
        return (
            <div className="single-brainstorm-idea-editor-compact" style={{ marginBottom: '16px', position: 'relative' }}>
                {/* Loading overlay for compact mode */}
                {isCreatingHumanTransform && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                        borderRadius: '6px'
                    }}>
                        <Spin
                            indicator={<LoadingOutlined style={{ fontSize: 24, color: '#722ed1' }} spin />}
                            tip="创建编辑版本中..."
                        >
                            <div style={{ padding: '20px' }} />
                        </Spin>
                    </div>
                )}

                <Card
                    size="small"
                    style={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #722ed1',
                        borderRadius: '6px',
                        opacity: isCreatingHumanTransform ? 0.7 : 1,
                        pointerEvents: isCreatingHumanTransform ? 'none' : 'auto'
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
                                    当前可编辑的创意
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
                                disabled={isCreatingHumanTransform}
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
                            disabled={isCreatingHumanTransform}
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

                        {previewArtifact && (() => {
                            try {
                                const data = JSON.parse(previewArtifact.data);
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
        <div className="single-brainstorm-idea-editor" style={{ marginBottom: '24px', position: 'relative' }}>
            {/* Loading overlay for normal mode */}
            {isCreatingHumanTransform && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    borderRadius: '8px'
                }}>
                    <Spin
                        indicator={<LoadingOutlined style={{ fontSize: 32, color: '#52c41a' }} spin />}
                        tip="创建编辑版本中..."
                    >
                        <div style={{ padding: '40px' }} />
                    </Spin>
                </div>
            )}

            <Card
                style={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #52c41a',
                    borderRadius: '8px',
                    opacity: isCreatingHumanTransform ? 0.7 : 1,
                    pointerEvents: isCreatingHumanTransform ? 'none' : 'auto'
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
                                    ✏️ 编辑创意
                                </Title>
                            </div>
                        </div>

                        {onViewOriginalIdeas && (
                            <Button
                                type="text"
                                icon={<EyeOutlined />}
                                onClick={onViewOriginalIdeas}
                                style={{ color: '#1890ff' }}
                                disabled={isCreatingHumanTransform}
                            >
                                查看所有创意
                            </Button>
                        )}
                    </div>
                </div>

                {/* Artifact Editor */}
                {editableArtifactId && (
                    <div style={{ marginBottom: '24px' }}>
                        <ArtifactEditor
                            artifactId={editableArtifactId}
                            fields={BRAINSTORM_IDEA_FIELDS}
                            statusColor="green"
                        />
                    </div>
                )}
                <Divider style={{ borderColor: '#434343', margin: '24px 0' }} />

                {/* Configuration Form */}
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        totalEpisodes: 60,
                        episodeDuration: 2,
                        platform: '抖音',
                        requirements: ''
                    }}
                    style={{ marginBottom: '24px' }}
                    disabled={isCreatingHumanTransform}
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
                                    disabled={isCreatingHumanTransform}
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
                                    disabled={isCreatingHumanTransform}
                                />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item
                                name="platform"
                                label="目标平台"
                                rules={[{ required: true, message: '请选择目标平台' }]}
                            >
                                <Select placeholder="请选择目标平台" disabled={isCreatingHumanTransform}>
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
                            disabled={isCreatingHumanTransform}
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
                        disabled={isCreatingHumanTransform}
                        style={{
                            background: 'linear-gradient(100deg, #40a9ff, rgb(22, 106, 184))',
                            border: 'none',
                            borderRadius: '6px',
                            padding: "24px 32px",
                            fontSize: "18px",
                            height: 'auto'
                        }}
                    >
                        继续生成叙事大纲 &gt;&gt;
                    </Button>
                    <br />

                </div>
            </Card>
        </div>
    );
}; 