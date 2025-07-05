import React, { useState, useCallback, useMemo } from 'react';
import { Card, Button, Space, Typography, message, Spin } from 'antd';
import { BulbOutlined, EditOutlined } from '@ant-design/icons';
import { useProjectData } from '../contexts/ProjectDataContext';
import { ArtifactEditor } from '../transform-artifact-framework/ArtifactEditor';
import type { BrainstormToolInput } from '../../common/schemas/artifacts';

const { Text, Title } = Typography;

interface ProjectCreationFormProps {
    projectId: string;
    onCreated?: (artifactId: string) => void;
}

const BrainstormCreationSection: React.FC<{ projectId: string; onCreated?: (artifactId: string) => void }> = ({
    projectId,
    onCreated
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const projectData = useProjectData();

    const handleCreateBrainstormInput = useCallback(async () => {
        if (isCreating) return;

        setIsCreating(true);
        try {
            // Create empty brainstorm input artifact
            const response = await fetch('/api/artifacts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    projectId,
                    type: 'brainstorm_tool_input_schema',
                    data: {
                        initialInput: true // Explicitly mark as initial input to bypass validation
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to create brainstorm input: ${response.status}`);
            }

            const newArtifact = await response.json();
            message.success('头脑风暴输入已创建！');
            onCreated?.(newArtifact.id);
        } catch (error) {
            console.error('Error creating brainstorm input:', error);
            message.error(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setIsCreating(false);
        }
    }, [projectId, onCreated, isCreating]);

    return (
        <div style={{ textAlign: 'center', padding: '24px 12px' }}>
            <Button
                type="primary"
                size="large"
                icon={<BulbOutlined />}
                onClick={handleCreateBrainstormInput}
                loading={isCreating}
                style={{
                    height: '120px',
                    width: '100%',
                    minWidth: '200px',
                    fontSize: '16px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #faad14, #ffc53d)',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(250, 173, 20, 0.3)'
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '24px' }}>💡</div>
                    <div>使用头脑风暴</div>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>
                        通过AI辅助生成创意想法
                    </div>
                </div>
            </Button>
        </div>
    );
};

const ManualCreationSection: React.FC<{ projectId: string; onCreated?: (artifactId: string) => void }> = ({
    projectId,
    onCreated
}) => {
    return (
        <div style={{ textAlign: 'center', padding: '24px 12px' }}>
            <Button
                size="large"
                icon={<EditOutlined />}
                disabled
                style={{
                    height: '120px',
                    width: '100%',
                    minWidth: '200px',
                    fontSize: '16px',
                    borderRadius: '12px',
                    borderColor: '#434343',
                    color: '#8c8c8c'
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '24px' }}>📝</div>
                    <div>手动输入素材</div>
                    <div style={{ fontSize: '12px', opacity: 0.6 }}>
                        即将推出...
                    </div>
                </div>
            </Button>
        </div>
    );
};

const BrainstormEditingSection: React.FC<{
    projectId: string;
    brainstormArtifact: any;
    onCreated?: (artifactId: string) => void
}> = ({
    projectId,
    brainstormArtifact,
    onCreated
}) => {
        // Field configuration for the brainstorm input form
        const brainstormFields = [
            { field: 'platform', component: 'input' as const, placeholder: '目标平台 (如: 抖音, 快手, 小红书)' },
            { field: 'genre', component: 'input' as const, placeholder: '故事类型 (如: 现代甜宠, 古装复仇)' },
            { field: 'other_requirements', component: 'textarea' as const, rows: 3, placeholder: '其他要求 (角色设定、情节要求、风格偏好等...)' },
            { field: 'numberOfIdeas', component: 'input' as const, placeholder: '创意数量 (1-4)' }
        ];

        return (
            <div style={{ padding: '24px' }}>
                <Title level={4} style={{ marginBottom: '24px', color: '#fff', textAlign: 'center' }}>
                    <BulbOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                    配置头脑风暴参数
                </Title>

                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <ArtifactEditor
                        artifactId={brainstormArtifact.id}
                        fields={brainstormFields}
                        className="brainstorm-input-editor"
                        onSaveSuccess={() => {
                            message.success('参数已保存');
                        }}
                    />

                    <div style={{ marginTop: '24px', textAlign: 'center' }}>
                        <Button
                            type="primary"
                            size="large"
                            style={{
                                width: '200px',
                                height: '48px',
                                fontSize: '16px',
                                borderRadius: '8px'
                            }}
                            onClick={() => {
                                // TODO: Trigger brainstorm agent with the artifact data
                                message.info('即将启动头脑风暴...');
                            }}
                        >
                            开始头脑风暴
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

export const ProjectCreationForm: React.FC<ProjectCreationFormProps> = ({
    projectId,
    onCreated
}) => {
    const projectData = useProjectData();

    // Check if project has brainstorm input artifacts
    const brainstormArtifact = useMemo(() => {
        if (!projectData.artifacts || projectData.artifacts.length === 0) {
            return null;
        }

        // Look for brainstorm_tool_input_schema artifacts
        return projectData.artifacts.find(artifact =>
            artifact.type === 'brainstorm_tool_input_schema'
        );
    }, [projectData.artifacts]);

    // Show loading state while project data is loading
    if (projectData.isLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '48px' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px' }}>
                    <Text type="secondary">加载项目信息...</Text>
                </div>
            </div>
        );
    }

    // If brainstorm artifact exists, show editing interface
    if (brainstormArtifact) {
        return (
            <Card
                title="编辑头脑风暴参数"
                style={{
                    maxWidth: '800px',
                    margin: '0 auto',
                    background: '#1a1a1a',
                    borderColor: '#333'
                }}
                headStyle={{
                    background: '#1a1a1a',
                    borderBottom: '1px solid #333',
                    color: '#fff'
                }}
                bodyStyle={{ background: '#1a1a1a' }}
            >
                <BrainstormEditingSection
                    projectId={projectId}
                    brainstormArtifact={brainstormArtifact}
                    onCreated={onCreated}
                />
            </Card>
        );
    }

    // Show initial creation buttons
    return (
        <Card
            title="选择创建方式"
            style={{
                maxWidth: '800px',
                margin: '0 auto',
                background: '#1a1a1a',
                borderColor: '#333'
            }}
            headStyle={{
                background: '#1a1a1a',
                borderBottom: '1px solid #333',
                color: '#fff'
            }}
            bodyStyle={{ background: '#1a1a1a' }}
        >
            <div style={{ padding: '20px 0' }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: '32px', textAlign: 'center' }}>
                    选择您希望如何开始创建项目
                </Text>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px',
                    maxWidth: '640px',
                    margin: '0 auto'
                }}>
                    <BrainstormCreationSection
                        projectId={projectId}
                        onCreated={onCreated}
                    />
                    <ManualCreationSection
                        projectId={projectId}
                        onCreated={onCreated}
                    />
                </div>
            </div>
        </Card>
    );
}; 